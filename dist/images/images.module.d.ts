import { DynamicModule } from '@nestjs/common';
import { ImagesModuleAsyncOptions, ImagesModuleOptions } from './interfaces/images-module-options.interface';
export declare class ImagesModule {
    static forRoot(options: ImagesModuleOptions): DynamicModule;
    static forRootAsync(options: ImagesModuleAsyncOptions): DynamicModule;
    private static createAsyncProviders;
    private static createAsyncOptionsProvider;
    private static createModuleOptions;
}
//# sourceMappingURL=images.module.d.ts.map