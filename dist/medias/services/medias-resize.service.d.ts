import { Readable } from 'stream';
import { ImageFormat } from '../medias.constants';
import { MediasModuleOptions } from '../interfaces/medias-module-options.interface';
import { MediasLoggerService } from './medias-logger.service';
import { MediasStorageService } from './medias-storage.service';
import { MediasValidationService } from './medias-validation.service';
export interface MediaBufferResponse {
    buffer: Buffer;
    mimeType: string;
    etag: string;
    notModified?: boolean;
}
export interface MediaStreamResponse {
    stream: Readable;
    mimeType: string;
    size: number;
    etag: string;
    lastModified: Date;
    notModified?: boolean;
}
export interface BatchResizeRequestItem {
    fileName: string;
    sizes: number[];
}
export interface BatchResizeResultItem {
    fileName: string;
    size: number;
    resizedFileName: string;
    success: boolean;
    error?: string;
}
interface GenerateVariantResult {
    resizedFileName: string;
    success: boolean;
    error?: string;
}
export declare class MediasResizeService {
    private readonly options;
    private readonly logger;
    private readonly storage;
    private readonly validation;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService, storage: MediasStorageService, validation: MediasValidationService);
    private applyFormat;
    getMimeTypeForFormat(format: ImageFormat, originalExt: string): string;
    getExtensionForFormat(format: ImageFormat, originalExt: string): string;
    negotiateFormat(acceptHeader?: string): ImageFormat;
    generateVariant(fileName: string, buffer: Buffer, size: number, originalWidth?: number, skipUpload?: boolean): Promise<GenerateVariantResult>;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse>;
    getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse>;
    preGenerateInline(fileName: string, buffer: Buffer, sizes: number[]): Promise<void>;
    batchResize(items: BatchResizeRequestItem[]): Promise<BatchResizeResultItem[]>;
}
export {};
//# sourceMappingURL=medias-resize.service.d.ts.map