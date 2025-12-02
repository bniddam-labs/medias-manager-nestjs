"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasResizeService = void 0;
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const medias_constants_1 = require("../medias.constants");
const medias_logger_service_1 = require("./medias-logger.service");
const medias_storage_service_1 = require("./medias-storage.service");
const medias_validation_service_1 = require("./medias-validation.service");
let MediasResizeService = class MediasResizeService {
    constructor(options, logger, storage, validation) {
        this.options = options;
        this.logger = logger;
        this.storage = storage;
        this.validation = validation;
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
                return this.validation.getMimeType(originalExt);
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
            this.logger.debug('Content negotiation: AVIF selected', { acceptHeader });
            return 'avif';
        }
        if (allowWebp && accept.includes('image/webp')) {
            this.logger.debug('Content negotiation: WebP selected', { acceptHeader });
            return 'webp';
        }
        if (accept.includes('image/jpeg') || accept.includes('image/*') || accept.includes('*/*')) {
            this.logger.debug('Content negotiation: JPEG selected as fallback', { acceptHeader });
            return 'jpeg';
        }
        this.logger.debug('Content negotiation: original format selected', { acceptHeader });
        return 'original';
    }
    async generateVariant(fileName, buffer, size, originalWidth, skipUpload = false) {
        const maxWidth = this.validation.getMaxResizeWidth();
        const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();
        const ext = this.validation.getExtension(fileName);
        const outputFormat = this.options.preferredFormat ?? 'original';
        const outputExt = this.getExtensionForFormat(outputFormat, ext);
        const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
        if (size > maxWidth) {
            const error = `Size ${size} exceeds maxResizeWidth (${maxWidth})`;
            this.logger.warn('Variant generation skipped: size exceeds maxResizeWidth', {
                fileName,
                size,
                maxWidth,
            });
            return { resizedFileName, success: false, error };
        }
        let finalSize = size;
        if (autoPreventUpscale && originalWidth && size > originalWidth) {
            this.logger.debug('Variant size exceeds original width, clamping', {
                fileName,
                requestedSize: size,
                originalWidth,
            });
            finalSize = originalWidth;
        }
        try {
            this.logger.verbose('Generating variant', {
                fileName,
                size,
                finalSize,
                resizedFileName,
            });
            let pipeline = (0, sharp_1.default)(buffer).resize(finalSize);
            pipeline = this.applyFormat(pipeline, outputFormat);
            const resizedBuffer = await pipeline.toBuffer();
            if (!skipUpload) {
                await this.storage.putFile(resizedFileName, resizedBuffer);
            }
            this.logger.info('Variant created', {
                fileName,
                size,
                resizedFileName,
                resizedSize: resizedBuffer.length,
            });
            return { resizedFileName, success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn('Failed to generate variant', {
                fileName,
                size,
                error: errorMessage,
            });
            return { resizedFileName, success: false, error: errorMessage };
        }
    }
    async getResizedImage(fileName, size, ifNoneMatch, format) {
        const startTime = Date.now();
        const outputFormat = format ?? this.options.preferredFormat ?? 'original';
        this.logger.verbose('getResizedImage called', { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });
        this.validation.validateResizable(fileName);
        this.validation.validateResizeSize(fileName, size);
        const stat = await this.storage.getFileStat(fileName);
        const maxOriginalSize = this.options.maxOriginalFileSize ?? medias_constants_1.DEFAULT_MAX_ORIGINAL_FILE_SIZE;
        if (maxOriginalSize > 0 && stat.size > maxOriginalSize) {
            this.logger.warn('Original image too large for on-the-fly resize', {
                fileName,
                size: stat.size,
                maxOriginalSize,
            });
            throw new common_1.BadRequestException(`Image too large to resize on-the-fly (${Math.round(stat.size / medias_constants_1.SIZE_UNITS.MEGABYTE)}MB). Maximum allowed: ${Math.round(maxOriginalSize / medias_constants_1.SIZE_UNITS.MEGABYTE)}MB.`);
        }
        const ext = this.validation.getExtension(fileName);
        const outputExt = this.getExtensionForFormat(outputFormat, ext);
        const mimeType = this.getMimeTypeForFormat(outputFormat, ext);
        const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
        this.logger.verbose('Computed resized file name', { originalFileName: fileName, resizedFileName, size, outputFormat });
        this.logger.verbose('Checking for cached resized image', { resizedFileName });
        try {
            const cachedStat = await this.storage.getFileStat(resizedFileName);
            const etag = this.validation.generateETag(resizedFileName, cachedStat.lastModified, cachedStat.size);
            this.logger.debug('Cached resized image found', { resizedFileName, size: cachedStat.size, etag });
            if (ifNoneMatch === etag) {
                this.logger.debug('Cache hit on resized image - returning 304 Not Modified', { resizedFileName, etag });
                this.options.onCacheHit?.({ fileName: resizedFileName, size, notModified: true });
                return { buffer: null, mimeType, etag, notModified: true };
            }
            this.logger.info('Serving cached resized image', { resizedFileName, size: cachedStat.size });
            const buffer = await this.storage.getFile(resizedFileName);
            const durationMs = Date.now() - startTime;
            this.options.onCacheHit?.({ fileName: resizedFileName, size, notModified: false });
            this.options.onImageResized?.({
                originalFileName: fileName,
                resizedFileName,
                requestedSize: size,
                finalSize: buffer.length,
                fromCache: true,
                durationMs,
                format: outputFormat,
            });
            return { buffer, mimeType, etag, notModified: false };
        }
        catch {
            this.logger.debug('No cached resized image found, will generate', { resizedFileName });
        }
        this.logger.verbose('Fetching original image for resize', { fileName });
        const originalFile = await this.storage.getFile(fileName);
        this.logger.debug('Original image loaded', { fileName, originalSize: originalFile.length });
        const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();
        let finalSize = size;
        if (autoPreventUpscale) {
            const metadata = await (0, sharp_1.default)(originalFile).metadata();
            if (metadata.width && size > metadata.width) {
                this.logger.debug('Requested size exceeds original width, preventing upscale', {
                    fileName,
                    requestedSize: size,
                    originalWidth: metadata.width,
                });
                finalSize = metadata.width;
            }
        }
        this.logger.verbose('Resizing image with Sharp', { fileName, targetWidth: finalSize, outputFormat });
        let pipeline = (0, sharp_1.default)(originalFile).resize(finalSize);
        pipeline = this.applyFormat(pipeline, outputFormat);
        const resizedBuffer = await pipeline.toBuffer();
        const etag = this.validation.generateETagFromBuffer(resizedBuffer);
        this.logger.debug('Image resized', { fileName, originalSize: originalFile.length, resizedSize: resizedBuffer.length, outputFormat, etag });
        if (ifNoneMatch === etag) {
            this.logger.debug('Generated image matches ETag - returning 304 Not Modified', { fileName, etag });
            return { buffer: null, mimeType, etag, notModified: true };
        }
        this.logger.verbose('Caching resized image to S3 (async)', { resizedFileName });
        this.storage.putFile(resizedFileName, resizedBuffer).catch((error) => {
            this.logger.warn('Failed to cache resized image', { resizedFileName, error: error instanceof Error ? error.message : 'Unknown error' });
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
        this.logger.info('Serving freshly resized image', { fileName, size, resizedSize: resizedBuffer.length });
        return { buffer: resizedBuffer, mimeType, etag, notModified: false };
    }
    async getResizedImageStream(fileName, size, ifNoneMatch, format) {
        const outputFormat = format ?? this.options.preferredFormat ?? 'original';
        this.logger.verbose('getResizedImageStream called', { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });
        this.validation.validateResizable(fileName);
        this.validation.validateResizeSize(fileName, size);
        const stat = await this.storage.getFileStat(fileName);
        const etag = this.validation.generateETag(`${fileName}-${size}-${outputFormat}`, stat.lastModified, stat.size);
        this.logger.debug('Generated ETag for streaming resize', { fileName, size, etag });
        if (ifNoneMatch === etag) {
            this.logger.debug('Cache hit - returning 304 Not Modified', { fileName, size, etag });
            this.options.onCacheHit?.({ fileName, size, notModified: true });
            return {
                stream: null,
                mimeType: this.getMimeTypeForFormat(outputFormat, this.validation.getExtension(fileName)),
                size: 0,
                etag,
                lastModified: stat.lastModified,
                notModified: true,
            };
        }
        this.logger.verbose('Fetching original image stream for resize', { fileName });
        const originalStream = await this.storage.getFileStream(fileName);
        this.logger.verbose('Creating streaming resize pipeline', { fileName, size, outputFormat });
        let resizePipeline = (0, sharp_1.default)().resize(size);
        resizePipeline = this.applyFormat(resizePipeline, outputFormat);
        const resizedStream = originalStream.pipe(resizePipeline);
        const mimeType = this.getMimeTypeForFormat(outputFormat, this.validation.getExtension(fileName));
        this.logger.info('Serving streaming resized image', { fileName, size, outputFormat });
        return {
            stream: resizedStream,
            mimeType,
            size: 0,
            etag,
            lastModified: stat.lastModified,
            notModified: false,
        };
    }
    async preGenerateInline(fileName, buffer, sizes) {
        if (!this.validation.isResizable(fileName)) {
            this.logger.debug('File is not resizable, skipping pre-generation', { fileName });
            return;
        }
        let originalWidth;
        try {
            const metadata = await (0, sharp_1.default)(buffer).metadata();
            originalWidth = metadata.width;
            this.logger.debug('Original image metadata for pre-generation', {
                fileName,
                width: originalWidth,
                height: metadata.height,
            });
        }
        catch (error) {
            this.logger.warn('Failed to get original image metadata for pre-generation', {
                fileName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
        const outputFormat = this.options.preferredFormat ?? 'original';
        this.logger.info('Starting pre-generation of image variants', {
            fileName,
            sizes,
            outputFormat,
            originalWidth,
        });
        for (const size of sizes) {
            await this.generateVariant(fileName, buffer, size, originalWidth);
        }
        this.logger.info('Pre-generation completed', { fileName, totalSizes: sizes.length });
    }
    async batchResize(items) {
        this.logger.info('Starting batch resize operation', {
            totalItems: items.length,
            totalVariants: items.reduce((sum, item) => sum + item.sizes.length, 0),
        });
        const results = [];
        for (const item of items) {
            const { fileName, sizes } = item;
            this.logger.verbose('Processing batch item', { fileName, sizes });
            if (!this.validation.isResizable(fileName)) {
                const error = this.validation.isImage(fileName) ? `Image format not supported for resizing` : `File is not an image`;
                this.logger.warn('Batch item skipped: not resizable', { fileName, error });
                for (const size of sizes) {
                    const ext = this.validation.getExtension(fileName);
                    const outputExt = this.getExtensionForFormat(this.options.preferredFormat ?? 'original', ext);
                    const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
                    results.push({ fileName, size, resizedFileName, success: false, error });
                }
                continue;
            }
            let buffer;
            try {
                buffer = await this.storage.getFile(fileName);
                this.logger.debug('Original image loaded for batch resize', { fileName, size: buffer.length });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'File not found';
                this.logger.error('Failed to load original for batch resize', { fileName, error: errorMessage });
                for (const size of sizes) {
                    const ext = this.validation.getExtension(fileName);
                    const outputExt = this.getExtensionForFormat(this.options.preferredFormat ?? 'original', ext);
                    const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
                    results.push({ fileName, size, resizedFileName, success: false, error: errorMessage });
                }
                continue;
            }
            let originalWidth;
            try {
                const metadata = await (0, sharp_1.default)(buffer).metadata();
                originalWidth = metadata.width;
                this.logger.debug('Original image metadata for batch resize', {
                    fileName,
                    width: originalWidth,
                    height: metadata.height,
                });
            }
            catch (error) {
                this.logger.warn('Failed to get metadata for batch resize, proceeding without upscale prevention', {
                    fileName,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
            for (const size of sizes) {
                const variantResult = await this.generateVariant(fileName, buffer, size, originalWidth);
                results.push({
                    fileName,
                    size,
                    resizedFileName: variantResult.resizedFileName,
                    success: variantResult.success,
                    error: variantResult.error,
                });
            }
        }
        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.filter((r) => !r.success).length;
        this.logger.info('Batch resize operation completed', {
            totalItems: items.length,
            totalVariants: results.length,
            successCount,
            failureCount,
        });
        return results;
    }
};
exports.MediasResizeService = MediasResizeService;
exports.MediasResizeService = MediasResizeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [Object, medias_logger_service_1.MediasLoggerService,
        medias_storage_service_1.MediasStorageService,
        medias_validation_service_1.MediasValidationService])
], MediasResizeService);
//# sourceMappingURL=medias-resize.service.js.map