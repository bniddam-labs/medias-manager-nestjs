import { DynamicModule, Module, Provider } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MinioModule } from 'nestjs-minio-client';
import { MEDIAS_MODULE_OPTIONS } from './medias.constants';
import { MediasController } from './medias.controller';
import { MediasService } from './medias.service';
import { MediasModuleAsyncOptions, MediasModuleOptions, MediasModuleOptionsFactory } from './interfaces/medias-module-options.interface';

/**
 * Internal module that holds the controller.
 * This allows RouterModule to apply the route prefix.
 */
@Module({
  controllers: [MediasController],
})
class MediasControllerModule {
  static forRoot(): DynamicModule {
    return {
      module: MediasControllerModule,
      controllers: [MediasController],
    };
  }
}

@Module({})
export class MediasModule {
  /**
   * Register the medias module synchronously with provided options
   * @param options Configuration options for the medias module
   */
  static forRoot(options: MediasModuleOptions): DynamicModule {
    const routePrefix = options.routePrefix ?? 'medias';
    const imports: DynamicModule['imports'] = [
      MinioModule.register({
        ...options.s3,
      }),
    ];

    // If controller is requested, set up the controller module with route prefix
    if (options.registerController) {
      imports.push(
        MediasControllerModule.forRoot(),
        RouterModule.register([
          {
            path: routePrefix,
            module: MediasControllerModule,
          },
        ]),
      );
    }

    return {
      module: MediasModule,
      imports,
      providers: [
        {
          provide: MEDIAS_MODULE_OPTIONS,
          useValue: options,
        },
        MediasService,
      ],
      exports: [MediasService],
    };
  }

  /**
   * Register the medias module asynchronously for dynamic configuration
   * @param options Async configuration options
   */
  static forRootAsync(options: MediasModuleAsyncOptions): DynamicModule {
    const routePrefix = options.routePrefix ?? 'medias';
    const imports: DynamicModule['imports'] = [
      ...(options.imports || []),
      MinioModule.registerAsync({
        useFactory: async (...args: unknown[]) => {
          const moduleOptions = await this.createModuleOptions(options, ...args);
          return moduleOptions.s3;
        },
        inject: options.inject || [],
      }),
    ];

    // If controller is requested, set up the controller module with route prefix
    if (options.registerController) {
      imports.push(
        MediasControllerModule.forRoot(),
        RouterModule.register([
          {
            path: routePrefix,
            module: MediasControllerModule,
          },
        ]),
      );
    }

    return {
      module: MediasModule,
      imports,
      providers: [...this.createAsyncProviders(options), MediasService],
      exports: [MediasService],
    };
  }

  private static createAsyncProviders(options: MediasModuleAsyncOptions): Provider[] {
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

  private static createAsyncOptionsProvider(options: MediasModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: MEDIAS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    if (options.useExisting) {
      return {
        provide: MEDIAS_MODULE_OPTIONS,
        useFactory: async (optionsFactory: MediasModuleOptionsFactory) => await optionsFactory.createMediasModuleOptions(),
        inject: [options.useExisting],
      };
    }

    if (options.useClass) {
      return {
        provide: MEDIAS_MODULE_OPTIONS,
        useFactory: async (optionsFactory: MediasModuleOptionsFactory) => await optionsFactory.createMediasModuleOptions(),
        inject: [options.useClass],
      };
    }

    throw new Error('Invalid MediasModule configuration');
  }

  private static async createModuleOptions(options: MediasModuleAsyncOptions, ...args: unknown[]): Promise<MediasModuleOptions> {
    if (options.useFactory) {
      return await options.useFactory(...args);
    }

    if (options.useClass || options.useExisting) {
      const factory = args[0] as MediasModuleOptionsFactory;
      return await factory.createMediasModuleOptions();
    }

    throw new Error('Invalid MediasModule configuration');
  }
}
