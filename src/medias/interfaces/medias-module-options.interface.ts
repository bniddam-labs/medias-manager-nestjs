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
 * Event fired when a video thumbnail is generated.
 *
 * Fires once **per thumbnail** — both during post-upload batch generation
 * and on-demand requests (GET /medias/clip.mp4?size=400).
 * Use for per-thumbnail monitoring/analytics.
 *
 * For a single "all thumbnails done" notification after upload,
 * use `onProcessingCompleted` instead.
 */
export interface VideoThumbnailGeneratedEvent {
  /** Original video file name */
  originalFileName: string;
  /** Generated thumbnail file name */
  thumbnailFileName: string;
  /** Requested thumbnail width in pixels */
  requestedSize: number;
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Format used for the thumbnail */
  format: ImageFormat;
}

/**
 * Event fired once when all post-upload background processing is complete
 * for a given file (all image variants OR all video thumbnails).
 *
 * Only fires in inline mode. In queue/dispatchJob mode, the library cannot
 * know when the external worker finishes — handle completion there instead.
 */
export interface ProcessingCompletedEvent {
  /** Original uploaded file name */
  originalFileName: string;
  /** Type of processing that was performed */
  type: 'image-variants' | 'video-thumbnails';
  /** Names of all successfully generated files in S3 */
  generatedFiles: string[];
  /** Total processing duration in milliseconds */
  totalDurationMs: number;
}

/**
 * Event fired when a file and its variants are deleted
 */
export interface MediaDeletedEvent {
  /** Original file that was deleted */
  fileName: string;
  /** Variant files that were successfully deleted */
  deletedVariants: string[];
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
 * Video thumbnail generation job for queue-based processing
 */
export interface VideoThumbnailJob {
  /** Full path to the original video file in the bucket */
  fileName: string;
  /** Thumbnail sizes to generate (in pixels) */
  sizes: number[];
  /** Timestamp for frame extraction (seconds or "10%" string) */
  thumbnailTimestamp?: number | string;
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
 * Video thumbnail generation configuration
 */
export interface VideoThumbnailOptions {
  /**
   * List of thumbnail widths in pixels to generate (e.g., [200, 400, 800])
   */
  sizes: number[];

  /**
   * Timestamp for frame extraction.
   * - Number: seconds into the video (e.g., 5.5)
   * - String with %: percentage of video duration (e.g., "10%")
   * @default "10%"
   */
  thumbnailTimestamp?: number | string;

  /**
   * Optional: Callback to delegate thumbnail generation to an external queue
   * - If defined: uploadMedia dispatches a job instead of generating inline
   * - If undefined: Falls back to inline generation (fire-and-forget)
   */
  dispatchJob?: (job: VideoThumbnailJob) => Promise<void>;
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
   * Optional: Callback fired on every individual image resize operation.
   *
   * Fires once **per variant** — both for on-demand requests
   * (GET /medias/photo.jpg?size=400) and pre-generation variants at upload.
   * Includes cache status (fromCache: true if served from S3, false if freshly generated).
   *
   * Use for per-resize monitoring and analytics.
   * NOT suitable for "upload processing complete" notifications —
   * use `onProcessingCompleted` for that.
   */
  onImageResized?: (event: ImageResizedEvent) => void;

  /**
   * Optional: Callback fired when a cached resource is served
   *
   * Useful for cache hit/miss analytics.
   */
  onCacheHit?: (event: CacheHitEvent) => void;

  /**
   * Optional: Callback fired immediately after a file is uploaded to S3.
   *
   * Fires before any background processing (pre-generation or video thumbnails).
   * Use for tracking uploads or triggering workflows that don't depend on
   * variant/thumbnail availability.
   *
   * For a notification after all post-upload processing is done,
   * use `onProcessingCompleted` instead.
   */
  onUploaded?: (event: FileUploadedEvent) => void;

