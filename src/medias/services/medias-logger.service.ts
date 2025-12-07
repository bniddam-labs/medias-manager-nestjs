import { Inject, Injectable, Logger } from '@nestjs/common';
import { MEDIAS_MODULE_OPTIONS } from '../medias.constants';
import { MediasLogLevel, MediasModuleOptions } from '../interfaces/medias-module-options.interface';

// Log level priority for comparison
const LOG_LEVEL_PRIORITY: Record<MediasLogLevel, number> = {
  none: -1,
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

/**
 * Internal logging service for the medias module
 * Provides configurable logging based on module options
 */
@Injectable()
export class MediasLoggerService {
  private readonly logger = new Logger('MediasModule');
  private readonly logLevel: MediasLogLevel;

  constructor(
    @Inject(MEDIAS_MODULE_OPTIONS)
    options: MediasModuleOptions,
  ) {
    this.logLevel = options.logLevel ?? 'none';
  }

  private shouldLog(level: MediasLogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.logLevel];
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.logger.error(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.logger.warn(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('log')) {
      this.logger.log(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.logger.debug(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }

  verbose(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('verbose')) {
      this.logger.verbose(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }
}
