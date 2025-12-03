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
var MediasController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasController = void 0;
const common_1 = require("@nestjs/common");
const delete_media_dto_1 = require("./dto/delete-media.dto");
const get_media_dto_1 = require("./dto/get-media.dto");
const medias_constants_1 = require("./medias.constants");
const medias_service_1 = require("./medias.service");
let MediasController = MediasController_1 = class MediasController {
    constructor(mediasService) {
        this.mediasService = mediasService;
        this.logger = new common_1.Logger(MediasController_1.name);
    }
    async getMedia(params, query, req, res) {
        const startTime = Date.now();
        const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
        const { size } = query;
        const ifNoneMatch = req.headers['if-none-match'];
        const acceptHeader = req.headers['accept'];
        try {
            if (size && parseInt(size, 10) > 0) {
                const requestedSize = parseInt(size, 10);
                if (!this.mediasService.isResizable(fileName)) {
                    if (this.mediasService.isImage(fileName)) {
                        throw new common_1.BadRequestException(`This image format does not support resizing. Serve without size parameter.`);
                    }
                    throw new common_1.BadRequestException(`Cannot resize non-image files. Remove the size parameter to serve the file.`);
                }
                const format = this.mediasService.negotiateFormat(acceptHeader);
                const result = await this.mediasService.getResizedImage(fileName, requestedSize, ifNoneMatch, format);
                const duration = Date.now() - startTime;
                if (result.notModified) {
                    res.setHeader('X-Processing-Time', `${duration}ms`);
                    res.setHeader('X-Cache', 'HIT');
                    res.setHeader('X-Resize', 'yes');
                    res.status(medias_constants_1.HTTP_STATUS.NOT_MODIFIED).end();
                    return;
                }
                res.setHeader('Vary', 'Accept');
                res.setHeader('X-Processing-Time', `${duration}ms`);
                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Resize', 'yes');
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Length', result.buffer.length);
                res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
                res.setHeader('ETag', result.etag);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.send(result.buffer);
            }
            else {
                const result = await this.mediasService.getMediaStream(fileName, ifNoneMatch);
                const duration = Date.now() - startTime;
                if (result.notModified) {
                    res.setHeader('X-Processing-Time', `${duration}ms`);
                    res.setHeader('X-Cache', 'HIT');
                    res.setHeader('X-Resize', 'no');
                    res.status(medias_constants_1.HTTP_STATUS.NOT_MODIFIED).end();
                    return;
                }
                res.setHeader('X-Processing-Time', `${duration}ms`);
                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Resize', 'no');
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Length', result.size);
                res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
                res.setHeader('ETag', result.etag);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.setHeader('Last-Modified', result.lastModified.toUTCString());
                result.stream.pipe(res);
                result.stream.on('error', (error) => {
                    this.logger.error(`Stream error: ${error.message}`);
                    if (!res.headersSent) {
                        res.status(medias_constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR).end();
                    }
                });
            }
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException || error instanceof common_1.NotFoundException) {
                throw error;
            }
            this.logger.error(`Error serving media: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new common_1.InternalServerErrorException('Error serving media');
        }
    }
    async deleteMedia(params) {
        const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
        return this.mediasService.deleteMedia(fileName);
    }
};
exports.MediasController = MediasController;
__decorate([
    (0, common_1.Get)('*fileName'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_media_dto_1.GetMediaParamsDto, get_media_dto_1.GetMediaQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], MediasController.prototype, "getMedia", null);
__decorate([
    (0, common_1.Delete)('*fileName'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_media_dto_1.DeleteMediaParamsDto]),
    __metadata("design:returntype", Promise)
], MediasController.prototype, "deleteMedia", null);
exports.MediasController = MediasController = MediasController_1 = __decorate([
    (0, common_1.Controller)('medias'),
    __metadata("design:paramtypes", [medias_service_1.MediasService])
], MediasController);
//# sourceMappingURL=medias.controller.js.map