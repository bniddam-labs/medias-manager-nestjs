# Video Thumbnail Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate thumbnail images from uploaded videos using ffmpeg, with configurable sizes, timestamps, and format conversion.

**Architecture:** New `MediasVideoService` internal service encapsulating ffmpeg logic, triggered from `uploadMedia()` on video files. Thumbnails are resized via Sharp and uploaded to S3 as regular images. Supports inline (fire-and-forget) and queue-based generation.

**Tech Stack:** `fluent-ffmpeg` for frame extraction, `sharp` for resize/format conversion, NestJS DI, Jest for testing.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `fluent-ffmpeg` + `@types/fluent-ffmpeg` |
| `src/medias/medias.constants.ts` | Modify | Add thumbnail constants |
| `src/medias/interfaces/medias-module-options.interface.ts` | Modify | Add `VideoThumbnailOptions`, `VideoThumbnailJob`, `VideoThumbnailGeneratedEvent`, extend `MediasModuleOptions` |
| `src/medias/services/medias-validation.service.ts` | Modify | Add `isVideo()`, `buildThumbnailFileName()` |
| `src/medias/services/medias-video.service.ts` | Create | ffmpeg frame extraction, thumbnail generation, Sharp resize |
| `src/medias/services/medias-video.service.spec.ts` | Create | Tests for video service |
| `src/medias/services/index.ts` | Modify | Export `MediasVideoService` |
| `src/medias/medias.module.ts` | Modify | Register `MediasVideoService` in `INTERNAL_SERVICES` |
| `src/medias/medias.service.ts` | Modify | Inject video service, add `isVideo()`, `triggerVideoThumbnailGeneration()` |
| `src/medias/medias.service.spec.ts` | Modify | Add video thumbnail tests |
| `src/index.ts` | Modify | Export new types |

---

### Task 1: Add dependencies

**Files:**
- Modify: `package.json:45-49` (dependencies), `package.json:57-78` (devDependencies)

- [ ] **Step 1: Install fluent-ffmpeg and types**

Run:
```bash
pnpm add fluent-ffmpeg && pnpm add -D @types/fluent-ffmpeg
```

- [ ] **Step 2: Verify installation**

Run: `pnpm ls fluent-ffmpeg @types/fluent-ffmpeg`
Expected: Both packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(deps): add fluent-ffmpeg for video thumbnail generation"
```

---

### Task 2: Add thumbnail constants

**Files:**
- Modify: `src/medias/medias.constants.ts`

- [ ] **Step 1: Add constants at end of file**

Add after line 185 (after `S3_METADATA_KEYS`):

```typescript
/**
 * Video thumbnail configuration
 */

/** Default timestamp position for video thumbnail extraction (percentage of duration) */
export const DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT = 10;

/** Divisor for percentage-to-decimal conversion */
export const PERCENTAGE_DIVISOR = 100;

/** Infix used in thumbnail file names to distinguish from image resizes */
export const THUMBNAIL_FILENAME_INFIX = 'thumb';

/** Number of frames to extract from video */
export const FFMPEG_FRAME_COUNT = 1;
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/medias/medias.constants.ts
git commit -m "feat: add video thumbnail constants"
```

---

### Task 3: Add interfaces

**Files:**
- Modify: `src/medias/interfaces/medias-module-options.interface.ts`

- [ ] **Step 1: Add VideoThumbnailGeneratedEvent after FileUploadedEvent (after line 61)**

```typescript
/**
 * Event fired when a video thumbnail is generated
 */
export interface VideoThumbnailGeneratedEvent {
  /** Original video file name */
  originalFileName: string;
  /** Generated thumbnail file name */
  thumbnailFileName: string;
  /** Requested thumbnail width in pixels */
  requestedSize: number;
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Format used for the thumbnail */
  format: ImageFormat;
}
```

- [ ] **Step 2: Add VideoThumbnailJob after PreGenerateJob (after line 71)**

```typescript
/**
 * Video thumbnail generation job for queue-based processing
 */
