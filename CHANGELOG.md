# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
