import { LogLevel, ModuleMetadata, Type } from '@nestjs/common';
import { ImageFormat } from '../medias.constants';

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
 * Event fired when an image is resized
 */
export interface ImageResizedEvent {
  /** Original file name */
  originalFileName: string;
  /** Resized file name (cached) */
  resizedFileName: string;
  /** Requested size in pixels */
  requestedSize: number;
  /** Final resized buffer size in bytes */
  finalSize: number;
  /** Whether the resized image was served from cache */
  fromCache: boolean;
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Format used for the resized image */
  format: ImageFormat;
}

/**
 * Event fired when a cached image is hit
 */
export interface CacheHitEvent {
  /** File name that was served from cache */
  fileName: string;
  /** Requested size (0 for original) */
  size: number;
  /** Whether it was a 304 Not Modified response */
  notModified: boolean;
}

/**
 * Event fired when a file is uploaded
 */
export interface FileUploadedEvent {
  /** File name */
  fileName: string;
  /** File size in bytes */
  size: number;
  /** Whether the file is an image */
  isImage: boolean;
  /** Image dimensions if available */
  dimensions?: { width: number; height: number };
}

/**
 * Pre-generation job for image variants
 */
export interface PreGenerateJob {
  /** Full path to the original file in the bucket */
  fileName: string;
  /** Sizes to generate (in pixels) */
  sizes: number[];
}

/**
 * Pre-generation configuration options
 */
export interface MediasPreGenerationOptions {
  /**
   * List of sizes in pixels to pre-generate (e.g., [200, 400, 800])
   * If empty or undefined, no pre-generation occurs.
   */
  sizes: number[];

  /**
   * Optional: Callback to delegate variant creation to an external queue
   * - If defined: uploadMedia dispatches a job instead of generating inline
   * - If undefined: Falls back to inline generation (synchronous loop in process)
   *
   * Use this for offloading heavy work to background workers (Bull, BullMQ, RabbitMQ, etc.)
   */
  dispatchJob?: (job: PreGenerateJob) => Promise<void>;
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
   * Optional: Custom list of allowed file extensions
   * If not provided, all supported extensions are allowed
   */
  allowedExtensions?: string[];

  /**
   * Optional: Maximum width for image resizing in pixels (default: 1200)
   *
   * This limits the maximum width that can be requested for resized images.
   * Setting a realistic limit helps prevent excessive memory and CPU usage.
   *
   * @default 1200
   */
  maxResizeWidth?: number;

  /**
   * Optional: Prevent upscaling images beyond their original width (default: true)
   *
   * When true, if a requested size exceeds the original image width,
   * the image will be resized to its original width instead of upscaling.
   * This prevents quality degradation and unnecessary CPU usage.
   *
   * @default true
   */
  autoPreventUpscale?: boolean;

  /**
   * Optional: Maximum size in bytes for original images to be resized on-the-fly (default: 15MB)
   *
   * Images larger than this limit will throw an error when resize is requested.
   * This protects against "image bombs" and excessive memory usage during resize operations.
   * Set to 0 to disable this check (not recommended for production).
   *
   * @default 15728640 (15MB)
   */
  maxOriginalFileSize?: number;

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

  /**
   * Optional: Preferred output format for resized images (default: 'original')
   *
   * - 'original': Keep the original format
   * - 'jpeg': Convert to JPEG (quality: 85)
   * - 'webp': Convert to WebP (quality: 80, smaller file size)
   * - 'avif': Convert to AVIF (quality: 75, best compression)
   *
   * Note: This is overridden by content negotiation if enabled.
   *
   * @default 'original'
   */
  preferredFormat?: ImageFormat;

  /**
   * Optional: Enable content negotiation based on Accept header (default: false)
   *
   * When enabled, the server will analyze the Accept header and serve
   * the best supported format (AVIF > WebP > JPEG > original).
   * Adds "Vary: Accept" header for proper CDN caching.
   *
   * Requires allowWebp and/or allowAvif to be true for those formats.
   *
   * @default false
   */
  enableContentNegotiation?: boolean;

  /**
   * Optional: Allow WebP format conversion (default: true)
   *
   * @default true
   */
  allowWebp?: boolean;

  /**
   * Optional: Allow AVIF format conversion (default: true)
   *
   * @default true
   */
  allowAvif?: boolean;

  /**
   * Optional: Callback fired when an image is resized
   *
   * Useful for monitoring, analytics, or custom logging.
   */
  onImageResized?: (event: ImageResizedEvent) => void;

  /**
   * Optional: Callback fired when a cached resource is served
   *
   * Useful for cache hit/miss analytics.
   */
  onCacheHit?: (event: CacheHitEvent) => void;

  /**
   * Optional: Callback fired when a file is uploaded
   *
   * Useful for tracking uploads, updating databases, or triggering workflows.
   */
  onUploaded?: (event: FileUploadedEvent) => void;

  /**
   * Optional: Pre-generation configuration for image variants
   *
   * When enabled, generates specified image sizes immediately upon upload
   * instead of waiting for the first request. This reduces latency and CPU spikes
   * for frequently accessed images.
   *
   * Example:
   * ```typescript
   * preGeneration: {
   *   sizes: [200, 400, 800],  // Generate these sizes on upload
   *   dispatchJob: async (job) => {
   *     // Optional: delegate to a queue (Bull, BullMQ, etc.)
   *     await imageQueue.add('resize', job);
   *   }
   * }
   * ```
   */
  preGeneration?: MediasPreGenerationOptions;
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
}