export interface VideoThumbnailJob {
  /** Full path to the original video file in the bucket */
  fileName: string;
  /** Thumbnail sizes to generate (in pixels) */
  sizes: number[];
  /** Timestamp for frame extraction (seconds or "10%" string) */
  thumbnailTimestamp?: number | string;
}
```

- [ ] **Step 3: Add VideoThumbnailOptions after MediasPreGenerationOptions (after line 91)**

```typescript
/**
 * Video thumbnail generation configuration
 */
export interface VideoThumbnailOptions {
  /**
   * List of thumbnail widths in pixels to generate (e.g., [200, 400, 800])
   */
  sizes: number[];

  /**
   * Timestamp for frame extraction.
   * - Number: seconds into the video (e.g., 5.5)
   * - String with %: percentage of video duration (e.g., "10%")
   * @default "10%"
   */
  thumbnailTimestamp?: number | string;

  /**
   * Optional: Callback to delegate thumbnail generation to an external queue
   * - If defined: uploadMedia dispatches a job instead of generating inline
   * - If undefined: Falls back to inline generation (fire-and-forget)
   */
  dispatchJob?: (job: VideoThumbnailJob) => Promise<void>;
}
```

- [ ] **Step 4: Add fields to MediasModuleOptions**

Add before the closing `}` of `MediasModuleOptions` (before `strictFilenameValidation`), after the `preGeneration` field (after line 254):

```typescript
  /**
   * Optional: Video thumbnail generation configuration
   *
   * When enabled, automatically extracts a frame from uploaded videos
   * and generates thumbnail images at the specified sizes.
   *
   * Requires ffmpeg to be installed on the system.
   *
   * Example:
   * ```typescript
   * videoThumbnails: {
   *   sizes: [200, 400, 800],
   *   thumbnailTimestamp: '10%',  // 10% into the video
   *   dispatchJob: async (job) => {
   *     await videoQueue.add('thumbnails', job);
   *   }
   * }
   * ```
   */
  videoThumbnails?: VideoThumbnailOptions;

  /**
   * Optional: Callback fired when a video thumbnail is generated
   */
  onVideoThumbnailGenerated?: (event: VideoThumbnailGeneratedEvent) => void;
```

- [ ] **Step 5: Verify build**

Run: `pnpm run build`
Expected: Compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add src/medias/interfaces/medias-module-options.interface.ts
git commit -m "feat: add video thumbnail interfaces"
```

---

### Task 4: Add validation methods

**Files:**
- Modify: `src/medias/services/medias-validation.service.ts`
- Test: `src/medias/medias.service.spec.ts` (for integration via MediasService)

- [ ] **Step 1: Add VIDEO_EXTENSIONS import**

Update the import from `'../medias.constants'` to include `VIDEO_EXTENSIONS` and `THUMBNAIL_FILENAME_INFIX`:

```typescript
import { DEFAULT_MAX_RESIZE_WIDTH, IMAGE_EXTENSIONS, MEDIAS_MODULE_OPTIONS, MIME_TYPES, RESIZABLE_IMAGE_EXTENSIONS, THUMBNAIL_FILENAME_INFIX, VIDEO_EXTENSIONS } from '../medias.constants';
```

- [ ] **Step 2: Add isVideo method after isResizable (after line 38)**

```typescript
  /**
   * Check if file is a video based on extension
   */
  isVideo(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }
```

- [ ] **Step 3: Add buildThumbnailFileName method after buildResizedFileName (after line 111)**

```typescript
  /**
   * Build thumbnail file name from original video file
   * Pattern: {dir}/{baseName}-thumb-{size}{outputExt}
   */
  buildThumbnailFileName(fileName: string, size: number, outputExt: string): string {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const dirName = path.dirname(fileName);
    const thumbName = `${baseName}-${THUMBNAIL_FILENAME_INFIX}-${size}${outputExt}`;
    return dirName === '.' ? thumbName : `${dirName}/${thumbName}`;
  }
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src/medias/services/medias-validation.service.ts
git commit -m "feat: add isVideo and buildThumbnailFileName to validation service"
```

---

### Task 5: Create MediasVideoService

**Files:**
- Create: `src/medias/services/medias-video.service.ts`

- [ ] **Step 1: Create the video service file**

