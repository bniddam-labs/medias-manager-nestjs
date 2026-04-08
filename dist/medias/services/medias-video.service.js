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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasVideoService = void 0;
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const common_1 = require("@nestjs/common");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const sharp_1 = __importDefault(require("sharp"));
const medias_constants_1 = require("../medias.constants");
const medias_logger_service_1 = require("./medias-logger.service");
const medias_storage_service_1 = require("./medias-storage.service");
const medias_validation_service_1 = require("./medias-validation.service");
let MediasVideoService = class MediasVideoService {
    constructor(options, logger, storage, validation) {
        this.options = options;
        this.logger = logger;
        this.storage = storage;
        this.validation = validation;
        this.ffmpegAvailable = false;
    }
    async onModuleInit() {
        this.ffmpegAvailable = await this.checkFfmpegAvailability();
    }
    checkFfmpegAvailability() {
        return new Promise((resolve) => {
            fluent_ffmpeg_1.default.getAvailableFormats((err) => {
                if (err) {
                    this.logger.warn('ffmpeg is not available. Video thumbnail generation will be disabled.', {
                        error: err.message,
                    });
                    resolve(false);
                }
                else {
                    this.logger.debug('ffmpeg is available for video thumbnail generation');
                    resolve(true);
                }
            });
        });
    }
    isFfmpegAvailable() {
        return this.ffmpegAvailable;
    }
    parseTimestamp(timestamp, videoDuration) {
        if (timestamp === undefined) {
            return (videoDuration * medias_constants_1.DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT) / medias_constants_1.PERCENTAGE_DIVISOR;
        }
        if (typeof timestamp === 'number') {
            return Math.min(timestamp, videoDuration);
        }
        if (typeof timestamp === 'string' && timestamp.endsWith('%')) {
            const percent = Number.parseFloat(timestamp);
            if (!Number.isNaN(percent)) {
                return (videoDuration * percent) / medias_constants_1.PERCENTAGE_DIVISOR;
            }
        }
        const parsed = Number.parseFloat(timestamp);
        if (!Number.isNaN(parsed)) {
            return Math.min(parsed, videoDuration);
        }
        this.logger.warn('Invalid thumbnail timestamp, using default', { timestamp });
        return (videoDuration * medias_constants_1.DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT) / medias_constants_1.PERCENTAGE_DIVISOR;
    }
    writeTempFile(videoBuffer) {
        const tempPath = path.join(os.tmpdir(), `medias-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
        fs.writeFileSync(tempPath, videoBuffer);
        return tempPath;
    }
    cleanupTempFile(tempPath) {
        try {
            fs.unlinkSync(tempPath);
        }
        catch {
            this.logger.warn('Failed to cleanup temp file', { tempPath });
        }
    }
    getVideoDuration(videoBuffer) {
        const tempPath = this.writeTempFile(videoBuffer);
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(tempPath, (err, metadata) => {
                this.cleanupTempFile(tempPath);
                if (err) {
                    reject(err);
                    return;
                }
                resolve(metadata.format.duration ?? 0);
            });
        });
    }
    extractFrame(videoBuffer, timestampSeconds) {
        const tempPath = this.writeTempFile(videoBuffer);
        return this.extractFrameAtTimestamp(tempPath, timestampSeconds).catch((error) => {
            this.logger.warn('Frame extraction failed at requested timestamp, retrying at 0s', {
                timestamp: timestampSeconds,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return this.extractFrameAtTimestamp(tempPath, 0);
        }).finally(() => {
            this.cleanupTempFile(tempPath);
        });
    }
    extractFrameAtTimestamp(filePath, timestampSeconds) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            (0, fluent_ffmpeg_1.default)(filePath)
                .inputOptions([`-ss ${timestampSeconds}`])
                .outputOptions([`-frames:v ${medias_constants_1.FFMPEG_FRAME_COUNT}`, '-f image2pipe', '-vcodec png'])
                .format('image2pipe')
                .on('error', (err) => {
                reject(err);
            })
                .pipe()
                .on('data', (chunk) => {
                chunks.push(chunk);
            })
                .on('end', () => {
                if (chunks.length === 0) {
                    reject(new Error('No frame extracted from video'));
                    return;
                }
                resolve(Buffer.concat(chunks));
            })
                .on('error', (err) => {
                reject(err);
            });
        });
    }
    applyFormat(pipeline, format) {
        switch (format) {
            case 'webp':
                return pipeline.webp({ quality: medias_constants_1.IMAGE_QUALITY.WEBP });
            case 'jpeg':
                return pipeline.jpeg({ quality: medias_constants_1.IMAGE_QUALITY.JPEG });
            case 'avif':
                return pipeline.avif({ quality: medias_constants_1.IMAGE_QUALITY.AVIF });
            default:
                return pipeline.jpeg({ quality: medias_constants_1.IMAGE_QUALITY.JPEG });
        }
    }
    getExtensionForFormat(format) {
        switch (format) {
            case 'webp':
                return '.webp';
            case 'avif':
                return '.avif';
            default:
                return '.jpg';
        }
    }
    async getOrGenerateThumbnail(fileName, size, ifNoneMatch) {
        if (!this.ffmpegAvailable) {
            throw new common_1.BadRequestException('Video thumbnail generation requires ffmpeg. Please ensure ffmpeg is installed on the system.');
        }
        const outputFormat = this.options.preferredFormat ?? 'original';
        const outputExt = this.getExtensionForFormat(outputFormat);
        const thumbnailFileName = this.validation.buildThumbnailFileName(fileName, size, outputExt);
        const mimeType = this.validation.getMimeType(outputExt);
        try {
            const stat = await this.storage.getFileStat(thumbnailFileName);
            const etag = this.validation.generateETag(thumbnailFileName, stat.lastModified, stat.size);
            if (ifNoneMatch === etag) {
                this.logger.debug('Video thumbnail cache hit (304)', { thumbnailFileName });
                return { buffer: null, mimeType, etag, notModified: true };
            }
            this.logger.debug('Video thumbnail cache hit', { thumbnailFileName });
            const buffer = await this.storage.getFile(thumbnailFileName);
            return { buffer, mimeType, etag, notModified: false };
        }
        catch {
            this.logger.debug('Video thumbnail not cached, generating on-the-fly', { thumbnailFileName });
        }
        this.validation.validateResizeSize(fileName, size);
        const startTime = Date.now();
        this.logger.info('Generating video thumbnail on-the-fly', { fileName, size });
        const videoBuffer = await this.storage.getFile(fileName);
        const duration = await this.getVideoDuration(videoBuffer);
        const timestamp = this.parseTimestamp(this.options.videoThumbnails?.thumbnailTimestamp, duration);
        const frameBuffer = await this.extractFrame(videoBuffer, timestamp);
        let finalSize = size;
        if (this.validation.isAutoPreventUpscaleEnabled()) {
            try {
                const frameMetadata = await (0, sharp_1.default)(frameBuffer).metadata();
                if (frameMetadata.width && size > frameMetadata.width) {
                    finalSize = frameMetadata.width;
                    this.logger.debug('Clamped thumbnail size to prevent upscale', {
                        fileName,
                        requestedSize: size,
                        frameWidth: frameMetadata.width,
                    });
                }
            }
            catch (error) {
                this.logger.warn('Failed to check frame dimensions for upscale prevention', {
                    fileName,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        let pipeline = (0, sharp_1.default)(frameBuffer).resize(finalSize);
        pipeline = this.applyFormat(pipeline, outputFormat);
        const thumbnailBuffer = await pipeline.toBuffer();
        const durationMs = Date.now() - startTime;
        this.storage.putFile(thumbnailFileName, thumbnailBuffer).then(() => {
            this.logger.info('Video thumbnail cached to S3', { thumbnailFileName });
            this.options.onVideoThumbnailGenerated?.({
                originalFileName: fileName,
                thumbnailFileName,
                requestedSize: size,
                durationMs,
                format: outputFormat,
            });
        }).catch((error) => {
            this.logger.error('Failed to cache video thumbnail to S3', {
                thumbnailFileName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        });
        const etag = this.validation.generateETagFromBuffer(thumbnailBuffer);
        this.logger.info('Video thumbnail generated on-the-fly', { fileName, size, thumbnailFileName, durationMs });
        return { buffer: thumbnailBuffer, mimeType, etag, notModified: false };
    }
    async generateThumbnailsInline(fileName, videoBuffer, sizes, thumbnailTimestamp) {
        if (!this.ffmpegAvailable) {
            this.logger.warn('ffmpeg not available, skipping video thumbnail generation', { fileName });
            return;
        }
        const startTime = Date.now();
        const outputFormat = this.options.preferredFormat ?? 'original';
        const outputExt = this.getExtensionForFormat(outputFormat);
        this.logger.info('Starting video thumbnail generation', {
            fileName,
            sizes,
            outputFormat,
            thumbnailTimestamp,
        });
        let duration;
        try {
            duration = await this.getVideoDuration(videoBuffer);
            this.logger.debug('Video duration probed', { fileName, duration });
        }
        catch (error) {
            this.logger.error('Failed to probe video duration', {
                fileName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
        const timestamp = this.parseTimestamp(thumbnailTimestamp, duration);
        this.logger.debug('Computed thumbnail timestamp', { fileName, timestamp, duration });
        let frameBuffer;
        try {
            frameBuffer = await this.extractFrame(videoBuffer, timestamp);
            this.logger.debug('Frame extracted from video', { fileName, frameSize: frameBuffer.length });
        }
        catch (error) {
            this.logger.error('Failed to extract frame from video', {
                fileName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
        const maxResizeWidth = this.validation.getMaxResizeWidth();
        const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();
        let frameWidth;
        if (autoPreventUpscale) {
            try {
                const frameMetadata = await (0, sharp_1.default)(frameBuffer).metadata();
                frameWidth = frameMetadata.width;
                this.logger.debug('Frame dimensions for upscale prevention', { fileName, frameWidth, frameHeight: frameMetadata.height });
            }
            catch (error) {
                this.logger.warn('Failed to get frame metadata for upscale prevention', {
                    fileName,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        for (const size of sizes) {
            const thumbnailStartTime = Date.now();
            const thumbnailFileName = this.validation.buildThumbnailFileName(fileName, size, outputExt);
            try {
                if (size > maxResizeWidth) {
                    this.logger.warn('Thumbnail size exceeds maxResizeWidth, skipping', {
                        fileName,
                        size,
                        maxResizeWidth,
                    });
                    continue;
                }
                let finalSize = size;
                if (autoPreventUpscale && frameWidth && size > frameWidth) {
                    this.logger.debug('Thumbnail size exceeds frame width, clamping', {
                        fileName,
                        requestedSize: size,
                        frameWidth,
                    });
                    finalSize = frameWidth;
                }
                let pipeline = (0, sharp_1.default)(frameBuffer).resize(finalSize);
                pipeline = this.applyFormat(pipeline, outputFormat);
                const thumbnailBuffer = await pipeline.toBuffer();
                await this.storage.putFile(thumbnailFileName, thumbnailBuffer);
                const durationMs = Date.now() - thumbnailStartTime;
                this.logger.info('Video thumbnail generated', {
                    fileName,
                    thumbnailFileName,
                    size,
                    thumbnailSize: thumbnailBuffer.length,
                    durationMs,
                });
                this.options.onVideoThumbnailGenerated?.({
                    originalFileName: fileName,
                    thumbnailFileName,
                    requestedSize: size,
                    durationMs,
                    format: outputFormat,
                });
            }
            catch (error) {
                this.logger.error('Failed to generate video thumbnail', {
                    fileName,
                    thumbnailFileName,
                    size,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        const totalDuration = Date.now() - startTime;
        this.logger.info('Video thumbnail generation completed', {
            fileName,
            totalSizes: sizes.length,
            totalDurationMs: totalDuration,
        });
    }
};
exports.MediasVideoService = MediasVideoService;
exports.MediasVideoService = MediasVideoService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [Object, medias_logger_service_1.MediasLoggerService,
        medias_storage_service_1.MediasStorageService,
        medias_validation_service_1.MediasValidationService])
], MediasVideoService);
//# sourceMappingURL=medias-video.service.js.map