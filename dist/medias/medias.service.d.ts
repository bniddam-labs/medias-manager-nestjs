import { Readable } from 'stream';
import { ImageFormat } from './medias.constants';
import { MediasModuleOptions } from './interfaces/medias-module-options.interface';
import { MediasLoggerService, MediasStorageService, MediasValidationService, MediasResizeService, MediaStatResult, MediaBufferResponse, MediaStreamResponse, BatchResizeRequestItem, BatchResizeResultItem } from './services';
export { MediaStatResult, MediaBufferResponse, MediaStreamResponse, BatchResizeRequestItem, BatchResizeResultItem };
export declare class MediasService {
    private readonly options;
    private readonly logger;
    private readonly storage;
    private readonly validation;
    private readonly resize;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService, storage: MediasStorageService, validation: MediasValidationService, resize: MediasResizeService);
    isImage(fileName: string): boolean;
    isResizable(fileName: string): boolean;
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
    deleteMedia(fileName: string): Promise<void>;
    getImageStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse>;
    getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse>;
    batchResize(items: BatchResizeRequestItem[]): Promise<BatchResizeResultItem[]>;
}
//# sourceMappingURL=medias.service.d.ts.map