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
            const fileStream = (await this.minioService.client.getObject(this.getBucketName(), fileName));
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
            const stat = await this.minioService.client.statObject(this.getBucketName(), fileName);
            this.logVerbose('File stat obtained', { fileName, size: stat.size });
            return stat;
        }
        catch (error) {
            this.logError('File stat not found', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async uploadMedia(fileName, file) {
        this.logVerbose('Uploading file to S3', { fileName, size: file.length });
        await this.minioService.client.putObject(this.getBucketName(), fileName, file);
        this.logInfo('File uploaded to S3', { fileName, size: file.length });
    }
    async deleteMedia(fileName) {
        this.logVerbose('Deleting file from S3', { fileName });
        await this.minioService.client.removeObject(this.getBucketName(), fileName);
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
    async getResizedImage(fileName, size, ifNoneMatch) {
        this.logVerbose('getResizedImage called', { fileName, size, hasIfNoneMatch: !!ifNoneMatch });
        if (!this.isResizable(fileName)) {
            const ext = path.extname(fileName).toLowerCase();
            if (this.isImage(fileName)) {
                this.logWarn('Attempted to resize unsupported image format', { fileName, ext });
                throw new common_1.BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${medias_constants_1.RESIZABLE_IMAGE_EXTENSIONS.join(', ')}`);
            }
            this.logWarn('Attempted to resize non-image file', { fileName });
            throw new common_1.BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
        }
        const maxWidth = this.options.maxResizeWidth || 5000;
        if (size > maxWidth) {
            this.logWarn('Resize size exceeds maximum', { fileName, size, maxWidth });
            throw new common_1.BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
        }
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const dirName = path.dirname(fileName);
        const resizedFileName = dirName === '.' ? `${baseName}-${size}${ext}` : `${dirName}/${baseName}-${size}${ext}`;
        const mimeType = this.getMimeType(ext);
        this.logVerbose('Computed resized file name', { originalFileName: fileName, resizedFileName, size });
        this.logVerbose('Checking for cached resized image', { resizedFileName });
        try {
            const stat = await this.getMediaStat(resizedFileName);
            const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);
            this.logDebug('Cached resized image found', { resizedFileName, size: stat.size, etag });
            if (ifNoneMatch === etag) {
                this.logDebug('Cache hit on resized image - returning 304 Not Modified', { resizedFileName, etag });
                return {
                    buffer: null,
                    mimeType,
                    etag,
                    notModified: true,
                };
            }
            this.logInfo('Serving cached resized image', { resizedFileName, size: stat.size });
            const buffer = await this.getMedia(resizedFileName);
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
        this.logVerbose('Resizing image with Sharp', { fileName, targetWidth: size });
        const resizedBuffer = await (0, sharp_1.default)(originalFile).resize(size).toBuffer();
        const etag = this.generateETagFromBuffer(resizedBuffer);
        this.logDebug('Image resized', { fileName, originalSize: originalFile.length, resizedSize: resizedBuffer.length, etag });
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
        this.logInfo('Serving freshly resized image', { fileName, size, resizedSize: resizedBuffer.length });
        return {
            buffer: resizedBuffer,
            mimeType,
            etag,
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