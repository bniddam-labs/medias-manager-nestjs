"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPES = exports.ALL_MEDIA_EXTENSIONS = exports.ARCHIVE_EXTENSIONS = exports.DOCUMENT_EXTENSIONS = exports.AUDIO_EXTENSIONS = exports.VIDEO_EXTENSIONS = exports.IMAGE_EXTENSIONS = exports.RESIZABLE_IMAGE_EXTENSIONS = exports.MEDIAS_MODULE_OPTIONS = void 0;
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
//# sourceMappingURL=medias.constants.js.map