import { LogLevel, ModuleMetadata, Type } from '@nestjs/common';

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
 * Log level for the medias module
 * - 'none': No logging
 * - 'error': Only errors
 * - 'warn': Errors and warnings
 * - 'log': Errors, warnings, and general info (default)
 * - 'debug': All above plus debug info (cache hits, ETags, etc.)
 * - 'verbose': All logs including detailed step-by-step traces
 */
export type MediasLogLevel = LogLevel | 'none';

/**
 * Medias module configuration options
 */
export interface MediasModuleOptions {
  /**
   * S3/MinIO configuration
   */
  s3: S3Options;

  /**
   * Optional: Register the built-in MediasController (default: false)
   *
   * Set to true for convenience if you want the default /medias endpoints.
   * Set to false (recommended) to create your own controller with custom logic,
   * authentication, rate limiting, etc.
   *
   * @default false
   */
  registerController?: boolean;

  /**
   * Optional: Override the default route prefix when using built-in controller (default: 'medias')
   * Only applies if registerController is true
   */
  routePrefix?: string;

  /**
   * Optional: Custom list of allowed file extensions
   * If not provided, all supported extensions are allowed
   */
  allowedExtensions?: string[];

  /**
   * Optional: Maximum width for image resizing (default: 5000)
   */
  maxResizeWidth?: number;

  /**
   * Optional: Log level for the medias module (default: 'none')
   *
   * - 'none': No logging (default)
   * - 'error': Only errors
   * - 'warn': Errors and warnings
   * - 'log': Errors, warnings, and general info
   * - 'debug': All above plus debug info (cache hits, ETags, etc.)
   * - 'verbose': All logs including detailed step-by-step traces
   */
  logLevel?: MediasLogLevel;
}

/**
 * Options factory interface for async configuration
 */
export interface MediasModuleOptionsFactory {
  createMediasModuleOptions(): Promise<MediasModuleOptions> | MediasModuleOptions;
}

/**
 * Async configuration options
 */
export interface MediasModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Use existing provider
   */
  useExisting?: Type<MediasModuleOptionsFactory>;

  /**
   * Use class
   */
  useClass?: Type<MediasModuleOptionsFactory>;

  /**
   * Use factory function
   */
  useFactory?: (...args: any[]) => Promise<MediasModuleOptions> | MediasModuleOptions;

  /**
   * Dependencies to inject into factory function
   */
  inject?: any[];

  /**
   * Optional: Register the built-in MediasController (default: false)
   *
   * Note: For async configuration, this must be specified here at module
   * registration time, not in the factory-returned options.
   *
   * @default false
   */
  registerController?: boolean;

  /**
   * Optional: Override the default route prefix when using built-in controller (default: 'medias')
   * Only applies if registerController is true
   *
   * Note: For async configuration, this must be specified here at module
   * registration time, not in the factory-returned options.
   */
  routePrefix?: string;
}