```typescript
import { Readable } from 'node:stream';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { MediasModuleOptions, VideoThumbnailGeneratedEvent } from '../interfaces/medias-module-options.interface';
import { DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT, FFMPEG_FRAME_COUNT, IMAGE_QUALITY, ImageFormat, MEDIAS_MODULE_OPTIONS, PERCENTAGE_DIVISOR } from '../medias.constants';
import { MediasLoggerService } from './medias-logger.service';
import { MediasStorageService } from './medias-storage.service';
import { MediasValidationService } from './medias-validation.service';

/**
 * Internal video service for the medias module
 * Handles video thumbnail extraction using ffmpeg
 */
@Injectable()
export class MediasVideoService implements OnModuleInit {
  private ffmpegAvailable = false;

  constructor(
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
    private readonly logger: MediasLoggerService,
    private readonly storage: MediasStorageService,
    private readonly validation: MediasValidationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.ffmpegAvailable = await this.checkFfmpegAvailability();
  }

  // ============================================
  // FFmpeg Availability
  // ============================================

  private checkFfmpegAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          this.logger.warn('ffmpeg is not available. Video thumbnail generation will be disabled.', {
            error: err.message,
          });
          resolve(false);
        } else {
          this.logger.debug('ffmpeg is available for video thumbnail generation');
          resolve(true);
        }
      });
    });
  }

  isFfmpegAvailable(): boolean {
    return this.ffmpegAvailable;
  }

  // ============================================
  // Timestamp Parsing
  // ============================================

  parseTimestamp(timestamp: number | string | undefined, videoDuration: number): number {
    if (timestamp === undefined) {
      return (videoDuration * DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT) / PERCENTAGE_DIVISOR;
    }

    if (typeof timestamp === 'number') {
      return Math.min(timestamp, videoDuration);
    }

    // Handle percentage string (e.g., "10%")
    if (typeof timestamp === 'string' && timestamp.endsWith('%')) {
      const percent = Number.parseFloat(timestamp);
      if (!Number.isNaN(percent)) {
        return (videoDuration * percent) / PERCENTAGE_DIVISOR;
      }
    }

    // Try to parse as number string
    const parsed = Number.parseFloat(timestamp);
    if (!Number.isNaN(parsed)) {
      return Math.min(parsed, videoDuration);
    }

    // Fallback to default
    this.logger.warn('Invalid thumbnail timestamp, using default', { timestamp });
    return (videoDuration * DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT) / PERCENTAGE_DIVISOR;
  }

  // ============================================
  // Video Duration Probing
  // ============================================

  getVideoDuration(videoBuffer: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const inputStream = Readable.from(videoBuffer);

      ffmpeg.ffprobe(inputStream, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format.duration ?? 0);
      });
    });
  }

  // ============================================
  // Frame Extraction
  // ============================================

  extractFrame(videoBuffer: Buffer, timestampSeconds: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const inputStream = Readable.from(videoBuffer);
      const chunks: Buffer[] = [];

      ffmpeg(inputStream)
        .seekInput(timestampSeconds)
        .outputOptions([`-frames:v ${FFMPEG_FRAME_COUNT}`, '-f image2pipe', '-vcodec png'])
        .format('image2pipe')
        .on('error', (err) => {
          reject(err);
        })
        .pipe()
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on('end', () => {
          if (chunks.length === 0) {
            reject(new Error('No frame extracted from video'));
            return;
          }
          resolve(Buffer.concat(chunks));
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  // ============================================
  // Thumbnail Generation
  // ============================================

  private applyFormat(pipeline: sharp.Sharp, format: ImageFormat): sharp.Sharp {
    switch (format) {
      case 'webp':
        return pipeline.webp({ quality: IMAGE_QUALITY.WEBP });
      case 'jpeg':
        return pipeline.jpeg({ quality: IMAGE_QUALITY.JPEG });
      case 'avif':
        return pipeline.avif({ quality: IMAGE_QUALITY.AVIF });
      default:
        return pipeline.jpeg({ quality: IMAGE_QUALITY.JPEG });
    }
  }

  private getExtensionForFormat(format: ImageFormat): string {
    switch (format) {
      case 'webp':
        return '.webp';
      case 'avif':
        return '.avif';
      default:
        return '.jpg';
    }
  }

  async generateThumbnailsInline(fileName: string, videoBuffer: Buffer, sizes: number[], thumbnailTimestamp?: number | string): Promise<void> {
    if (!this.ffmpegAvailable) {
      this.logger.warn('ffmpeg not available, skipping video thumbnail generation', { fileName });
      return;
    }

    const startTime = Date.now();
    const outputFormat = this.options.preferredFormat ?? 'original';
    const outputExt = this.getExtensionForFormat(outputFormat);

    this.logger.info('Starting video thumbnail generation', {
      fileName,
      sizes,
      outputFormat,
      thumbnailTimestamp,
    });

    // 1. Probe video duration
    let duration: number;
    try {
      duration = await this.getVideoDuration(videoBuffer);
      this.logger.debug('Video duration probed', { fileName, duration });
    } catch (error) {
      this.logger.error('Failed to probe video duration', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    // 2. Compute timestamp
    const timestamp = this.parseTimestamp(thumbnailTimestamp, duration);
    this.logger.debug('Computed thumbnail timestamp', { fileName, timestamp, duration });

    // 3. Extract frame
    let frameBuffer: Buffer;
    try {
      frameBuffer = await this.extractFrame(videoBuffer, timestamp);
      this.logger.debug('Frame extracted from video', { fileName, frameSize: frameBuffer.length });
    } catch (error) {
      this.logger.error('Failed to extract frame from video', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    // 4. Generate each thumbnail size
    for (const size of sizes) {
      const thumbnailStartTime = Date.now();
      const thumbnailFileName = this.validation.buildThumbnailFileName(fileName, size, outputExt);

      try {
        let pipeline = sharp(frameBuffer).resize(size);
        pipeline = this.applyFormat(pipeline, outputFormat);
        const thumbnailBuffer = await pipeline.toBuffer();

        await this.storage.putFile(thumbnailFileName, thumbnailBuffer);

        const durationMs = Date.now() - thumbnailStartTime;

        this.logger.info('Video thumbnail generated', {
          fileName,
          thumbnailFileName,
          size,
          thumbnailSize: thumbnailBuffer.length,
          durationMs,
        });

        this.options.onVideoThumbnailGenerated?.({
          originalFileName: fileName,
          thumbnailFileName,
          requestedSize: size,
          durationMs,
          format: outputFormat,
        });
      } catch (error) {
        this.logger.error('Failed to generate video thumbnail', {
          fileName,
          thumbnailFileName,
          size,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    this.logger.info('Video thumbnail generation completed', {
      fileName,
      totalSizes: sizes.length,
      totalDurationMs: totalDuration,
    });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/medias/services/medias-video.service.ts
git commit -m "feat: create MediasVideoService for video thumbnail generation"
```