  /**
   * Optional: Post-upload image variant pre-generation (images only).
   *
   * Generates the specified sizes immediately after an image is uploaded,
   * so they are ready in S3 before the first request. Reduces on-demand
   * latency and CPU spikes for frequently accessed images (avatars, thumbnails).
   *
   * Separate from `videoThumbnails` because image variants and video thumbnails
   * have different configuration needs (no timestamp, no ffmpeg required).
   *
   * Two modes:
   * - Inline (default): fire-and-forget in the same process, non-blocking
   * - Queue: delegate to an external worker via `dispatchJob` (Bull, BullMQ, etc.)
   *
   * Example:
   * ```typescript
   * preGeneration: {
   *   sizes: [200, 400, 800],
   *   dispatchJob: async (job) => {
   *     await imageQueue.add('resize', job);
   *   }
   * }
   * ```
   */
  preGeneration?: MediasPreGenerationOptions;

  /**
   * Optional: Post-upload video thumbnail generation (videos only).
   *
   * Extracts a frame from uploaded videos via ffmpeg and generates thumbnail
   * images at the specified sizes. Also enables the on-demand thumbnail API:
   * GET /medias/clip.mp4?size=400 returns the thumbnail (generated on first
   * request if not already cached).
   *
   * Separate from `preGeneration` because video processing requires ffmpeg,
   * a timestamp parameter, and produces image files from a video source.
   *
   * Two modes:
   * - Inline (default): fire-and-forget in the same process, non-blocking
   * - Queue: delegate to an external worker via `dispatchJob`
   *
   * Requires ffmpeg to be installed on the host system.
   *
   * Example:
   * ```typescript
   * videoThumbnails: {
   *   sizes: [200, 400, 800],
   *   thumbnailTimestamp: '10%',
   *   dispatchJob: async (job) => {
   *     await videoQueue.add('thumbnails', job);
   *   }
   * }
   * ```
   */
  videoThumbnails?: VideoThumbnailOptions;

  /**
   * Optional: Callback fired once per individual video thumbnail generated.
   *
   * Fires once **per thumbnail** — both during post-upload batch generation
   * and on-demand requests (GET /medias/clip.mp4?size=400).
   * Use for per-thumbnail monitoring/analytics.
   *
   * For a single "all thumbnails done" notification after upload,
   * use `onProcessingCompleted` instead.
   */
  onVideoThumbnailGenerated?: (event: VideoThumbnailGeneratedEvent) => void;

  /**
   * Optional: Callback fired once when all post-upload background processing
   * is complete for a given file.
   *
   * - For images with `preGeneration`: fires after all variants are generated
   * - For videos with `videoThumbnails`: fires after all thumbnails are generated
   *
   * This is the right hook for WebSocket notifications, database updates, or
   * any action that requires all variants/thumbnails to be available in S3.
   *
   * **Only fires in inline mode.** When using `dispatchJob`, the library cannot
   * know when the external worker finishes — handle completion in the worker instead.
   *
   * Example:
   * ```typescript
   * onProcessingCompleted: (event) => {
   *   // event.originalFileName, event.type, event.generatedFiles, event.totalDurationMs
   *   gateway.emit('media-ready', { fileName: event.originalFileName });
   * }
   * ```
   */
  onProcessingCompleted?: (event: ProcessingCompletedEvent) => void;

  /**
   * Optional: Callback fired when a file and its variants are deleted via deleteMediaWithVariants.
   *
   * Not fired by the simple deleteMedia() method.
   */
  onDeleted?: (event: MediaDeletedEvent) => void;

  /**
   * Optional: Enable strict filename validation using whitelist (default: true)
   *
   * When true (default): Only alphanumeric characters, dots, hyphens, underscores,
   * and forward slashes are allowed. This is the safest option for new S3 buckets.
   *
   * When false: Only control characters (0x00-0x1F) are blocked. This allows
   * spaces, parentheses, apostrophes, Unicode characters, etc. Useful for
   * backward compatibility with existing S3 buckets that already contain files
   * with special characters.
   *
   * Security checks always applied regardless of this setting:
   * - Path traversal prevention (../, /.., leading /)
   * - File extension whitelist
   * - Maximum filename length
   *
   * @default true
   */
  strictFilenameValidation?: boolean;
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
