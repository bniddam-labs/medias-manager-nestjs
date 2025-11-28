import { DynamicModule, Module, Provider } from '@nestjs/common';
import { MinioModule } from 'nestjs-minio-client';
import { IMAGES_MODULE_OPTIONS } from './images.constants';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import {
  ImagesModuleAsyncOptions,
  ImagesModuleOptions,
  ImagesModuleOptionsFactory,
} from './interfaces/images-module-options.interface';

@Module({})
export class ImagesModule {
  /**
   * Register the images module synchronously with provided options
   * @param options Configuration options for the images module
   */
  static forRoot(options: ImagesModuleOptions): DynamicModule {
    const controllers = options.registerController ? [ImagesController] : [];

    return {
      module: ImagesModule,
      imports: [
        MinioModule.register({
          ...options.s3,
        }),
      ],
      controllers,
      providers: [
        {
          provide: IMAGES_MODULE_OPTIONS,
          useValue: options,
        },
        ImagesService,
      ],
      exports: [ImagesService],
    };
  }

  /**
   * Register the images module asynchronously for dynamic configuration
   * @param options Async configuration options
   */
  static forRootAsync(options: ImagesModuleAsyncOptions): DynamicModule {
    const controllers = options.registerController ? [ImagesController] : [];

    return {
      module: ImagesModule,
      imports: [
        ...(options.imports || []),
        MinioModule.registerAsync({
          useFactory: async (...args: any[]) => {
            const moduleOptions = await this.createModuleOptions(options, ...args);
            return moduleOptions.s3;
          },
          inject: options.inject || [],
        }),
      ],
      controllers,
      providers: [...this.createAsyncProviders(options), ImagesService],
      exports: [ImagesService],
    };
  }

  private static createAsyncProviders(options: ImagesModuleAsyncOptions): Provider[] {
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

  private static createAsyncOptionsProvider(options: ImagesModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: IMAGES_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    if (options.useExisting) {
      return {
        provide: IMAGES_MODULE_OPTIONS,
        useFactory: async (optionsFactory: ImagesModuleOptionsFactory) =>
          await optionsFactory.createImagesModuleOptions(),
        inject: [options.useExisting],
      };
    }

    if (options.useClass) {
      return {
        provide: IMAGES_MODULE_OPTIONS,
        useFactory: async (optionsFactory: ImagesModuleOptionsFactory) =>
          await optionsFactory.createImagesModuleOptions(),
        inject: [options.useClass],
      };
    }

    throw new Error('Invalid ImagesModule configuration');
  }

  private static async createModuleOptions(
    options: ImagesModuleAsyncOptions,
    ...args: any[]
  ): Promise<ImagesModuleOptions> {
    if (options.useFactory) {
      return await options.useFactory(...args);
    }

    if (options.useClass || options.useExisting) {
      const factory = args[0] as ImagesModuleOptionsFactory;
      return await factory.createImagesModuleOptions();
    }

    throw new Error('Invalid ImagesModule configuration');
  }
}
