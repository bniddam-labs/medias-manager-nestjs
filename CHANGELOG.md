# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.5.0] - 2025-12-01

### Changed
- **Major service refactoring** for better maintainability
  - Split `MediasService` (1200+ lines) into specialized internal services:
    - `MediasLoggerService`: Configurable logging
    - `MediasStorageService`: S3/MinIO operations (get, put, delete, stat)
    - `MediasValidationService`: File type checking, size validation, ETag generation
    - `MediasResizeService`: Image resizing (buffer, stream, batch, pre-generation)
  - `MediasService` remains the public facade (unchanged API)
  - Internal services are not exported (implementation detail)
  - Each service now ~200-400 lines (vs 1200+ before)

## [3.4.0] - 2025-12-01

### Added
- **Batch resize** (`batchResize()` method)
  - Resize multiple images with multiple sizes in a single call
  - Returns detailed results for each variant (success/failure with error messages)
  - Use cases: regenerate thumbnails after format changes, pre-warm cache, bulk operations
  - Respects `maxResizeWidth` and `autoPreventUpscale` settings
- Exported `BatchResizeRequestItem` and `BatchResizeResultItem` types

### Changed
- Refactored variant generation into shared `generateVariant()` method
  - Used by both `preGenerateInline()` and `batchResize()`
  - Consistent behavior and error handling

## [3.3.0] - 2025-12-01

### Added
- **Pre-generation at upload** (`preGeneration` option)
  - Automatically generate common image sizes when uploading
  - Configure sizes to pre-generate: `preGeneration: { sizes: [200, 400, 800] }`
  - Optional `dispatchJob` callback for external queue integration (Bull, BullMQ, etc.)
  - Best-effort: errors don't fail uploads
- **Streaming resize** (`getResizedImageStream()` method)
  - Low-memory alternative to `getResizedImage()`
  - Processes images on-the-fly without loading full buffer
  - Does not cache to S3 (suitable for infrequent access)
  - Full ETag support for 304 responses
- **Content negotiation** (`enableContentNegotiation` option)
  - Serve optimal format based on Accept header (AVIF > WebP > JPEG)
  - `preferredFormat` option for default format
  - `allowWebp` and `allowAvif` options
- **Event hooks** for monitoring and analytics
  - `onImageResized`: Fired when an image is resized
  - `onCacheHit`: Fired when a cached resource is served
  - `onUploaded`: Fired when a file is uploaded
- **S3 operation retry logic** with exponential backoff for transient errors
- **Image metadata enrichment** on upload (width, height, MIME type stored in S3 metadata)
- Exported `PreGenerateJob`, `ImageResizedEvent`, `CacheHitEvent`, `FileUploadedEvent` types
- Exported `ImageFormat` type and format constants

### Changed
- `uploadMedia()` now accepts optional `originalName` parameter for metadata
- `getResizedImage()` now accepts optional `format` parameter for explicit format conversion

## [3.2.0] - 2025-12-01

### Added
- **Resource protection options**
  - `maxResizeWidth`: Maximum width for resized images (default: 1200px)
  - `autoPreventUpscale`: Prevent upscaling beyond original dimensions (default: true)
  - `maxOriginalFileSize`: Reject resize for images >15MB (configurable)
- Validation helpers factored out for reuse between buffer and stream methods

## [3.1.2] - 2025-12-01

### Added
- **Configurable logging** with `logLevel` option in module configuration
  - `'none'` (default): No logging
  - `'error'`: Only errors
  - `'warn'`: Errors and warnings
  - `'log'`: General info (file served, uploaded, deleted)
  - `'debug'`: Cache hits/misses, ETags, file stats
  - `'verbose'`: Step-by-step traces of every operation
- Comprehensive logging throughout `MediasService` for debugging
- Exported `MediasLogLevel` type

### Removed
- `routePrefix` option (was not functional due to NestJS static decorators)
  - Use `RouterModule` in your app for custom route prefixes instead

### Fixed
- Module dependency injection when using `registerController: true`

## [3.0.0] - 2025-11-28

### ⚠️ BREAKING CHANGES
- Renamed all exports from `Images*` to `Medias*`:
  - `ImagesModule` → `MediasModule`
  - `ImagesService` → `MediasService`
  - `ImagesController` → `MediasController`
  - `ImagesModuleOptions` → `MediasModuleOptions`
  - `IMAGES_MODULE_OPTIONS` → `MEDIAS_MODULE_OPTIONS`
- Renamed DTOs:
  - `GetImageParamsDto` → `GetMediaParamsDto`
  - `GetImageQueryDto` → `GetMediaQueryDto`
  - `DeleteImageParamsDto` → `DeleteMediaParamsDto`
- Renamed service methods:
  - `getFile()` → `getMedia()`
  - `getFileStream()` → `getMediaFileStream()`
  - `getFileStat()` → `getMediaStat()`
  - `uploadFile()` → `uploadMedia()`
  - `deleteFile()` → `deleteMedia()`
- Response types renamed:
  - `ImageStreamResponse` → `MediaStreamResponse`
  - `ImageBufferResponse` → `MediaBufferResponse`
- Default controller route changed from `/images` to `/medias`

### Added
- **Full media support**: Videos, audio, documents, and archives
  - Video: `.mp4`, `.webm`, `.ogg`, `.mov`, `.avi`, `.mkv`, `.m4v`, `.wmv`, `.flv`
  - Audio: `.mp3`, `.wav`, `.flac`, `.aac`, `.m4a`, `.wma`, `.opus`
  - Documents: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`, `.rtf`, `.csv`
  - Archives: `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.bz2`
  - Additional images: `.svg`, `.ico`, `.bmp`, `.tiff`, `.avif`
- Helper methods in `MediasService`:
  - `isImage(fileName)`: Check if file is an image
  - `isResizable(fileName)`: Check if file can be resized with Sharp
- Protection against resizing non-image files (throws `BadRequestException`)
- Exported constants for extension categories:
  - `IMAGE_EXTENSIONS`, `RESIZABLE_IMAGE_EXTENSIONS`
  - `VIDEO_EXTENSIONS`, `AUDIO_EXTENSIONS`
  - `DOCUMENT_EXTENSIONS`, `ARCHIVE_EXTENSIONS`
  - `ALL_MEDIA_EXTENSIONS`, `MIME_TYPES`
- New config options:
  - `allowedExtensions`: Custom whitelist of allowed extensions
  - `maxResizeWidth`: Maximum width for image resizing (default: 5000)

### Changed
- Resize operations now explicitly validate that the file is a resizable image format
- Improved error messages for resize attempts on non-image files

## [2.1.0] - 2025-11-28

### Fixed
- Fixed `path-to-regexp` v8 compatibility for NestJS 11
- Changed route syntax from `:fileName(*)` to `*fileName`
- Handle array params from wildcard routes

### Added
- GitHub Actions CI workflow (lint, test, build on Node 20/22/24)
- Dependabot configuration for automated dependency updates
- Auto-commit of dist/ build on push to main
- CodeQL security analysis workflow
- New scripts: `format:check`, `lint:check`, `typecheck`
- CI badge in README
- `.nvmrc` file for Node version management
- `engines` field in package.json

### Changed
- dist/ folder now gitignored, built only by CI

## [2.0.3] - 2025-11-27

### Added
- Initial public release
- S3/MinIO integration with nestjs-minio-client
- On-demand image resizing with Sharp
- HTTP caching with ETag support
- Streaming support for large files
- Zod-based input validation
- Dynamic module pattern (forRoot/forRootAsync)
- Optional built-in controller
