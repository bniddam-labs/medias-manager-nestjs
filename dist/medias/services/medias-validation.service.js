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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasValidationService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const medias_constants_1 = require("../medias.constants");
const medias_logger_service_1 = require("./medias-logger.service");
let MediasValidationService = class MediasValidationService {
    constructor(options, logger) {
        this.options = options;
        this.logger = logger;
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
    validateResizable(fileName) {
        if (!this.isResizable(fileName)) {
            const ext = path.extname(fileName).toLowerCase();
            if (this.isImage(fileName)) {
                this.logger.warn('Attempted to resize unsupported image format', { fileName, ext });
                throw new common_1.BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${medias_constants_1.RESIZABLE_IMAGE_EXTENSIONS.join(', ')}`);
            }
            this.logger.warn('Attempted to resize non-image file', { fileName });
            throw new common_1.BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
        }
    }
    validateResizeSize(fileName, size) {
        const maxWidth = this.options.maxResizeWidth ?? medias_constants_1.DEFAULT_MAX_RESIZE_WIDTH;
        if (size > maxWidth) {
            this.logger.warn('Resize size exceeds maximum', { fileName, size, maxWidth });
            throw new common_1.BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
        }
    }
    generateETag(fileName, lastModified, size) {
        const hash = crypto.createHash('md5').update(`${fileName}-${lastModified.getTime()}-${size}`).digest('hex');
        return `"${hash}"`;
    }
    generateETagFromBuffer(buffer) {
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        return `"${hash}"`;
    }
    buildResizedFileName(fileName, size, outputExt) {
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const dirName = path.dirname(fileName);
        return dirName === '.' ? `${baseName}-${size}${outputExt}` : `${dirName}/${baseName}-${size}${outputExt}`;
    }
    getExtension(fileName) {
        return path.extname(fileName);
    }
    getMaxResizeWidth() {
        return this.options.maxResizeWidth ?? medias_constants_1.DEFAULT_MAX_RESIZE_WIDTH;
    }
    isAutoPreventUpscaleEnabled() {
        return this.options.autoPreventUpscale ?? true;
    }
};
exports.MediasValidationService = MediasValidationService;
exports.MediasValidationService = MediasValidationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [Object, medias_logger_service_1.MediasLoggerService])
], MediasValidationService);
//# sourceMappingURL=medias-validation.service.js.map