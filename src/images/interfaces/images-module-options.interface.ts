import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * S3/MinIO configuration options
 */
export interface S3Options {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region: string;
  bucketName: string;
}

/**
 * Images module configuration options
 */
export interface ImagesModuleOptions {
  /**
   * S3/MinIO configuration
   */
  s3: S3Options;

  /**
   * Optional: Register the built-in ImagesController (default: false)
   *
   * Set to true for convenience if you want the default /images endpoints.
   * Set to false (recommended) to create your own controller with custom logic,
   * authentication, rate limiting, etc.
   *
   * @default false
   */
  registerController?: boolean;

  /**
   * Optional: Override the default route prefix when using built-in controller (default: 'images')
   * Only applies if registerController is true
   */
  routePrefix?: string;
}

/**
 * Options factory interface for async configuration
 */
export interface ImagesModuleOptionsFactory {
  createImagesModuleOptions(): Promise<ImagesModuleOptions> | ImagesModuleOptions;
}

/**
 * Async configuration options
 */
export interface ImagesModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Use existing provider
   */
  useExisting?: Type<ImagesModuleOptionsFactory>;

  /**
   * Use class
   */
  useClass?: Type<ImagesModuleOptionsFactory>;

  /**
   * Use factory function
   */
  useFactory?: (...args: any[]) => Promise<ImagesModuleOptions> | ImagesModuleOptions;

  /**
   * Dependencies to inject into factory function
   */
  inject?: any[];

  /**
   * Optional: Register the built-in ImagesController (default: false)
   *
   * Note: For async configuration, this must be specified here at module
   * registration time, not in the factory-returned options.
   *
   * @default false
   */
  registerController?: boolean;
}
