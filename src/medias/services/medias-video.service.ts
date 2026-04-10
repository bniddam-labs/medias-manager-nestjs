import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { MediaBufferResponse } from './medias-resize.service';
import { MediasModuleOptions } from '../interfaces/medias-module-options.interface';
import { DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT, FFMPEG_FRAME_COUNT, IMAGE_QUALITY, ImageFormat, MEDIAS_MODULE_OPTIONS, PERCENTAGE_DIVISOR } from '../medias.constants';
import { MediasLoggerService } from './medias-logger.service';
import { MediasStorageService } from './medias-storage.service';
import { MediasValidationService } from './medias-validation.service';

/**
 * Internal video service for the medias module
 * Handles video thumbnail extraction using ffmpeg
 */
@Injectable()
export class MediasVideoService implements OnModuleInit {
  private ffmpegAvailable = false;

  constructor(
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
    private readonly logger: MediasLoggerService,
    private readonly storage: MediasStorageService,
    private readonly validation: MediasValidationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.ffmpegAvailable = await this.checkFfmpegAvailability();
  }

  // ============================================
  // FFmpeg Availability
  // ============================================

  private checkFfmpegAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          this.logger.warn('ffmpeg is not available. Video thumbnail generation will be disabled.', {
            error: err.message,
          });
          resolve(false);
        } else {
          this.logger.debug('ffmpeg is available for video thumbnail generation');
          resolve(true);
        }
      });
    });
  }

  isFfmpegAvailable(): boolean {
    return this.ffmpegAvailable;
  }

  // ============================================
  // Timestamp Parsing
  // ============================================

  parseTimestamp(timestamp: number | string | undefined, videoDuration: number): number {
    if (timestamp === undefined) {
      return (videoDuration * DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT) / PERCENTAGE_DIVISOR;
    }

    if (typeof timestamp === 'number') {
      return Math.min(timestamp, videoDuration);
    }

    // Handle percentage string (e.g., "10%")
    if (typeof timestamp === 'string' && timestamp.endsWith('%')) {
      const percent = Number.parseFloat(timestamp);
      if (!Number.isNaN(percent)) {
        return (videoDuration * percent) / PERCENTAGE_DIVISOR;
      }
    }

    // Try to parse as number string
    const parsed = Number.parseFloat(timestamp);
    if (!Number.isNaN(parsed)) {
      return Math.min(parsed, videoDuration);
    }

    // Fallback to default
    this.logger.warn('Invalid thumbnail timestamp, using default', { timestamp });
    return (videoDuration * DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT) / PERCENTAGE_DIVISOR;
  }

  // ============================================
  // Video Duration Probing
  // ============================================

  private writeTempFile(videoBuffer: Buffer): string {
    const tempPath = path.join(os.tmpdir(), `medias-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    fs.writeFileSync(tempPath, videoBuffer);
    return tempPath;
  }

  private cleanupTempFile(tempPath: string): void {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      this.logger.warn('Failed to cleanup temp file', { tempPath });
    }
  }

  getVideoDuration(videoBuffer: Buffer): Promise<number> {
    const tempPath = this.writeTempFile(videoBuffer);

    return new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        this.cleanupTempFile(tempPath);
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format.duration ?? 0);
      });
    });
  }

  // ============================================
  // Frame Extraction
  // ============================================

  extractFrame(videoBuffer: Buffer, timestampSeconds: number): Promise<Buffer> {
    const tempPath = this.writeTempFile(videoBuffer);

    return this.extractFrameAtTimestamp(tempPath, timestampSeconds)
      .catch((error) => {
        this.logger.warn('Frame extraction failed at requested timestamp, retrying at 0s', {
          timestamp: timestampSeconds,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return this.extractFrameAtTimestamp(tempPath, 0);
      })
      .finally(() => {
        this.cleanupTempFile(tempPath);
      });
  }

  private extractFrameAtTimestamp(filePath: string, timestampSeconds: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(filePath)
        .inputOptions([`-ss ${timestampSeconds}`])
        .outputOptions([`-frames:v ${FFMPEG_FRAME_COUNT}`, '-f image2pipe', '-vcodec png'])
        .format('image2pipe')
        .on('error', (err) => {
          reject(err);
        })
        .pipe()
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on('end', () => {
          if (chunks.length === 0) {
            reject(new Error('No frame extracted from video'));
            return;
          }
          resolve(Buffer.concat(chunks));
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  // ============================================
  // Thumbnail Generation
  // ============================================

  private applyFormat(pipeline: sharp.Sharp, format: ImageFormat): sharp.Sharp {
    switch (format) {
      case 'webp':
        return pipeline.webp({ quality: IMAGE_QUALITY.WEBP });
      case 'jpeg':
        return pipeline.jpeg({ quality: IMAGE_QUALITY.JPEG });
      case 'avif':
        return pipeline.avif({ quality: IMAGE_QUALITY.AVIF });
      default:
        return pipeline.jpeg({ quality: IMAGE_QUALITY.JPEG });
    }
  }

  private getExtensionForFormat(format: ImageFormat): string {
    switch (format) {
      case 'webp':
        return '.webp';
      case 'avif':
        return '.avif';
      default:
        return '.jpg';
    }
  }

  /**
   * Get video thumbnail for a given size, generating and caching it on first request.
   * Subsequent requests for the same size are served directly from S3.
   */
  async getOrGenerateThumbnail(fileName: string, size: number, ifNoneMatch?: string): Promise<MediaBufferResponse> {
    if (!this.ffmpegAvailable) {
      throw new BadRequestException('Video thumbnail generation requires ffmpeg. Please ensure ffmpeg is installed on the system.');
    }

    const outputFormat = this.options.preferredFormat ?? 'original';
    const outputExt = this.getExtensionForFormat(outputFormat);
    const thumbnailFileName = this.validation.buildThumbnailFileName(fileName, size, outputExt);
    const mimeType = this.validation.getMimeType(outputExt);

    // Try to serve from cache
    try {
      const stat = await this.storage.getFileStat(thumbnailFileName);
      const etag = this.validation.generateETag(thumbnailFileName, stat.lastModified, stat.size);

      if (ifNoneMatch === etag) {
        this.logger.debug('Video thumbnail cache hit (304)', { thumbnailFileName });
        return { buffer: null as unknown as Buffer, mimeType, etag, notModified: true };
      }

      this.logger.debug('Video thumbnail cache hit', { thumbnailFileName });
      const buffer = await this.storage.getFile(thumbnailFileName);
      return { buffer, mimeType, etag, notModified: false };
    } catch {
      this.logger.debug('Video thumbnail not cached, generating on-the-fly', { thumbnailFileName });
    }

    // Validate size
    this.validation.validateResizeSize(fileName, size);

    const startTime = Date.now();

    this.logger.info('Generating video thumbnail on-the-fly', { fileName, size });

    // Fetch video buffer from S3
    const videoBuffer = await this.storage.getFile(fileName);

    // Probe duration and extract frame
    const duration = await this.getVideoDuration(videoBuffer);
    const timestamp = this.parseTimestamp(this.options.videoThumbnails?.thumbnailTimestamp, duration);
    const frameBuffer = await this.extractFrame(videoBuffer, timestamp);

    // Determine final size (upscale prevention)
    let finalSize = size;

    if (this.validation.isAutoPreventUpscaleEnabled()) {
      try {
        const frameMetadata = await sharp(frameBuffer).metadata();
        if (frameMetadata.width && size > frameMetadata.width) {
          finalSize = frameMetadata.width;
          this.logger.debug('Clamped thumbnail size to prevent upscale', {
            fileName,
            requestedSize: size,
            frameWidth: frameMetadata.width,
          });
        }
      } catch (error) {
        this.logger.warn('Failed to check frame dimensions for upscale prevention', {
          fileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Resize and convert
    let pipeline = sharp(frameBuffer).resize(finalSize);
    pipeline = this.applyFormat(pipeline, outputFormat);
    const thumbnailBuffer = await pipeline.toBuffer();

    const durationMs = Date.now() - startTime;

    // Cache to S3 (fire-and-forget)
    this.storage
      .putFile(thumbnailFileName, thumbnailBuffer)
      .then(() => {
        this.logger.info('Video thumbnail cached to S3', { thumbnailFileName });
        this.options.onVideoThumbnailGenerated?.({
          originalFileName: fileName,
          thumbnailFileName,
          requestedSize: size,
          durationMs,
          format: outputFormat,
        });
      })
      .catch((error: unknown) => {
        this.logger.error('Failed to cache video thumbnail to S3', {
          thumbnailFileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    const etag = this.validation.generateETagFromBuffer(thumbnailBuffer);
    this.logger.info('Video thumbnail generated on-the-fly', { fileName, size, thumbnailFileName, durationMs });
    return { buffer: thumbnailBuffer, mimeType, etag, notModified: false };
  }

  async generateThumbnailsInline(fileName: string, videoBuffer: Buffer, sizes: number[], thumbnailTimestamp?: number | string): Promise<void> {
    if (!this.ffmpegAvailable) {
      this.logger.warn('ffmpeg not available, skipping video thumbnail generation', { fileName });
      return;
    }

    const startTime = Date.now();
    const outputFormat = this.options.preferredFormat ?? 'original';
    const outputExt = this.getExtensionForFormat(outputFormat);

    this.logger.info('Starting video thumbnail generation', {
      fileName,
      sizes,
      outputFormat,
      thumbnailTimestamp,
    });

    // 1. Probe video duration
    let duration: number;
    try {
      duration = await this.getVideoDuration(videoBuffer);
      this.logger.debug('Video duration probed', { fileName, duration });
    } catch (error) {
      this.logger.error('Failed to probe video duration', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    // 2. Compute timestamp
    const timestamp = this.parseTimestamp(thumbnailTimestamp, duration);
    this.logger.debug('Computed thumbnail timestamp', { fileName, timestamp, duration });

    // 3. Extract frame
    let frameBuffer: Buffer;
    try {
      frameBuffer = await this.extractFrame(videoBuffer, timestamp);
      this.logger.debug('Frame extracted from video', { fileName, frameSize: frameBuffer.length });
    } catch (error) {
      this.logger.error('Failed to extract frame from video', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    // 4. Get frame dimensions for upscale prevention
    const maxResizeWidth = this.validation.getMaxResizeWidth();
    const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();
    let frameWidth: number | undefined;

    if (autoPreventUpscale) {
      try {
        const frameMetadata = await sharp(frameBuffer).metadata();
        frameWidth = frameMetadata.width;
        this.logger.debug('Frame dimensions for upscale prevention', { fileName, frameWidth, frameHeight: frameMetadata.height });
      } catch (error) {
        this.logger.warn('Failed to get frame metadata for upscale prevention', {
          fileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 5. Generate each thumbnail size
    const generatedFiles: string[] = [];

    for (const size of sizes) {
      const thumbnailStartTime = Date.now();
      const thumbnailFileName = this.validation.buildThumbnailFileName(fileName, size, outputExt);

      try {
        // Validate size against maxResizeWidth
        if (size > maxResizeWidth) {
          this.logger.warn('Thumbnail size exceeds maxResizeWidth, skipping', {
            fileName,
            size,
            maxResizeWidth,
          });
          continue;
        }

        // Prevent upscaling if enabled
        let finalSize = size;
        if (autoPreventUpscale && frameWidth && size > frameWidth) {
          this.logger.debug('Thumbnail size exceeds frame width, clamping', {
            fileName,
            requestedSize: size,
            frameWidth,
          });
          finalSize = frameWidth;
        }

        let pipeline = sharp(frameBuffer).resize(finalSize);
        pipeline = this.applyFormat(pipeline, outputFormat);
        const thumbnailBuffer = await pipeline.toBuffer();

        await this.storage.putFile(thumbnailFileName, thumbnailBuffer);

        const durationMs = Date.now() - thumbnailStartTime;

        this.logger.info('Video thumbnail generated', {
          fileName,
          thumbnailFileName,
          size,
          thumbnailSize: thumbnailBuffer.length,
          durationMs,
        });

        this.options.onVideoThumbnailGenerated?.({
          originalFileName: fileName,
          thumbnailFileName,
          requestedSize: size,
          durationMs,
          format: outputFormat,
        });

        generatedFiles.push(thumbnailFileName);
      } catch (error) {
        this.logger.error('Failed to generate video thumbnail', {
          fileName,
          thumbnailFileName,
          size,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    this.logger.info('Video thumbnail generation completed', {
      fileName,
      totalSizes: sizes.length,
      totalDurationMs: totalDuration,
    });

    this.options.onProcessingCompleted?.({
      originalFileName: fileName,
      type: 'video-thumbnails',
      generatedFiles,
      totalDurationMs: totalDuration,
    });
  }
}
