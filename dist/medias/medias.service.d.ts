import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
import { MediasModuleOptions } from './interfaces/medias-module-options.interface';
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
    constructor(minioService: MinioService, options: MediasModuleOptions);
    private getBucketName;
    isImage(fileName: string): boolean;
    isResizable(fileName: string): boolean;
    getMimeType(ext: string): string;
    generateETag(fileName: string, lastModified: Date, size: number): string;
    generateETagFromBuffer(buffer: Buffer): string;
    getMediaStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getMedia(fileName: string): Promise<Buffer>;
    getMediaFileStream(fileName: string): Promise<Readable>;
    getMediaStat(fileName: string): Promise<MediaStatResult>;
    uploadMedia(fileName: string, file: Buffer): Promise<void>;
    deleteMedia(fileName: string): Promise<void>;
    getImageStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string): Promise<MediaBufferResponse>;
}
//# sourceMappingURL=medias.service.d.ts.map