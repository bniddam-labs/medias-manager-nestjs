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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasStorageService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_minio_client_1 = require("nestjs-minio-client");
const medias_constants_1 = require("../medias.constants");
const medias_logger_service_1 = require("./medias-logger.service");
let MediasStorageService = class MediasStorageService {
    constructor(minioService, options, logger) {
        this.minioService = minioService;
        this.options = options;
        this.logger = logger;
        this.logger.verbose('MediasStorageService initialized', { bucket: options.s3.bucketName });
    }
    getBucketName() {
        const bucketName = this.options.s3.bucketName;
        if (!bucketName) {
            this.logger.error('S3 bucket name not configured');
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
                this.logger.verbose(`Executing S3 operation (attempt ${attempt + 1}/${medias_constants_1.RETRY_CONFIG.MAX_ATTEMPTS})`, {
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
                    this.logger.error('S3 operation failed', {
                        operation: context.operationName,
                        fileName: context.fileName,
                        attempt,
                        isTransient,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    throw error;
                }
                const backoffMs = medias_constants_1.RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(medias_constants_1.RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
                this.logger.warn('Transient S3 error, retrying', {
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
    async getFileStream(fileName) {
        this.logger.verbose('Fetching file stream from S3', { fileName, bucket: this.getBucketName() });
        try {
            const fileStream = await this.withRetry(() => this.minioService.client.getObject(this.getBucketName(), fileName), { operationName: 'getObject', fileName });
            this.logger.verbose('File stream obtained', { fileName });
            return fileStream;
        }
        catch (error) {
            this.logger.error('File not found in S3', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async getFile(fileName) {
        this.logger.verbose('Loading file into buffer', { fileName });
        try {
            const fileStream = await this.getFileStream(fileName);
            return new Promise((resolve, reject) => {
                const chunks = [];
                fileStream.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                fileStream.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    this.logger.debug('File loaded into buffer', { fileName, size: buffer.length });
                    resolve(buffer);
                });
                fileStream.on('error', (error) => {
                    this.logger.error('Error reading file stream', { fileName, error: error.message });
                    reject(error);
                });
            });
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            this.logger.error('Failed to get file', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async getFileStat(fileName) {
        this.logger.verbose('Fetching file stat from S3', { fileName });
        try {
            const stat = await this.withRetry(() => this.minioService.client.statObject(this.getBucketName(), fileName), { operationName: 'statObject', fileName });
            this.logger.verbose('File stat obtained', { fileName, size: stat.size });
            return stat;
        }
        catch (error) {
            this.logger.error('File stat not found', { fileName, error: error instanceof Error ? error.message : 'Unknown error' });
            throw new common_1.NotFoundException(`File with name ${fileName} not found`);
        }
    }
    async putFile(fileName, file, metadata) {
        this.logger.verbose('Uploading file to S3', { fileName, size: file.length });
        await this.withRetry(() => (metadata ? this.minioService.client.putObject(this.getBucketName(), fileName, file, metadata) : this.minioService.client.putObject(this.getBucketName(), fileName, file)), { operationName: 'putObject', fileName });
        this.logger.info('File uploaded to S3', { fileName, size: file.length });
    }
    async deleteFile(fileName) {
        this.logger.verbose('Deleting file from S3', { fileName });
        await this.withRetry(() => this.minioService.client.removeObject(this.getBucketName(), fileName), { operationName: 'removeObject', fileName });
        this.logger.info('File deleted from S3', { fileName });
    }
};
exports.MediasStorageService = MediasStorageService;
exports.MediasStorageService = MediasStorageService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [nestjs_minio_client_1.MinioService, Object, medias_logger_service_1.MediasLoggerService])
], MediasStorageService);
//# sourceMappingURL=medias-storage.service.js.map