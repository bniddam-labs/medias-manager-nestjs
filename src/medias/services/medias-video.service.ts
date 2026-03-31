import { Readable } from 'node:stream';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
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

  getVideoDuration(videoBuffer: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const inputStream = Readable.from(videoBuffer);

      ffmpeg.ffprobe(inputStream as unknown as string, (err, metadata) => {
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
    return new Promise((resolve, reject) => {
      const inputStream = Readable.from(videoBuffer);
      const chunks: Buffer[] = [];

      ffmpeg(inputStream)
        .seekInput(timestampSeconds)
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
  }
}
