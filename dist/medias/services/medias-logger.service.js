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
exports.MediasLoggerService = void 0;
const common_1 = require("@nestjs/common");
const medias_constants_1 = require("../medias.constants");
const LOG_LEVEL_PRIORITY = {
    none: -1,
    fatal: 0,
    error: 1,
    warn: 2,
    log: 3,
    debug: 4,
    verbose: 5,
};
let MediasLoggerService = class MediasLoggerService {
    constructor(options) {
        this.logger = new common_1.Logger('MediasModule');
        this.logLevel = options.logLevel ?? 'none';
    }
    shouldLog(level) {
        return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.logLevel];
    }
    error(message, context) {
        if (this.shouldLog('error')) {
            this.logger.error(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    warn(message, context) {
        if (this.shouldLog('warn')) {
            this.logger.warn(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    info(message, context) {
        if (this.shouldLog('log')) {
            this.logger.log(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    debug(message, context) {
        if (this.shouldLog('debug')) {
            this.logger.debug(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
    verbose(message, context) {
        if (this.shouldLog('verbose')) {
            this.logger.verbose(context ? `${message} ${JSON.stringify(context)}` : message);
        }
    }
};
exports.MediasLoggerService = MediasLoggerService;
exports.MediasLoggerService = MediasLoggerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(medias_constants_1.MEDIAS_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], MediasLoggerService);
//# sourceMappingURL=medias-logger.service.js.map