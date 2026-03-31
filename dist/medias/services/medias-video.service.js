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
exports.MediasVideoService = void 0;
const node_stream_1 = require("node:stream");
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
    getVideoDuration(videoBuffer) {
        return new Promise((resolve, reject) => {
            const inputStream = node_stream_1.Readable.from(videoBuffer);
            fluent_ffmpeg_1.default.ffprobe(inputStream, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(metadata.format.duration ?? 0);
            });
        });
    }
    extractFrame(videoBuffer, timestampSeconds) {
        return new Promise((resolve, reject) => {
            const inputStream = node_stream_1.Readable.from(videoBuffer);
            const chunks = [];
            (0, fluent_ffmpeg_1.default)(inputStream)
                .seekInput(timestampSeconds)
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