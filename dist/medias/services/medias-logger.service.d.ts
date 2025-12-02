import { MediasModuleOptions } from '../interfaces/medias-module-options.interface';
export declare class MediasLoggerService {
    private readonly logger;
    private readonly logLevel;
    constructor(options: MediasModuleOptions);
    private shouldLog;
    error(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    debug(message: string, context?: Record<string, unknown>): void;
    verbose(message: string, context?: Record<string, unknown>): void;
}
//# sourceMappingURL=medias-logger.service.d.ts.map