---

### Task 6: Register and wire the service

**Files:**
- Modify: `src/medias/services/index.ts`
- Modify: `src/medias/medias.module.ts`
- Modify: `src/medias/medias.service.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Export from services/index.ts**

Add this line to `src/medias/services/index.ts`:

```typescript
export { MediasVideoService } from './medias-video.service';
```

- [ ] **Step 2: Register in module**

In `src/medias/medias.module.ts`, update the import to include `MediasVideoService`:

```typescript
import { MediasLoggerService, MediasResizeService, MediasStorageService, MediasValidationService, MediasVideoService } from './services';
```

Update `INTERNAL_SERVICES`:

```typescript
const INTERNAL_SERVICES = [MediasLoggerService, MediasStorageService, MediasValidationService, MediasResizeService, MediasVideoService];
```

- [ ] **Step 3: Inject into MediasService and add methods**

In `src/medias/medias.service.ts`, update the import from `'./services'` to include `MediasVideoService`:

```typescript
import { BatchResizeRequestItem, BatchResizeResultItem, MediaBufferResponse, MediaStatResult, MediaStreamResponse, MediasLoggerService, MediasResizeService, MediasStorageService, MediasValidationService, MediasVideoService } from './services';
```

Add `MediasVideoService` to the constructor:

```typescript
  constructor(
    @Inject(MEDIAS_MODULE_OPTIONS)
    private readonly options: MediasModuleOptions,
    private readonly logger: MediasLoggerService,
    private readonly storage: MediasStorageService,
    private readonly validation: MediasValidationService,
    private readonly resize: MediasResizeService,
    private readonly video: MediasVideoService,
  ) {
    this.logger.verbose('MediasService initialized', { bucket: options.s3.bucketName });
  }
