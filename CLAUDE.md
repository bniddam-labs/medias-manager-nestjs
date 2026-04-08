# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@bniddam-labs/medias-manager-nestjs** is a reusable NestJS library module that provides:
- Media storage and retrieval via S3-compatible object storage (MinIO/AWS S3)
- On-demand image resizing with caching using Sharp
- RESTful API endpoints for media operations (GET with resize, DELETE)
- Built-in security validation with Zod

This is a **library package**, not a standalone application. It's designed to be imported and used in other NestJS projects.

## Development Commands

### Package Manager
This project uses `pnpm`. All commands should use `pnpm` rather than `npm` or `yarn`.

### Common Commands
```bash
# Install dependencies
pnpm install

# Build library for distribution
pnpm run build

# Lint and auto-fix
pnpm run lint

# Format code
pnpm run format

# Run unit tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:cov

# Build before publishing (runs automatically)
pnpm run prepublishOnly
```

## Library Architecture

### Dynamic Module Pattern

**MediasModule** (src/medias/medias.module.ts)
- Implements NestJS dynamic module pattern with `forRoot()` and `forRootAsync()` methods
- Accepts configuration programmatically (not from .env)
- Exports `MediasService` for use in consuming applications
- **Optionally** registers `MediasController` (via `registerController: true`)
  - Default: `false` (consumer creates their own controller - recommended)
  - Controller provides convenience endpoints but lacks auth/rate limiting

**Configuration Injection** (src/medias/interfaces/medias-module-options.interface.ts)
- `MediasModuleOptions`: Main configuration interface
- `S3Options`: S3/MinIO connection and bucket configuration
- `MediasModuleOptionsFactory`: Factory pattern for async configuration
- `MediasModuleAsyncOptions`: Supports useFactory, useClass, useExisting patterns

**Resource Protection Options**:
- `maxResizeWidth` (default: 1200): Maximum width in pixels for resized images and video thumbnails
- `autoPreventUpscale` (default: true): Prevent upscaling images and video thumbnails beyond original width
- `maxOriginalFileSize` (default: 15MB): Maximum size of original images that can be resized on-the-fly

**Modern Image Formats & Content Negotiation** (NEW):
- `preferredFormat` (default: 'original'): Force output format for resized images
  - `'original'`: Keep source format
  - `'jpeg'`: Convert to JPEG (quality: 85, universal compatibility)
  - `'webp'`: Convert to WebP (quality: 80, ~30% smaller than JPEG)
  - `'avif'`: Convert to AVIF (quality: 75, ~50% smaller than JPEG)
- `enableContentNegotiation` (default: false): Analyze Accept header to serve best format
  - Priority: AVIF > WebP > JPEG > original
  - Adds `Vary: Accept` header for proper CDN caching
- `allowWebp` (default: true): Enable WebP format conversion
- `allowAvif` (default: true): Enable AVIF format conversion

**Event Hooks for Observability** (NEW):
- `onImageResized(event)`: Fired when an image is resized (cached or fresh)
  - Includes: fileName, size, duration, format, fromCache
- `onCacheHit(event)`: Fired when cached resource is served
  - Includes: fileName, notModified (304 or cached file)
- `onUploaded(event)`: Fired when a file is uploaded to S3
  - Includes: fileName, size, isImage, dimensions (if image)
- `onVideoThumbnailGenerated(event)`: Fired when a video thumbnail is generated
  - Includes: originalFileName, thumbnailFileName, requestedSize, durationMs, format

**S3 Resilience** (NEW):
- Automatic retry with exponential backoff on transient S3 errors
- Default: 3 attempts, 50ms initial backoff, 2x multiplier
- Retries on: RequestTimeout, SlowDown, ServiceUnavailable, etc.

**Pre-generation of Image Variants** (NEW):
- `preGeneration.sizes`: Array of pixel widths to pre-generate on upload (e.g., [200, 400, 800])
  - Reduces latency and CPU spikes on first request
  - Ideal for avatars, thumbnails, frequently accessed images
- `preGeneration.dispatchJob(job)`: Optional callback to delegate to external queue (Bull, BullMQ, etc.)
  - If defined: uploadMedia dispatches job instead of generating inline
  - If undefined: Falls back to inline generation (fire-and-forget, non-blocking)
