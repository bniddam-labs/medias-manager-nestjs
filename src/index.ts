/**
 * @bniddam-labs/medias-manager-nestjs
 * A NestJS module for handling media storage, retrieval, and on-demand image resizing with S3/MinIO
 */

// Module
export { MediasModule } from './medias/medias.module.js';

// Services
export { MediasService } from './medias/medias.service.js';
export type { MediaStreamResponse, MediaBufferResponse, MediaStatResult, BatchResizeRequestItem, BatchResizeResultItem } from './medias/medias.service.js';

// Controllers
export { MediasController } from './medias/medias.controller.js';

// DTOs
export { DeleteMediaParamsDto, DeleteMediaParamsLooseDto, createDeleteMediaParamsSchema } from './medias/dto/delete-media.dto.js';
export { GetMediaParamsDto, GetMediaParamsLooseDto, GetMediaQueryDto, createGetMediaParamsSchema } from './medias/dto/get-media.dto.js';

// Interfaces & Types
export type { MediasModuleOptions, MediasModuleAsyncOptions, MediasModuleOptionsFactory, S3Options, MediasLogLevel, ImageResizedEvent, CacheHitEvent, FileUploadedEvent, PreGenerateJob, MediasPreGenerationOptions } from './medias/interfaces/medias-module-options.interface.js';
export type { ImageFormat } from './medias/medias.constants.js';

// Constants
export { MEDIAS_MODULE_OPTIONS, MIME_TYPES, IMAGE_EXTENSIONS, RESIZABLE_IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, DOCUMENT_EXTENSIONS, ARCHIVE_EXTENSIONS, ALL_MEDIA_EXTENSIONS, DEFAULT_MAX_RESIZE_WIDTH, DEFAULT_MAX_ORIGINAL_FILE_SIZE, SIZE_UNITS, MAX_FILENAME_LENGTH, MAX_RESIZE_WIDTH_LIMIT, HTTP_STATUS, IMAGE_QUALITY, FORMAT_PRIORITY, RETRY_CONFIG, TRANSIENT_S3_ERROR_CODES, S3_METADATA_KEYS } from './medias/medias.constants.js';
