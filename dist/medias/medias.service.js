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
exports.MediasService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_minio_client_1 = require("nestjs-minio-client");
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const medias_constants_1 = require("./medias.constants");
let MediasService = class MediasService {
    constructor(minioService, options) {
        this.minioService = minioService;
        this.options = options;
    }
    getBucketName() {
        const bucketName = this.options.s3.bucketName;
        if (!bucketName) {
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
        const ext = path.extname(fileName);
        const mimeType = this.getMimeType(ext);
        const stat = await this.getMediaStat(fileName);
        const etag = this.generateETag(fileName, stat.lastModified, stat.size);
        if (ifNoneMatch === etag) {
            return {
                stream: null,
                mimeType,
                size: stat.size,
                etag,
                lastModified: stat.lastModified,
                notModified: true,
            };
        }
        const stream = await this.getMediaFileStream(fileName);
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
        try {
            const fileStream = await this.getMediaFileStream(fileName);
            return new Promise((resolve, reject) => {
                const chunks = [];
                fileStream.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                fileStream.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
                fileStream.on('error', reject);
            });
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async getMediaFileStream(fileName) {
        try {
            const fileStream = (await this.minioService.client.getObject(this.getBucketName(), fileName));
            return fileStream;
        }
        catch {
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async getMediaStat(fileName) {
        try {
            return await this.minioService.client.statObject(this.getBucketName(), fileName);
        }
        catch {
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async uploadMedia(fileName, file) {
        await this.minioService.client.putObject(this.getBucketName(), fileName, file);
    }
    async deleteMedia(fileName) {
        await this.minioService.client.removeObject(this.getBucketName(), fileName);
    }
    async getImageStream(fileName, ifNoneMatch) {
        if (!this.isImage(fileName)) {
            throw new common_1.BadRequestException(`File ${fileName} is not an image. Use getMediaStream() for non-image files.`);
        }
        return this.getMediaStream(fileName, ifNoneMatch);
    }
    async getResizedImage(fileName, size, ifNoneMatch) {
        if (!this.isResizable(fileName)) {
            const ext = path.extname(fileName).toLowerCase();
            if (this.isImage(fileName)) {
                throw new common_1.BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${medias_constants_1.RESIZABLE_IMAGE_EXTENSIONS.join(', ')}`);
            }
            throw new common_1.BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
        }
        const maxWidth = this.options.maxResizeWidth || 5000;
        if (size > maxWidth) {
            throw new common_1.BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
        }
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const dirName = path.dirname(fileName);
        const resizedFileName = dirName === '.' ? `${baseName}-${size}${ext}` : `${dirName}/${baseName}-${size}${ext}`;
        const mimeType = this.getMimeType(ext);
        try {
            const stat = await this.getMediaStat(resizedFileName);
            const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);
            if (ifNoneMatch === etag) {
                return {
                    buffer: null,
                    mimeType,
                    etag,
                    notModified: true,
                };
            }
            const buffer = await this.getMedia(resizedFileName);
            return {
                buffer,
                mimeType,
                etag,
                notModified: false,
            };
        }
        catch {
        }
        const originalFile = await this.getMedia(fileName);
        const resizedBuffer = await (0, sharp_1.default)(originalFile).resize(size).toBuffer();
        const etag = this.generateETagFromBuffer(resizedBuffer);
        if (ifNoneMatch === etag) {
            return {
                buffer: null,
                mimeType,
                etag,
                notModified: true,
            };
        }
        this.uploadMedia(resizedFileName, resizedBuffer).catch(() => {
        });
        return {
            buffer: resizedBuffer,
            mimeType,
            etag,
            notModified: false,
        };
    }
};
exports.MediasService = MediasService;
exports.MediasService = MediasService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [nestjs_minio_client_1.MinioService, Object])
], MediasService);
//# sourceMappingURL=medias.service.js.map