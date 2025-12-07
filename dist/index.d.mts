import { LogLevel, ModuleMetadata, Type, DynamicModule } from '@nestjs/common';
import { Readable } from 'stream';
import { MinioService } from 'nestjs-minio-client';
import { Request, Response } from 'express';
import * as nestjs_zod from 'nestjs-zod';
import { z } from 'zod';

declare const MEDIAS_MODULE_OPTIONS = "MEDIAS_MODULE_OPTIONS";
declare const RESIZABLE_IMAGE_EXTENSIONS: string[];
declare const IMAGE_EXTENSIONS: string[];
declare const VIDEO_EXTENSIONS: string[];
declare const AUDIO_EXTENSIONS: string[];
declare const DOCUMENT_EXTENSIONS: string[];
declare const ARCHIVE_EXTENSIONS: string[];
declare const ALL_MEDIA_EXTENSIONS: string[];
declare const MIME_TYPES: Record<string, string>;
declare const DEFAULT_MAX_RESIZE_WIDTH = 1200;
declare const DEFAULT_MAX_ORIGINAL_FILE_SIZE: number;
declare const SIZE_UNITS: {
    readonly KILOBYTE: 1024;
    readonly MEGABYTE: number;
};
declare const MAX_FILENAME_LENGTH = 255;
declare const MAX_RESIZE_WIDTH_LIMIT = 5000;
declare const HTTP_STATUS: {
    readonly NOT_MODIFIED: 304;
    readonly INTERNAL_SERVER_ERROR: 500;
};
type ImageFormat = 'original' | 'jpeg' | 'webp' | 'avif';
declare const IMAGE_QUALITY: {
    readonly JPEG: 85;
    readonly WEBP: 80;
    readonly AVIF: 75;
};
declare const FORMAT_PRIORITY: Record<ImageFormat, number>;
declare const RETRY_CONFIG: {
    readonly MAX_ATTEMPTS: 3;
    readonly INITIAL_BACKOFF_MS: 50;
    readonly BACKOFF_MULTIPLIER: 2;
};
declare const TRANSIENT_S3_ERROR_CODES: string[];
declare const S3_METADATA_KEYS: {
    readonly WIDTH: "x-amz-meta-width";
    readonly HEIGHT: "x-amz-meta-height";
    readonly MIME_TYPE: "x-amz-meta-mime";
    readonly ORIGINAL_NAME: "x-amz-meta-original-name";
    readonly UPLOADED_AT: "x-amz-meta-uploaded-at";
};

interface S3Options {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    region: string;
    bucketName: string;
}
interface ImageResizedEvent {
    originalFileName: string;
    resizedFileName: string;
    requestedSize: number;
    finalSize: number;
    fromCache: boolean;
    durationMs: number;
    format: ImageFormat;
}
interface CacheHitEvent {
    fileName: string;
    size: number;
    notModified: boolean;
}
interface FileUploadedEvent {
    fileName: string;
    size: number;
    isImage: boolean;
    dimensions?: {
        width: number;
        height: number;
    };
}
interface PreGenerateJob {
    fileName: string;
    sizes: number[];
}
interface MediasPreGenerationOptions {
    sizes: number[];
    dispatchJob?: (job: PreGenerateJob) => Promise<void>;
}
type MediasLogLevel = LogLevel | 'none';
interface MediasModuleOptions {
    s3: S3Options;
    registerController?: boolean;
    allowedExtensions?: string[];
    maxResizeWidth?: number;
    autoPreventUpscale?: boolean;
    maxOriginalFileSize?: number;
    logLevel?: MediasLogLevel;
    preferredFormat?: ImageFormat;
    enableContentNegotiation?: boolean;
    allowWebp?: boolean;
    allowAvif?: boolean;
    onImageResized?: (event: ImageResizedEvent) => void;
    onCacheHit?: (event: CacheHitEvent) => void;
    onUploaded?: (event: FileUploadedEvent) => void;
    preGeneration?: MediasPreGenerationOptions;
    strictFilenameValidation?: boolean;
}
interface MediasModuleOptionsFactory {
    createMediasModuleOptions(): Promise<MediasModuleOptions> | MediasModuleOptions;
}
interface MediasModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<MediasModuleOptionsFactory>;
    useClass?: Type<MediasModuleOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<MediasModuleOptions> | MediasModuleOptions;
    inject?: any[];
    registerController?: boolean;
}

