"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3_METADATA_KEYS = exports.TRANSIENT_S3_ERROR_CODES = exports.RETRY_CONFIG = exports.FORMAT_PRIORITY = exports.IMAGE_QUALITY = exports.HTTP_STATUS = exports.MAX_RESIZE_WIDTH_LIMIT = exports.MAX_FILENAME_LENGTH = exports.SIZE_UNITS = exports.DEFAULT_MAX_ORIGINAL_FILE_SIZE = exports.DEFAULT_MAX_RESIZE_WIDTH = exports.MIME_TYPES = exports.ALL_MEDIA_EXTENSIONS = exports.ARCHIVE_EXTENSIONS = exports.DOCUMENT_EXTENSIONS = exports.AUDIO_EXTENSIONS = exports.VIDEO_EXTENSIONS = exports.IMAGE_EXTENSIONS = exports.RESIZABLE_IMAGE_EXTENSIONS = exports.MEDIAS_MODULE_OPTIONS = void 0;
exports.MEDIAS_MODULE_OPTIONS = 'MEDIAS_MODULE_OPTIONS';
exports.RESIZABLE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.tiff'];
exports.IMAGE_EXTENSIONS = [...exports.RESIZABLE_IMAGE_EXTENSIONS, '.svg', '.ico', '.bmp'];
exports.VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.flv'];
exports.AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.opus'];
exports.DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv'];
exports.ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'];
exports.ALL_MEDIA_EXTENSIONS = [...exports.IMAGE_EXTENSIONS, ...exports.VIDEO_EXTENSIONS, ...exports.AUDIO_EXTENSIONS, ...exports.DOCUMENT_EXTENSIONS, ...exports.ARCHIVE_EXTENSIONS];
exports.MIME_TYPES = {
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
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/x-m4v',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.wma': 'audio/x-ms-wma',
    '.opus': 'audio/opus',
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
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.bz2': 'application/x-bzip2',
};
exports.DEFAULT_MAX_RESIZE_WIDTH = 1200;
const BYTES_PER_KILOBYTE = 1024;
const KILOBYTES_PER_MEGABYTE = 1024;
const BYTES_PER_MEGABYTE = KILOBYTES_PER_MEGABYTE * BYTES_PER_KILOBYTE;
const DEFAULT_MAX_FILE_SIZE_MB = 15;
exports.DEFAULT_MAX_ORIGINAL_FILE_SIZE = DEFAULT_MAX_FILE_SIZE_MB * BYTES_PER_MEGABYTE;
exports.SIZE_UNITS = {
    KILOBYTE: BYTES_PER_KILOBYTE,
    MEGABYTE: BYTES_PER_MEGABYTE,
};
exports.MAX_FILENAME_LENGTH = 255;
exports.MAX_RESIZE_WIDTH_LIMIT = 5000;
exports.HTTP_STATUS = {
    NOT_MODIFIED: 304,
    INTERNAL_SERVER_ERROR: 500,
};
exports.IMAGE_QUALITY = {
    JPEG: 85,
    WEBP: 80,
    AVIF: 75,
};
exports.FORMAT_PRIORITY = {
    avif: 3,
    webp: 2,
    jpeg: 1,
    original: 0,
};
exports.RETRY_CONFIG = {
    MAX_ATTEMPTS: 3,
    INITIAL_BACKOFF_MS: 50,
    BACKOFF_MULTIPLIER: 2,
};
exports.TRANSIENT_S3_ERROR_CODES = [
    'RequestTimeout',
    'RequestTimeoutException',
    'PriorRequestNotComplete',
    'ConnectionError',
    'NetworkingError',
    'SlowDown',
    'ServiceUnavailable',
    'InternalError',
];
exports.S3_METADATA_KEYS = {
    WIDTH: 'x-amz-meta-width',
    HEIGHT: 'x-amz-meta-height',
    MIME_TYPE: 'x-amz-meta-mime',
    ORIGINAL_NAME: 'x-amz-meta-original-name',
    UPLOADED_AT: 'x-amz-meta-uploaded-at',
};
//# sourceMappingURL=medias.constants.js.map