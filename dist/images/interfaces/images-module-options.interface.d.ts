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
export interface ImagesModuleOptions {
    s3: S3Options;
    registerController?: boolean;
    routePrefix?: string;
}
export interface ImagesModuleOptionsFactory {
    createImagesModuleOptions(): Promise<ImagesModuleOptions> | ImagesModuleOptions;
}
export interface ImagesModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<ImagesModuleOptionsFactory>;
    useClass?: Type<ImagesModuleOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<ImagesModuleOptions> | ImagesModuleOptions;
    inject?: any[];
    registerController?: boolean;
}
//# sourceMappingURL=images-module-options.interface.d.ts.map