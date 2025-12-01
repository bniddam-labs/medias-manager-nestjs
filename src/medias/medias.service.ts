import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { MinioService } from 'nestjs-minio-client';
import * as path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';
import { MediasLogLevel, MediasModuleOptions } from './interfaces/medias-module-options.interface';
import { IMAGE_EXTENSIONS, MEDIAS_MODULE_OPTIONS, MIME_TYPES, RESIZABLE_IMAGE_EXTENSIONS } from './medias.constants';

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
      const fileStream = (await this.minioService.client.getObject(this.getBucketName(), fileName)) as Readable;
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
      const stat = await this.minioService.client.statObject(this.getBucketName(), fileName);
      this.logVerbose('File stat obtained', { fileName, size: stat.size });
      return stat;
    } catch (error) {
      this.logError('File stat not found', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  /**
   * Upload any media file to S3
   */
  async uploadMedia(fileName: string, file: Buffer): Promise<void> {
    this.logVerbose('Uploading file to S3', { fileName, size: file.length });
    await this.minioService.client.putObject(this.getBucketName(), fileName, file);
    this.logInfo('File uploaded to S3', { fileName, size: file.length });
  }

  /**
   * Delete any media file from S3
   */
  async deleteMedia(fileName: string): Promise<void> {
    this.logVerbose('Deleting file from S3', { fileName });
    await this.minioService.client.removeObject(this.getBucketName(), fileName);
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
   * @returns Resized image buffer with metadata
   * @throws BadRequestException if file is not a resizable image
   */
  async getResizedImage(fileName: string, size: number, ifNoneMatch?: string): Promise<MediaBufferResponse> {
    this.logVerbose('getResizedImage called', { fileName, size, hasIfNoneMatch: !!ifNoneMatch });

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
    const maxWidth = this.options.maxResizeWidth || 5000;
    if (size > maxWidth) {
      this.logWarn('Resize size exceeds maximum', { fileName, size, maxWidth });
      throw new BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
    }

    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const dirName = path.dirname(fileName);
    const resizedFileName = dirName === '.' ? `${baseName}-${size}${ext}` : `${dirName}/${baseName}-${size}${ext}`;
    const mimeType = this.getMimeType(ext);
    this.logVerbose('Computed resized file name', { originalFileName: fileName, resizedFileName, size });

    // Try to get cached resized image
    this.logVerbose('Checking for cached resized image', { resizedFileName });
    try {
      const stat = await this.getMediaStat(resizedFileName);
      const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);
      this.logDebug('Cached resized image found', { resizedFileName, size: stat.size, etag });

      if (ifNoneMatch === etag) {
        this.logDebug('Cache hit on resized image - returning 304 Not Modified', { resizedFileName, etag });
        return {
          buffer: null as unknown as Buffer,
          mimeType,
          etag,
          notModified: true,
        };
      }

      this.logInfo('Serving cached resized image', { resizedFileName, size: stat.size });
      const buffer = await this.getMedia(resizedFileName);
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

    this.logVerbose('Resizing image with Sharp', { fileName, targetWidth: size });
    const resizedBuffer = await sharp(originalFile).resize(size).toBuffer();
    const etag = this.generateETagFromBuffer(resizedBuffer);
    this.logDebug('Image resized', { fileName, originalSize: originalFile.length, resizedSize: resizedBuffer.length, etag });

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

    this.logInfo('Serving freshly resized image', { fileName, size, resizedSize: resizedBuffer.length });
    return {
      buffer: resizedBuffer,
      mimeType,
      etag,
      notModified: false,
    };
  }
}
