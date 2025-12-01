"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var MediasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const nestjs_minio_client_1 = require("nestjs-minio-client");
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const medias_constants_1 = require("./medias.constants");
const LOG_LEVEL_PRIORITY = {
    none: -1,
    fatal: 0,
    error: 1,
    warn: 2,
    log: 3,
    debug: 4,
    verbose: 5,
};
let MediasService = MediasService_1 = class MediasService {
    constructor(minioService, options) {
        this.minioService = minioService;
        this.options = options;
        this.logger = new common_1.Logger(MediasService_1.name);
        this.logLevel = options.logLevel ?? 'none';
        this.logVerbose('MediasService initialized', { logLevel: this.logLevel, bucket: options.s3.bucketName });
    }
    shouldLog(level) {
        return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.logLevel];
    }
    logError(message, context) {
        if (this.shouldLog('error')) {
            this.logger.error(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    logWarn(message, context) {
        if (this.shouldLog('warn')) {
            this.logger.warn(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    logInfo(message, context) {
        if (this.shouldLog('log')) {
            this.logger.log(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    logDebug(message, context) {
        if (this.shouldLog('debug')) {
            this.logger.debug(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    logVerbose(message, context) {
        if (this.shouldLog('verbose')) {
            this.logger.verbose(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    getBucketName() {
        const bucketName = this.options.s3.bucketName;
        if (!bucketName) {
            this.logError('S3 bucket name not configured');
            throw new common_1.InternalServerErrorException('S3 bucket name not configured');
        }
        return bucketName;
    }
    isTransientError(error) {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const err = error;
        const errorCode = err.code ?? err.name ?? '';
        return medias_constants_1.TRANSIENT_S3_ERROR_CODES.includes(errorCode);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async withRetry(operation, context) {
        let attempt = 0;
        while (true) {
            try {
                this.logVerbose(`Executing S3 operation (attempt ${attempt + 1}/${medias_constants_1.RETRY_CONFIG.MAX_ATTEMPTS})`, {
                    operation: context.operationName,
                    fileName: context.fileName,
                });
                return await operation();
            }
            catch (error) {
                attempt++;
                const isTransient = this.isTransientError(error);
                const shouldRetry = isTransient && attempt < medias_constants_1.RETRY_CONFIG.MAX_ATTEMPTS;
                if (!shouldRetry) {
                    this.logError('S3 operation failed', {
                        operation: context.operationName,
                        fileName: context.fileName,
                        attempt,
                        isTransient,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    throw error;
                }
                const backoffMs = medias_constants_1.RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(medias_constants_1.RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
                this.logWarn('Transient S3 error, retrying', {
                    operation: context.operationName,
                    fileName: context.fileName,
                    attempt,
                    retryAfterMs: backoffMs,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                await this.delay(backoffMs);
            }
        }
    }
    isImage(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        return medias_constants_1.IMAGE_EXTENSIONS.includes(ext);
    }
    isResizable(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        return medias_constants_1.RESIZABLE_IMAGE_EXTENSIONS.includes(ext);
    }
    getMimeType(ext) {
        return medias_constants_1.MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
    }
    generateETag(fileName, lastModified, size) {
        const hash = crypto.createHash('md5').update(`${fileName}-${lastModified.getTime()}-${size}`).digest('hex');
        return `"${hash}"`;
    }
    generateETagFromBuffer(buffer) {
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        return `"${hash}"`;
    }
    applyFormat(pipeline, format) {
        switch (format) {
            case 'webp':
                return pipeline.webp({ quality: medias_constants_1.IMAGE_QUALITY.WEBP });
            case 'jpeg':
                return pipeline.jpeg({ quality: medias_constants_1.IMAGE_QUALITY.JPEG });
            case 'avif':
                return pipeline.avif({ quality: medias_constants_1.IMAGE_QUALITY.AVIF });
            case 'original':
            default:
                return pipeline;
        }
    }
    getMimeTypeForFormat(format, originalExt) {
        switch (format) {
            case 'webp':
                return 'image/webp';
            case 'jpeg':
                return 'image/jpeg';
            case 'avif':
                return 'image/avif';
            case 'original':
            default:
                return this.getMimeType(originalExt);
        }
    }
    getExtensionForFormat(format, originalExt) {
        switch (format) {
            case 'webp':
                return '.webp';
            case 'jpeg':
                return '.jpg';
            case 'avif':
                return '.avif';
            case 'original':
            default:
                return originalExt;
        }
    }
    negotiateFormat(acceptHeader) {
        if (!this.options.enableContentNegotiation) {
            return this.options.preferredFormat ?? 'original';
        }
        if (!acceptHeader) {
            return this.options.preferredFormat ?? 'original';
        }
        const accept = acceptHeader.toLowerCase();
        const allowAvif = this.options.allowAvif ?? true;
        const allowWebp = this.options.allowWebp ?? true;
        if (allowAvif && accept.includes('image/avif')) {
            this.logDebug('Content negotiation: AVIF selected', { acceptHeader });
            return 'avif';
        }
        if (allowWebp && accept.includes('image/webp')) {
            this.logDebug('Content negotiation: WebP selected', { acceptHeader });
            return 'webp';
        }
        if (accept.includes('image/jpeg') || accept.includes('image/*') || accept.includes('*/*')) {
            this.logDebug('Content negotiation: JPEG selected as fallback', { acceptHeader });
            return 'jpeg';
        }
        this.logDebug('Content negotiation: original format selected', { acceptHeader });
        return 'original';
    }
    async getMediaStream(fileName, ifNoneMatch) {
        this.logVerbose('getMediaStream called', { fileName, hasIfNoneMatch: !!ifNoneMatch });
        const ext = path.extname(fileName);
        const mimeType = this.getMimeType(ext);
        this.logVerbose('Determined MIME type', { fileName, ext, mimeType });
        this.logVerbose('Fetching file stat', { fileName });
        const stat = await this.getMediaStat(fileName);
        const etag = this.generateETag(fileName, stat.lastModified, stat.size);
        this.logDebug('File stat retrieved', { fileName, size: stat.size, etag });
        if (ifNoneMatch === etag) {
            this.logDebug('Cache hit - returning 304 Not Modified', { fileName, etag });
            this.options.onCacheHit?.({
                fileName,
                size: 0,
                notModified: true,
            });
            return {
                stream: null,
                mimeType,
                size: stat.size,
                etag,
                lastModified: stat.lastModified,
                notModified: true,
            };
        }
        this.logVerbose('Cache miss - fetching file stream', { fileName });
        const stream = await this.getMediaFileStream(fileName);
        this.logInfo('Serving media stream', { fileName, size: stat.size, mimeType });
        return {
            stream,
            mimeType,
            size: stat.size,
            etag,
            lastModified: stat.lastModified,
            notModified: false,
        };
    }
    async getMedia(fileName) {
        this.logVerbose('getMedia called - loading file into buffer', { fileName });
        this.logWarn('Loading entire file into memory', { fileName });
        try {
            const fileStream = await this.getMediaFileStream(fileName);
            return new Promise((resolve, reject) => {
                const chunks = [];
                fileStream.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                fileStream.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    this.logDebug('File loaded into buffer', { fileName, size: buffer.length });
                    resolve(buffer);
                });
                fileStream.on('error', (error) => {
                    this.logError('Error reading file stream', { fileName, error: error.message });
                    reject(error);
                });
            });
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            this.logError('Failed to get media', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async getMediaFileStream(fileName) {
        this.logVerbose('Fetching file stream from S3', { fileName, bucket: this.getBucketName() });
        try {
            const fileStream = await this.withRetry(() => this.minioService.client.getObject(this.getBucketName(), fileName), { operationName: 'getObject', fileName });
            this.logVerbose('File stream obtained', { fileName });
            return fileStream;
        }
        catch (error) {
            this.logError('File not found in S3', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async getMediaStat(fileName) {
        this.logVerbose('Fetching file stat from S3', { fileName });
        try {
            const stat = await this.withRetry(() => this.minioService.client.statObject(this.getBucketName(), fileName), { operationName: 'statObject', fileName });
            this.logVerbose('File stat obtained', { fileName, size: stat.size });
            return stat;
        }
        catch (error) {
            this.logError('File stat not found', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async preGenerateInline(fileName, buffer, sizes) {
        if (!this.isResizable(fileName)) {
            this.logDebug('File is not resizable, skipping pre-generation', { fileName });
            return;
        }
        const maxWidth = this.options.maxResizeWidth ?? medias_constants_1.DEFAULT_MAX_RESIZE_WIDTH;
        const autoPreventUpscale = this.options.autoPreventUpscale ?? true;
        let originalWidth;
        try {
            const metadata = await (0, sharp_1.default)(buffer).metadata();
            originalWidth = metadata.width;
            this.logDebug('Original image metadata for pre-generation', {
                fileName,
                width: originalWidth,
                height: metadata.height,
            });
        }
        catch (error) {
            this.logWarn('Failed to get original image metadata for pre-generation', {
                fileName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const dirName = path.dirname(fileName);
        const outputFormat = this.options.preferredFormat ?? 'original';
        const outputExt = this.getExtensionForFormat(outputFormat, ext);
        this.logInfo('Starting pre-generation of image variants', {
            fileName,
            sizes,
            outputFormat,
            originalWidth,
        });
        for (const size of sizes) {
            try {
                if (size > maxWidth) {
                    this.logWarn('Pre-generation size exceeds maxResizeWidth, skipping', {
                        fileName,
                        size,
                        maxWidth,
                    });
                    continue;
                }
                let finalSize = size;
                if (autoPreventUpscale && originalWidth && size > originalWidth) {
                    this.logDebug('Pre-generation size exceeds original width, clamping', {
                        fileName,
                        requestedSize: size,
                        originalWidth,
                    });
                    finalSize = originalWidth;
                }
                const resizedFileName = dirName === '.' ? `${baseName}-${size}${outputExt}` : `${dirName}/${baseName}-${size}${outputExt}`;
                this.logVerbose('Generating pre-generation variant', {
                    fileName,
                    size,
                    finalSize,
                    resizedFileName,
                });
                let pipeline = (0, sharp_1.default)(buffer).resize(finalSize);
                pipeline = this.applyFormat(pipeline, outputFormat);
                const resizedBuffer = await pipeline.toBuffer();
                await this.uploadMedia(resizedFileName, resizedBuffer, undefined, true);
                this.logInfo('Pre-generation variant created', {
                    fileName,
                    size,
                    resizedFileName,
                    resizedSize: resizedBuffer.length,
                });
            }
            catch (error) {
                this.logWarn('Failed to pre-generate variant, continuing with other sizes', {
                    fileName,
                    size,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        this.logInfo('Pre-generation completed', { fileName, totalSizes: sizes.length });
    }
    async uploadMedia(fileName, file, originalName, skipPreGeneration = false) {
        this.logVerbose('Uploading file to S3', { fileName, size: file.length, originalName, skipPreGeneration });
        if (this.isImage(fileName)) {
            try {
                const metadata = await (0, sharp_1.default)(file).metadata();
                const ext = path.extname(fileName);
                const mimeType = this.getMimeType(ext);
                const s3Metadata = {
                    [medias_constants_1.S3_METADATA_KEYS.MIME_TYPE]: mimeType,
                    [medias_constants_1.S3_METADATA_KEYS.UPLOADED_AT]: new Date().toISOString(),
                };
                if (metadata.width) {
                    s3Metadata[medias_constants_1.S3_METADATA_KEYS.WIDTH] = String(metadata.width);
                }
                if (metadata.height) {
                    s3Metadata[medias_constants_1.S3_METADATA_KEYS.HEIGHT] = String(metadata.height);
                }
                if (originalName) {
                    s3Metadata[medias_constants_1.S3_METADATA_KEYS.ORIGINAL_NAME] = originalName;
                }
                this.logDebug('Uploading image with enriched metadata', {
                    fileName,
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                });
                await this.withRetry(() => this.minioService.client.putObject(this.getBucketName(), fileName, file, s3Metadata), { operationName: 'putObject', fileName });
                this.logInfo('Image uploaded to S3 with metadata', {
                    fileName,
                    size: file.length,
                    dimensions: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : undefined,
                });
                this.options.onUploaded?.({
                    fileName,
                    size: file.length,
                    isImage: true,
                    dimensions: metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined,
                });
                if (!skipPreGeneration) {
                    await this.triggerPreGeneration(fileName, file);
                }
                return;
            }
            catch (error) {
                this.logWarn('Failed to extract image metadata, uploading without enrichment', {
                    fileName,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        await this.withRetry(() => this.minioService.client.putObject(this.getBucketName(), fileName, file), { operationName: 'putObject', fileName });
        this.logInfo('File uploaded to S3', { fileName, size: file.length });
        this.options.onUploaded?.({
            fileName,
            size: file.length,
            isImage: false,
        });
        if (!skipPreGeneration) {
            await this.triggerPreGeneration(fileName, file);
        }
    }
    async triggerPreGeneration(fileName, buffer) {
        const preGen = this.options.preGeneration;
        if (!preGen || !preGen.sizes || preGen.sizes.length === 0) {
            return;
        }
        if (!this.isResizable(fileName)) {
            this.logDebug('File is not resizable, skipping pre-generation trigger', { fileName });
            return;
        }
        this.logDebug('Triggering pre-generation', {
            fileName,
            sizes: preGen.sizes,
            hasDispatchJob: !!preGen.dispatchJob,
        });
        try {
            if (preGen.dispatchJob) {
                this.logInfo('Dispatching pre-generation job to external queue', {
                    fileName,
                    sizes: preGen.sizes,
                });
                await preGen.dispatchJob({
                    fileName,
                    sizes: preGen.sizes,
                });
                this.logInfo('Pre-generation job dispatched successfully', { fileName });
            }
            else {
                this.logInfo('Starting inline pre-generation (fire-and-forget)', {
                    fileName,
                    sizes: preGen.sizes,
                });
                this.preGenerateInline(fileName, buffer, preGen.sizes).catch((error) => {
                    this.logError('Inline pre-generation failed', {
                        fileName,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                });
            }
        }
        catch (error) {
            this.logError('Failed to trigger pre-generation', {
                fileName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async deleteMedia(fileName) {
        this.logVerbose('Deleting file from S3', { fileName });
        await this.withRetry(() => this.minioService.client.removeObject(this.getBucketName(), fileName), { operationName: 'removeObject', fileName });
        this.logInfo('File deleted from S3', { fileName });
    }
    async getImageStream(fileName, ifNoneMatch) {
        this.logVerbose('getImageStream called', { fileName });
        if (!this.isImage(fileName)) {
            this.logWarn('Attempted to get non-image file as image', { fileName });
            throw new common_1.BadRequestException(`File ${fileName} is not an image. Use getMediaStream() for non-image files.`);
        }
        return this.getMediaStream(fileName, ifNoneMatch);
    }
    validateResizable(fileName) {
        if (!this.isResizable(fileName)) {
            const ext = path.extname(fileName).toLowerCase();
            if (this.isImage(fileName)) {
                this.logWarn('Attempted to resize unsupported image format', { fileName, ext });
                throw new common_1.BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${medias_constants_1.RESIZABLE_IMAGE_EXTENSIONS.join(', ')}`);
            }
            this.logWarn('Attempted to resize non-image file', { fileName });
            throw new common_1.BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
        }
    }
    validateResizeSize(fileName, size) {
        const maxWidth = this.options.maxResizeWidth ?? medias_constants_1.DEFAULT_MAX_RESIZE_WIDTH;
        if (size > maxWidth) {
            this.logWarn('Resize size exceeds maximum', { fileName, size, maxWidth });
            throw new common_1.BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
        }
    }
    async getResizedImage(fileName, size, ifNoneMatch, format) {
        const startTime = Date.now();
        const outputFormat = format ?? this.options.preferredFormat ?? 'original';
        this.logVerbose('getResizedImage called', { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });
        this.validateResizable(fileName);
        this.validateResizeSize(fileName, size);
        const stat = await this.getMediaStat(fileName);
        const maxOriginalSize = this.options.maxOriginalFileSize ?? medias_constants_1.DEFAULT_MAX_ORIGINAL_FILE_SIZE;
        if (maxOriginalSize > 0 && stat.size > maxOriginalSize) {
            this.logWarn('Original image too large for on-the-fly resize', {
                fileName,
                size: stat.size,
                maxOriginalSize,
            });
            throw new common_1.BadRequestException(`Image too large to resize on-the-fly (${Math.round(stat.size / medias_constants_1.SIZE_UNITS.MEGABYTE)}MB). Maximum allowed: ${Math.round(maxOriginalSize / medias_constants_1.SIZE_UNITS.MEGABYTE)}MB.`);
        }
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const dirName = path.dirname(fileName);
        const outputExt = this.getExtensionForFormat(outputFormat, ext);
        const mimeType = this.getMimeTypeForFormat(outputFormat, ext);
        const resizedFileName = dirName === '.' ? `${baseName}-${size}${outputExt}` : `${dirName}/${baseName}-${size}${outputExt}`;
        this.logVerbose('Computed resized file name', { originalFileName: fileName, resizedFileName, size, outputFormat });
        this.logVerbose('Checking for cached resized image', { resizedFileName });
        try {
            const stat = await this.getMediaStat(resizedFileName);
            const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);
            this.logDebug('Cached resized image found', { resizedFileName, size: stat.size, etag });
            if (ifNoneMatch === etag) {
                this.logDebug('Cache hit on resized image - returning 304 Not Modified', { resizedFileName, etag });
                this.options.onCacheHit?.({
                    fileName: resizedFileName,
                    size,
                    notModified: true,
                });
                return {
                    buffer: null,
                    mimeType,
                    etag,
                    notModified: true,
                };
            }
            this.logInfo('Serving cached resized image', { resizedFileName, size: stat.size });
            const buffer = await this.getMedia(resizedFileName);
            const durationMs = Date.now() - startTime;
            this.options.onCacheHit?.({
                fileName: resizedFileName,
                size,
                notModified: false,
            });
            this.options.onImageResized?.({
                originalFileName: fileName,
                resizedFileName,
                requestedSize: size,
                finalSize: buffer.length,
                fromCache: true,
                durationMs,
                format: outputFormat,
            });
            return {
                buffer,
                mimeType,
                etag,
                notModified: false,
            };
        }
        catch {
            this.logDebug('No cached resized image found, will generate', { resizedFileName });
        }
        this.logVerbose('Fetching original image for resize', { fileName });
        const originalFile = await this.getMedia(fileName);
        this.logDebug('Original image loaded', { fileName, originalSize: originalFile.length });
        const autoPreventUpscale = this.options.autoPreventUpscale ?? true;
        let finalSize = size;
        if (autoPreventUpscale) {
            const image = (0, sharp_1.default)(originalFile);
            const metadata = await image.metadata();
            if (metadata.width && size > metadata.width) {
                this.logDebug('Requested size exceeds original width, preventing upscale', {
                    fileName,
                    requestedSize: size,
                    originalWidth: metadata.width,
                });
                finalSize = metadata.width;
            }
        }
        this.logVerbose('Resizing image with Sharp', { fileName, targetWidth: finalSize, outputFormat });
        let pipeline = (0, sharp_1.default)(originalFile).resize(finalSize);
        pipeline = this.applyFormat(pipeline, outputFormat);
        const resizedBuffer = await pipeline.toBuffer();
        const etag = this.generateETagFromBuffer(resizedBuffer);
        this.logDebug('Image resized', { fileName, originalSize: originalFile.length, resizedSize: resizedBuffer.length, outputFormat, etag });
        if (ifNoneMatch === etag) {
            this.logDebug('Generated image matches ETag - returning 304 Not Modified', { fileName, etag });
            return {
                buffer: null,
                mimeType,
                etag,
                notModified: true,
            };
        }
        this.logVerbose('Caching resized image to S3 (async)', { resizedFileName });
        this.uploadMedia(resizedFileName, resizedBuffer).catch((error) => {
            this.logWarn('Failed to cache resized image', { resizedFileName, error: error instanceof Error ? error.message : 'Unknown error' });
        });
        const durationMs = Date.now() - startTime;
        this.options.onImageResized?.({
            originalFileName: fileName,
            resizedFileName,
            requestedSize: size,
            finalSize: resizedBuffer.length,
            fromCache: false,
            durationMs,
            format: outputFormat,
        });
        this.logInfo('Serving freshly resized image', { fileName, size, resizedSize: resizedBuffer.length });
        return {
            buffer: resizedBuffer,
            mimeType,
            etag,
            notModified: false,
        };
    }
    async getResizedImageStream(fileName, size, ifNoneMatch, format) {
        const outputFormat = format ?? this.options.preferredFormat ?? 'original';
        this.logVerbose('getResizedImageStream called', { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });
        this.validateResizable(fileName);
        this.validateResizeSize(fileName, size);
        const stat = await this.getMediaStat(fileName);
        const etag = this.generateETag(`${fileName}-${size}-${outputFormat}`, stat.lastModified, stat.size);
        this.logDebug('Generated ETag for streaming resize', { fileName, size, etag });
        if (ifNoneMatch === etag) {
            this.logDebug('Cache hit - returning 304 Not Modified', { fileName, size, etag });
            this.options.onCacheHit?.({
                fileName,
                size,
                notModified: true,
            });
            return {
                stream: null,
                mimeType: this.getMimeTypeForFormat(outputFormat, path.extname(fileName)),
                size: 0,
                etag,
                lastModified: stat.lastModified,
                notModified: true,
            };
        }
        this.logVerbose('Fetching original image stream for resize', { fileName });
        const originalStream = await this.getMediaFileStream(fileName);
        this.logVerbose('Creating streaming resize pipeline', { fileName, size, outputFormat });
        let resizePipeline = (0, sharp_1.default)().resize(size);
        resizePipeline = this.applyFormat(resizePipeline, outputFormat);
        const resizedStream = originalStream.pipe(resizePipeline);
        const mimeType = this.getMimeTypeForFormat(outputFormat, path.extname(fileName));
        this.logInfo('Serving streaming resized image', { fileName, size, outputFormat });
        return {
            stream: resizedStream,
            mimeType,
            size: 0,
            etag,
            lastModified: stat.lastModified,
            notModified: false,
        };
    }
};
exports.MediasService = MediasService;
exports.MediasService = MediasService = MediasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [nestjs_minio_client_1.MinioService, Object])
], MediasService);
//# sourceMappingURL=medias.service.js.map