declare class MediasModule {
    static forRoot(options: MediasModuleOptions): DynamicModule;
    static forRootAsync(options: MediasModuleAsyncOptions): DynamicModule;
    private static createAsyncProviders;
    private static createAsyncOptionsProvider;
    private static createModuleOptions;
}

declare class MediasLoggerService {
    private readonly logger;
    private readonly logLevel;
    constructor(options: MediasModuleOptions);
    private shouldLog;
    error(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    debug(message: string, context?: Record<string, unknown>): void;
    verbose(message: string, context?: Record<string, unknown>): void;
}

interface MediaStatResult {
    size: number;
    lastModified: Date;
    etag: string;
    metaData: Record<string, string>;
}
declare class MediasStorageService {
    private readonly minioService;
    private readonly options;
    private readonly logger;
    constructor(minioService: MinioService, options: MediasModuleOptions, logger: MediasLoggerService);
    getBucketName(): string;
    private isTransientError;
    private delay;
    withRetry<T>(operation: () => Promise<T>, context: {
        operationName: string;
        fileName?: string;
    }): Promise<T>;
    getFileStream(fileName: string): Promise<Readable>;
    getFile(fileName: string): Promise<Buffer>;
    getFileStat(fileName: string): Promise<MediaStatResult>;
    putFile(fileName: string, file: Buffer, metadata?: Record<string, string>): Promise<void>;
    deleteFile(fileName: string): Promise<void>;
}

declare class MediasValidationService {
    private readonly options;
    private readonly logger;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService);
    isImage(fileName: string): boolean;
    isResizable(fileName: string): boolean;
    getMimeType(ext: string): string;
    validateResizable(fileName: string): void;
    validateResizeSize(fileName: string, size: number): void;
    generateETag(fileName: string, lastModified: Date, size: number): string;
    generateETagFromBuffer(buffer: Buffer): string;
    buildResizedFileName(fileName: string, size: number, outputExt: string): string;
    getExtension(fileName: string): string;
    getMaxResizeWidth(): number;
    isAutoPreventUpscaleEnabled(): boolean;
}

interface MediaBufferResponse {
    buffer: Buffer;
    mimeType: string;
    etag: string;
    notModified?: boolean;
}
interface MediaStreamResponse {
    stream: Readable;
    mimeType: string;
    size: number;
    etag: string;
    lastModified: Date;
    notModified?: boolean;
}
interface BatchResizeRequestItem {
    fileName: string;
    sizes: number[];
}
interface BatchResizeResultItem {
    fileName: string;
    size: number;
    resizedFileName: string;
    success: boolean;
    error?: string;
}
interface GenerateVariantResult {
    resizedFileName: string;
    success: boolean;
    error?: string;
}
declare class MediasResizeService {
    private readonly options;
    private readonly logger;
    private readonly storage;
    private readonly validation;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService, storage: MediasStorageService, validation: MediasValidationService);
    private applyFormat;
    getMimeTypeForFormat(format: ImageFormat, originalExt: string): string;
    getExtensionForFormat(format: ImageFormat, originalExt: string): string;
    negotiateFormat(acceptHeader?: string): ImageFormat;
    generateVariant(fileName: string, buffer: Buffer, size: number, originalWidth?: number, skipUpload?: boolean): Promise<GenerateVariantResult>;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse>;
    getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse>;
    preGenerateInline(fileName: string, buffer: Buffer, sizes: number[]): Promise<void>;
    batchResize(items: BatchResizeRequestItem[]): Promise<BatchResizeResultItem[]>;
}

