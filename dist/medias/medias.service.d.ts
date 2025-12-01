import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
import { MediasModuleOptions } from './interfaces/medias-module-options.interface';
import { ImageFormat } from './medias.constants';
export interface MediaStreamResponse {
    stream: Readable;
    mimeType: string;
    size: number;
    etag: string;
    lastModified: Date;
    notModified?: boolean;
}
export interface MediaBufferResponse {
    buffer: Buffer;
    mimeType: string;
    etag: string;
    notModified?: boolean;
}
export interface MediaStatResult {
    size: number;
    lastModified: Date;
    etag: string;
    metaData: Record<string, string>;
}
export declare class MediasService {
    private readonly minioService;
    private readonly options;
    private readonly logger;
    private readonly logLevel;
    constructor(minioService: MinioService, options: MediasModuleOptions);
    private shouldLog;
    private logError;
    private logWarn;
    private logInfo;
    private logDebug;
    private logVerbose;
    private getBucketName;
    private isTransientError;
    private delay;
    private withRetry;
    isImage(fileName: string): boolean;
    isResizable(fileName: string): boolean;
    getMimeType(ext: string): string;
    generateETag(fileName: string, lastModified: Date, size: number): string;
    generateETagFromBuffer(buffer: Buffer): string;
    private applyFormat;
    private getMimeTypeForFormat;
    private getExtensionForFormat;
    negotiateFormat(acceptHeader?: string): ImageFormat;
    getMediaStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getMedia(fileName: string): Promise<Buffer>;
    getMediaFileStream(fileName: string): Promise<Readable>;
    getMediaStat(fileName: string): Promise<MediaStatResult>;
    private preGenerateInline;
    uploadMedia(fileName: string, file: Buffer, originalName?: string, skipPreGeneration?: boolean): Promise<void>;
    private triggerPreGeneration;
    deleteMedia(fileName: string): Promise<void>;
    getImageStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    private validateResizable;
    private validateResizeSize;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse>;
    getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse>;
}
//# sourceMappingURL=medias.service.d.ts.map