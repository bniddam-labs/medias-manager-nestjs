import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import sharp, { Sharp } from 'sharp';
import { Readable } from 'stream';
import { DEFAULT_MAX_ORIGINAL_FILE_SIZE, IMAGE_QUALITY, ImageFormat, MEDIAS_MODULE_OPTIONS, SIZE_UNITS } from '../medias.constants';
import { MediasModuleOptions } from '../interfaces/medias-module-options.interface';
import { MediasLoggerService } from './medias-logger.service';
import { MediasStorageService } from './medias-storage.service';
import { MediasValidationService } from './medias-validation.service';

/**
 * Response type for buffered media
 */
export interface MediaBufferResponse {
  buffer: Buffer;
  mimeType: string;
  etag: string;
  notModified?: boolean;
}

/**
 * Response type for streaming media
 */
export interface MediaStreamResponse {
  stream: Readable;
  mimeType: string;
  size: number;
  etag: string;
  lastModified: Date;
  notModified?: boolean;
}

/**
 * Request item for batch resize operation
 */
export interface BatchResizeRequestItem {
  fileName: string;
  sizes: number[];
}

/**
 * Result item for batch resize operation
 */
export interface BatchResizeResultItem {
  fileName: string;
  size: number;
  resizedFileName: string;
  success: boolean;
  error?: string;
}

/**
 * Internal result for single variant generation
 */
interface GenerateVariantResult {
  resizedFileName: string;
  success: boolean;
  error?: string;
}

/**
 * Internal resize service for the medias module
 * Handles all image resizing operations
 */
@Injectable()
export class MediasResizeService {
  constructor(
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
    private readonly logger: MediasLoggerService,
    private readonly storage: MediasStorageService,
    private readonly validation: MediasValidationService,
  ) {}

  // ============================================
  // Format Helpers
  // ============================================

  private applyFormat(pipeline: Sharp, format: ImageFormat): Sharp {
    switch (format) {
      case 'webp':
        return pipeline.webp({ quality: IMAGE_QUALITY.WEBP });
      case 'jpeg':
        return pipeline.jpeg({ quality: IMAGE_QUALITY.JPEG });
      case 'avif':
        return pipeline.avif({ quality: IMAGE_QUALITY.AVIF });
      case 'original':
      default:
        return pipeline;
    }
  }

  getMimeTypeForFormat(format: ImageFormat, originalExt: string): string {
    switch (format) {
      case 'webp':
        return 'image/webp';
      case 'jpeg':
        return 'image/jpeg';
      case 'avif':
        return 'image/avif';
      case 'original':
      default:
        return this.validation.getMimeType(originalExt);
    }
  }

  getExtensionForFormat(format: ImageFormat, originalExt: string): string {
    switch (format) {
      case 'webp':
        return '.webp';
      case 'jpeg':
        return '.jpg';
      case 'avif':
        return '.avif';
      case 'original':
      default:
        return originalExt;
    }
  }

  /**
   * Negotiate the best image format based on Accept header
   */
  negotiateFormat(acceptHeader?: string): ImageFormat {
    if (!this.options.enableContentNegotiation) {
      return this.options.preferredFormat ?? 'original';
    }

    if (!acceptHeader) {
      return this.options.preferredFormat ?? 'original';
    }

    const accept = acceptHeader.toLowerCase();
    const allowAvif = this.options.allowAvif ?? true;
    const allowWebp = this.options.allowWebp ?? true;

    if (allowAvif && accept.includes('image/avif')) {
      this.logger.debug('Content negotiation: AVIF selected', { acceptHeader });
      return 'avif';
    }

    if (allowWebp && accept.includes('image/webp')) {
      this.logger.debug('Content negotiation: WebP selected', { acceptHeader });
      return 'webp';
    }

    if (accept.includes('image/jpeg') || accept.includes('image/*') || accept.includes('*/*')) {
      this.logger.debug('Content negotiation: JPEG selected as fallback', { acceptHeader });
      return 'jpeg';
    }

    this.logger.debug('Content negotiation: original format selected', { acceptHeader });
    return 'original';
  }

  // ============================================
  // Single Variant Generation
  // ============================================

