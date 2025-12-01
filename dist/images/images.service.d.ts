import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
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
export declare class ImagesService {
    private readonly minioService;
    private readonly options;
    constructor(minioService: MinioService, options: ImagesModuleOptions);
    private getBucketName;
    getMimeType(ext: string): string;
    generateETag(fileName: string, lastModified: Date, size: number): string;
    generateETagFromBuffer(buffer: Buffer): string;
    getImageStream(fileName: string, ifNoneMatch?: string): Promise<ImageStreamResponse>;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string): Promise<ImageBufferResponse>;
    getFileStream(fileName: string): Promise<Readable>;
    getFile(fileName: string): Promise<Buffer>;
    getFileStat(fileName: string): Promise<{
        size: number;
        lastModified: Date;
        etag: string;
        metaData: Record<string, string>;
    }>;
    uploadFile(fileName: string, file: Buffer): Promise<void>;
    deleteFile(fileName: string): Promise<void>;
}
//# sourceMappingURL=images.service.d.ts.map