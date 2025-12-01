import { LogLevel, ModuleMetadata, Type } from '@nestjs/common';
import { ImageFormat } from '../medias.constants';
export interface S3Options {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    region: string;
    bucketName: string;
}
export interface ImageResizedEvent {
    originalFileName: string;
    resizedFileName: string;
    requestedSize: number;
    finalSize: number;
    fromCache: boolean;
    durationMs: number;
    format: ImageFormat;
}
export interface CacheHitEvent {
    fileName: string;
    size: number;
    notModified: boolean;
}
export interface FileUploadedEvent {
    fileName: string;
    size: number;
    isImage: boolean;
    dimensions?: {
        width: number;
        height: number;
    };
}
export interface PreGenerateJob {
    fileName: string;
    sizes: number[];
}
export interface MediasPreGenerationOptions {
    sizes: number[];
    dispatchJob?: (job: PreGenerateJob) => Promise<void>;
}
export type MediasLogLevel = LogLevel | 'none';
export interface MediasModuleOptions {
    s3: S3Options;
    registerController?: boolean;
    allowedExtensions?: string[];
    maxResizeWidth?: number;
    autoPreventUpscale?: boolean;
    maxOriginalFileSize?: number;
    logLevel?: MediasLogLevel;
    preferredFormat?: ImageFormat;
    enableContentNegotiation?: boolean;
    allowWebp?: boolean;
    allowAvif?: boolean;
    onImageResized?: (event: ImageResizedEvent) => void;
    onCacheHit?: (event: CacheHitEvent) => void;
    onUploaded?: (event: FileUploadedEvent) => void;
    preGeneration?: MediasPreGenerationOptions;
}
export interface MediasModuleOptionsFactory {
    createMediasModuleOptions(): Promise<MediasModuleOptions> | MediasModuleOptions;
}
export interface MediasModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<MediasModuleOptionsFactory>;
    useClass?: Type<MediasModuleOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<MediasModuleOptions> | MediasModuleOptions;
    inject?: any[];
    registerController?: boolean;
}
//# sourceMappingURL=medias-module-options.interface.d.ts.map