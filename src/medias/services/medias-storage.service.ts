import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
import { MEDIAS_MODULE_OPTIONS, RETRY_CONFIG, TRANSIENT_S3_ERROR_CODES } from '../medias.constants.js';
import { MediasModuleOptions } from '../interfaces/medias-module-options.interface.js';
import { MediasLoggerService } from './medias-logger.service.js';

/**
 * File stat information
 */
export interface MediaStatResult {
  size: number;
  lastModified: Date;
  etag: string;
  metaData: Record<string, string>;
}

/**
 * Internal storage service for S3/MinIO operations
 * Handles all direct interactions with the object storage
 */
@Injectable()
export class MediasStorageService {
  constructor(
    private readonly minioService: MinioService,
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
    private readonly logger: MediasLoggerService,
  ) {
    this.logger.verbose('MediasStorageService initialized', { bucket: options.s3.bucketName });
  }

  getBucketName(): string {
    const bucketName = this.options.s3.bucketName;
    if (!bucketName) {
      this.logger.error('S3 bucket name not configured');
      throw new InternalServerErrorException('S3 bucket name not configured');
    }
    return bucketName;
  }

  // ============================================
  // Retry Logic
  // ============================================

  private isTransientError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const err = error as { code?: string; name?: string };
    const errorCode = err.code ?? err.name ?? '';

    return TRANSIENT_S3_ERROR_CODES.includes(errorCode);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async withRetry<T>(operation: () => Promise<T>, context: { operationName: string; fileName?: string }): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        this.logger.verbose(`Executing S3 operation (attempt ${attempt + 1}/${RETRY_CONFIG.MAX_ATTEMPTS})`, {
          operation: context.operationName,
          fileName: context.fileName,
        });
        return await operation();
      } catch (error) {
        attempt++;

        const isTransient = this.isTransientError(error);
        const shouldRetry = isTransient && attempt < RETRY_CONFIG.MAX_ATTEMPTS;

        if (!shouldRetry) {
          this.logger.error('S3 operation failed', {
            operation: context.operationName,
            fileName: context.fileName,
            attempt,
            isTransient,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }

        const backoffMs = RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
        this.logger.warn('Transient S3 error, retrying', {
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
  // Storage Operations
  // ============================================

  async getFileStream(fileName: string): Promise<Readable> {
    this.logger.verbose('Fetching file stream from S3', { fileName, bucket: this.getBucketName() });
    try {
      const fileStream = await this.withRetry(
        () => this.minioService.client.getObject(this.getBucketName(), fileName) as Promise<Readable>,
        { operationName: 'getObject', fileName },
      );
      this.logger.verbose('File stream obtained', { fileName });
      return fileStream;
    } catch (error) {
      this.logger.error('File not found in S3', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  async getFile(fileName: string): Promise<Buffer> {
    this.logger.verbose('Loading file into buffer', { fileName });

    try {
      const fileStream = await this.getFileStream(fileName);

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        fileStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        fileStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          this.logger.debug('File loaded into buffer', { fileName, size: buffer.length });
          resolve(buffer);
        });

        fileStream.on('error', (error) => {
          this.logger.error('Error reading file stream', { fileName, error: error.message });
          reject(error);
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to get file', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  async getFileStat(fileName: string): Promise<MediaStatResult> {
    this.logger.verbose('Fetching file stat from S3', { fileName });
    try {
      const stat = await this.withRetry(() => this.minioService.client.statObject(this.getBucketName(), fileName), { operationName: 'statObject', fileName });
      this.logger.verbose('File stat obtained', { fileName, size: stat.size });
      return stat;
    } catch (error) {
      this.logger.error('File stat not found', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }

  async putFile(fileName: string, file: Buffer, metadata?: Record<string, string>): Promise<void> {
    this.logger.verbose('Uploading file to S3', { fileName, size: file.length });
    await this.withRetry(
      () => (metadata ? this.minioService.client.putObject(this.getBucketName(), fileName, file, metadata) : this.minioService.client.putObject(this.getBucketName(), fileName, file)),
      { operationName: 'putObject', fileName },
    );
    this.logger.info('File uploaded to S3', { fileName, size: file.length });
  }

  async deleteFile(fileName: string): Promise<void> {
    this.logger.verbose('Deleting file from S3', { fileName });
    await this.withRetry(() => this.minioService.client.removeObject(this.getBucketName(), fileName), { operationName: 'removeObject', fileName });
    this.logger.info('File deleted from S3', { fileName });
  }
}
