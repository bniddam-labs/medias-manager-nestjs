import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import * as path from 'path';
import sharp from 'sharp';
import { MEDIAS_MODULE_OPTIONS, MIME_TYPES, IMAGE_EXTENSIONS, RESIZABLE_IMAGE_EXTENSIONS } from './medias.constants';
import { MediasModuleOptions } from './interfaces/medias-module-options.interface';

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

@Injectable()
export class MediasService {
  constructor(
    private readonly minioService: MinioService,
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
  ) {}

  private getBucketName(): string {
    const bucketName = this.options.s3.bucketName;
    if (!bucketName) {
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
    const ext = path.extname(fileName);
    const mimeType = this.getMimeType(ext);

    const stat = await this.getMediaStat(fileName);
    const etag = this.generateETag(fileName, stat.lastModified, stat.size);

    if (ifNoneMatch === etag) {
      return {
        stream: null as unknown as Readable,
        mimeType,
        size: stat.size,
        etag,
        lastModified: stat.lastModified,
        notModified: true,
      };
    }

    const stream = await this.getMediaFileStream(fileName);

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
    try {
      const fileStream = await this.getMediaFileStream(fileName);

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        fileStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        fileStream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        fileStream.on('error', reject);
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  /**
   * Get raw file stream from S3
   */
  async getMediaFileStream(fileName: string): Promise<Readable> {
    try {
      const fileStream = (await this.minioService.client.getObject(this.getBucketName(), fileName)) as Readable;
      return fileStream;
    } catch {
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  /**
   * Get file metadata (size, content-type, etc.)
   */
  async getMediaStat(fileName: string): Promise<MediaStatResult> {
    try {
      return await this.minioService.client.statObject(this.getBucketName(), fileName);
    } catch {
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  /**
   * Upload any media file to S3
   */
  async uploadMedia(fileName: string, file: Buffer): Promise<void> {
    await this.minioService.client.putObject(this.getBucketName(), fileName, file);
  }

  /**
   * Delete any media file from S3
   */
  async deleteMedia(fileName: string): Promise<void> {
    await this.minioService.client.removeObject(this.getBucketName(), fileName);
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
    if (!this.isImage(fileName)) {
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
    // Validate that file is resizable
    if (!this.isResizable(fileName)) {
      const ext = path.extname(fileName).toLowerCase();
      if (this.isImage(fileName)) {
        throw new BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${RESIZABLE_IMAGE_EXTENSIONS.join(', ')}`);
      }
      throw new BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
    }

    // Validate size
    const maxWidth = this.options.maxResizeWidth || 5000;
    if (size > maxWidth) {
      throw new BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
    }

    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const dirName = path.dirname(fileName);
    const resizedFileName = dirName === '.' ? `${baseName}-${size}${ext}` : `${dirName}/${baseName}-${size}${ext}`;
    const mimeType = this.getMimeType(ext);

    // Try to get cached resized image
    try {
      const stat = await this.getMediaStat(resizedFileName);
      const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);

      if (ifNoneMatch === etag) {
        return {
          buffer: null as unknown as Buffer,
          mimeType,
          etag,
          notModified: true,
        };
      }

      const buffer = await this.getMedia(resizedFileName);
      return {
        buffer,
        mimeType,
        etag,
        notModified: false,
      };
    } catch {
      // Cached version not found, generate it
    }

    // Generate resized image
    const originalFile = await this.getMedia(fileName);
    const resizedBuffer = await sharp(originalFile).resize(size).toBuffer();
    const etag = this.generateETagFromBuffer(resizedBuffer);

    if (ifNoneMatch === etag) {
      return {
        buffer: null as unknown as Buffer,
        mimeType,
        etag,
        notModified: true,
      };
    }

    // Upload to S3 asynchronously (fire-and-forget)
    this.uploadMedia(resizedFileName, resizedBuffer).catch(() => {
      // Silently fail - caching is optional
    });

    return {
      buffer: resizedBuffer,
      mimeType,
      etag,
      notModified: false,
    };
  }
}
