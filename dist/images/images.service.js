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
exports.ImagesService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_minio_client_1 = require("nestjs-minio-client");
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const images_constants_1 = require("./images.constants");
let ImagesService = class ImagesService {
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
    getMimeType(ext) {
        switch (ext.toLowerCase()) {
            case '.png':
                return 'image/png';
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.gif':
                return 'image/gif';
            case '.webp':
                return 'image/webp';
            default:
                return 'application/octet-stream';
        }
    }
    generateETag(fileName, lastModified, size) {
        const hash = crypto
            .createHash('md5')
            .update(`${fileName}-${lastModified.getTime()}-${size}`)
            .digest('hex');
        return `"${hash}"`;
    }
    generateETagFromBuffer(buffer) {
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        return `"${hash}"`;
    }
    async getImageStream(fileName, ifNoneMatch) {
        const ext = path.extname(fileName);
        const mimeType = this.getMimeType(ext);
        const stat = await this.getFileStat(fileName);
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
        const stream = await this.getFileStream(fileName);
        return {
            stream,
            mimeType,
            size: stat.size,
            etag,
            lastModified: stat.lastModified,
            notModified: false,
        };
    }
    async getResizedImage(fileName, size, ifNoneMatch) {
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const resizedFileName = `${baseName}-${size}${ext}`;
        const mimeType = this.getMimeType(ext);
        try {
            const stat = await this.getFileStat(resizedFileName);
            const etag = this.generateETag(resizedFileName, stat.lastModified, stat.size);
            if (ifNoneMatch === etag) {
                return {
                    buffer: null,
                    mimeType,
                    etag,
                    notModified: true,
                };
            }
            const buffer = await this.getFile(resizedFileName);
            return {
                buffer,
                mimeType,
                etag,
                notModified: false,
            };
        }
        catch (error) {
        }
        const originalFile = await this.getFile(fileName);
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
        this.uploadFile(resizedFileName, resizedBuffer).catch(() => {
        });
        return {
            buffer: resizedBuffer,
            mimeType,
            etag,
            notModified: false,
        };
    }
    async getFileStream(fileName) {
        try {
            const fileStream = (await this.minioService.client.getObject(this.getBucketName(), fileName));
            return fileStream;
        }
        catch (error) {
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async getFile(fileName) {
        try {
            const fileStream = await this.getFileStream(fileName);
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
    async getFileStat(fileName) {
        try {
            return await this.minioService.client.statObject(this.getBucketName(), fileName);
        }
        catch (error) {
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async uploadFile(fileName, file) {
        await this.minioService.client.putObject(this.getBucketName(), fileName, file);
    }
    deleteFile(fileName) {
        return this.minioService.client.removeObject(this.getBucketName(), fileName);
    }
};
exports.ImagesService = ImagesService;
exports.ImagesService = ImagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(images_constants_1.IMAGES_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [nestjs_minio_client_1.MinioService, Object])
], ImagesService);
//# sourceMappingURL=images.service.js.map