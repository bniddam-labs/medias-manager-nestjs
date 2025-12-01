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
var ImagesController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImagesController = void 0;
const common_1 = require("@nestjs/common");
const delete_image_dto_1 = require("./dto/delete-image.dto");
const get_image_dto_1 = require("./dto/get-image.dto");
const images_service_1 = require("./images.service");
let ImagesController = ImagesController_1 = class ImagesController {
    constructor(imagesService) {
        this.imagesService = imagesService;
        this.logger = new common_1.Logger(ImagesController_1.name);
    }
    async getFile(params, query, req, res) {
        const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
        const { size } = query;
        const ifNoneMatch = req.headers['if-none-match'];
        try {
            if (size && parseInt(size, 10) > 0) {
                const result = await this.imagesService.getResizedImage(fileName, parseInt(size, 10), ifNoneMatch);
                if (result.notModified) {
                    res.status(304).end();
                    return;
                }
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Length', result.buffer.length);
                res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
                res.setHeader('ETag', result.etag);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.send(result.buffer);
            }
            else {
                const result = await this.imagesService.getImageStream(fileName, ifNoneMatch);
                if (result.notModified) {
                    res.status(304).end();
                    return;
                }
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
                        res.status(500).end();
                    }
                });
            }
        }
        catch (error) {
            this.logger.error(`Error serving image: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new common_1.InternalServerErrorException('Error serving image');
        }
    }
    async deleteFile(params) {
        const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
        return this.imagesService.deleteFile(fileName);
    }
};
exports.ImagesController = ImagesController;
__decorate([
    (0, common_1.Get)('*fileName'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_image_dto_1.GetImageParamsDto, get_image_dto_1.GetImageQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ImagesController.prototype, "getFile", null);
__decorate([
    (0, common_1.Delete)('*fileName'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_image_dto_1.DeleteImageParamsDto]),
    __metadata("design:returntype", Promise)
], ImagesController.prototype, "deleteFile", null);
exports.ImagesController = ImagesController = ImagesController_1 = __decorate([
    (0, common_1.Controller)('images'),
    __metadata("design:paramtypes", [images_service_1.ImagesService])
], ImagesController);
//# sourceMappingURL=images.controller.js.map