declare class MediasService {
    private readonly options;
    private readonly logger;
    private readonly storage;
    private readonly validation;
    private readonly resize;
    constructor(options: MediasModuleOptions, logger: MediasLoggerService, storage: MediasStorageService, validation: MediasValidationService, resize: MediasResizeService);
    isImage(fileName: string): boolean;
    isResizable(fileName: string): boolean;
    getMimeType(ext: string): string;
    generateETag(fileName: string, lastModified: Date, size: number): string;
    generateETagFromBuffer(buffer: Buffer): string;
    negotiateFormat(acceptHeader?: string): ImageFormat;
    getMediaStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getMedia(fileName: string): Promise<Buffer>;
    getMediaFileStream(fileName: string): Promise<Readable>;
    getMediaStat(fileName: string): Promise<MediaStatResult>;
    uploadMedia(fileName: string, file: Buffer, originalName?: string, skipPreGeneration?: boolean): Promise<void>;
    private triggerPreGeneration;
    deleteMedia(fileName: string): Promise<void>;
    getImageStream(fileName: string, ifNoneMatch?: string): Promise<MediaStreamResponse>;
    getResizedImage(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaBufferResponse>;
    getResizedImageStream(fileName: string, size: number, ifNoneMatch?: string, format?: ImageFormat): Promise<MediaStreamResponse>;
    batchResize(items: BatchResizeRequestItem[]): Promise<BatchResizeResultItem[]>;
}

declare const createDeleteMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>;
declare const DeleteMediaParamsDto_base: nestjs_zod.ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
declare class DeleteMediaParamsDto extends DeleteMediaParamsDto_base {
}
declare const DeleteMediaParamsLooseDto_base: nestjs_zod.ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
declare class DeleteMediaParamsLooseDto extends DeleteMediaParamsLooseDto_base {
}

declare const createGetMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>;
declare const GetMediaParamsDto_base: nestjs_zod.ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
declare class GetMediaParamsDto extends GetMediaParamsDto_base {
}
declare const GetMediaParamsLooseDto_base: nestjs_zod.ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
declare class GetMediaParamsLooseDto extends GetMediaParamsLooseDto_base {
}
declare const GetMediaQueryDto_base: nestjs_zod.ZodDto<z.ZodObject<{
    size: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    size?: string | undefined;
}, {
    size?: string | undefined;
}>> & {
    io: "input";
};
declare class GetMediaQueryDto extends GetMediaQueryDto_base {
}

declare class MediasController {
    private readonly mediasService;
    private readonly logger;
    constructor(mediasService: MediasService);
    getMedia(params: GetMediaParamsLooseDto, query: GetMediaQueryDto, req: Request, res: Response): Promise<void>;
    deleteMedia(params: DeleteMediaParamsLooseDto): Promise<void>;
}

export { ALL_MEDIA_EXTENSIONS, ARCHIVE_EXTENSIONS, AUDIO_EXTENSIONS, type BatchResizeRequestItem, type BatchResizeResultItem, type CacheHitEvent, DEFAULT_MAX_ORIGINAL_FILE_SIZE, DEFAULT_MAX_RESIZE_WIDTH, DOCUMENT_EXTENSIONS, DeleteMediaParamsDto, DeleteMediaParamsLooseDto, FORMAT_PRIORITY, type FileUploadedEvent, GetMediaParamsDto, GetMediaParamsLooseDto, GetMediaQueryDto, HTTP_STATUS, IMAGE_EXTENSIONS, IMAGE_QUALITY, type ImageFormat, type ImageResizedEvent, MAX_FILENAME_LENGTH, MAX_RESIZE_WIDTH_LIMIT, MEDIAS_MODULE_OPTIONS, MIME_TYPES, type MediaBufferResponse, type MediaStatResult, type MediaStreamResponse, MediasController, type MediasLogLevel, MediasModule, type MediasModuleAsyncOptions, type MediasModuleOptions, type MediasModuleOptionsFactory, type MediasPreGenerationOptions, MediasService, type PreGenerateJob, RESIZABLE_IMAGE_EXTENSIONS, RETRY_CONFIG, type S3Options, S3_METADATA_KEYS, SIZE_UNITS, TRANSIENT_S3_ERROR_CODES, VIDEO_EXTENSIONS, createDeleteMediaParamsSchema, createGetMediaParamsSchema };
