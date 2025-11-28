/**
 * @bniddam-labs/medias-manager-nestjs
 * A NestJS module for handling media storage, retrieval, and on-demand image resizing with S3/MinIO
 */

// Module
export { MediasModule } from './medias/medias.module';

// Services
export { MediasService } from './medias/medias.service';
export type { MediaStreamResponse, MediaBufferResponse, MediaStatResult } from './medias/medias.service';

// Controllers
export { MediasController } from './medias/medias.controller';

// DTOs
export { DeleteMediaParamsDto } from './medias/dto/delete-media.dto';
export { GetMediaParamsDto, GetMediaQueryDto } from './medias/dto/get-media.dto';

// Interfaces & Types
export type { MediasModuleOptions, MediasModuleAsyncOptions, MediasModuleOptionsFactory, S3Options } from './medias/interfaces/medias-module-options.interface';

// Constants
export { MEDIAS_MODULE_OPTIONS, MIME_TYPES, IMAGE_EXTENSIONS, RESIZABLE_IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, DOCUMENT_EXTENSIONS, ARCHIVE_EXTENSIONS, ALL_MEDIA_EXTENSIONS } from './medias/medias.constants';
