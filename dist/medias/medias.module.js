"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MediasControllerModule_1, MediasModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const nestjs_minio_client_1 = require("nestjs-minio-client");
const medias_constants_1 = require("./medias.constants");
const medias_controller_1 = require("./medias.controller");
const medias_service_1 = require("./medias.service");
let MediasControllerModule = MediasControllerModule_1 = class MediasControllerModule {
    static forRoot() {
        return {
            module: MediasControllerModule_1,
            controllers: [medias_controller_1.MediasController],
        };
    }
};
MediasControllerModule = MediasControllerModule_1 = __decorate([
    (0, common_1.Module)({
        controllers: [medias_controller_1.MediasController],
    })
], MediasControllerModule);
let MediasModule = MediasModule_1 = class MediasModule {
    static forRoot(options) {
        const routePrefix = options.routePrefix ?? 'medias';
        const imports = [
            nestjs_minio_client_1.MinioModule.register({
                ...options.s3,
            }),
        ];
        if (options.registerController) {
            imports.push(MediasControllerModule.forRoot(), core_1.RouterModule.register([
                {
                    path: routePrefix,
                    module: MediasControllerModule,
                },
            ]));
        }
        return {
            module: MediasModule_1,
            imports,
            providers: [
                {
                    provide: medias_constants_1.MEDIAS_MODULE_OPTIONS,
                    useValue: options,
                },
                medias_service_1.MediasService,
            ],
            exports: [medias_service_1.MediasService],
        };
    }
    static forRootAsync(options) {
        const routePrefix = options.routePrefix ?? 'medias';
        const imports = [
            ...(options.imports || []),
            nestjs_minio_client_1.MinioModule.registerAsync({
                useFactory: async (...args) => {
                    const moduleOptions = await this.createModuleOptions(options, ...args);
                    return moduleOptions.s3;
                },
                inject: options.inject || [],
            }),
        ];
        if (options.registerController) {
            imports.push(MediasControllerModule.forRoot(), core_1.RouterModule.register([
                {
                    path: routePrefix,
                    module: MediasControllerModule,
                },
            ]));
        }
        return {
            module: MediasModule_1,
            imports,
            providers: [...this.createAsyncProviders(options), medias_service_1.MediasService],
            exports: [medias_service_1.MediasService],
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
                provide: medias_constants_1.MEDIAS_MODULE_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject || [],
            };
        }
        if (options.useExisting) {
            return {
                provide: medias_constants_1.MEDIAS_MODULE_OPTIONS,
                useFactory: async (optionsFactory) => await optionsFactory.createMediasModuleOptions(),
                inject: [options.useExisting],
            };
        }
        if (options.useClass) {
            return {
                provide: medias_constants_1.MEDIAS_MODULE_OPTIONS,
                useFactory: async (optionsFactory) => await optionsFactory.createMediasModuleOptions(),
                inject: [options.useClass],
            };
        }
        throw new Error('Invalid MediasModule configuration');
    }
    static async createModuleOptions(options, ...args) {
        if (options.useFactory) {
            return await options.useFactory(...args);
        }
        if (options.useClass || options.useExisting) {
            const factory = args[0];
            return await factory.createMediasModuleOptions();
        }
        throw new Error('Invalid MediasModule configuration');
    }
};
exports.MediasModule = MediasModule;
exports.MediasModule = MediasModule = MediasModule_1 = __decorate([
    (0, common_1.Module)({})
], MediasModule);
//# sourceMappingURL=medias.module.js.map