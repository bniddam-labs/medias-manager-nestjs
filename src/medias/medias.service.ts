import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { Readable } from 'stream';
import { ImageFormat, MEDIAS_MODULE_OPTIONS, S3_METADATA_KEYS } from './medias.constants';
import { MediasModuleOptions } from './interfaces/medias-module-options.interface';
import {
  MediasLoggerService,
  MediasStorageService,
  MediasValidationService,
  MediasResizeService,
  MediaStatResult,
  MediaBufferResponse,
  MediaStreamResponse,
  BatchResizeRequestItem,
  BatchResizeResultItem,
} from './services';

// Re-export types for backward compatibility
export { MediaStatResult, MediaBufferResponse, MediaStreamResponse, BatchResizeRequestItem, BatchResizeResultItem };

/**
 * Main service for media storage, retrieval, and image resizing
 *
 * This is the public facade that consumers should use.
 * Internal logic is delegated to specialized services.
 */
@Injectable()
export class MediasService {
  constructor(
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
    private readonly logger: MediasLoggerService,
    private readonly storage: MediasStorageService,
    private readonly validation: MediasValidationService,
    private readonly resize: MediasResizeService,
  ) {
    this.logger.verbose('MediasService initialized', { bucket: options.s3.bucketName });
  }

  // ============================================
  // Validation & Utilities (delegated)
  // ============================================

  /**
   * Check if file is an image based on extension
   */
  isImage(fileName: string): boolean {
    return this.validation.isImage(fileName);
  }