  /**
   * Generate a single image variant
   * Shared logic used by preGenerate and batchResize
   */
  async generateVariant(
    fileName: string,
    buffer: Buffer,
    size: number,
    originalWidth?: number,
    skipUpload = false,
  ): Promise<GenerateVariantResult> {
    const maxWidth = this.validation.getMaxResizeWidth();
    const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();

    const ext = this.validation.getExtension(fileName);
    const outputFormat = this.options.preferredFormat ?? 'original';
    const outputExt = this.getExtensionForFormat(outputFormat, ext);
    const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);

    // Validate size against maxWidth
    if (size > maxWidth) {
      const error = `Size ${size} exceeds maxResizeWidth (${maxWidth})`;
      this.logger.warn('Variant generation skipped: size exceeds maxResizeWidth', {
        fileName,
        size,
        maxWidth,
      });
      return { resizedFileName, success: false, error };
    }

    // Prevent upscaling if enabled
    let finalSize = size;
    if (autoPreventUpscale && originalWidth && size > originalWidth) {
      this.logger.debug('Variant size exceeds original width, clamping', {
        fileName,
        requestedSize: size,
        originalWidth,
      });
      finalSize = originalWidth;
    }

    try {
      this.logger.verbose('Generating variant', {
        fileName,
        size,
        finalSize,
        resizedFileName,
      });

      let pipeline = sharp(buffer).resize(finalSize);
      pipeline = this.applyFormat(pipeline, outputFormat);
      const resizedBuffer = await pipeline.toBuffer();

      if (!skipUpload) {
        await this.storage.putFile(resizedFileName, resizedBuffer);
      }

      this.logger.info('Variant created', {
        fileName,
        size,
        resizedFileName,
        resizedSize: resizedBuffer.length,
      });

      return { resizedFileName, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Failed to generate variant', {
        fileName,
        size,
        error: errorMessage,
      });
      return { resizedFileName, success: false, error: errorMessage };
    }
  }

  // ============================================
  // Resize Methods
  // ============================================

  /**
   * Get resized image with automatic caching
   */
  async getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse> {
    const startTime = Date.now();
    const outputFormat = format ?? this.options.preferredFormat ?? 'original';

    this.logger.verbose('getResizedImage called', { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });

    // Validate
    this.validation.validateResizable(fileName);
    this.validation.validateResizeSize(fileName, size);

    // Check original file size
    const stat = await this.storage.getFileStat(fileName);
    const maxOriginalSize = this.options.maxOriginalFileSize ?? DEFAULT_MAX_ORIGINAL_FILE_SIZE;
    if (maxOriginalSize > 0 && stat.size > maxOriginalSize) {
      this.logger.warn('Original image too large for on-the-fly resize', {
        fileName,
        size: stat.size,
        maxOriginalSize,
      });
      throw new BadRequestException(
        `Image too large to resize on-the-fly (${Math.round(stat.size / SIZE_UNITS.MEGABYTE)}MB). Maximum allowed: ${Math.round(maxOriginalSize / SIZE_UNITS.MEGABYTE)}MB.`,
      );
    }

    const ext = this.validation.getExtension(fileName);
    const outputExt = this.getExtensionForFormat(outputFormat, ext);
    const mimeType = this.getMimeTypeForFormat(outputFormat, ext);
    const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);

    this.logger.verbose('Computed resized file name', { originalFileName: fileName, resizedFileName, size, outputFormat });

    // Try to get cached resized image
    this.logger.verbose('Checking for cached resized image', { resizedFileName });
    try {
      const cachedStat = await this.storage.getFileStat(resizedFileName);
      const etag = this.validation.generateETag(resizedFileName, cachedStat.lastModified, cachedStat.size);
      this.logger.debug('Cached resized image found', { resizedFileName, size: cachedStat.size, etag });

      if (ifNoneMatch === etag) {
        this.logger.debug('Cache hit on resized image - returning 304 Not Modified', { resizedFileName, etag });
        this.options.onCacheHit?.({ fileName: resizedFileName, size, notModified: true });
        return { buffer: null as unknown as Buffer, mimeType, etag, notModified: true };
      }

      this.logger.info('Serving cached resized image', { resizedFileName, size: cachedStat.size });
      const buffer = await this.storage.getFile(resizedFileName);
      const durationMs = Date.now() - startTime;

      this.options.onCacheHit?.({ fileName: resizedFileName, size, notModified: false });
      this.options.onImageResized?.({
        originalFileName: fileName,
        resizedFileName,
        requestedSize: size,
        finalSize: buffer.length,
        fromCache: true,
        durationMs,
        format: outputFormat,
      });

      return { buffer, mimeType, etag, notModified: false };
    } catch {
      this.logger.debug('No cached resized image found, will generate', { resizedFileName });
    }

    // Generate resized image
    this.logger.verbose('Fetching original image for resize', { fileName });
    const originalFile = await this.storage.getFile(fileName);
    this.logger.debug('Original image loaded', { fileName, originalSize: originalFile.length });

    // Check original dimensions and prevent upscaling if enabled
    const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();
    let finalSize = size;

    if (autoPreventUpscale) {
      const metadata = await sharp(originalFile).metadata();
      if (metadata.width && size > metadata.width) {
        this.logger.debug('Requested size exceeds original width, preventing upscale', {
          fileName,
          requestedSize: size,
          originalWidth: metadata.width,
        });
        finalSize = metadata.width;
      }
    }

    this.logger.verbose('Resizing image with Sharp', { fileName, targetWidth: finalSize, outputFormat });
    let pipeline = sharp(originalFile).resize(finalSize);
    pipeline = this.applyFormat(pipeline, outputFormat);
    const resizedBuffer = await pipeline.toBuffer();
    const etag = this.validation.generateETagFromBuffer(resizedBuffer);
    this.logger.debug('Image resized', { fileName, originalSize: originalFile.length, resizedSize: resizedBuffer.length, outputFormat, etag });

    if (ifNoneMatch === etag) {
      this.logger.debug('Generated image matches ETag - returning 304 Not Modified', { fileName, etag });
      return { buffer: null as unknown as Buffer, mimeType, etag, notModified: true };
    }

    // Upload to S3 asynchronously (fire-and-forget)
    this.logger.verbose('Caching resized image to S3 (async)', { resizedFileName });
    this.storage.putFile(resizedFileName, resizedBuffer).catch((error) => {
      this.logger.warn('Failed to cache resized image', { resizedFileName, error: error instanceof Error ? error.message : 'Unknown error' });
    });

    const durationMs = Date.now() - startTime;

    this.options.onImageResized?.({
      originalFileName: fileName,
      resizedFileName,
      requestedSize: size,
      finalSize: resizedBuffer.length,
      fromCache: false,
      durationMs,
      format: outputFormat,
    });

    this.logger.info('Serving freshly resized image', { fileName, size, resizedSize: resizedBuffer.length });
    return { buffer: resizedBuffer, mimeType, etag, notModified: false };
  }

  /**
   * Get resized image as a stream (low-memory mode)
   */
  async getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse> {
    const outputFormat = format ?? this.options.preferredFormat ?? 'original';

    this.logger.verbose('getResizedImageStream called', { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });

    // Validate
    this.validation.validateResizable(fileName);
    this.validation.validateResizeSize(fileName, size);

    // Get original file metadata for ETag generation
    const stat = await this.storage.getFileStat(fileName);
    const etag = this.validation.generateETag(`${fileName}-${size}-${outputFormat}`, stat.lastModified, stat.size);
    this.logger.debug('Generated ETag for streaming resize', { fileName, size, etag });

    // Check for 304 Not Modified
    if (ifNoneMatch === etag) {
      this.logger.debug('Cache hit - returning 304 Not Modified', { fileName, size, etag });
      this.options.onCacheHit?.({ fileName, size, notModified: true });

      return {
        stream: null as unknown as Readable,
        mimeType: this.getMimeTypeForFormat(outputFormat, this.validation.getExtension(fileName)),
        size: 0,
        etag,
        lastModified: stat.lastModified,
        notModified: true,
      };
    }

    // Get original image stream
    this.logger.verbose('Fetching original image stream for resize', { fileName });
    const originalStream = await this.storage.getFileStream(fileName);

    // Create Sharp resize pipeline
    this.logger.verbose('Creating streaming resize pipeline', { fileName, size, outputFormat });
    let resizePipeline = sharp().resize(size);
    resizePipeline = this.applyFormat(resizePipeline, outputFormat);

    // Pipe original stream through Sharp
    const resizedStream = originalStream.pipe(resizePipeline);
    const mimeType = this.getMimeTypeForFormat(outputFormat, this.validation.getExtension(fileName));

    this.logger.info('Serving streaming resized image', { fileName, size, outputFormat });

    return {
      stream: resizedStream,
      mimeType,
      size: 0,
      etag,
      lastModified: stat.lastModified,
      notModified: false,
    };
  }

  // ============================================
  // Batch Operations
  // ============================================

  /**
   * Pre-generate image variants inline
   */
  async preGenerateInline(fileName: string, buffer: Buffer, sizes: number[]): Promise<void> {
    if (!this.validation.isResizable(fileName)) {
      this.logger.debug('File is not resizable, skipping pre-generation', { fileName });
      return;
    }

    let originalWidth: number | undefined;
    try {
      const metadata = await sharp(buffer).metadata();
      originalWidth = metadata.width;
      this.logger.debug('Original image metadata for pre-generation', {
        fileName,
        width: originalWidth,
        height: metadata.height,
      });
    } catch (error) {
      this.logger.warn('Failed to get original image metadata for pre-generation', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    const outputFormat = this.options.preferredFormat ?? 'original';

    this.logger.info('Starting pre-generation of image variants', {
      fileName,
      sizes,
      outputFormat,
      originalWidth,
    });

    for (const size of sizes) {
      await this.generateVariant(fileName, buffer, size, originalWidth);
    }

    this.logger.info('Pre-generation completed', { fileName, totalSizes: sizes.length });
  }

  /**
   * Batch resize multiple images with multiple sizes
   */
  async batchResize(items: BatchResizeRequestItem[]): Promise<BatchResizeResultItem[]> {
    this.logger.info('Starting batch resize operation', {
      totalItems: items.length,
      totalVariants: items.reduce((sum, item) => sum + item.sizes.length, 0),
    });

    const results: BatchResizeResultItem[] = [];

    for (const item of items) {
      const { fileName, sizes } = item;

      this.logger.verbose('Processing batch item', { fileName, sizes });

      // Check if file is resizable
      if (!this.validation.isResizable(fileName)) {
        const error = this.validation.isImage(fileName) ? `Image format not supported for resizing` : `File is not an image`;

        this.logger.warn('Batch item skipped: not resizable', { fileName, error });

        for (const size of sizes) {
          const ext = this.validation.getExtension(fileName);
          const outputExt = this.getExtensionForFormat(this.options.preferredFormat ?? 'original', ext);
          const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);

          results.push({ fileName, size, resizedFileName, success: false, error });
        }
        continue;
      }

      // Load original image
      let buffer: Buffer;
      try {
        buffer = await this.storage.getFile(fileName);
        this.logger.debug('Original image loaded for batch resize', { fileName, size: buffer.length });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'File not found';
        this.logger.error('Failed to load original for batch resize', { fileName, error: errorMessage });

        for (const size of sizes) {
          const ext = this.validation.getExtension(fileName);
          const outputExt = this.getExtensionForFormat(this.options.preferredFormat ?? 'original', ext);
          const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);

          results.push({ fileName, size, resizedFileName, success: false, error: errorMessage });
        }
        continue;
      }

      // Get original dimensions for upscale prevention
      let originalWidth: number | undefined;
      try {
        const metadata = await sharp(buffer).metadata();
        originalWidth = metadata.width;
        this.logger.debug('Original image metadata for batch resize', {
          fileName,
          width: originalWidth,
          height: metadata.height,
        });
      } catch (error) {
        this.logger.warn('Failed to get metadata for batch resize, proceeding without upscale prevention', {
          fileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Generate each size
      for (const size of sizes) {
        const variantResult = await this.generateVariant(fileName, buffer, size, originalWidth);

        results.push({
          fileName,
          size,
          resizedFileName: variantResult.resizedFileName,
          success: variantResult.success,
          error: variantResult.error,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    this.logger.info('Batch resize operation completed', {
      totalItems: items.length,
      totalVariants: results.length,
      successCount,
      failureCount,
    });

    return results;
  }
}