- **Best effort**: Errors on variant generation don't fail the original upload
- **Respects protections**: maxResizeWidth, autoPreventUpscale, format conversion
- **No recursion**: Variants are uploaded with skipPreGeneration flag

**Video Thumbnail Generation**:
- `videoThumbnails.sizes`: Array of pixel widths for thumbnail generation (e.g., [200, 400, 800])
  - Extracts a frame from uploaded videos using ffmpeg, resizes with Sharp
  - Thumbnails uploaded to S3 as regular images (servable via `getMediaStream`)
- `videoThumbnails.thumbnailTimestamp`: When to extract the frame (default: "10%")
  - Number: seconds into video (e.g., 5.5)
  - String: percentage of duration (e.g., "10%", "50%")
- `videoThumbnails.dispatchJob(job)`: Optional callback for queue-based generation
  - Same pattern as image pre-generation (inline fire-and-forget vs external queue)
- **Naming convention**: `{baseName}-thumb-{size}.{ext}` (e.g., `clip-thumb-400.webp`)
  - The `-thumb-` infix distinguishes from image resizes (`-{size}`)
- **Respects protections**: maxResizeWidth, autoPreventUpscale, format conversion
- **Graceful degradation**: If ffmpeg is not installed, logs warning and skips silently
- **Event hook**: `onVideoThumbnailGenerated(event)` fires per generated thumbnail
  - Includes: originalFileName, thumbnailFileName, requestedSize, durationMs, format
- **Requires**: `fluent-ffmpeg` (bundled dependency) + ffmpeg binary on host system

**Dependency Injection**
- Configuration injected via `MEDIAS_MODULE_OPTIONS` token
- Services receive configuration through DI, not ConfigService
- MinIO client configured from injected options

### Media Processing Flow

**Architecture Principle**: Business logic lives in the service, controller is a thin HTTP layer.

**Request Flow**
1. GET `/medias/:fileName?size=<width>` - Request with optional size parameter
2. DTOs validate input (Zod-based validation in src/medias/dto/)
3. Controller extracts request data and calls appropriate service method
4. Service handles all business logic (caching, ETags, MIME types, Sharp processing)
5. Controller sets HTTP headers and sends response

**MediasService - Business Logic Layer** (src/medias/medias.service.ts)

The service provides all media processing logic that consumers can use in custom controllers:

**High-Level Methods (Recommended for Custom Controllers)**:
- `getMediaStream(fileName, ifNoneMatch?)`: Complete media serving with:
  - Memory-efficient streaming (Readable)
  - Automatic MIME type detection
  - ETag generation from file metadata
  - 304 Not Modified support
  - Returns: `{ stream, mimeType, size, etag, lastModified, notModified }`

- `getResizedImage(fileName, size, ifNoneMatch?, format?)`: Complete resize logic with:
  - Checks for cached resized version (e.g., `photo-300.webp`)
  - If not cached, fetches original and generates resize using Sharp
  - Applies format conversion (WebP, AVIF, JPEG, or original)
  - Uploads resized version to S3 asynchronously (fire-and-forget)
  - ETag generation from buffer content
  - 304 Not Modified support
  - Returns: `{ buffer, mimeType, etag, notModified }`

**Utility Methods**:
- `getMimeType(ext)`: Determines MIME type from file extension
- `generateETag(fileName, lastModified, size)`: Creates ETag from metadata
- `generateETagFromBuffer(buffer)`: Creates ETag from buffer content
- `isImage(fileName)`: Check if file is an image
- `isVideo(fileName)`: Check if file is a video
- `isResizable(fileName)`: Check if file can be resized (Sharp-compatible)
- `negotiateFormat(acceptHeader?)`: Determines best image format based on Accept header (NEW)
  - Returns `ImageFormat` ('avif', 'webp', 'jpeg', or 'original')
  - Respects `enableContentNegotiation`, `allowWebp`, and `allowAvif` options