```

Add `isVideo()` public method after `isResizable()` (after line 46):

```typescript
  /**
   * Check if file is a video based on extension
   */
  isVideo(fileName: string): boolean {
    return this.validation.isVideo(fileName);
  }
```

Add `triggerVideoThumbnailGeneration()` private method after `triggerPreGeneration()` (after line 274):

```typescript
  /**
   * Trigger video thumbnail generation
   */
  private async triggerVideoThumbnailGeneration(fileName: string, buffer: Buffer): Promise<void> {
    const videoThumbs = this.options.videoThumbnails;

    if (!videoThumbs?.sizes || videoThumbs.sizes.length === 0) {
      return;
    }

    if (!this.validation.isVideo(fileName)) {
      return;
    }

    this.logger.debug('Triggering video thumbnail generation', {
      fileName,
      sizes: videoThumbs.sizes,
      hasDispatchJob: !!videoThumbs.dispatchJob,
    });

    try {
      if (videoThumbs.dispatchJob) {
        this.logger.info('Dispatching video thumbnail job to external queue', {
          fileName,
          sizes: videoThumbs.sizes,
        });

        await videoThumbs.dispatchJob({
          fileName,
          sizes: videoThumbs.sizes,
          thumbnailTimestamp: videoThumbs.thumbnailTimestamp,
        });
        this.logger.info('Video thumbnail job dispatched successfully', { fileName });
      } else {
        this.logger.info('Starting inline video thumbnail generation (fire-and-forget)', {
          fileName,
          sizes: videoThumbs.sizes,
        });

        this.video.generateThumbnailsInline(fileName, buffer, videoThumbs.sizes, videoThumbs.thumbnailTimestamp).catch((error) => {
          this.logger.error('Inline video thumbnail generation failed', {
            fileName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    } catch (error) {
      this.logger.error('Failed to trigger video thumbnail generation', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
```

- [ ] **Step 4: Call triggerVideoThumbnailGeneration in uploadMedia**

In `uploadMedia()`, add the call after the existing `triggerPreGeneration` for non-images (after line 222, the second `if (!skipPreGeneration)` block). Replace the block at lines 219-222:

```typescript
    // Trigger pre-generation if configured
    if (!skipPreGeneration) {
      await this.triggerPreGeneration(fileName, file);
      await this.triggerVideoThumbnailGeneration(fileName, file);
    }
```

Also add `triggerVideoThumbnailGeneration` after image pre-generation (after line 198). Replace lines 196-199:

```typescript
        // Trigger pre-generation if configured
        if (!skipPreGeneration) {
          await this.triggerPreGeneration(fileName, file);
          await this.triggerVideoThumbnailGeneration(fileName, file);
        }
```

Note: `triggerVideoThumbnailGeneration` will early-return for images since `isVideo()` returns false, so calling it in both branches is safe and keeps the code symmetric.

- [ ] **Step 5: Update public exports**

In `src/index.ts`, add the new types to the type export block:

```typescript
export type {
  CacheHitEvent,
  FileUploadedEvent,
  ImageResizedEvent,
  MediasLogLevel,
  MediasModuleAsyncOptions,
  MediasModuleOptions,
  MediasModuleOptionsFactory,
  MediasPreGenerationOptions,
  PreGenerateJob,
  S3Options,
  VideoThumbnailGeneratedEvent,
  VideoThumbnailJob,
  VideoThumbnailOptions,
} from './medias/interfaces/medias-module-options.interface';
```

Also export the new constants:

```typescript
export {
  ALL_MEDIA_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  DEFAULT_MAX_ORIGINAL_FILE_SIZE,
  DEFAULT_MAX_RESIZE_WIDTH,
  DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT,
  DOCUMENT_EXTENSIONS,
  FFMPEG_FRAME_COUNT,
  FORMAT_PRIORITY,
  HTTP_STATUS,
  IMAGE_EXTENSIONS,
  IMAGE_QUALITY,
  MAX_FILENAME_LENGTH,
  MAX_RESIZE_WIDTH_LIMIT,
  MEDIAS_MODULE_OPTIONS,
  MIME_TYPES,
  PERCENTAGE_DIVISOR,
  RESIZABLE_IMAGE_EXTENSIONS,
  RETRY_CONFIG,
  S3_METADATA_KEYS,
  SIZE_UNITS,
  THUMBNAIL_FILENAME_INFIX,
  TRANSIENT_S3_ERROR_CODES,
  VIDEO_EXTENSIONS,
} from './medias/medias.constants';
```

- [ ] **Step 6: Verify build**

Run: `pnpm run build`
Expected: Compiles without errors.

- [ ] **Step 7: Verify lint**

Run: `pnpm run lint`
Expected: No lint errors (Biome may auto-fix import order).

- [ ] **Step 8: Commit**

```bash
git add src/medias/services/index.ts src/medias/medias.module.ts src/medias/medias.service.ts src/index.ts
git commit -m "feat: wire MediasVideoService into module and MediasService"
```

---

### Task 7: Write tests for MediasVideoService

**Files:**
- Create: `src/medias/services/medias-video.service.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MEDIAS_MODULE_OPTIONS } from '../medias.constants';
import { MediasLoggerService } from './medias-logger.service';
import { MediasStorageService } from './medias-storage.service';
import { MediasValidationService } from './medias-validation.service';
import { MediasVideoService } from './medias-video.service';

// Mock fluent-ffmpeg
const mockFfprobe = jest.fn();
const mockGetAvailableFormats = jest.fn();
const mockPipe = jest.fn();
const mockOn = jest.fn();

jest.mock('fluent-ffmpeg', () => {
  const ffmpegInstance = {
    seekInput: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function (this: any, event: string, cb: (...args: any[]) => void) {
      if (event === 'error') {
        // Store error handler for later triggering
      }
      return this;
    }),
    pipe: jest.fn().mockReturnValue({
      on: jest.fn().mockImplementation(function (this: any, event: string, cb: (...args: any[]) => void) {
        if (event === 'end') {
          // Simulate frame extraction completing with a PNG buffer
          process.nextTick(() => cb());
        }
        if (event === 'data') {
          // Simulate a chunk of data
          process.nextTick(() => cb(Buffer.from('fake-png-frame')));
        }
        return this;
      }),
    }),
  };

  const ffmpegFn: any = jest.fn().mockReturnValue(ffmpegInstance);
  ffmpegFn.ffprobe = mockFfprobe;
  ffmpegFn.getAvailableFormats = mockGetAvailableFormats;

  return { __esModule: true, default: ffmpegFn };
});

// Mock sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('thumbnail-data')),
    metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080, format: 'png' }),
  }));
});

