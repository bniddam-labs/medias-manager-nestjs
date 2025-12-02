import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
import { MediasModuleOptions } from '../interfaces/medias-module-options.interface';
import { MediasLoggerService } from './medias-logger.service';
export interface MediaStatResult {
    size: number;
    lastModified: Date;
    etag: string;
    metaData: Record<string, string>;
}
export declare class MediasStorageService {
    private readonly minioService;
    private readonly options;
    private readonly logger;
    constructor(minioService: MinioService, options: MediasModuleOptions, logger: MediasLoggerService);
    getBucketName(): string;
    private isTransientError;
    private delay;
    withRetry<T>(operation: () => Promise<T>, context: {
        operationName: string;
        fileName?: string;
    }): Promise<T>;
    getFileStream(fileName: string): Promise<Readable>;
    getFile(fileName: string): Promise<Buffer>;
    getFileStat(fileName: string): Promise<MediaStatResult>;
    putFile(fileName: string, file: Buffer, metadata?: Record<string, string>): Promise<void>;
    deleteFile(fileName: string): Promise<void>;
}
//# sourceMappingURL=medias-storage.service.d.ts.map