**Low-Level Methods** (for basic S3 operations):
- `getMediaFileStream(fileName)`: Raw stream from S3 (with retry logic)
- `getMedia(fileName)`: Converts stream to Buffer (WARNING: memory-intensive)
- `getMediaStat(fileName)`: Gets file metadata without downloading (with retry logic)
- `uploadMedia(fileName, buffer, originalName?, skipPreGeneration?)`: Uploads buffer to S3
  - **Enriched metadata** (NEW): For images, extracts and stores width, height, MIME type, upload date
  - **Pre-generation** (NEW): Triggers variant generation after upload if configured
    - Inline mode: Fire-and-forget, non-blocking (default fallback)
    - Queue mode: Dispatches job to external queue via `dispatchJob` callback
  - **Video thumbnails**: Triggers thumbnail generation for video files if `videoThumbnails` configured
    - Extracts frame via ffmpeg, resizes with Sharp, uploads to S3
    - Same inline/queue dispatch pattern as image pre-generation
  - **Hooks**: Fires `onUploaded` hook after successful upload
  - **Retry logic**: Uses exponential backoff for resilience
  - `skipPreGeneration`: Internal flag to prevent recursion during variant uploads
- `deleteMedia(fileName)`: Removes object from S3 (with retry logic)

**Key Implementation Details**:
- All caching, ETag, and resize logic is in the SERVICE
- Controller just handles HTTP request/response
- Consumers can use service methods directly in custom controllers
- Resized files use naming convention: `{baseName}-{size}{ext}` (e.g., `photo-300.webp`)
  - Extension changes based on output format (NEW)
- Sharp library handles image transformations (resize maintains aspect ratio by width)
  - Format conversion applied during resize (NEW)
- Streaming for original media (97% memory reduction)
- HTTP caching with ETags (99% bandwidth savings)
- S3 operations protected with automatic retry on transient errors (NEW)
- Event hooks for observability (onImageResized, onCacheHit, onUploaded) (NEW)
- S3 metadata enriched for images (width, height, MIME, upload date) (NEW)
- **Pre-generation workflow** (NEW):
  1. Original file uploaded to S3
  2. If image + `preGeneration.sizes` configured → trigger variant generation
  3. **Inline mode** (default): Fire-and-forget async generation in same process
     - Non-blocking: upload completes immediately
     - Best effort: errors logged but don't fail upload
  4. **Queue mode** (optional): Dispatch job via `dispatchJob` callback
     - External worker fetches original from S3 and calls service to generate variants
     - Recommended for high-volume or resource-intensive scenarios
  5. Variants respect all protections (maxResizeWidth, autoPreventUpscale, format)
  6. Each variant uploaded with `skipPreGeneration=true` to prevent recursion

**Resource Protection & Validation**:
- Size validation: Requested width must be ≤ `maxResizeWidth` (default: 1200px)
- File size check: Original file must be ≤ `maxOriginalFileSize` (default: 15MB) before resize
- Upscale prevention: If `autoPreventUpscale` is true (default), images are never enlarged beyond original width
- Original dimensions checked using Sharp metadata before resize operation

**ETag Strategy**:
- Original media: MD5 hash of `fileName + lastModified + size` (based on S3 metadata)
- Resized images: MD5 hash of final resized buffer content (deterministic, content-addressable)
- Both support 304 Not Modified responses for bandwidth savings

**MediasController - Thin HTTP Layer** (src/medias/medias.controller.ts)
- Optional controller (opt-in via `registerController: true`)
- Extracts request parameters and headers (including Accept for content negotiation) (NEW)
- Calls service methods (`getMediaStream()` or `getResizedImage()`)
- Negotiates output format based on Accept header if enabled (NEW)
- Sets HTTP headers from service response
- Adds observability headers (NEW):
  - `X-Processing-Time`: Request duration in milliseconds
  - `X-Cache`: HIT (304 or cached) or MISS (generated/fetched)
  - `X-Resize`: yes/no indicator
  - `Vary: Accept`: For proper CDN caching with content negotiation
- Pipes stream or sends buffer to client
- NO business logic - all handled by service

### Supported Media Types

The library supports multiple media categories:

**Images** (IMAGE_EXTENSIONS)
- `.png` `.jpg` `.jpeg` `.gif` `.webp` `.svg` `.ico` `.bmp` `.tiff` `.avif`

**Resizable Images** (RESIZABLE_IMAGE_EXTENSIONS)
- `.png` `.jpg` `.jpeg` `.gif` `.webp` `.avif` `.tiff` `.bmp`
- Note: `.svg` and `.ico` are NOT resizable (vector/icon formats)

**Videos** (VIDEO_EXTENSIONS)
- `.mp4` `.webm` `.ogg` `.mov` `.avi` `.mkv` `.m4v` `.wmv` `.flv`

