import { DynamicModule } from '@nestjs/common';
import { MediasModuleAsyncOptions, MediasModuleOptions } from './interfaces/medias-module-options.interface';
export declare class MediasModule {
    static forRoot(options: MediasModuleOptions): DynamicModule;
    static forRootAsync(options: MediasModuleAsyncOptions): DynamicModule;
    private static createAsyncProviders;
    private static createAsyncOptionsProvider;
    private static createModuleOptions;
}
//# sourceMappingURL=medias.module.d.ts.map