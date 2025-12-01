"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ImagesModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImagesModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_minio_client_1 = require("nestjs-minio-client");
const images_constants_1 = require("./images.constants");
const images_controller_1 = require("./images.controller");
const images_service_1 = require("./images.service");
let ImagesModule = ImagesModule_1 = class ImagesModule {
    static forRoot(options) {
        const controllers = options.registerController ? [images_controller_1.ImagesController] : [];
        return {
            module: ImagesModule_1,
            imports: [
                nestjs_minio_client_1.MinioModule.register({
                    ...options.s3,
                }),
            ],
            controllers,
            providers: [
                {
                    provide: images_constants_1.IMAGES_MODULE_OPTIONS,
                    useValue: options,
                },
                images_service_1.ImagesService,
            ],
            exports: [images_service_1.ImagesService],
        };
    }
    static forRootAsync(options) {
        const controllers = options.registerController ? [images_controller_1.ImagesController] : [];
        return {
            module: ImagesModule_1,
            imports: [
                ...(options.imports || []),
                nestjs_minio_client_1.MinioModule.registerAsync({
                    useFactory: async (...args) => {
                        const moduleOptions = await this.createModuleOptions(options, ...args);
                        return moduleOptions.s3;
                    },
                    inject: options.inject || [],
                }),
            ],
            controllers,
            providers: [...this.createAsyncProviders(options), images_service_1.ImagesService],
            exports: [images_service_1.ImagesService],
        };
    }
    static createAsyncProviders(options) {
        if (options.useExisting || options.useFactory) {
            return [this.createAsyncOptionsProvider(options)];
        }
        if (options.useClass) {
            return [
                this.createAsyncOptionsProvider(options),
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
            ];
        }
        return [];
    }
    static createAsyncOptionsProvider(options) {
        if (options.useFactory) {
            return {
                provide: images_constants_1.IMAGES_MODULE_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject || [],
            };
        }
        if (options.useExisting) {
            return {
                provide: images_constants_1.IMAGES_MODULE_OPTIONS,
                useFactory: async (optionsFactory) => await optionsFactory.createImagesModuleOptions(),
                inject: [options.useExisting],
            };
        }
        if (options.useClass) {
            return {
                provide: images_constants_1.IMAGES_MODULE_OPTIONS,
                useFactory: async (optionsFactory) => await optionsFactory.createImagesModuleOptions(),
                inject: [options.useClass],
            };
        }
        throw new Error('Invalid ImagesModule configuration');
    }
    static async createModuleOptions(options, ...args) {
        if (options.useFactory) {
            return await options.useFactory(...args);
        }
        if (options.useClass || options.useExisting) {
            const factory = args[0];
            return await factory.createImagesModuleOptions();
        }
        throw new Error('Invalid ImagesModule configuration');
    }
};
exports.ImagesModule = ImagesModule;
exports.ImagesModule = ImagesModule = ImagesModule_1 = __decorate([
    (0, common_1.Module)({})
], ImagesModule);
//# sourceMappingURL=images.module.js.map