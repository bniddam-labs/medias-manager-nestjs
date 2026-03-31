import { OnModuleInit } from '@nestjs/common';
import { MediasModuleOptions } from '../interfaces/medias-module-options.interface';
import { MediasLoggerService } from './medias-logger.service';
import { MediasStorageService } from './medias-storage.service';
import { MediasValidationService } from './medias-validation.service';
export declare class MediasVideoService implements OnModuleInit {
    private readonly options;
    private readonly logger;
    private readonly storage;
    private readonly validation;
    private ffmpegAvailable;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService, storage: MediasStorageService, validation: MediasValidationService);
    onModuleInit(): Promise<void>;
    private checkFfmpegAvailability;
    isFfmpegAvailable(): boolean;
    parseTimestamp(timestamp: number | string | undefined, videoDuration: number): number;
    private writeTempFile;
    private cleanupTempFile;
    getVideoDuration(videoBuffer: Buffer): Promise<number>;
    extractFrame(videoBuffer: Buffer, timestampSeconds: number): Promise<Buffer>;
    private extractFrameAtTimestamp;
    private applyFormat;
    private getExtensionForFormat;
    generateThumbnailsInline(fileName: string, videoBuffer: Buffer, sizes: number[], thumbnailTimestamp?: number | string): Promise<void>;
}
//# sourceMappingURL=medias-video.service.d.ts.map