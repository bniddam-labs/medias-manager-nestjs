export const MEDIAS_MODULE_OPTIONS = 'MEDIAS_MODULE_OPTIONS';

/**
 * Image extensions supported by Sharp for resizing
 */
export const RESIZABLE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.tiff'];

/**
 * All image extensions (including non-resizable)
 */
export const IMAGE_EXTENSIONS = [...RESIZABLE_IMAGE_EXTENSIONS, '.svg', '.ico', '.bmp'];

/**
 * Video extensions
 */
export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.flv'];

/**
 * Audio extensions
 */
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.opus'];

/**
 * Document extensions
 */
export const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv'];

/**
 * Archive extensions
 */
export const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'];

/**
 * All supported media extensions
 */
export const ALL_MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...DOCUMENT_EXTENSIONS, ...ARCHIVE_EXTENSIONS];

/**
 * MIME type mapping
 */
export const MIME_TYPES: Record<string, string> = {
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',

  // Videos
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.wma': 'audio/x-ms-wma',
  '.opus': 'audio/opus',

  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
  '.csv': 'text/csv',

  // Archives
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.bz2': 'application/x-bzip2',
};

/**
 * Default configuration values
 */

/** Default maximum width for image resizing in pixels */
export const DEFAULT_MAX_RESIZE_WIDTH = 1200;

/** Size constants in bytes */
const BYTES_PER_KILOBYTE = 1024;
const KILOBYTES_PER_MEGABYTE = 1024;
const BYTES_PER_MEGABYTE = KILOBYTES_PER_MEGABYTE * BYTES_PER_KILOBYTE;
const DEFAULT_MAX_FILE_SIZE_MB = 15;

/** Default maximum file size for on-the-fly resizing in bytes (15MB) */
export const DEFAULT_MAX_ORIGINAL_FILE_SIZE = DEFAULT_MAX_FILE_SIZE_MB * BYTES_PER_MEGABYTE;

/** Size units for calculations */
export const SIZE_UNITS = {
  KILOBYTE: BYTES_PER_KILOBYTE,
  MEGABYTE: BYTES_PER_MEGABYTE,
} as const;

/**
 * Validation limits
 */

/** Maximum length for file names */
export const MAX_FILENAME_LENGTH = 255;

/** Maximum width for resize parameter validation */
export const MAX_RESIZE_WIDTH_LIMIT = 5000;

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  NOT_MODIFIED: 304,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Image format options for conversion
 */
export type ImageFormat = 'original' | 'jpeg' | 'webp' | 'avif';

/**
 * Image quality settings by format
 */
export const IMAGE_QUALITY = {
  JPEG: 85,
  WEBP: 80,
  AVIF: 75,
} as const;

/**
 * Format priority for content negotiation (higher = preferred)
 */
export const FORMAT_PRIORITY: Record<ImageFormat, number> = {
  avif: 3,
  webp: 2,
  jpeg: 1,
  original: 0,
};

/**
 * Retry configuration for S3 operations
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  MAX_ATTEMPTS: 3,
  /** Initial backoff delay in milliseconds */
  INITIAL_BACKOFF_MS: 50,
  /** Backoff multiplier for each retry attempt */
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * S3 error codes that should trigger a retry
 */
export const TRANSIENT_S3_ERROR_CODES = [
  'RequestTimeout',
  'RequestTimeoutException',
  'PriorRequestNotComplete',
  'ConnectionError',
  'NetworkingError',
  'SlowDown',
  'ServiceUnavailable',
  'InternalError',
];

/**
 * S3 metadata keys for enriched file information
 */
export const S3_METADATA_KEYS = {
  WIDTH: 'x-amz-meta-width',
  HEIGHT: 'x-amz-meta-height',
  MIME_TYPE: 'x-amz-meta-mime',
  ORIGINAL_NAME: 'x-amz-meta-original-name',
  UPLOADED_AT: 'x-amz-meta-uploaded-at',
} as const;