  /**
   * Check if file can be resized (Sharp-compatible image)
   */
  isResizable(fileName: string): boolean {
    return this.validation.isResizable(fileName);
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(ext: string): string {
    return this.validation.getMimeType(ext);
  }

  /**
   * Generate ETag from file metadata
   */
  generateETag(fileName: string, lastModified: Date, size: number): string {
    return this.validation.generateETag(fileName, lastModified, size);
  }

  /**
   * Generate ETag from buffer content
   */
  generateETagFromBuffer(buffer: Buffer): string {
    return this.validation.generateETagFromBuffer(buffer);
  }

  /**
   * Negotiate the best image format based on Accept header
   */
  negotiateFormat(acceptHeader?: string): ImageFormat {
    return this.resize.negotiateFormat(acceptHeader);
  }

  // ============================================
  // Storage Operations (delegated)
  // ============================================

  /**
   * Get any media file as a stream with metadata (memory-efficient)
   */
  async getMediaStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse> {
    this.logger.verbose('getMediaStream called', { fileName, hasIfNoneMatch: !!ifNoneMatch });

    const ext = this.validation.getExtension(fileName);
    const mimeType = this.validation.getMimeType(ext);
    this.logger.verbose('Determined MIME type', { fileName, ext, mimeType });

    this.logger.verbose('Fetching file stat', { fileName });
    const stat = await this.storage.getFileStat(fileName);
    const etag = this.validation.generateETag(fileName, stat.lastModified, stat.size);
    this.logger.debug('File stat retrieved', { fileName, size: stat.size, etag });

    if (ifNoneMatch === etag) {
      this.logger.debug('Cache hit - returning 304 Not Modified', { fileName, etag });
      this.options.onCacheHit?.({ fileName, size: 0, notModified: true });

      return {
        stream: null as unknown as Readable,
        mimeType,
        size: stat.size,
        etag,
        lastModified: stat.lastModified,
        notModified: true,
      };
    }

    this.logger.verbose('Cache miss - fetching file stream', { fileName });
    const stream = await this.storage.getFileStream(fileName);
    this.logger.info('Serving media stream', { fileName, size: stat.size, mimeType });

    return {
      stream,
      mimeType,
      size: stat.size,
      etag,
      lastModified: stat.lastModified,
      notModified: false,
    };
  }

  /**
   * Get any media file as a buffer
   * WARNING: Loads entire file into memory - not suitable for large files
   */
  async getMedia(fileName: string): Promise<Buffer> {
    this.logger.warn('Loading entire file into memory', { fileName });
    return this.storage.getFile(fileName);
  }

  /**
   * Get raw file stream from S3
   */
  async getMediaFileStream(fileName: string): Promise<Readable> {
    return this.storage.getFileStream(fileName);
  }

  /**
   * Get file metadata (size, content-type, etc.)
   */
  async getMediaStat(fileName: string): Promise<MediaStatResult> {
    return this.storage.getFileStat(fileName);
  }

  /**
   * Upload any media file to S3
   */
  async uploadMedia(fileName: string, file: Buffer, originalName?: string, skipPreGeneration = false): Promise<void> {
    this.logger.verbose('Uploading file to S3', { fileName, size: file.length, originalName, skipPreGeneration });

    // Check if file is an image and extract metadata
    if (this.validation.isImage(fileName)) {
      try {
        const metadata = await sharp(file).metadata();
        const ext = this.validation.getExtension(fileName);
        const mimeType = this.validation.getMimeType(ext);

        const s3Metadata: Record<string, string> = {
          [S3_METADATA_KEYS.MIME_TYPE]: mimeType,
          [S3_METADATA_KEYS.UPLOADED_AT]: new Date().toISOString(),
        };

        if (metadata.width) {
          s3Metadata[S3_METADATA_KEYS.WIDTH] = String(metadata.width);
        }
        if (metadata.height) {
          s3Metadata[S3_METADATA_KEYS.HEIGHT] = String(metadata.height);
        }
        if (originalName) {
          s3Metadata[S3_METADATA_KEYS.ORIGINAL_NAME] = originalName;
        }

        this.logger.debug('Uploading image with enriched metadata', {
          fileName,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
        });

        await this.storage.putFile(fileName, file, s3Metadata);

        this.logger.info('Image uploaded to S3 with metadata', {
          fileName,
          size: file.length,
          dimensions: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : undefined,
        });

        this.options.onUploaded?.({
          fileName,
          size: file.length,
          isImage: true,
          dimensions: metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined,
        });

        // Trigger pre-generation if configured
        if (!skipPreGeneration) {
          await this.triggerPreGeneration(fileName, file);
        }

        return;
      } catch (error) {
        this.logger.warn('Failed to extract image metadata, uploading without enrichment', {
          fileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Regular upload for non-images or if metadata extraction failed
    await this.storage.putFile(fileName, file);

    this.options.onUploaded?.({
      fileName,
      size: file.length,
      isImage: false,
    });

    // Trigger pre-generation if configured
    if (!skipPreGeneration) {
      await this.triggerPreGeneration(fileName, file);
    }
  }

  /**
   * Trigger pre-generation of image variants
   */
  private async triggerPreGeneration(fileName: string, buffer: Buffer): Promise<void> {
    const preGen = this.options.preGeneration;

    if (!preGen || !preGen.sizes || preGen.sizes.length === 0) {
      return;
    }

    if (!this.validation.isResizable(fileName)) {
      this.logger.debug('File is not resizable, skipping pre-generation trigger', { fileName });
      return;
    }

    this.logger.debug('Triggering pre-generation', {
      fileName,
      sizes: preGen.sizes,
      hasDispatchJob: !!preGen.dispatchJob,
    });

    try {
      if (preGen.dispatchJob) {
        this.logger.info('Dispatching pre-generation job to external queue', {
          fileName,
          sizes: preGen.sizes,
        });

        await preGen.dispatchJob({ fileName, sizes: preGen.sizes });
        this.logger.info('Pre-generation job dispatched successfully', { fileName });
      } else {
        this.logger.info('Starting inline pre-generation (fire-and-forget)', {
          fileName,
          sizes: preGen.sizes,
        });

        this.resize.preGenerateInline(fileName, buffer, preGen.sizes).catch((error) => {
          this.logger.error('Inline pre-generation failed', {
            fileName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    } catch (error) {
      this.logger.error('Failed to trigger pre-generation', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete any media file from S3
   */
  async deleteMedia(fileName: string): Promise<void> {
    return this.storage.deleteFile(fileName);
  }

  // ============================================
  // Image Operations (delegated to resize service)
  // ============================================

  /**
   * Get image as a stream with metadata
   */
  async getImageStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse> {
    this.logger.verbose('getImageStream called', { fileName });
    if (!this.validation.isImage(fileName)) {
      this.logger.warn('Attempted to get non-image file as image', { fileName });
      throw new BadRequestException(`File ${fileName} is not an image. Use getMediaStream() for non-image files.`);
    }
    return this.getMediaStream(fileName, ifNoneMatch);
  }

  /**
   * Get resized image with automatic caching
   */
  async getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse> {
    return this.resize.getResizedImage(fileName, size, ifNoneMatch, format);
  }

  /**
   * Get resized image as a stream (low-memory mode)
   */
  async getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse> {
    return this.resize.getResizedImageStream(fileName, size, ifNoneMatch, format);
  }

  /**
   * Batch resize multiple images with multiple sizes
   */
  async batchResize(items: BatchResizeRequestItem[]): Promise<BatchResizeResultItem[]> {
    return this.resize.batchResize(items);
  }
}