**Audio** (AUDIO_EXTENSIONS)
- `.mp3` `.wav` `.flac` `.aac` `.m4a` `.wma` `.opus`

**Documents** (DOCUMENT_EXTENSIONS)
- `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` `.txt` `.rtf` `.csv`

**Archives** (ARCHIVE_EXTENSIONS)
- `.zip` `.rar` `.7z` `.tar` `.gz` `.bz2`

### Security Features

**Input Validation** (src/medias/dto/)
- All endpoints protected with Zod-based DTOs for strict validation
- Path traversal prevention: File names validated to block `../` patterns
- File extension whitelist: Only supported media extensions allowed
- Size parameter validation: Must be positive integer between 1 and 1200 (default, configurable via `maxResizeWidth`)

**Filename Validation Modes**:
- **Strict mode (default)**: `strictFilenameValidation: true`
  - Whitelist approach: Only `a-z`, `A-Z`, `0-9`, `.`, `-`, `_`, `/` allowed
  - Use `GetMediaParamsDto` and `DeleteMediaParamsDto` for strict validation
  - Recommended for new S3 buckets
- **Loose mode**: `strictFilenameValidation: false`
  - Blacklist approach: Only control characters (0x00-0x1F) are blocked
  - Allows spaces, parentheses, apostrophes, Unicode characters, etc.
  - Use `GetMediaParamsLooseDto` and `DeleteMediaParamsLooseDto`
  - For backward compatibility with existing S3 files

**Schema Factories** (for custom controllers):
- `createGetMediaParamsSchema(strict?: boolean)`: Create schema with configurable strictness
- `createDeleteMediaParamsSchema(strict?: boolean)`: Create schema with configurable strictness
- Default is strict mode when called without arguments

**Security Always Applied** (regardless of mode):
- Path traversal prevention (`../`, `/..`, leading `/`)
- File extension whitelist
- Maximum filename length (255 characters)

**Resource Protection** (src/medias/medias.service.ts)
- Resize width limits: Prevents excessive memory and CPU usage (default: 1200px max)
- File size limits: Rejects oversized files before processing (default: 15MB max)
- Upscale prevention: Automatically prevents quality degradation from upscaling (default: enabled)
- These protections help prevent DoS attacks and "image bombs"

**Library Security Boundaries**
- Built-in controller is OPTIONAL and OFF by default (`registerController: false`)
- Controller (if enabled) has NO authentication, authorization, or rate limiting
- Recommended: Create custom controller with full security controls
- Library does NOT include CORS configuration - consuming app handles this
- Library does NOT include Helmet - consuming app should add security headers
- Library does NOT include global validation pipe - consuming app must configure this

**TypeScript Strict Mode**
- All strict type checks enabled (strict, strictNullChecks, noImplicitAny, etc.)
- Ensures type safety and catches potential runtime errors at compile time
- Peer dependencies properly typed

### Logging System

**Log Levels** (configurable via `logLevel` option):
- `'none'`: No logging (default)
- `'error'`: Only errors
- `'warn'`: Errors + warnings
- `'log'`: General info (file served, uploaded, deleted)
- `'debug'`: Cache hits/misses, ETags, file stats
- `'verbose'`: Step-by-step traces of every operation

**Implementation**:
- Logging methods in service: `logError()`, `logWarn()`, `logInfo()`, `logDebug()`, `logVerbose()`
- Priority-based filtering: `shouldLog(level)` checks if level should be logged
- All logs appear with context `[MediasService]`

### Library Entry Point

**Public API** (src/index.ts)
Exports all public APIs:
- `MediasModule` - Main module with forRoot/forRootAsync
- `MediasService` - Service for direct use (primary export)
- `MediasController` - Optional controller (opt-in via registerController)
- DTOs - For custom controllers (recommended usage)
- Interfaces - For configuration
- Constants - Injection tokens, MIME types, extension lists

### Dependencies

**Core Dependencies** (bundled with library)
- `nestjs-minio-client`: MinIO/S3-compatible object storage integration
- `sharp`: High-performance image processing (resizing, format conversion)
- `fluent-ffmpeg`: Video frame extraction for thumbnail generation (requires ffmpeg binary on host)
- `zod` + `nestjs-zod`: Schema validation for DTOs

