import { MediasModuleOptions } from '../interfaces/medias-module-options.interface';
import { MediasLoggerService } from './medias-logger.service';
export declare class MediasValidationService {
    private readonly options;
    private readonly logger;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService);
    isImage(fileName: string): boolean;
    isResizable(fileName: string): boolean;
    getMimeType(ext: string): string;
    validateResizable(fileName: string): void;
    validateResizeSize(fileName: string, size: number): void;
    generateETag(fileName: string, lastModified: Date, size: number): string;
    generateETagFromBuffer(buffer: Buffer): string;
    buildResizedFileName(fileName: string, size: number, outputExt: string): string;
    getExtension(fileName: string): string;
    getMaxResizeWidth(): number;
    isAutoPreventUpscaleEnabled(): boolean;
}
//# sourceMappingURL=medias-validation.service.d.ts.map