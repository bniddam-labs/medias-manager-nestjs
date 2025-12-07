import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import { DEFAULT_MAX_RESIZE_WIDTH, IMAGE_EXTENSIONS, MIME_TYPES, RESIZABLE_IMAGE_EXTENSIONS, MEDIAS_MODULE_OPTIONS } from '../medias.constants.js';
import { MediasModuleOptions } from '../interfaces/medias-module-options.interface.js';
import { MediasLoggerService } from './medias-logger.service.js';

/**
 * Internal validation service for the medias module
 * Handles file type checking, size validation, and utility functions
 */
@Injectable()
export class MediasValidationService {
  constructor(
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
    private readonly logger: MediasLoggerService,
  ) {}

  // ============================================
  // File Type Checking
  // ============================================

  /**
   * Check if file is an image based on extension
   */
  isImage(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Check if file can be resized (Sharp-compatible image)
   */
  isResizable(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return RESIZABLE_IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(ext: string): string {
    return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
  }

  // ============================================
  // Validation Methods
  // ============================================

  /**
   * Validate that a file can be resized
   * @throws BadRequestException if file is not resizable
   */
  validateResizable(fileName: string): void {
    if (!this.isResizable(fileName)) {
      const ext = path.extname(fileName).toLowerCase();
      if (this.isImage(fileName)) {
        this.logger.warn('Attempted to resize unsupported image format', { fileName, ext });
        throw new BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${RESIZABLE_IMAGE_EXTENSIONS.join(', ')}`);
      }
      this.logger.warn('Attempted to resize non-image file', { fileName });
      throw new BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
    }
  }

  /**
   * Validate that resize size is within allowed limits
   * @throws BadRequestException if size exceeds maxResizeWidth
   */
  validateResizeSize(fileName: string, size: number): void {
    const maxWidth = this.options.maxResizeWidth ?? DEFAULT_MAX_RESIZE_WIDTH;
    if (size > maxWidth) {
      this.logger.warn('Resize size exceeds maximum', { fileName, size, maxWidth });
      throw new BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
    }
  }

  // ============================================
  // ETag Generation
  // ============================================

  /**
   * Generate ETag from file metadata
   */
  generateETag(fileName: string, lastModified: Date, size: number): string {
    const hash = crypto.createHash('md5').update(`${fileName}-${lastModified.getTime()}-${size}`).digest('hex');
    return `"${hash}"`;
  }

  /**
   * Generate ETag from buffer content
   */
  generateETagFromBuffer(buffer: Buffer): string {
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    return `"${hash}"`;
  }

  // ============================================
  // Path Utilities
  // ============================================

  /**
   * Build resized file name from original
   */
  buildResizedFileName(fileName: string, size: number, outputExt: string): string {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const dirName = path.dirname(fileName);
    return dirName === '.' ? `${baseName}-${size}${outputExt}` : `${dirName}/${baseName}-${size}${outputExt}`;
  }

  /**
   * Get file extension
   */
  getExtension(fileName: string): string {
    return path.extname(fileName);
  }

  /**
   * Get max resize width from options
   */
  getMaxResizeWidth(): number {
    return this.options.maxResizeWidth ?? DEFAULT_MAX_RESIZE_WIDTH;
  }

  /**
   * Check if auto prevent upscale is enabled
   */
  isAutoPreventUpscaleEnabled(): boolean {
    return this.options.autoPreventUpscale ?? true;
  }
}
