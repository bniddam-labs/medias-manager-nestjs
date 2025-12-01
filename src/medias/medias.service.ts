import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { MinioService } from 'nestjs-minio-client';
import * as path from 'path';
import sharp, { Sharp } from 'sharp';
import { Readable } from 'stream';
import { MediasLogLevel, MediasModuleOptions } from './interfaces/medias-module-options.interface';
import { DEFAULT_MAX_ORIGINAL_FILE_SIZE, DEFAULT_MAX_RESIZE_WIDTH, IMAGE_EXTENSIONS, IMAGE_QUALITY, ImageFormat, MEDIAS_MODULE_OPTIONS, MIME_TYPES, RESIZABLE_IMAGE_EXTENSIONS, RETRY_CONFIG, S3_METADATA_KEYS, SIZE_UNITS, TRANSIENT_S3_ERROR_CODES } from './medias.constants';

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
 * Response type for buffered media
 */
export interface MediaBufferResponse {
  buffer: Buffer;
  mimeType: string;
  etag: string;
  notModified?: boolean;
}

/**
 * File stat information
 */
export interface MediaStatResult {
  size: number;
  lastModified: Date;
  etag: string;
  metaData: Record<string, string>;
}

// Log level priority for comparison
const LOG_LEVEL_PRIORITY: Record<MediasLogLevel, number> = {
  none: -1,
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

@Injectable()
export class MediasService {
  private readonly logger = new Logger(MediasService.name);
  private readonly logLevel: MediasLogLevel;

  constructor(
    private readonly minioService: MinioService,
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
  ) {
    this.logLevel = options.logLevel ?? 'none';
    this.logVerbose('MediasService initialized', { logLevel: this.logLevel, bucket: options.s3.bucketName });
  }

  // ============================================
  // Logging Helpers
  // ============================================

  private shouldLog(level: MediasLogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.logLevel];
  }

  private logError(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.logger.error(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  private logWarn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.logger.warn(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('log')) {
      this.logger.log(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  private logDebug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.logger.debug(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  private logVerbose(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('verbose')) {
      this.logger.verbose(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  private getBucketName(): string {
    const bucketName = this.options.s3.bucketName;
    if (!bucketName) {
      this.logError('S3 bucket name not configured');
      throw new InternalServerErrorException('S3 bucket name not configured');
    }
    return bucketName;
  }

  // ============================================
  // Retry Logic for S3 Operations
  // ============================================

  /**
   * Check if an error is transient and should trigger a retry
   */
  private isTransientError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const err = error as { code?: string; name?: string };
    const errorCode = err.code ?? err.name ?? '';

    return TRANSIENT_S3_ERROR_CODES.includes(errorCode);
  }

  /**
   * Delay execution for a specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry wrapper for S3 operations
   * Retries on transient errors with exponential backoff
   */
  private async withRetry<T>(operation: () => Promise<T>, context: { operationName: string; fileName?: string }): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        this.logVerbose(`Executing S3 operation (attempt ${attempt + 1}/${RETRY_CONFIG.MAX_ATTEMPTS})`, {
          operation: context.operationName,
          fileName: context.fileName,
        });
        return await operation();
      } catch (error) {
        attempt++;

        const isTransient = this.isTransientError(error);
        const shouldRetry = isTransient && attempt < RETRY_CONFIG.MAX_ATTEMPTS;

        if (!shouldRetry) {
          this.logError('S3 operation failed', {
            operation: context.operationName,
            fileName: context.fileName,
            attempt,
            isTransient,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }

        const backoffMs = RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
        this.logWarn('Transient S3 error, retrying', {
          operation: context.operationName,
          fileName: context.fileName,
          attempt,
          retryAfterMs: backoffMs,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.delay(backoffMs);
      }
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Check if file is an image based on extension
   */
  isImage(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Check if file can be resized (Sharp-compatible image)
   */
  isResizable(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return RESIZABLE_IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Get MIME type from file extension
   * @param ext File extension (including dot)
   * @returns MIME type string
   */
  getMimeType(ext: string): string {
    return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Generate ETag from file metadata
   */
  generateETag(fileName: string, lastModified: Date, size: number): string {
    const hash = crypto.createHash('md5').update(`${fileName}-${lastModified.getTime()}-${size}`).digest('hex');
    return `"${hash}"`;
  }

  /**
   * Generate ETag from buffer content
   */
  generateETagFromBuffer(buffer: Buffer): string {
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    return `"${hash}"`;
  }

  /**
   * Apply format conversion to Sharp pipeline
   * @param pipeline Sharp pipeline
   * @param format Target format
   * @returns Modified Sharp pipeline
   */
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
        // Keep original format
        return pipeline;
    }
  }

  /**
   * Get MIME type for a specific image format
   */
  private getMimeTypeForFormat(format: ImageFormat, originalExt: string): string {
    switch (format) {
      case 'webp':
        return 'image/webp';
      case 'jpeg':
        return 'image/jpeg';
      case 'avif':
        return 'image/avif';
      case 'original':
      default:
        return this.getMimeType(originalExt);
    }
  }

  /**
   * Get file extension for a specific image format
   */
  private getExtensionForFormat(format: ImageFormat, originalExt: string): string {
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
   * @param acceptHeader The Accept header from the request
   * @returns The best supported format
   */
  negotiateFormat(acceptHeader?: string): ImageFormat {
    // If content negotiation is disabled, return configured preferred format or original
    if (!this.options.enableContentNegotiation) {
      return this.options.preferredFormat ?? 'original';
    }

    if (!acceptHeader) {
      return this.options.preferredFormat ?? 'original';
    }

    const accept = acceptHeader.toLowerCase();

    // Check format support and preference (AVIF > WebP > JPEG > original)
    const allowAvif = this.options.allowAvif ?? true;
    const allowWebp = this.options.allowWebp ?? true;

    if (allowAvif && accept.includes('image/avif')) {
      this.logDebug('Content negotiation: AVIF selected', { acceptHeader });
      return 'avif';
    }

    if (allowWebp && accept.includes('image/webp')) {
      this.logDebug('Content negotiation: WebP selected', { acceptHeader });
      return 'webp';
    }

    if (accept.includes('image/jpeg') || accept.includes('image/*') || accept.includes('*/*')) {
      this.logDebug('Content negotiation: JPEG selected as fallback', { acceptHeader });
      return 'jpeg';
    }

    this.logDebug('Content negotiation: original format selected', { acceptHeader });
    return 'original';
  }

  // ============================================
  // Generic Media Methods (all file types)
  // ============================================

  /**
   * Get any media file as a stream with metadata (memory-efficient)
   * @param fileName Name of the file to retrieve
   * @param ifNoneMatch ETag value from If-None-Match header for 304 support
   * @returns Media stream with metadata
   */
  async getMediaStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse> {
    this.logVerbose('getMediaStream called', { fileName, hasIfNoneMatch: !!ifNoneMatch });

    const ext = path.extname(fileName);
    const mimeType = this.getMimeType(ext);
    this.logVerbose('Determined MIME type', { fileName, ext, mimeType });

    this.logVerbose('Fetching file stat', { fileName });
    const stat = await this.getMediaStat(fileName);
    const etag = this.generateETag(fileName, stat.lastModified, stat.size);
    this.logDebug('File stat retrieved', { fileName, size: stat.size, etag });

    if (ifNoneMatch === etag) {
      this.logDebug('Cache hit - returning 304 Not Modified', { fileName, etag });

      // Fire onCacheHit hook
      this.options.onCacheHit?.({
        fileName,
        size: 0,
        notModified: true,
      });

      return {
        stream: null as unknown as Readable,
        mimeType,
        size: stat.size,
        etag,
        lastModified: stat.lastModified,
        notModified: true,
      };
    }

    this.logVerbose('Cache miss - fetching file stream', { fileName });
    const stream = await this.getMediaFileStream(fileName);
    this.logInfo('Serving media stream', { fileName, size: stat.size, mimeType });

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
   * @param fileName Name of the file to retrieve
   * @returns Buffer containing the file contents
   */
  async getMedia(fileName: string): Promise<Buffer> {
    this.logVerbose('getMedia called - loading file into buffer', { fileName });
    this.logWarn('Loading entire file into memory', { fileName });

    try {
      const fileStream = await this.getMediaFileStream(fileName);

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        fileStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        fileStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          this.logDebug('File loaded into buffer', { fileName, size: buffer.length });
          resolve(buffer);
        });

        fileStream.on('error', (error) => {
          this.logError('Error reading file stream', { fileName, error: error.message });
          reject(error);
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logError('Failed to get media', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  /**
   * Get raw file stream from S3
   */
  async getMediaFileStream(fileName: string): Promise<Readable> {
    this.logVerbose('Fetching file stream from S3', { fileName, bucket: this.getBucketName() });
    try {
      const fileStream = await this.withRetry(
        () => this.minioService.client.getObject(this.getBucketName(), fileName) as Promise<Readable>,
        { operationName: 'getObject', fileName },
      );
      this.logVerbose('File stream obtained', { fileName });
      return fileStream;
    } catch (error) {
      this.logError('File not found in S3', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  /**
   * Get file metadata (size, content-type, etc.)
   */
  async getMediaStat(fileName: string): Promise<MediaStatResult> {
    this.logVerbose('Fetching file stat from S3', { fileName });
    try {
      const stat = await this.withRetry(() => this.minioService.client.statObject(this.getBucketName(), fileName), { operationName: 'statObject', fileName });
      this.logVerbose('File stat obtained', { fileName, size: stat.size });
      return stat;
    } catch (error) {
      this.logError('File stat not found', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  // ============================================
  // Pre-generation Logic
  // ============================================

  /**
   * Pre-generate image variants inline (synchronous fallback)
   * @param fileName Original file name
   * @param buffer Original file buffer
   * @param sizes Sizes to pre-generate (in pixels)
   */
  private async preGenerateInline(fileName: string, buffer: Buffer, sizes: number[]): Promise<void> {
    if (!this.isResizable(fileName)) {
      this.logDebug('File is not resizable, skipping pre-generation', { fileName });
      return;
    }

    const maxWidth = this.options.maxResizeWidth ?? DEFAULT_MAX_RESIZE_WIDTH;
    const autoPreventUpscale = this.options.autoPreventUpscale ?? true;

    // Get original image metadata
    let originalWidth: number | undefined;
    try {
      const metadata = await sharp(buffer).metadata();
      originalWidth = metadata.width;
      this.logDebug('Original image metadata for pre-generation', {
        fileName,
        width: originalWidth,
        height: metadata.height,
      });
    } catch (error) {
      this.logWarn('Failed to get original image metadata for pre-generation', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const dirName = path.dirname(fileName);

    // Determine output format
    const outputFormat = this.options.preferredFormat ?? 'original';
    const outputExt = this.getExtensionForFormat(outputFormat, ext);

    this.logInfo('Starting pre-generation of image variants', {
      fileName,
      sizes,
      outputFormat,
      originalWidth,
    });

    // Generate each size (best effort)
    for (const size of sizes) {
      try {
        // Validate size against maxWidth
        if (size > maxWidth) {
          this.logWarn('Pre-generation size exceeds maxResizeWidth, skipping', {
            fileName,
            size,
            maxWidth,
          });
          continue;
        }

        // Prevent upscaling if enabled
        let finalSize = size;
        if (autoPreventUpscale && originalWidth && size > originalWidth) {
          this.logDebug('Pre-generation size exceeds original width, clamping', {
            fileName,
            requestedSize: size,
            originalWidth,
          });
          finalSize = originalWidth;
        }

        // Build resized file name
        const resizedFileName = dirName === '.' ? `${baseName}-${size}${outputExt}` : `${dirName}/${baseName}-${size}${outputExt}`;

        // Generate variant
        this.logVerbose('Generating pre-generation variant', {
          fileName,
          size,
          finalSize,
          resizedFileName,
        });

        let pipeline = sharp(buffer).resize(finalSize);
        pipeline = this.applyFormat(pipeline, outputFormat);
        const resizedBuffer = await pipeline.toBuffer();

        // Upload variant (skip pre-generation for variants to avoid recursion)
        await this.uploadMedia(resizedFileName, resizedBuffer, undefined, true);

        this.logInfo('Pre-generation variant created', {
          fileName,
          size,
          resizedFileName,
          resizedSize: resizedBuffer.length,
        });
      } catch (error) {
        // Best effort: log error but continue with other sizes
        this.logWarn('Failed to pre-generate variant, continuing with other sizes', {
          fileName,
          size,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logInfo('Pre-generation completed', { fileName, totalSizes: sizes.length });
  }

  /**
   * Upload any media file to S3
   * @param fileName Name of the file in S3
   * @param file Buffer containing the file data
   * @param originalName Optional original file name (for metadata)
   * @param skipPreGeneration Internal flag to prevent recursion during variant uploads
   */
  async uploadMedia(fileName: string, file: Buffer, originalName?: string, skipPreGeneration = false): Promise<void> {
    this.logVerbose('Uploading file to S3', { fileName, size: file.length, originalName, skipPreGeneration });

    // Check if file is an image and extract metadata
    if (this.isImage(fileName)) {
      try {
        const metadata = await sharp(file).metadata();
        const ext = path.extname(fileName);
        const mimeType = this.getMimeType(ext);

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

        this.logDebug('Uploading image with enriched metadata', {
          fileName,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
        });

        await this.withRetry(() => this.minioService.client.putObject(this.getBucketName(), fileName, file, s3Metadata), { operationName: 'putObject', fileName });

        this.logInfo('Image uploaded to S3 with metadata', {
          fileName,
          size: file.length,
          dimensions: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : undefined,
        });

        // Fire onUploaded hook
        this.options.onUploaded?.({
          fileName,
          size: file.length,
          isImage: true,
          dimensions: metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined,
        });

        // Trigger pre-generation if configured and not skipped
        if (!skipPreGeneration) {
          await this.triggerPreGeneration(fileName, file);
        }

        return;
      } catch (error) {
        this.logWarn('Failed to extract image metadata, uploading without enrichment', {
          fileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Fall through to regular upload
      }
    }

    // Regular upload for non-images or if metadata extraction failed
    await this.withRetry(() => this.minioService.client.putObject(this.getBucketName(), fileName, file), { operationName: 'putObject', fileName });
    this.logInfo('File uploaded to S3', { fileName, size: file.length });

    // Fire onUploaded hook
    this.options.onUploaded?.({
      fileName,
      size: file.length,
      isImage: false,
    });

    // Trigger pre-generation if configured and not skipped
    if (!skipPreGeneration) {
      await this.triggerPreGeneration(fileName, file);
    }
  }

  /**
   * Trigger pre-generation of image variants (inline or via queue)
   * @param fileName Original file name
   * @param buffer Original file buffer
   */
  private async triggerPreGeneration(fileName: string, buffer: Buffer): Promise<void> {
    const preGen = this.options.preGeneration;

    // Skip if pre-generation not configured or no sizes specified
    if (!preGen || !preGen.sizes || preGen.sizes.length === 0) {
      return;
    }

    // Skip if file is not resizable
    if (!this.isResizable(fileName)) {
      this.logDebug('File is not resizable, skipping pre-generation trigger', { fileName });
      return;
    }

    this.logDebug('Triggering pre-generation', {
      fileName,
      sizes: preGen.sizes,
      hasDispatchJob: !!preGen.dispatchJob,
    });

    try {
      if (preGen.dispatchJob) {
        // Delegate to external queue
        this.logInfo('Dispatching pre-generation job to external queue', {
          fileName,
          sizes: preGen.sizes,
        });

        await preGen.dispatchJob({
          fileName,
          sizes: preGen.sizes,
        });

        this.logInfo('Pre-generation job dispatched successfully', { fileName });
      } else {
        // Fallback to inline generation (fire-and-forget to avoid blocking upload)
        this.logInfo('Starting inline pre-generation (fire-and-forget)', {
          fileName,
          sizes: preGen.sizes,
        });

        // Fire-and-forget: don't await, log errors
        this.preGenerateInline(fileName, buffer, preGen.sizes).catch((error) => {
          this.logError('Inline pre-generation failed', {
            fileName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    } catch (error) {
      // Best effort: log error but don't fail the upload
      this.logError('Failed to trigger pre-generation', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete any media file from S3
   */
  async deleteMedia(fileName: string): Promise<void> {
    this.logVerbose('Deleting file from S3', { fileName });
    await this.withRetry(() => this.minioService.client.removeObject(this.getBucketName(), fileName), { operationName: 'removeObject', fileName });
    this.logInfo('File deleted from S3', { fileName });
  }

  // ============================================
  // Image-Specific Methods (with resize support)
  // ============================================

  /**
   * Get image as a stream with metadata
   * Same as getMediaStream but validates that file is an image
   * @param fileName Name of the image file
   * @param ifNoneMatch ETag for cache validation
   */
  async getImageStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse> {
    this.logVerbose('getImageStream called', { fileName });
    if (!this.isImage(fileName)) {
      this.logWarn('Attempted to get non-image file as image', { fileName });
      throw new BadRequestException(`File ${fileName} is not an image. Use getMediaStream() for non-image files.`);
    }
    return this.getMediaStream(fileName, ifNoneMatch);
  }

  /**
   * Get resized image with automatic caching
   * Only works with resizable image formats (PNG, JPG, JPEG, GIF, WebP, AVIF, TIFF)
   *
   * @param fileName Original file name
   * @param size Desired width in pixels
   * @param ifNoneMatch ETag for cache validation
   * @param format Optional output format (overrides preferredFormat option)
   * @returns Resized image buffer with metadata
   * @throws BadRequestException if file is not a resizable image
   */
  async getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse> {
    const startTime = Date.now();

    // Determine the output format (parameter > option > original)
    const outputFormat = format ?? this.options.preferredFormat ?? 'original';

    this.logVerbose('getResizedImage called', { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });

    // Validate that file is resizable
    if (!this.isResizable(fileName)) {
      const ext = path.extname(fileName).toLowerCase();
      if (this.isImage(fileName)) {
        this.logWarn('Attempted to resize unsupported image format', { fileName, ext });
        throw new BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${RESIZABLE_IMAGE_EXTENSIONS.join(', ')}`);
      }
      this.logWarn('Attempted to resize non-image file', { fileName });
      throw new BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
    }

    // Validate size
    const maxWidth = this.options.maxResizeWidth ?? DEFAULT_MAX_RESIZE_WIDTH;
    if (size > maxWidth) {
      this.logWarn('Resize size exceeds maximum', { fileName, size, maxWidth });
      throw new BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
    }

    // Check original file size to prevent processing of excessively large files
    const stat = await this.getMediaStat(fileName);
    const maxOriginalSize = this.options.maxOriginalFileSize ?? DEFAULT_MAX_ORIGINAL_FILE_SIZE;
    if (maxOriginalSize > 0 && stat.size > maxOriginalSize) {
      this.logWarn('Original image too large for on-the-fly resize', {
        fileName,
        size: stat.size,
        maxOriginalSize,
      });
      throw new BadRequestException(
        `Image too large to resize on-the-fly (${Math.round(stat.size / SIZE_UNITS.MEGABYTE)}MB). Maximum allowed: ${Math.round(maxOriginalSize / SIZE_UNITS.MEGABYTE)}MB.`,
      );
    }

    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const dirName = path.dirname(fileName);

    // Compute output extension and MIME type based on format
    const outputExt = this.getExtensionForFormat(outputFormat, ext);
    const mimeType = this.getMimeTypeForFormat(outputFormat, ext);

    // Build resized file name with output extension
    const resizedFileName = dirName === '.' ? `${baseName}-${size}${outputExt}` : `${dirName}/${baseName}-${size}${outputExt}`;
    this.logVerbose('Computed resized file name', { originalFileName: fileName, resizedFileName, size, outputFormat });

    // Try to get cached resized image
    this.logVerbose('Checking for cached resized image', { resizedFileName });
    try {
      const stat = await this.getMediaStat(resizedFileName);
      const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);
      this.logDebug('Cached resized image found', { resizedFileName, size: stat.size, etag });

      if (ifNoneMatch === etag) {
        this.logDebug('Cache hit on resized image - returning 304 Not Modified', { resizedFileName, etag });

        // Fire onCacheHit hook
        this.options.onCacheHit?.({
          fileName: resizedFileName,
          size,
          notModified: true,
        });

        return {
          buffer: null as unknown as Buffer,
          mimeType,
          etag,
          notModified: true,
        };
      }

      this.logInfo('Serving cached resized image', { resizedFileName, size: stat.size });
      const buffer = await this.getMedia(resizedFileName);
      const durationMs = Date.now() - startTime;

      // Fire onCacheHit hook
      this.options.onCacheHit?.({
        fileName: resizedFileName,
        size,
        notModified: false,
      });

      // Fire onImageResized hook
      this.options.onImageResized?.({
        originalFileName: fileName,
        resizedFileName,
        requestedSize: size,
        finalSize: buffer.length,
        fromCache: true,
        durationMs,
        format: outputFormat,
      });

      return {
        buffer,
        mimeType,
        etag,
        notModified: false,
      };
    } catch {
      this.logDebug('No cached resized image found, will generate', { resizedFileName });
    }

    // Generate resized image
    this.logVerbose('Fetching original image for resize', { fileName });
    const originalFile = await this.getMedia(fileName);
    this.logDebug('Original image loaded', { fileName, originalSize: originalFile.length });

    // Check original dimensions and prevent upscaling if enabled
    const autoPreventUpscale = this.options.autoPreventUpscale ?? true;
    let finalSize = size;

    if (autoPreventUpscale) {
      const image = sharp(originalFile);
      const metadata = await image.metadata();

      if (metadata.width && size > metadata.width) {
        this.logDebug('Requested size exceeds original width, preventing upscale', {
          fileName,
          requestedSize: size,
          originalWidth: metadata.width,
        });
        finalSize = metadata.width;
      }
    }

    this.logVerbose('Resizing image with Sharp', { fileName, targetWidth: finalSize, outputFormat });
    let pipeline = sharp(originalFile).resize(finalSize);
    pipeline = this.applyFormat(pipeline, outputFormat);
    const resizedBuffer = await pipeline.toBuffer();
    const etag = this.generateETagFromBuffer(resizedBuffer);
    this.logDebug('Image resized', { fileName, originalSize: originalFile.length, resizedSize: resizedBuffer.length, outputFormat, etag });

    if (ifNoneMatch === etag) {
      this.logDebug('Generated image matches ETag - returning 304 Not Modified', { fileName, etag });
      return {
        buffer: null as unknown as Buffer,
        mimeType,
        etag,
        notModified: true,
      };
    }

    // Upload to S3 asynchronously (fire-and-forget)
    this.logVerbose('Caching resized image to S3 (async)', { resizedFileName });
    this.uploadMedia(resizedFileName, resizedBuffer).catch((error) => {
      this.logWarn('Failed to cache resized image', { resizedFileName, error: error instanceof Error ? error.message : 'Unknown error' });
    });

    const durationMs = Date.now() - startTime;

    // Fire onImageResized hook
    this.options.onImageResized?.({
      originalFileName: fileName,
      resizedFileName,
      requestedSize: size,
      finalSize: resizedBuffer.length,
      fromCache: false,
      durationMs,
      format: outputFormat,
    });

    this.logInfo('Serving freshly resized image', { fileName, size, resizedSize: resizedBuffer.length });
    return {
      buffer: resizedBuffer,
      mimeType,
      etag,
      notModified: false,
    };
  }
}
