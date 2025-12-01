import { ModuleMetadata, Type } from '@nestjs/common';
export interface S3Options {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    region: string;
    bucketName: string;
}
export interface MediasModuleOptions {
    s3: S3Options;
    registerController?: boolean;
    routePrefix?: string;
    allowedExtensions?: string[];
    maxResizeWidth?: number;
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
    routePrefix?: string;
}
//# sourceMappingURL=medias-module-options.interface.d.ts.map