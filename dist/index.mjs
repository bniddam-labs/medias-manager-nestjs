import { Get, Param, Query, Req, Res, Delete, Controller, Injectable, Inject, Module, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { MinioModule } from 'nestjs-minio-client';
import sharp from 'sharp';
import * as crypto from 'crypto';
import * as path from 'path';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/medias/medias.constants.ts
var MEDIAS_MODULE_OPTIONS = "MEDIAS_MODULE_OPTIONS";
var RESIZABLE_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".tiff"];
var IMAGE_EXTENSIONS = [...RESIZABLE_IMAGE_EXTENSIONS, ".svg", ".ico", ".bmp"];
var VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v", ".wmv", ".flv"];
var AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg", ".wma", ".opus"];
var DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".csv"];
var ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"];
var ALL_MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...DOCUMENT_EXTENSIONS, ...ARCHIVE_EXTENSIONS];
var MIME_TYPES = {
  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".avif": "image/avif",
  // Videos
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".wma": "audio/x-ms-wma",
  ".opus": "audio/opus",
  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".csv": "text/csv",
  // Archives
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".bz2": "application/x-bzip2"
};
var DEFAULT_MAX_RESIZE_WIDTH = 1200;
var BYTES_PER_KILOBYTE = 1024;
var KILOBYTES_PER_MEGABYTE = 1024;
var BYTES_PER_MEGABYTE = KILOBYTES_PER_MEGABYTE * BYTES_PER_KILOBYTE;
var DEFAULT_MAX_FILE_SIZE_MB = 15;
var DEFAULT_MAX_ORIGINAL_FILE_SIZE = DEFAULT_MAX_FILE_SIZE_MB * BYTES_PER_MEGABYTE;
var SIZE_UNITS = {
  KILOBYTE: BYTES_PER_KILOBYTE,
  MEGABYTE: BYTES_PER_MEGABYTE
};
var MAX_FILENAME_LENGTH = 255;
var MAX_RESIZE_WIDTH_LIMIT = 5e3;
var HTTP_STATUS = {
  NOT_MODIFIED: 304,
  INTERNAL_SERVER_ERROR: 500
};
var IMAGE_QUALITY = {
  JPEG: 85,
  WEBP: 80,
  AVIF: 75
};
var FORMAT_PRIORITY = {
  avif: 3,
  webp: 2,
  jpeg: 1,
  original: 0
};
var RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  MAX_ATTEMPTS: 3,
  /** Initial backoff delay in milliseconds */
  INITIAL_BACKOFF_MS: 50,
  /** Backoff multiplier for each retry attempt */
  BACKOFF_MULTIPLIER: 2
};
var TRANSIENT_S3_ERROR_CODES = [
  "RequestTimeout",
  "RequestTimeoutException",
  "PriorRequestNotComplete",
  "ConnectionError",
  "NetworkingError",
  "SlowDown",
  "ServiceUnavailable",
  "InternalError"
];
var S3_METADATA_KEYS = {
  WIDTH: "x-amz-meta-width",
  HEIGHT: "x-amz-meta-height",
  MIME_TYPE: "x-amz-meta-mime",
  ORIGINAL_NAME: "x-amz-meta-original-name",
  UPLOADED_AT: "x-amz-meta-uploaded-at"
};
var MediasController = class {
  constructor(mediasService) {
    this.mediasService = mediasService;
    this.logger = new Logger(MediasController.name);
  }
  async getMedia(params, query, req, res) {
    const startTime = Date.now();
    const fileName = Array.isArray(params.fileName) ? params.fileName.join("/") : params.fileName;
    const { size } = query;
    const ifNoneMatch = req.headers["if-none-match"];
    const acceptHeader = req.headers["accept"];
    try {
      if (size && parseInt(size, 10) > 0) {
        const requestedSize = parseInt(size, 10);
        if (!this.mediasService.isResizable(fileName)) {
          if (this.mediasService.isImage(fileName)) {
            throw new BadRequestException(`This image format does not support resizing. Serve without size parameter.`);
          }
          throw new BadRequestException(`Cannot resize non-image files. Remove the size parameter to serve the file.`);
        }
        const format = this.mediasService.negotiateFormat(acceptHeader);
        const result = await this.mediasService.getResizedImage(fileName, requestedSize, ifNoneMatch, format);
        const duration = Date.now() - startTime;
        if (result.notModified) {
          res.setHeader("X-Processing-Time", `${duration}ms`);
          res.setHeader("X-Cache", "HIT");
          res.setHeader("X-Resize", "yes");
          res.status(HTTP_STATUS.NOT_MODIFIED).end();
          return;
        }
        res.setHeader("Vary", "Accept");
        res.setHeader("X-Processing-Time", `${duration}ms`);
        res.setHeader("X-Cache", "MISS");
        res.setHeader("X-Resize", "yes");
        res.setHeader("Content-Type", result.mimeType);
        res.setHeader("Content-Length", result.buffer.length);
        res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
        res.setHeader("ETag", result.etag);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.send(result.buffer);
      } else {
        const result = await this.mediasService.getMediaStream(fileName, ifNoneMatch);
        const duration = Date.now() - startTime;
        if (result.notModified) {
          res.setHeader("X-Processing-Time", `${duration}ms`);
          res.setHeader("X-Cache", "HIT");
          res.setHeader("X-Resize", "no");
          res.status(HTTP_STATUS.NOT_MODIFIED).end();
          return;
        }
        res.setHeader("X-Processing-Time", `${duration}ms`);
        res.setHeader("X-Cache", "MISS");
        res.setHeader("X-Resize", "no");
        res.setHeader("Content-Type", result.mimeType);
        res.setHeader("Content-Length", result.size);
        res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
        res.setHeader("ETag", result.etag);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Last-Modified", result.lastModified.toUTCString());
        result.stream.pipe(res);
        result.stream.on("error", (error) => {
          this.logger.error(`Stream error: ${error.message}`);
          if (!res.headersSent) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).end();
          }
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error serving media: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new InternalServerErrorException("Error serving media");
    }
  }
  async deleteMedia(params) {
    const fileName = Array.isArray(params.fileName) ? params.fileName.join("/") : params.fileName;
    return this.mediasService.deleteMedia(fileName);
  }
};
__decorateClass([
  Get("*fileName"),
  __decorateParam(0, Param()),
  __decorateParam(1, Query()),
  __decorateParam(2, Req()),
  __decorateParam(3, Res())
], MediasController.prototype, "getMedia", 1);
__decorateClass([
  Delete("*fileName"),
  __decorateParam(0, Param())
], MediasController.prototype, "deleteMedia", 1);
MediasController = __decorateClass([
  Controller("medias")
], MediasController);
var LOG_LEVEL_PRIORITY = {
  none: -1,
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5
};
var MediasLoggerService = class {
  constructor(options) {
    this.logger = new Logger("MediasModule");
    this.logLevel = options.logLevel ?? "none";
  }
  shouldLog(level) {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.logLevel];
  }
  error(message, context) {
    if (this.shouldLog("error")) {
      this.logger.error(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }
  warn(message, context) {
    if (this.shouldLog("warn")) {
      this.logger.warn(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }
  info(message, context) {
    if (this.shouldLog("log")) {
      this.logger.log(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }
  debug(message, context) {
    if (this.shouldLog("debug")) {
      this.logger.debug(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }
  verbose(message, context) {
    if (this.shouldLog("verbose")) {
      this.logger.verbose(context ? `${message} ${JSON.stringify(context)}` : message);
    }
  }
};
MediasLoggerService = __decorateClass([
  Injectable(),
  __decorateParam(0, Inject(MEDIAS_MODULE_OPTIONS))
], MediasLoggerService);
var MediasStorageService = class {
  constructor(minioService, options, logger) {
    this.minioService = minioService;
    this.options = options;
    this.logger = logger;
    this.logger.verbose("MediasStorageService initialized", { bucket: options.s3.bucketName });
  }
  getBucketName() {
    const bucketName = this.options.s3.bucketName;
    if (!bucketName) {
      this.logger.error("S3 bucket name not configured");
      throw new InternalServerErrorException("S3 bucket name not configured");
    }
    return bucketName;
  }
  // ============================================
  // Retry Logic
  // ============================================
  isTransientError(error) {
    if (!error || typeof error !== "object") {
      return false;
    }
    const err = error;
    const errorCode = err.code ?? err.name ?? "";
    return TRANSIENT_S3_ERROR_CODES.includes(errorCode);
  }
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async withRetry(operation, context) {
    let attempt = 0;
    while (true) {
      try {
        this.logger.verbose(`Executing S3 operation (attempt ${attempt + 1}/${RETRY_CONFIG.MAX_ATTEMPTS})`, {
          operation: context.operationName,
          fileName: context.fileName
        });
        return await operation();
      } catch (error) {
        attempt++;
        const isTransient = this.isTransientError(error);
        const shouldRetry = isTransient && attempt < RETRY_CONFIG.MAX_ATTEMPTS;
        if (!shouldRetry) {
          this.logger.error("S3 operation failed", {
            operation: context.operationName,
            fileName: context.fileName,
            attempt,
            isTransient,
            error: error instanceof Error ? error.message : "Unknown error"
          });
          throw error;
        }
        const backoffMs = RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
        this.logger.warn("Transient S3 error, retrying", {
          operation: context.operationName,
          fileName: context.fileName,
          attempt,
          retryAfterMs: backoffMs,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        await this.delay(backoffMs);
      }
    }
  }
  // ============================================
  // Storage Operations
  // ============================================
  async getFileStream(fileName) {
    this.logger.verbose("Fetching file stream from S3", { fileName, bucket: this.getBucketName() });
    try {
      const fileStream = await this.withRetry(
        () => this.minioService.client.getObject(this.getBucketName(), fileName),
        { operationName: "getObject", fileName }
      );
      this.logger.verbose("File stream obtained", { fileName });
      return fileStream;
    } catch (error) {
      this.logger.error("File not found in S3", { fileName, error: error instanceof Error ? error.message : "Unknown error" });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }
  async getFile(fileName) {
    this.logger.verbose("Loading file into buffer", { fileName });
    try {
      const fileStream = await this.getFileStream(fileName);
      return new Promise((resolve, reject) => {
        const chunks = [];
        fileStream.on("data", (chunk) => {
          chunks.push(chunk);
        });
        fileStream.on("end", () => {
          const buffer = Buffer.concat(chunks);
          this.logger.debug("File loaded into buffer", { fileName, size: buffer.length });
          resolve(buffer);
        });
        fileStream.on("error", (error) => {
          this.logger.error("Error reading file stream", { fileName, error: error.message });
          reject(error);
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error("Failed to get file", { fileName, error: error instanceof Error ? error.message : "Unknown error" });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }
  async getFileStat(fileName) {
    this.logger.verbose("Fetching file stat from S3", { fileName });
    try {
      const stat = await this.withRetry(() => this.minioService.client.statObject(this.getBucketName(), fileName), { operationName: "statObject", fileName });
      this.logger.verbose("File stat obtained", { fileName, size: stat.size });
      return stat;
    } catch (error) {
      this.logger.error("File stat not found", { fileName, error: error instanceof Error ? error.message : "Unknown error" });
      throw new NotFoundException(`File with name ${fileName} not found`);
    }
  }
  async putFile(fileName, file, metadata) {
    this.logger.verbose("Uploading file to S3", { fileName, size: file.length });
    await this.withRetry(
      () => metadata ? this.minioService.client.putObject(this.getBucketName(), fileName, file, metadata) : this.minioService.client.putObject(this.getBucketName(), fileName, file),
      { operationName: "putObject", fileName }
    );
    this.logger.info("File uploaded to S3", { fileName, size: file.length });
  }
  async deleteFile(fileName) {
    this.logger.verbose("Deleting file from S3", { fileName });
    await this.withRetry(() => this.minioService.client.removeObject(this.getBucketName(), fileName), { operationName: "removeObject", fileName });
    this.logger.info("File deleted from S3", { fileName });
  }
};
MediasStorageService = __decorateClass([
  Injectable(),
  __decorateParam(1, Inject(MEDIAS_MODULE_OPTIONS))
], MediasStorageService);
var MediasValidationService = class {
  constructor(options, logger) {
    this.options = options;
    this.logger = logger;
  }
  // ============================================
  // File Type Checking
  // ============================================
  /**
   * Check if file is an image based on extension
   */
  isImage(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }
  /**
   * Check if file can be resized (Sharp-compatible image)
   */
  isResizable(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return RESIZABLE_IMAGE_EXTENSIONS.includes(ext);
  }
  /**
   * Get MIME type from file extension
   */
  getMimeType(ext) {
    return MIME_TYPES[ext.toLowerCase()] || "application/octet-stream";
  }
  // ============================================
  // Validation Methods
  // ============================================
  /**
   * Validate that a file can be resized
   * @throws BadRequestException if file is not resizable
   */
  validateResizable(fileName) {
    if (!this.isResizable(fileName)) {
      const ext = path.extname(fileName).toLowerCase();
      if (this.isImage(fileName)) {
        this.logger.warn("Attempted to resize unsupported image format", { fileName, ext });
        throw new BadRequestException(`Image format ${ext} does not support resizing. Supported formats: ${RESIZABLE_IMAGE_EXTENSIONS.join(", ")}`);
      }
      this.logger.warn("Attempted to resize non-image file", { fileName });
      throw new BadRequestException(`Cannot resize non-image file ${fileName}. Resize is only supported for images.`);
    }
  }
  /**
   * Validate that resize size is within allowed limits
   * @throws BadRequestException if size exceeds maxResizeWidth
   */
  validateResizeSize(fileName, size) {
    const maxWidth = this.options.maxResizeWidth ?? DEFAULT_MAX_RESIZE_WIDTH;
    if (size > maxWidth) {
      this.logger.warn("Resize size exceeds maximum", { fileName, size, maxWidth });
      throw new BadRequestException(`Size cannot exceed ${maxWidth} pixels`);
    }
  }
  // ============================================
  // ETag Generation
  // ============================================
  /**
   * Generate ETag from file metadata
   */
  generateETag(fileName, lastModified, size) {
    const hash = crypto.createHash("md5").update(`${fileName}-${lastModified.getTime()}-${size}`).digest("hex");
    return `"${hash}"`;
  }
  /**
   * Generate ETag from buffer content
   */
  generateETagFromBuffer(buffer) {
    const hash = crypto.createHash("md5").update(buffer).digest("hex");
    return `"${hash}"`;
  }
  // ============================================
  // Path Utilities
  // ============================================
  /**
   * Build resized file name from original
   */
  buildResizedFileName(fileName, size, outputExt) {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const dirName = path.dirname(fileName);
    return dirName === "." ? `${baseName}-${size}${outputExt}` : `${dirName}/${baseName}-${size}${outputExt}`;
  }
  /**
   * Get file extension
   */
  getExtension(fileName) {
    return path.extname(fileName);
  }
  /**
   * Get max resize width from options
   */
  getMaxResizeWidth() {
    return this.options.maxResizeWidth ?? DEFAULT_MAX_RESIZE_WIDTH;
  }
  /**
   * Check if auto prevent upscale is enabled
   */
  isAutoPreventUpscaleEnabled() {
    return this.options.autoPreventUpscale ?? true;
  }
};
MediasValidationService = __decorateClass([
  Injectable(),
  __decorateParam(0, Inject(MEDIAS_MODULE_OPTIONS))
], MediasValidationService);
var MediasResizeService = class {
  constructor(options, logger, storage, validation) {
    this.options = options;
    this.logger = logger;
    this.storage = storage;
    this.validation = validation;
  }
  // ============================================
  // Format Helpers
  // ============================================
  applyFormat(pipeline, format) {
    switch (format) {
      case "webp":
        return pipeline.webp({ quality: IMAGE_QUALITY.WEBP });
      case "jpeg":
        return pipeline.jpeg({ quality: IMAGE_QUALITY.JPEG });
      case "avif":
        return pipeline.avif({ quality: IMAGE_QUALITY.AVIF });
      case "original":
      default:
        return pipeline;
    }
  }
  getMimeTypeForFormat(format, originalExt) {
    switch (format) {
      case "webp":
        return "image/webp";
      case "jpeg":
        return "image/jpeg";
      case "avif":
        return "image/avif";
      case "original":
      default:
        return this.validation.getMimeType(originalExt);
    }
  }
  getExtensionForFormat(format, originalExt) {
    switch (format) {
      case "webp":
        return ".webp";
      case "jpeg":
        return ".jpg";
      case "avif":
        return ".avif";
      case "original":
      default:
        return originalExt;
    }
  }
  /**
   * Negotiate the best image format based on Accept header
   */
  negotiateFormat(acceptHeader) {
    if (!this.options.enableContentNegotiation) {
      return this.options.preferredFormat ?? "original";
    }
    if (!acceptHeader) {
      return this.options.preferredFormat ?? "original";
    }
    const accept = acceptHeader.toLowerCase();
    const allowAvif = this.options.allowAvif ?? true;
    const allowWebp = this.options.allowWebp ?? true;
    if (allowAvif && accept.includes("image/avif")) {
      this.logger.debug("Content negotiation: AVIF selected", { acceptHeader });
      return "avif";
    }
    if (allowWebp && accept.includes("image/webp")) {
      this.logger.debug("Content negotiation: WebP selected", { acceptHeader });
      return "webp";
    }
    if (accept.includes("image/jpeg") || accept.includes("image/*") || accept.includes("*/*")) {
      this.logger.debug("Content negotiation: JPEG selected as fallback", { acceptHeader });
      return "jpeg";
    }
    this.logger.debug("Content negotiation: original format selected", { acceptHeader });
    return "original";
  }
  // ============================================
  // Single Variant Generation
  // ============================================
  /**
   * Generate a single image variant
   * Shared logic used by preGenerate and batchResize
   */
  async generateVariant(fileName, buffer, size, originalWidth, skipUpload = false) {
    const maxWidth = this.validation.getMaxResizeWidth();
    const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();
    const ext = this.validation.getExtension(fileName);
    const outputFormat = this.options.preferredFormat ?? "original";
    const outputExt = this.getExtensionForFormat(outputFormat, ext);
    const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
    if (size > maxWidth) {
      const error = `Size ${size} exceeds maxResizeWidth (${maxWidth})`;
      this.logger.warn("Variant generation skipped: size exceeds maxResizeWidth", {
        fileName,
        size,
        maxWidth
      });
      return { resizedFileName, success: false, error };
    }
    let finalSize = size;
    if (autoPreventUpscale && originalWidth && size > originalWidth) {
      this.logger.debug("Variant size exceeds original width, clamping", {
        fileName,
        requestedSize: size,
        originalWidth
      });
      finalSize = originalWidth;
    }
    try {
      this.logger.verbose("Generating variant", {
        fileName,
        size,
        finalSize,
        resizedFileName
      });
      let pipeline = sharp(buffer).resize(finalSize);
      pipeline = this.applyFormat(pipeline, outputFormat);
      const resizedBuffer = await pipeline.toBuffer();
      if (!skipUpload) {
        await this.storage.putFile(resizedFileName, resizedBuffer);
      }
      this.logger.info("Variant created", {
        fileName,
        size,
        resizedFileName,
        resizedSize: resizedBuffer.length
      });
      return { resizedFileName, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn("Failed to generate variant", {
        fileName,
        size,
        error: errorMessage
      });
      return { resizedFileName, success: false, error: errorMessage };
    }
  }
  // ============================================
  // Resize Methods
  // ============================================
  /**
   * Get resized image with automatic caching
   */
  async getResizedImage(fileName, size, ifNoneMatch, format) {
    const startTime = Date.now();
    const outputFormat = format ?? this.options.preferredFormat ?? "original";
    this.logger.verbose("getResizedImage called", { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });
    this.validation.validateResizable(fileName);
    this.validation.validateResizeSize(fileName, size);
    const stat = await this.storage.getFileStat(fileName);
    const maxOriginalSize = this.options.maxOriginalFileSize ?? DEFAULT_MAX_ORIGINAL_FILE_SIZE;
    if (maxOriginalSize > 0 && stat.size > maxOriginalSize) {
      this.logger.warn("Original image too large for on-the-fly resize", {
        fileName,
        size: stat.size,
        maxOriginalSize
      });
      throw new BadRequestException(
        `Image too large to resize on-the-fly (${Math.round(stat.size / SIZE_UNITS.MEGABYTE)}MB). Maximum allowed: ${Math.round(maxOriginalSize / SIZE_UNITS.MEGABYTE)}MB.`
      );
    }
    const ext = this.validation.getExtension(fileName);
    const outputExt = this.getExtensionForFormat(outputFormat, ext);
    const mimeType = this.getMimeTypeForFormat(outputFormat, ext);
    const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
    this.logger.verbose("Computed resized file name", { originalFileName: fileName, resizedFileName, size, outputFormat });
    this.logger.verbose("Checking for cached resized image", { resizedFileName });
    try {
      const cachedStat = await this.storage.getFileStat(resizedFileName);
      const etag2 = this.validation.generateETag(resizedFileName, cachedStat.lastModified, cachedStat.size);
      this.logger.debug("Cached resized image found", { resizedFileName, size: cachedStat.size, etag: etag2 });
      if (ifNoneMatch === etag2) {
        this.logger.debug("Cache hit on resized image - returning 304 Not Modified", { resizedFileName, etag: etag2 });
        this.options.onCacheHit?.({ fileName: resizedFileName, size, notModified: true });
        return { buffer: null, mimeType, etag: etag2, notModified: true };
      }
      this.logger.info("Serving cached resized image", { resizedFileName, size: cachedStat.size });
      const buffer = await this.storage.getFile(resizedFileName);
      const durationMs2 = Date.now() - startTime;
      this.options.onCacheHit?.({ fileName: resizedFileName, size, notModified: false });
      this.options.onImageResized?.({
        originalFileName: fileName,
        resizedFileName,
        requestedSize: size,
        finalSize: buffer.length,
        fromCache: true,
        durationMs: durationMs2,
        format: outputFormat
      });
      return { buffer, mimeType, etag: etag2, notModified: false };
    } catch {
      this.logger.debug("No cached resized image found, will generate", { resizedFileName });
    }
    this.logger.verbose("Fetching original image for resize", { fileName });
    const originalFile = await this.storage.getFile(fileName);
    this.logger.debug("Original image loaded", { fileName, originalSize: originalFile.length });
    const autoPreventUpscale = this.validation.isAutoPreventUpscaleEnabled();
    let finalSize = size;
    if (autoPreventUpscale) {
      const metadata = await sharp(originalFile).metadata();
      if (metadata.width && size > metadata.width) {
        this.logger.debug("Requested size exceeds original width, preventing upscale", {
          fileName,
          requestedSize: size,
          originalWidth: metadata.width
        });
        finalSize = metadata.width;
      }
    }
    this.logger.verbose("Resizing image with Sharp", { fileName, targetWidth: finalSize, outputFormat });
    let pipeline = sharp(originalFile).resize(finalSize);
    pipeline = this.applyFormat(pipeline, outputFormat);
    const resizedBuffer = await pipeline.toBuffer();
    const etag = this.validation.generateETagFromBuffer(resizedBuffer);
    this.logger.debug("Image resized", { fileName, originalSize: originalFile.length, resizedSize: resizedBuffer.length, outputFormat, etag });
    if (ifNoneMatch === etag) {
      this.logger.debug("Generated image matches ETag - returning 304 Not Modified", { fileName, etag });
      return { buffer: null, mimeType, etag, notModified: true };
    }
    this.logger.verbose("Caching resized image to S3 (async)", { resizedFileName });
    this.storage.putFile(resizedFileName, resizedBuffer).catch((error) => {
      this.logger.warn("Failed to cache resized image", { resizedFileName, error: error instanceof Error ? error.message : "Unknown error" });
    });
    const durationMs = Date.now() - startTime;
    this.options.onImageResized?.({
      originalFileName: fileName,
      resizedFileName,
      requestedSize: size,
      finalSize: resizedBuffer.length,
      fromCache: false,
      durationMs,
      format: outputFormat
    });
    this.logger.info("Serving freshly resized image", { fileName, size, resizedSize: resizedBuffer.length });
    return { buffer: resizedBuffer, mimeType, etag, notModified: false };
  }
  /**
   * Get resized image as a stream (low-memory mode)
   */
  async getResizedImageStream(fileName, size, ifNoneMatch, format) {
    const outputFormat = format ?? this.options.preferredFormat ?? "original";
    this.logger.verbose("getResizedImageStream called", { fileName, size, outputFormat, hasIfNoneMatch: !!ifNoneMatch });
    this.validation.validateResizable(fileName);
    this.validation.validateResizeSize(fileName, size);
    const stat = await this.storage.getFileStat(fileName);
    const etag = this.validation.generateETag(`${fileName}-${size}-${outputFormat}`, stat.lastModified, stat.size);
    this.logger.debug("Generated ETag for streaming resize", { fileName, size, etag });
    if (ifNoneMatch === etag) {
      this.logger.debug("Cache hit - returning 304 Not Modified", { fileName, size, etag });
      this.options.onCacheHit?.({ fileName, size, notModified: true });
      return {
        stream: null,
        mimeType: this.getMimeTypeForFormat(outputFormat, this.validation.getExtension(fileName)),
        size: 0,
        etag,
        lastModified: stat.lastModified,
        notModified: true
      };
    }
    this.logger.verbose("Fetching original image stream for resize", { fileName });
    const originalStream = await this.storage.getFileStream(fileName);
    this.logger.verbose("Creating streaming resize pipeline", { fileName, size, outputFormat });
    let resizePipeline = sharp().resize(size);
    resizePipeline = this.applyFormat(resizePipeline, outputFormat);
    const resizedStream = originalStream.pipe(resizePipeline);
    const mimeType = this.getMimeTypeForFormat(outputFormat, this.validation.getExtension(fileName));
    this.logger.info("Serving streaming resized image", { fileName, size, outputFormat });
    return {
      stream: resizedStream,
      mimeType,
      size: 0,
      etag,
      lastModified: stat.lastModified,
      notModified: false
    };
  }
  // ============================================
  // Batch Operations
  // ============================================
  /**
   * Pre-generate image variants inline
   */
  async preGenerateInline(fileName, buffer, sizes) {
    if (!this.validation.isResizable(fileName)) {
      this.logger.debug("File is not resizable, skipping pre-generation", { fileName });
      return;
    }
    let originalWidth;
    try {
      const metadata = await sharp(buffer).metadata();
      originalWidth = metadata.width;
      this.logger.debug("Original image metadata for pre-generation", {
        fileName,
        width: originalWidth,
        height: metadata.height
      });
    } catch (error) {
      this.logger.warn("Failed to get original image metadata for pre-generation", {
        fileName,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return;
    }
    const outputFormat = this.options.preferredFormat ?? "original";
    this.logger.info("Starting pre-generation of image variants", {
      fileName,
      sizes,
      outputFormat,
      originalWidth
    });
    for (const size of sizes) {
      await this.generateVariant(fileName, buffer, size, originalWidth);
    }
    this.logger.info("Pre-generation completed", { fileName, totalSizes: sizes.length });
  }
  /**
   * Batch resize multiple images with multiple sizes
   */
  async batchResize(items) {
    this.logger.info("Starting batch resize operation", {
      totalItems: items.length,
      totalVariants: items.reduce((sum, item) => sum + item.sizes.length, 0)
    });
    const results = [];
    for (const item of items) {
      const { fileName, sizes } = item;
      this.logger.verbose("Processing batch item", { fileName, sizes });
      if (!this.validation.isResizable(fileName)) {
        const error = this.validation.isImage(fileName) ? `Image format not supported for resizing` : `File is not an image`;
        this.logger.warn("Batch item skipped: not resizable", { fileName, error });
        for (const size of sizes) {
          const ext = this.validation.getExtension(fileName);
          const outputExt = this.getExtensionForFormat(this.options.preferredFormat ?? "original", ext);
          const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
          results.push({ fileName, size, resizedFileName, success: false, error });
        }
        continue;
      }
      let buffer;
      try {
        buffer = await this.storage.getFile(fileName);
        this.logger.debug("Original image loaded for batch resize", { fileName, size: buffer.length });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "File not found";
        this.logger.error("Failed to load original for batch resize", { fileName, error: errorMessage });
        for (const size of sizes) {
          const ext = this.validation.getExtension(fileName);
          const outputExt = this.getExtensionForFormat(this.options.preferredFormat ?? "original", ext);
          const resizedFileName = this.validation.buildResizedFileName(fileName, size, outputExt);
          results.push({ fileName, size, resizedFileName, success: false, error: errorMessage });
        }
        continue;
      }
      let originalWidth;
      try {
        const metadata = await sharp(buffer).metadata();
        originalWidth = metadata.width;
        this.logger.debug("Original image metadata for batch resize", {
          fileName,
          width: originalWidth,
          height: metadata.height
        });
      } catch (error) {
        this.logger.warn("Failed to get metadata for batch resize, proceeding without upscale prevention", {
          fileName,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
      for (const size of sizes) {
        const variantResult = await this.generateVariant(fileName, buffer, size, originalWidth);
        results.push({
          fileName,
          size,
          resizedFileName: variantResult.resizedFileName,
          success: variantResult.success,
          error: variantResult.error
        });
      }
    }
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    this.logger.info("Batch resize operation completed", {
      totalItems: items.length,
      totalVariants: results.length,
      successCount,
      failureCount
    });
    return results;
  }
};
MediasResizeService = __decorateClass([
  Injectable(),
  __decorateParam(0, Inject(MEDIAS_MODULE_OPTIONS))
], MediasResizeService);

// src/medias/medias.service.ts
var MediasService = class {
  constructor(options, logger, storage, validation, resize) {
    this.options = options;
    this.logger = logger;
    this.storage = storage;
    this.validation = validation;
    this.resize = resize;
    this.logger.verbose("MediasService initialized", { bucket: options.s3.bucketName });
  }
  // ============================================
  // Validation & Utilities (delegated)
  // ============================================
  /**
   * Check if file is an image based on extension
   */
  isImage(fileName) {
    return this.validation.isImage(fileName);
  }
  /**
   * Check if file can be resized (Sharp-compatible image)
   */
  isResizable(fileName) {
    return this.validation.isResizable(fileName);
  }
  /**
   * Get MIME type from file extension
   */
  getMimeType(ext) {
    return this.validation.getMimeType(ext);
  }
  /**
   * Generate ETag from file metadata
   */
  generateETag(fileName, lastModified, size) {
    return this.validation.generateETag(fileName, lastModified, size);
  }
  /**
   * Generate ETag from buffer content
   */
  generateETagFromBuffer(buffer) {
    return this.validation.generateETagFromBuffer(buffer);
  }
  /**
   * Negotiate the best image format based on Accept header
   */
  negotiateFormat(acceptHeader) {
    return this.resize.negotiateFormat(acceptHeader);
  }
  // ============================================
  // Storage Operations (delegated)
  // ============================================
  /**
   * Get any media file as a stream with metadata (memory-efficient)
   */
  async getMediaStream(fileName, ifNoneMatch) {
    this.logger.verbose("getMediaStream called", { fileName, hasIfNoneMatch: !!ifNoneMatch });
    const ext = this.validation.getExtension(fileName);
    const mimeType = this.validation.getMimeType(ext);
    this.logger.verbose("Determined MIME type", { fileName, ext, mimeType });
    this.logger.verbose("Fetching file stat", { fileName });
    const stat = await this.storage.getFileStat(fileName);
    const etag = this.validation.generateETag(fileName, stat.lastModified, stat.size);
    this.logger.debug("File stat retrieved", { fileName, size: stat.size, etag });
    if (ifNoneMatch === etag) {
      this.logger.debug("Cache hit - returning 304 Not Modified", { fileName, etag });
      this.options.onCacheHit?.({ fileName, size: 0, notModified: true });
      return {
        stream: null,
        mimeType,
        size: stat.size,
        etag,
        lastModified: stat.lastModified,
        notModified: true
      };
    }
    this.logger.verbose("Cache miss - fetching file stream", { fileName });
    const stream = await this.storage.getFileStream(fileName);
    this.logger.info("Serving media stream", { fileName, size: stat.size, mimeType });
    return {
      stream,
      mimeType,
      size: stat.size,
      etag,
      lastModified: stat.lastModified,
      notModified: false
    };
  }
  /**
   * Get any media file as a buffer
   * WARNING: Loads entire file into memory - not suitable for large files
   */
  async getMedia(fileName) {
    this.logger.warn("Loading entire file into memory", { fileName });
    return this.storage.getFile(fileName);
  }
  /**
   * Get raw file stream from S3
   */
  async getMediaFileStream(fileName) {
    return this.storage.getFileStream(fileName);
  }
  /**
   * Get file metadata (size, content-type, etc.)
   */
  async getMediaStat(fileName) {
    return this.storage.getFileStat(fileName);
  }
  /**
   * Upload any media file to S3
   */
  async uploadMedia(fileName, file, originalName, skipPreGeneration = false) {
    this.logger.verbose("Uploading file to S3", { fileName, size: file.length, originalName, skipPreGeneration });
    if (this.validation.isImage(fileName)) {
      try {
        const metadata = await sharp(file).metadata();
        const ext = this.validation.getExtension(fileName);
        const mimeType = this.validation.getMimeType(ext);
        const s3Metadata = {
          [S3_METADATA_KEYS.MIME_TYPE]: mimeType,
          [S3_METADATA_KEYS.UPLOADED_AT]: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (metadata.width) {
          s3Metadata[S3_METADATA_KEYS.WIDTH] = String(metadata.width);
        }
        if (metadata.height) {
          s3Metadata[S3_METADATA_KEYS.HEIGHT] = String(metadata.height);
        }
        if (originalName) {
          s3Metadata[S3_METADATA_KEYS.ORIGINAL_NAME] = originalName;
        }
        this.logger.debug("Uploading image with enriched metadata", {
          fileName,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        });
        await this.storage.putFile(fileName, file, s3Metadata);
        this.logger.info("Image uploaded to S3 with metadata", {
          fileName,
          size: file.length,
          dimensions: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : void 0
        });
        this.options.onUploaded?.({
          fileName,
          size: file.length,
          isImage: true,
          dimensions: metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : void 0
        });
        if (!skipPreGeneration) {
          await this.triggerPreGeneration(fileName, file);
        }
        return;
      } catch (error) {
        this.logger.warn("Failed to extract image metadata, uploading without enrichment", {
          fileName,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    await this.storage.putFile(fileName, file);
    this.options.onUploaded?.({
      fileName,
      size: file.length,
      isImage: false
    });
    if (!skipPreGeneration) {
      await this.triggerPreGeneration(fileName, file);
    }
  }
  /**
   * Trigger pre-generation of image variants
   */
  async triggerPreGeneration(fileName, buffer) {
    const preGen = this.options.preGeneration;
    if (!preGen || !preGen.sizes || preGen.sizes.length === 0) {
      return;
    }
    if (!this.validation.isResizable(fileName)) {
      this.logger.debug("File is not resizable, skipping pre-generation trigger", { fileName });
      return;
    }
    this.logger.debug("Triggering pre-generation", {
      fileName,
      sizes: preGen.sizes,
      hasDispatchJob: !!preGen.dispatchJob
    });
    try {
      if (preGen.dispatchJob) {
        this.logger.info("Dispatching pre-generation job to external queue", {
          fileName,
          sizes: preGen.sizes
        });
        await preGen.dispatchJob({ fileName, sizes: preGen.sizes });
        this.logger.info("Pre-generation job dispatched successfully", { fileName });
      } else {
        this.logger.info("Starting inline pre-generation (fire-and-forget)", {
          fileName,
          sizes: preGen.sizes
        });
        this.resize.preGenerateInline(fileName, buffer, preGen.sizes).catch((error) => {
          this.logger.error("Inline pre-generation failed", {
            fileName,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        });
      }
    } catch (error) {
      this.logger.error("Failed to trigger pre-generation", {
        fileName,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  /**
   * Delete any media file from S3
   */
  async deleteMedia(fileName) {
    return this.storage.deleteFile(fileName);
  }
  // ============================================
  // Image Operations (delegated to resize service)
  // ============================================
  /**
   * Get image as a stream with metadata
   */
  async getImageStream(fileName, ifNoneMatch) {
    this.logger.verbose("getImageStream called", { fileName });
    if (!this.validation.isImage(fileName)) {
      this.logger.warn("Attempted to get non-image file as image", { fileName });
      throw new BadRequestException(`File ${fileName} is not an image. Use getMediaStream() for non-image files.`);
    }
    return this.getMediaStream(fileName, ifNoneMatch);
  }
  /**
   * Get resized image with automatic caching
   */
  async getResizedImage(fileName, size, ifNoneMatch, format) {
    return this.resize.getResizedImage(fileName, size, ifNoneMatch, format);
  }
  /**
   * Get resized image as a stream (low-memory mode)
   */
  async getResizedImageStream(fileName, size, ifNoneMatch, format) {
    return this.resize.getResizedImageStream(fileName, size, ifNoneMatch, format);
  }
  /**
   * Batch resize multiple images with multiple sizes
   */
  async batchResize(items) {
    return this.resize.batchResize(items);
  }
};
MediasService = __decorateClass([
  Injectable(),
  __decorateParam(0, Inject(MEDIAS_MODULE_OPTIONS))
], MediasService);

// src/medias/medias.module.ts
var INTERNAL_SERVICES = [MediasLoggerService, MediasStorageService, MediasValidationService, MediasResizeService];
var MediasModule = class {
  /**
   * Register the medias module synchronously with provided options
   * @param options Configuration options for the medias module
   */
  static forRoot(options) {
    const controllers = options.registerController ? [MediasController] : [];
    return {
      module: MediasModule,
      imports: [
        MinioModule.register({
          ...options.s3
        })
      ],
      controllers,
      providers: [
        {
          provide: MEDIAS_MODULE_OPTIONS,
          useValue: options
        },
        ...INTERNAL_SERVICES,
        MediasService
      ],
      exports: [MediasService]
    };
  }
  /**
   * Register the medias module asynchronously for dynamic configuration
   * @param options Async configuration options
   */
  static forRootAsync(options) {
    const controllers = options.registerController ? [MediasController] : [];
    return {
      module: MediasModule,
      imports: [
        ...options.imports || [],
        MinioModule.registerAsync({
          useFactory: async (...args) => {
            const moduleOptions = await this.createModuleOptions(options, ...args);
            return moduleOptions.s3;
          },
          inject: options.inject || []
        })
      ],
      controllers,
      providers: [...this.createAsyncProviders(options), ...INTERNAL_SERVICES, MediasService],
      exports: [MediasService]
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
          useClass: options.useClass
        }
      ];
    }
    return [];
  }
  static createAsyncOptionsProvider(options) {
    if (options.useFactory) {
      return {
        provide: MEDIAS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || []
      };
    }
    if (options.useExisting) {
      return {
        provide: MEDIAS_MODULE_OPTIONS,
        useFactory: async (optionsFactory) => await optionsFactory.createMediasModuleOptions(),
        inject: [options.useExisting]
      };
    }
    if (options.useClass) {
      return {
        provide: MEDIAS_MODULE_OPTIONS,
        useFactory: async (optionsFactory) => await optionsFactory.createMediasModuleOptions(),
        inject: [options.useClass]
      };
    }
    throw new Error("Invalid MediasModule configuration");
  }
  static async createModuleOptions(options, ...args) {
    if (options.useFactory) {
      return await options.useFactory(...args);
    }
    if (options.useClass || options.useExisting) {
      const factory = args[0];
      return await factory.createMediasModuleOptions();
    }
    throw new Error("Invalid MediasModule configuration");
  }
};
MediasModule = __decorateClass([
  Module({})
], MediasModule);
var commonFileNameRefinements = (schema) => schema.min(1, "File name is required").max(MAX_FILENAME_LENGTH, "File name is too long").refine(
  (val) => {
    const sanitized = val.replace(/\\/g, "/");
    return !sanitized.includes("../") && !sanitized.includes("/..") && !sanitized.startsWith("/");
  },
  {
    message: "Invalid file name - path traversal detected"
  }
).refine(
  (val) => {
    const ext = val.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    return ext ? ALL_MEDIA_EXTENSIONS.includes(ext) : false;
  },
  {
    message: `Invalid file extension - allowed extensions: ${ALL_MEDIA_EXTENSIONS.join(", ")}`
  }
);
var strictFilenameRefinement = (val) => /^[a-zA-Z0-9._/-]+$/.test(val);
var looseFilenameRefinement = (val) => !/[\x00-\x1F]/.test(val);
var createDeleteMediaParamsSchema = (strict = true) => z.object({
  fileName: commonFileNameRefinements(z.string()).refine(strict ? strictFilenameRefinement : looseFilenameRefinement, {
    message: strict ? "File name contains invalid characters - only alphanumeric, dots, hyphens, underscores, and slashes are allowed" : "File name contains invalid control characters"
  })
});
var DeleteMediaParamsSchema = createDeleteMediaParamsSchema(true);
var DeleteMediaParamsLooseSchema = createDeleteMediaParamsSchema(false);
var DeleteMediaParamsDto = class extends createZodDto(DeleteMediaParamsSchema) {
};
var DeleteMediaParamsLooseDto = class extends createZodDto(DeleteMediaParamsLooseSchema) {
};
var commonFileNameRefinements2 = (schema) => schema.min(1, "File name is required").max(MAX_FILENAME_LENGTH, "File name is too long").refine(
  (val) => {
    const sanitized = val.replace(/\\/g, "/");
    return !sanitized.includes("../") && !sanitized.includes("/..") && !sanitized.startsWith("/");
  },
  {
    message: "Invalid file name - path traversal detected"
  }
).refine(
  (val) => {
    const ext = val.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    return ext ? ALL_MEDIA_EXTENSIONS.includes(ext) : false;
  },
  {
    message: `Invalid file extension - allowed extensions: ${ALL_MEDIA_EXTENSIONS.join(", ")}`
  }
);
var strictFilenameRefinement2 = (val) => /^[a-zA-Z0-9._/-]+$/.test(val);
var looseFilenameRefinement2 = (val) => !/[\x00-\x1F]/.test(val);
var createGetMediaParamsSchema = (strict = true) => z.object({
  fileName: commonFileNameRefinements2(z.string()).refine(strict ? strictFilenameRefinement2 : looseFilenameRefinement2, {
    message: strict ? "File name contains invalid characters - only alphanumeric, dots, hyphens, underscores, and slashes are allowed" : "File name contains invalid control characters"
  })
});
var GetMediaParamsSchema = createGetMediaParamsSchema(true);
var GetMediaParamsLooseSchema = createGetMediaParamsSchema(false);
var GetMediaQuerySchema = z.object({
  size: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0 && num <= MAX_RESIZE_WIDTH_LIMIT;
    },
    {
      message: `Size must be a positive integer between 1 and ${MAX_RESIZE_WIDTH_LIMIT}`
    }
  )
});
var GetMediaParamsDto = class extends createZodDto(GetMediaParamsSchema) {
};
var GetMediaParamsLooseDto = class extends createZodDto(GetMediaParamsLooseSchema) {
};
var GetMediaQueryDto = class extends createZodDto(GetMediaQuerySchema) {
};

export { ALL_MEDIA_EXTENSIONS, ARCHIVE_EXTENSIONS, AUDIO_EXTENSIONS, DEFAULT_MAX_ORIGINAL_FILE_SIZE, DEFAULT_MAX_RESIZE_WIDTH, DOCUMENT_EXTENSIONS, DeleteMediaParamsDto, DeleteMediaParamsLooseDto, FORMAT_PRIORITY, GetMediaParamsDto, GetMediaParamsLooseDto, GetMediaQueryDto, HTTP_STATUS, IMAGE_EXTENSIONS, IMAGE_QUALITY, MAX_FILENAME_LENGTH, MAX_RESIZE_WIDTH_LIMIT, MEDIAS_MODULE_OPTIONS, MIME_TYPES, MediasController, MediasModule, MediasService, RESIZABLE_IMAGE_EXTENSIONS, RETRY_CONFIG, S3_METADATA_KEYS, SIZE_UNITS, TRANSIENT_S3_ERROR_CODES, VIDEO_EXTENSIONS, createDeleteMediaParamsSchema, createGetMediaParamsSchema };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map