import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import * as path from 'path';
import sharp from 'sharp';
import { IMAGES_MODULE_OPTIONS } from './images.constants';
import { ImagesModuleOptions } from './interfaces/images-module-options.interface';

export interface ImageStreamResponse {
  stream: Readable;
  mimeType: string;
  size: number;
  etag: string;
  lastModified: Date;
  notModified?: boolean;
}

export interface ImageBufferResponse {
  buffer: Buffer;
  mimeType: string;
  etag: string;
  notModified?: boolean;
}

@Injectable()
export class ImagesService {
  constructor(
    private readonly minioService: MinioService,
    @Inject(IMAGES_MODULE_OPTIONS)
    private readonly options: ImagesModuleOptions,
  ) {}

  private getBucketName(): string {
    const bucketName = this.options.s3.bucketName;
    if (!bucketName) {
      throw new InternalServerErrorException('S3 bucket name not configured');
    }
    return bucketName;
  }

  /**
   * Get MIME type from file extension
   * @param ext File extension (including dot)
   * @returns MIME type string
   */
  getMimeType(ext: string): string {
    switch (ext.toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Generate ETag from file metadata
   * @param fileName File name
   * @param lastModified Last modified date
   * @param size File size in bytes
   * @returns ETag string
   */
  generateETag(fileName: string, lastModified: Date, size: number): string {
    const hash = crypto
      .createHash('md5')
      .update(`${fileName}-${lastModified.getTime()}-${size}`)
      .digest('hex');
    return `"${hash}"`;
  }

  /**
   * Generate ETag from buffer content
   * @param buffer File buffer
   * @returns ETag string
   */
  generateETagFromBuffer(buffer: Buffer): string {
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    return `"${hash}"`;
  }

  /**
   * Get original image as a stream with metadata (memory-efficient)
   * Use this method to serve images efficiently in your custom controller
   * @param fileName Name of the file to retrieve
   * @param ifNoneMatch ETag value from If-None-Match header for 304 support
   * @returns Image stream with metadata and headers
   */
  async getImageStream(fileName: string, ifNoneMatch?: string): Promise<ImageStreamResponse> {
    const ext = path.extname(fileName);
    const mimeType = this.getMimeType(ext);

    // Get file metadata
    const stat = await this.getFileStat(fileName);
    const etag = this.generateETag(fileName, stat.lastModified, stat.size);

    // Check if client has cached version
    if (ifNoneMatch === etag) {
      return {
        stream: null as any, // Won't be used when notModified is true
        mimeType,
        size: stat.size,
        etag,
        lastModified: stat.lastModified,
        notModified: true,
      };
    }

    // Get file stream
    const stream = await this.getFileStream(fileName);

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
   * Get resized image with automatic caching
   * Use this method to serve resized images efficiently in your custom controller
   * @param fileName Original file name
   * @param size Desired width in pixels
   * @param ifNoneMatch ETag value from If-None-Match header for 304 support
   * @returns Resized image buffer with metadata and headers
   */
  async getResizedImage(fileName: string, size: number, ifNoneMatch?: string): Promise<ImageBufferResponse> {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const resizedFileName = `${baseName}-${size}${ext}`;
    const mimeType = this.getMimeType(ext);

    // Try to get cached resized image
    try {
      const stat = await this.getFileStat(resizedFileName);
      const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);

      // Check if client has cached version
      if (ifNoneMatch === etag) {
        return {
          buffer: null as any, // Won't be used when notModified is true
          mimeType,
          etag,
          notModified: true,
        };
      }

      // Get cached resized image
      const buffer = await this.getFile(resizedFileName);
      return {
        buffer,
        mimeType,
        etag,
        notModified: false,
      };
    } catch (error) {
      // Cached version not found, generate it
    }

    // Generate resized image
    const originalFile = await this.getFile(fileName);
    const resizedBuffer = await sharp(originalFile).resize(size).toBuffer();
    const etag = this.generateETagFromBuffer(resizedBuffer);

    // Check ETag before returning
    if (ifNoneMatch === etag) {
      return {
        buffer: null as any,
        mimeType,
        etag,
        notModified: true,
      };
    }

    // Upload to S3 asynchronously (don't wait)
    this.uploadFile(resizedFileName, resizedBuffer).catch(() => {
      // Silently fail - caching is optional
    });

    return {
      buffer: resizedBuffer,
      mimeType,
      etag,
      notModified: false,
    };
  }

  /**
   * Get file as a stream (memory-efficient for large files)
   * @param fileName Name of the file to retrieve
   * @returns Readable stream of the file
   */
  async getFileStream(fileName: string): Promise<Readable> {
    try {
      const fileStream = (await this.minioService.client.getObject(
        this.getBucketName(),
        fileName,
      )) as Readable;
      return fileStream;
    } catch (error) {
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  /**
   * Get file as a buffer (use for small files or when processing is needed)
   * WARNING: Loads entire file into memory - not suitable for large files
   * @param fileName Name of the file to retrieve
   * @returns Buffer containing the file contents
   */
  async getFile(fileName: string): Promise<Buffer> {
    try {
      const fileStream = await this.getFileStream(fileName);

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
   * Get file metadata (size, content-type, etc.)
   * @param fileName Name of the file
   * @returns File stat information
   */
  async getFileStat(fileName: string): Promise<{
    size: number;
    lastModified: Date;
    etag: string;
    metaData: Record<string, string>;
  }> {
    try {
      return await this.minioService.client.statObject(this.getBucketName(), fileName);
    } catch (error) {
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  async uploadFile(fileName: string, file: Buffer): Promise<void> {
    await this.minioService.client.putObject(this.getBucketName(), fileName, file);
  }

  deleteFile(fileName: string): Promise<void> {
    return this.minioService.client.removeObject(this.getBucketName(), fileName);
  }
}