describe('MediasVideoService', () => {
  let service: MediasVideoService;
  let mockStoragePutFile: jest.Mock;

  const mockOptions = {
    s3: {
      bucketName: 'test-bucket',
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'test',
      secretKey: 'test',
    },
    preferredFormat: 'jpeg' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStoragePutFile = jest.fn().mockResolvedValue(undefined);
    mockGetAvailableFormats.mockImplementation((cb: (err: Error | null, formats?: any) => void) => {
      cb(null, { mp4: {} });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasVideoService,
        MediasLoggerService,
        {
          provide: MediasStorageService,
          useValue: { putFile: mockStoragePutFile },
        },
        {
          provide: MediasValidationService,
          useValue: {
            isVideo: jest.fn().mockReturnValue(true),
            buildThumbnailFileName: jest.fn().mockImplementation(
              (fileName: string, size: number, ext: string) => `${fileName.replace(/\.[^.]+$/, '')}-thumb-${size}${ext}`,
            ),
          },
        },
        {
          provide: MEDIAS_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<MediasVideoService>(MediasVideoService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkFfmpegAvailability', () => {
    it('should detect ffmpeg as available', () => {
      expect(service.isFfmpegAvailable()).toBe(true);
    });

    it('should detect ffmpeg as unavailable', async () => {
      mockGetAvailableFormats.mockImplementation((cb: (err: Error | null) => void) => {
        cb(new Error('ffmpeg not found'));
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MediasVideoService,
          MediasLoggerService,
          {
            provide: MediasStorageService,
            useValue: { putFile: jest.fn() },
          },
          {
            provide: MediasValidationService,
            useValue: { isVideo: jest.fn(), buildThumbnailFileName: jest.fn() },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      const unavailableService = module.get<MediasVideoService>(MediasVideoService);
      await unavailableService.onModuleInit();

      expect(unavailableService.isFfmpegAvailable()).toBe(false);
    });
  });

  describe('parseTimestamp', () => {
    it('should return default 10% when undefined', () => {
      expect(service.parseTimestamp(undefined, 100)).toBe(10);
    });

    it('should return number directly when within duration', () => {
      expect(service.parseTimestamp(5.5, 100)).toBe(5.5);
    });

    it('should clamp number to duration', () => {
      expect(service.parseTimestamp(150, 100)).toBe(100);
    });

    it('should parse percentage string', () => {
      expect(service.parseTimestamp('25%', 200)).toBe(50);
    });

    it('should parse number string', () => {
      expect(service.parseTimestamp('30', 100)).toBe(30);
    });

    it('should fallback to default for invalid string', () => {
      expect(service.parseTimestamp('invalid', 100)).toBe(10);
    });
  });

  describe('generateThumbnailsInline', () => {
    it('should skip when ffmpeg is not available', async () => {
      mockGetAvailableFormats.mockImplementation((cb: (err: Error | null) => void) => {
        cb(new Error('ffmpeg not found'));
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MediasVideoService,
          MediasLoggerService,
          {
            provide: MediasStorageService,
            useValue: { putFile: mockStoragePutFile },
          },
          {
            provide: MediasValidationService,
            useValue: {
              isVideo: jest.fn().mockReturnValue(true),
              buildThumbnailFileName: jest.fn(),
            },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      const unavailableService = module.get<MediasVideoService>(MediasVideoService);
      await unavailableService.onModuleInit();

      await unavailableService.generateThumbnailsInline('video.mp4', Buffer.from('video'), [200, 400]);

      expect(mockStoragePutFile).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm run test -- --testPathPattern=medias-video`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/medias/services/medias-video.service.spec.ts
git commit -m "test: add MediasVideoService unit tests"
```

---

### Task 8: Update MediasService tests

**Files:**
- Modify: `src/medias/medias.service.spec.ts`

- [ ] **Step 1: Add MediasVideoService to test module**

Update imports at the top of the file to include `MediasVideoService`:

```typescript
import { MediasLoggerService, MediasResizeService, MediasStorageService, MediasValidationService, MediasVideoService } from './services';
```

Add `MediasVideoService` to the providers array in `beforeEach` (after `MediasResizeService`):

```typescript
        MediasResizeService,
        MediasVideoService,
```

Also need to mock fluent-ffmpeg at the top of the file (after the sharp mock):

```typescript
// Mock fluent-ffmpeg module
jest.mock('fluent-ffmpeg', () => {
  const ffmpegFn: any = jest.fn().mockReturnValue({
    seekInput: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockReturnValue({ on: jest.fn().mockReturnThis() }),
  });
  ffmpegFn.ffprobe = jest.fn();
  ffmpegFn.getAvailableFormats = jest.fn().mockImplementation((cb: (err: Error | null, formats?: any) => void) => {
    cb(null, { mp4: {} });
  });
  return { __esModule: true, default: ffmpegFn };
});
```

- [ ] **Step 2: Add isVideo tests**

Add a new `describe` block after the `isResizable` block:

```typescript
  describe('isVideo', () => {
    it('should return true for video files', () => {
      expect(service.isVideo('video.mp4')).toBe(true);
      expect(service.isVideo('video.webm')).toBe(true);
      expect(service.isVideo('video.mov')).toBe(true);
      expect(service.isVideo('video.avi')).toBe(true);
      expect(service.isVideo('video.mkv')).toBe(true);
    });

    it('should return false for non-video files', () => {
      expect(service.isVideo('photo.jpg')).toBe(false);
      expect(service.isVideo('audio.mp3')).toBe(false);
      expect(service.isVideo('document.pdf')).toBe(false);
    });
  });
```

- [ ] **Step 3: Add uploadMedia video thumbnail tests**

Add inside the existing `describe('uploadMedia')` block:

```typescript
    it('should trigger video thumbnail generation when videoThumbnails configured', async () => {
      const dispatchJob = jest.fn().mockResolvedValue(undefined);

      // Create service with videoThumbnails config
      const moduleWithThumbs: TestingModule = await Test.createTestingModule({
        providers: [
          MediasService,
          MediasLoggerService,
          MediasStorageService,
          MediasValidationService,
          MediasResizeService,
          MediasVideoService,
          {
            provide: MinioService,
            useValue: { client: mockMinioClient },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: {
              ...mockOptions,
              videoThumbnails: {
                sizes: [200, 400],
                dispatchJob,
              },
            },
          },
        ],
      }).compile();

      const serviceWithThumbs = moduleWithThumbs.get<MediasService>(MediasService);
      mockMinioClient.putObject.mockResolvedValue({});

      await serviceWithThumbs.uploadMedia('clip.mp4', Buffer.from('video content'));

      expect(dispatchJob).toHaveBeenCalledWith({
        fileName: 'clip.mp4',
        sizes: [200, 400],
        thumbnailTimestamp: undefined,
      });
    });

    it('should not trigger video thumbnails for image files', async () => {
      const dispatchJob = jest.fn().mockResolvedValue(undefined);

      const moduleWithThumbs: TestingModule = await Test.createTestingModule({
        providers: [
          MediasService,
          MediasLoggerService,
          MediasStorageService,
          MediasValidationService,
          MediasResizeService,
          MediasVideoService,
          {
            provide: MinioService,
            useValue: { client: mockMinioClient },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: {
              ...mockOptions,
              videoThumbnails: {
                sizes: [200, 400],
                dispatchJob,
              },
            },
          },
        ],
      }).compile();

      const serviceWithThumbs = moduleWithThumbs.get<MediasService>(MediasService);
      mockMinioClient.putObject.mockResolvedValue({});

      await serviceWithThumbs.uploadMedia('photo.jpg', Buffer.from('image content'));

      expect(dispatchJob).not.toHaveBeenCalled();
    });

    it('should not trigger video thumbnails when skipPreGeneration is true', async () => {
      const dispatchJob = jest.fn().mockResolvedValue(undefined);

      const moduleWithThumbs: TestingModule = await Test.createTestingModule({
        providers: [
          MediasService,
          MediasLoggerService,
          MediasStorageService,
          MediasValidationService,
          MediasResizeService,
          MediasVideoService,
          {
            provide: MinioService,
            useValue: { client: mockMinioClient },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: {
              ...mockOptions,
              videoThumbnails: {
                sizes: [200, 400],
                dispatchJob,
              },
            },
          },
        ],
      }).compile();

      const serviceWithThumbs = moduleWithThumbs.get<MediasService>(MediasService);
      mockMinioClient.putObject.mockResolvedValue({});

      await serviceWithThumbs.uploadMedia('clip.mp4', Buffer.from('video content'), undefined, true);

      expect(dispatchJob).not.toHaveBeenCalled();
    });
```

- [ ] **Step 4: Run all tests**

Run: `pnpm run test`
Expected: All tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/medias/medias.service.spec.ts
git commit -m "test: add video thumbnail integration tests to MediasService"
```

---

### Task 9: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `pnpm run build`
Expected: Compiles without errors.

- [ ] **Step 2: Run linter**

Run: `pnpm run lint`
Expected: No lint errors.

- [ ] **Step 3: Run all tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit any auto-fixed files (if any)**

If Biome auto-fixed import ordering or formatting:
```bash
git add -u
git commit -m "style: auto-fix formatting from Biome"
```
