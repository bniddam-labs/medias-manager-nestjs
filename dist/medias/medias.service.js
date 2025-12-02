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
exports.MediasService = void 0;
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const medias_constants_1 = require("./medias.constants");
const services_1 = require("./services");
let MediasService = class MediasService {
    constructor(options, logger, storage, validation, resize) {
        this.options = options;
        this.logger = logger;
        this.storage = storage;
        this.validation = validation;
        this.resize = resize;
        this.logger.verbose('MediasService initialized', { bucket: options.s3.bucketName });
    }
    isImage(fileName) {
        return this.validation.isImage(fileName);
    }
    isResizable(fileName) {
        return this.validation.isResizable(fileName);
    }
    getMimeType(ext) {
        return this.validation.getMimeType(ext);
    }
    generateETag(fileName, lastModified, size) {
        return this.validation.generateETag(fileName, lastModified, size);
    }
    generateETagFromBuffer(buffer) {
        return this.validation.generateETagFromBuffer(buffer);
    }
    negotiateFormat(acceptHeader) {
        return this.resize.negotiateFormat(acceptHeader);
    }
    async getMediaStream(fileName, ifNoneMatch) {
        this.logger.verbose('getMediaStream called', { fileName, hasIfNoneMatch: !!ifNoneMatch });
        const ext = this.validation.getExtension(fileName);
        const mimeType = this.validation.getMimeType(ext);
        this.logger.verbose('Determined MIME type', { fileName, ext, mimeType });
        this.logger.verbose('Fetching file stat', { fileName });
        const stat = await this.storage.getFileStat(fileName);
        const etag = this.validation.generateETag(fileName, stat.lastModified, stat.size);
        this.logger.debug('File stat retrieved', { fileName, size: stat.size, etag });
        if (ifNoneMatch === etag) {
            this.logger.debug('Cache hit - returning 304 Not Modified', { fileName, etag });
            this.options.onCacheHit?.({ fileName, size: 0, notModified: true });
            return {
                stream: null,
                mimeType,
                size: stat.size,
                etag,
                lastModified: stat.lastModified,
                notModified: true,
            };
        }
        this.logger.verbose('Cache miss - fetching file stream', { fileName });
        const stream = await this.storage.getFileStream(fileName);
        this.logger.info('Serving media stream', { fileName, size: stat.size, mimeType });
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
        this.logger.warn('Loading entire file into memory', { fileName });
        return this.storage.getFile(fileName);
    }
    async getMediaFileStream(fileName) {
        return this.storage.getFileStream(fileName);
    }
    async getMediaStat(fileName) {
        return this.storage.getFileStat(fileName);
    }
    async uploadMedia(fileName, file, originalName, skipPreGeneration = false) {
        this.logger.verbose('Uploading file to S3', { fileName, size: file.length, originalName, skipPreGeneration });
        if (this.validation.isImage(fileName)) {
            try {
                const metadata = await (0, sharp_1.default)(file).metadata();
                const ext = this.validation.getExtension(fileName);
                const mimeType = this.validation.getMimeType(ext);
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
                this.logger.debug('Uploading image with enriched metadata', {
                    fileName,
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                });
                await this.storage.putFile(fileName, file, s3Metadata);
                this.logger.info('Image uploaded to S3 with metadata', {
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
                this.logger.warn('Failed to extract image metadata, uploading without enrichment', {
                    fileName,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        await this.storage.putFile(fileName, file);
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
        if (!this.validation.isResizable(fileName)) {
            this.logger.debug('File is not resizable, skipping pre-generation trigger', { fileName });
            return;
        }
        this.logger.debug('Triggering pre-generation', {
            fileName,
            sizes: preGen.sizes,
            hasDispatchJob: !!preGen.dispatchJob,
        });
        try {
            if (preGen.dispatchJob) {
                this.logger.info('Dispatching pre-generation job to external queue', {
                    fileName,
                    sizes: preGen.sizes,
                });
                await preGen.dispatchJob({ fileName, sizes: preGen.sizes });
                this.logger.info('Pre-generation job dispatched successfully', { fileName });
            }
            else {
                this.logger.info('Starting inline pre-generation (fire-and-forget)', {
                    fileName,
                    sizes: preGen.sizes,
                });
                this.resize.preGenerateInline(fileName, buffer, preGen.sizes).catch((error) => {
                    this.logger.error('Inline pre-generation failed', {
                        fileName,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to trigger pre-generation', {
                fileName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async deleteMedia(fileName) {
        return this.storage.deleteFile(fileName);
    }
    async getImageStream(fileName, ifNoneMatch) {
        this.logger.verbose('getImageStream called', { fileName });
        if (!this.validation.isImage(fileName)) {
            this.logger.warn('Attempted to get non-image file as image', { fileName });
            throw new common_1.BadRequestException(`File ${fileName} is not an image. Use getMediaStream() for non-image files.`);
        }
        return this.getMediaStream(fileName, ifNoneMatch);
    }
    async getResizedImage(fileName, size, ifNoneMatch, format) {
        return this.resize.getResizedImage(fileName, size, ifNoneMatch, format);
    }
    async getResizedImageStream(fileName, size, ifNoneMatch, format) {
        return this.resize.getResizedImageStream(fileName, size, ifNoneMatch, format);
    }
    async batchResize(items) {
        return this.resize.batchResize(items);
    }
};
exports.MediasService = MediasService;
exports.MediasService = MediasService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [Object, services_1.MediasLoggerService,
        services_1.MediasStorageService,
        services_1.MediasValidationService,
        services_1.MediasResizeService])
], MediasService);
//# sourceMappingURL=medias.service.js.map