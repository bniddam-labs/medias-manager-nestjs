import { LogLevel, ModuleMetadata, Type } from '@nestjs/common';
export interface S3Options {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    region: string;
    bucketName: string;
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