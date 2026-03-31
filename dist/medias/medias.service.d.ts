import { Readable } from 'node:stream';
import { MediasModuleOptions } from './interfaces/medias-module-options.interface';
import { ImageFormat } from './medias.constants';
import { BatchResizeRequestItem, BatchResizeResultItem, MediaBufferResponse, MediaStatResult, MediaStreamResponse, MediasLoggerService, MediasResizeService, MediasStorageService, MediasValidationService, MediasVideoService } from './services';
export { BatchResizeRequestItem, BatchResizeResultItem, MediaBufferResponse, MediaStatResult, MediaStreamResponse };
export declare class MediasService {
    private readonly options;
    private readonly logger;
    private readonly storage;
    private readonly validation;
    private readonly resize;
    private readonly video;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService, storage: MediasStorageService, validation: MediasValidationService, resize: MediasResizeService, video: MediasVideoService);
    isImage(fileName: string): boolean;
    isResizable(fileName: string): boolean;
    isVideo(fileName: string): boolean;
    getMimeType(ext: string): string;
    generateETag(fileName: string, lastModified: Date, size: number): string;
    generateETagFromBuffer(buffer: Buffer): string;
    negotiateFormat(acceptHeader?: string): ImageFormat;
    getMediaStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getMedia(fileName: string): Promise<Buffer>;
    getMediaFileStream(fileName: string): Promise<Readable>;
    getMediaStat(fileName: string): Promise<MediaStatResult>;
    uploadMedia(fileName: string, file: Buffer, originalName?: string, skipPreGeneration?: boolean): Promise<void>;
    private triggerPreGeneration;
    private triggerVideoThumbnailGeneration;
    deleteMedia(fileName: string): Promise<void>;
    getImageStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse>;
    getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse>;
    batchResize(items: BatchResizeRequestItem[]): Promise<BatchResizeResultItem[]>;
}
//# sourceMappingURL=medias.service.d.ts.map