**Peer Dependencies** (must be installed by consumer)
- `@nestjs/common`: ^10.0.0 || ^11.0.0
- `@nestjs/core`: ^10.0.0 || ^11.0.0
- `reflect-metadata`: ^0.1.0 || ^0.2.0
- `rxjs`: ^7.0.0

**Not Included** (consumer's choice)
- `@nestjs/config` - If using forRootAsync with ConfigService
- `@nestjs/throttler` - If adding rate limiting
- `helmet` - If adding security headers
- `@nestjs/platform-express` - Required if using controllers

## Package Distribution

**Build Output**
- Built files: `dist/` directory
- Entry point: `dist/index.js`
- Type definitions: `dist/index.d.ts`
- Source maps: Generated for debugging

**Published Files**
Only these files are published to npm (per package.json `files` field):
- `dist/` - Built JavaScript and type definitions
- `README.md` - Usage documentation
- `LICENSE` - MIT license

**Not Published**
- Source files (`src/`)
- Tests
- Configuration files
- Development dependencies

## Development Best Practices

**Module Development**
- Keep module self-contained with minimal peer dependencies
- Export only what consumers need (principle of least privilege)
- Document breaking changes in README changelog
- Use semantic versioning (major.minor.patch)

**Validation**
- All DTOs use Zod schemas via `nestjs-zod`
- Validation rules must be comprehensive but reasonable
- Document validation requirements in README

**Error Handling**
- Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Log errors with appropriate context using NestJS Logger
- Avoid exposing internal errors or stack traces

**Type Safety**
- Never use `any` type - TypeScript strict mode is enabled
- Use generic type parameters when needed
- Properly type all public APIs
- Generate complete type definitions

**Code Quality - No Magic Numbers**
- ESLint rule `@typescript-eslint/no-magic-numbers` is enforced
- All numeric literals must be extracted to named constants (src/medias/medias.constants.ts)
- Exceptions: 0, 1, -1 (common values), array indexes, default values, enums
- Benefits: Improved readability, maintainability, and single source of truth
- Examples of constants:
  - `DEFAULT_MAX_RESIZE_WIDTH = 1200`
  - `DEFAULT_MAX_ORIGINAL_FILE_SIZE = 15MB`
  - `MAX_FILENAME_LENGTH = 255`
  - `HTTP_STATUS.NOT_MODIFIED = 304`
  - `SIZE_UNITS.MEGABYTE = 1048576`

**Testing**
- Unit tests for all services
- Keep tests isolated (mock external dependencies)
- Test validation logic thoroughly
- Test both success and error paths
- Tests are excluded from no-magic-numbers rule (in `.eslintrc.js` ignorePatterns)

## Consumer Integration

### Recommended: Create Custom Controller

```typescript
import { MediasModule, MediasService } from '@bniddam-labs/medias-manager-nestjs';

// 1. Import module (no controller)
@Module({
  imports: [
    MediasModule.forRoot({
      s3: { /* config */ },
      registerController: false,  // Default, can be omitted
    }),
  ],
})
export class AppModule {}

// 2. Create your own controller
@Controller('api/medias')
@UseGuards(AuthGuard)  // Your security
export class MyMediasController {
  constructor(private readonly mediasService: MediasService) {}

  @Get(':id')
  async getMedia(@Param('id') id: string) {
    return this.mediasService.getMedia(id);
  }
}
```

### Alternative: Use Built-in Controller (Quick Prototyping)

```typescript
@Module({
  imports: [
    MediasModule.forRoot({
      s3: { /* config */ },
      registerController: true,  // Enable built-in controller
    }),
  ],
})
export class AppModule {}
// Now GET /medias/:fileName and DELETE /medias/:fileName are available
// WARNING: No authentication, authorization, or rate limiting
```

### Pre-generation Usage Examples

**Example 1: Inline pre-generation (default)**

```typescript
@Module({
  imports: [
    MediasModule.forRoot({
      s3: { /* config */ },
      preferredFormat: 'webp',  // Convert to WebP
      preGeneration: {
        sizes: [200, 400, 800],  // Generate these sizes on upload
        // dispatchJob not specified → inline generation (fire-and-forget)
      },
    }),
  ],
})
export class AppModule {}

// When you upload:
await mediasService.uploadMedia('avatars/user-123.jpg', buffer);

// Automatically generates in background (non-blocking):
// - avatars/user-123-200.webp
// - avatars/user-123-400.webp
// - avatars/user-123-800.webp
```

**Example 2: Queue-based pre-generation (Bull/BullMQ)**

```typescript
import { Queue } from 'bull';

@Module({
  imports: [
    MediasModule.forRootAsync({
      imports: [BullModule.registerQueue({ name: 'image-resize' })],
      inject: [getQueueToken('image-resize')],
      useFactory: (imageQueue: Queue) => ({
        s3: { /* config */ },
        preferredFormat: 'webp',
        preGeneration: {
          sizes: [200, 400, 800, 1200],
          dispatchJob: async (job) => {
            // Offload to background worker
            await imageQueue.add('resize-variants', job, {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
            });
          },
        },
      }),
    }),
  ],
})
export class AppModule {}

// Worker (separate process or container):
@Processor('image-resize')
export class ImageResizeProcessor {
  constructor(private readonly mediasService: MediasService) {}

  @Process('resize-variants')
  async handleResize(job: Job<PreGenerateJob>) {
    const { fileName, sizes } = job.data;

    // Fetch original from S3
    const original = await this.mediasService.getMedia(fileName);

    // Generate variants
    for (const size of sizes) {
      const resized = await this.mediasService.getResizedImage(fileName, size);
      // Variants are automatically cached to S3 by getResizedImage
    }
  }
}
```

### Video Thumbnail Usage Examples

**Example 1: Inline video thumbnails**

```typescript
@Module({
  imports: [
    MediasModule.forRoot({
      s3: { /* config */ },
      preferredFormat: 'webp',
      videoThumbnails: {
        sizes: [200, 400, 800],
        thumbnailTimestamp: '10%',  // Extract frame at 10% of duration
        // No dispatchJob → inline generation (fire-and-forget)
      },
    }),
  ],
})
export class AppModule {}

// When you upload a video:
await mediasService.uploadMedia('videos/clip.mp4', buffer);

// Automatically generates in background (non-blocking):
// - videos/clip-thumb-200.webp
// - videos/clip-thumb-400.webp
// - videos/clip-thumb-800.webp

// Serve thumbnails like any image:
const thumb = await mediasService.getMediaStream('videos/clip-thumb-400.webp');
```

**Example 2: Queue-based video thumbnails**

```typescript
MediasModule.forRootAsync({
  imports: [BullModule.registerQueue({ name: 'video-thumbnails' })],
  inject: [getQueueToken('video-thumbnails')],
  useFactory: (videoQueue: Queue) => ({
    s3: { /* config */ },
    preferredFormat: 'webp',
    videoThumbnails: {
      sizes: [200, 400, 800],
      thumbnailTimestamp: '10%',
      dispatchJob: async (job) => {
        await videoQueue.add('generate-thumbnails', job);
      },
    },
  }),
})
```

See README.md for complete usage examples.

## Publishing

```bash
# Build the library
pnpm run build

# Verify package contents
npm pack --dry-run

# Publish to npm (requires authentication)
npm publish --access public

# Or publish to private registry
npm publish --registry https://your-registry.com
```

## Versioning

Follow semantic versioning:
- **Major (1.0.0 → 2.0.0)**: Breaking changes
- **Minor (1.0.0 → 1.1.0)**: New features, backwards compatible
- **Patch (1.0.0 → 1.0.1)**: Bug fixes, backwards compatible

## Support

For library usage questions, consumers should refer to:
- README.md for installation and usage
- TypeScript type definitions for API documentation
- GitHub issues for bug reports

## Learned Rules
<!-- auto-generated — do not edit manually -->

- [2026-03-31] When upgrading TypeScript to v6+, `export class Dto extends createZodDto(schema) {}` fails with TS2883. Fix by extracting to an intermediate const with explicit `ZodDto` type annotation: `const Base: ZodDto<typeof Schema> = createZodDto(Schema); export class Dto extends Base {}`.
- [2026-03-31] When adding new media processing features that parallel existing ones (e.g., video thumbnails mirroring image resize), always carry over all protection/validation mechanisms (maxResizeWidth, autoPreventUpscale, maxOriginalFileSize) from the original feature — verify they are actually enforced in the new code path.
- [2026-04-08] When `?size=` is requested for a video file, the controller routes to `getVideoThumbnail` instead of throwing `BadRequestException`. Controller tests for the resize-rejection path must use a non-video, non-image file (e.g., `document.pdf`) — not `video.mp4`.
