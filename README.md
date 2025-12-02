# @bniddam-labs/medias-manager-nestjs

[![CI](https://github.com/bniddam-labs/medias-manager-nestjs/actions/workflows/ci.yml/badge.svg)](https://github.com/bniddam-labs/medias-manager-nestjs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🚀 A production-ready NestJS module for media storage, retrieval, and on-demand image resizing with S3/MinIO backend.

## ✨ Features

| Feature                     | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| 🗄️ **Multi-Media Support**  | Images, videos, audio, documents, and archives         |
| ☁️ **S3/MinIO Integration** | Works with AWS S3, MinIO, DigitalOcean Spaces, etc.    |
| 🖼️ **On-Demand Resizing**   | Automatic image resizing with Sharp                    |
| 🚀 **Pre-generation**       | Generate common sizes at upload time                   |
| 🌊 **Streaming Resize**     | Low-memory mode for large images                       |
| 💾 **Smart Caching**        | Resized images cached to S3 automatically              |
| ⚡ **HTTP Caching**         | ETag support for 304 responses (99% bandwidth savings) |
| 🔒 **Security First**       | Path traversal prevention, file type validation        |
| 📦 **Zero Config**          | Sensible defaults, optional controller                 |
| 🔧 **TypeScript**           | Full type safety with strict mode                      |

### 📁 Supported File Types

| Category     | Extensions                                                                |
| ------------ | ------------------------------------------------------------------------- |
| 🖼️ Images    | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.svg` `.ico` `.bmp` `.tiff` `.avif` |
| 🎬 Videos    | `.mp4` `.webm` `.ogg` `.mov` `.avi` `.mkv` `.m4v` `.wmv` `.flv`           |
| 🎵 Audio     | `.mp3` `.wav` `.flac` `.aac` `.m4a` `.wma` `.opus`                        |
| 📄 Documents | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` `.txt` `.rtf` `.csv`  |
| 📦 Archives  | `.zip` `.rar` `.7z` `.tar` `.gz` `.bz2`                                   |

---

## 📦 Installation

<!-- ```bash
# pnpm (recommended)
pnpm add @bniddam-labs/medias-manager-nestjs

# npm
npm install @bniddam-labs/medias-manager-nestjs

# yarn
yarn add @bniddam-labs/medias-manager-nestjs
``` -->

### 📥 Install from GitHub

```bash
# pnpm (recommended)
pnpm add github:bniddam-labs/medias-manager-nestjs
```

> **Note:** The library is automatically built during installation via the `prepare` script. The `dist/` directory is generated on-the-fly and is not committed to the repository. No additional build steps are required after installation.

---

## 🚀 Quick Start

```typescript
import { Module } from '@nestjs/common';
import { MediasModule } from '@bniddam-labs/medias-manager-nestjs';

@Module({
  imports: [
    MediasModule.forRoot({
      s3: {
        endPoint: 'localhost',
        port: 9000,
        useSSL: false,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        region: 'us-east-1',
        bucketName: 'medias',
      },
    }),
  ],
})
export class AppModule {}
```

That's it! 🎉 The `MediasService` is now available for dependency injection.

---

## ⚙️ Configuration

### 🔄 Async Configuration (recommended)

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MediasModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        s3: {
          endPoint: config.get('S3_ENDPOINT'),
          port: config.get('S3_PORT'),
          useSSL: config.get('S3_USE_SSL') === 'true',
          accessKey: config.get('S3_ACCESS_KEY'),
          secretKey: config.get('S3_SECRET_KEY'),
          region: config.get('S3_REGION'),
          bucketName: config.get('S3_BUCKET'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 📋 Configuration Options

```typescript
interface MediasModuleOptions {
  s3: {
    endPoint: string; // S3/MinIO endpoint
    port?: number; // Port (default: 443 for SSL, 80 otherwise)
    useSSL?: boolean; // Use HTTPS (default: true)
    accessKey: string; // Access key
    secretKey: string; // Secret key
    region?: string; // AWS region
    bucketName: string; // Bucket name
  };
  registerController?: boolean; // Enable built-in controller (default: false)
  maxResizeWidth?: number; // Max resize width in px (default: 1200)
  autoPreventUpscale?: boolean; // Prevent upscaling beyond original (default: true)
  maxOriginalFileSize?: number; // Max size in bytes for on-the-fly resize (default: 15MB)
  logLevel?: MediasLogLevel; // Logging verbosity (default: 'none')
}
```

### 🛡️ Resource Protection Options

The module includes several options to protect your server from excessive resource usage:

| Option                  | Default | Description                                                         |
| ----------------------- | ------- | ------------------------------------------------------------------- |
| `maxResizeWidth`        | `1200`  | Maximum width in pixels for resized images                         |
| `autoPreventUpscale`    | `true`  | Prevent upscaling images beyond their original width               |
| `maxOriginalFileSize`   | `15MB`  | Maximum size of original images that can be resized on-the-fly    |

**Example:**
```typescript
MediasModule.forRoot({
  s3: { /* ... */ },
  maxResizeWidth: 2000,        // Allow up to 2000px wide resizes
  autoPreventUpscale: true,    // Don't upscale small images
  maxOriginalFileSize: 20 * 1024 * 1024, // 20MB limit
});
```

### 📝 Log Levels

Control logging verbosity with the `logLevel` option:

| Level     | Description                                          |
| --------- | ---------------------------------------------------- |
| `'none'`  | No logging (default)                                 |
| `'error'` | Only errors                                          |
| `'warn'`  | Errors + warnings                                    |
| `'log'`   | General info (file served, uploaded, deleted)        |
| `'debug'` | Cache hits/misses, ETags, file stats                 |
| `'verbose'` | Step-by-step traces of every operation             |

```typescript
MediasModule.forRoot({
  s3: { /* ... */ },
  logLevel: 'debug', // See cache behavior and ETags
});
```

Logs appear with context `[MediasService]` in your app's console.
```

---

## 🎮 Usage

### 💉 Using the Service (Recommended)

```typescript
import { Injectable } from '@nestjs/common';
import { MediasService } from '@bniddam-labs/medias-manager-nestjs';

@Injectable()
export class MyService {
  constructor(private readonly mediasService: MediasService) {}

  // 🖼️ Get image with optional resize
  getImage(fileName: string, size?: number) {
    if (size) {
      return this.mediasService.getResizedImage(fileName, size);
    }
    return this.mediasService.getMediaStream(fileName);
  }

  // 📤 Upload media
  upload(fileName: string, buffer: Buffer) {
    return this.mediasService.uploadMedia(fileName, buffer);
  }

  // 🗑️ Delete media
  delete(fileName: string) {
    return this.mediasService.deleteMedia(fileName);
  }

  // 🔍 Check file type
  isResizable(fileName: string) {
    return this.mediasService.isResizable(fileName); // true for jpg, png, etc.
  }
}
```

### 🎛️ Built-in Controller (Quick Prototyping)

> ⚠️ **Warning**: The built-in controller has NO authentication. Use for prototyping only!

```typescript
MediasModule.forRoot({
  s3: {
    /* ... */
  },
  registerController: true, // Enables /medias endpoints
});
```

**Endpoints:**

| Method   | Endpoint                     | Description                     |
| -------- | ---------------------------- | ------------------------------- |
| `GET`    | `/medias/:fileName`          | Get media file                  |
| `GET`    | `/medias/:fileName?size=300` | Get resized image (images only) |
| `DELETE` | `/medias/:fileName`          | Delete media file               |

---

## 🖼️ Image Resizing

### How it works

```
GET /medias/photo.jpg?size=300
         │
         ▼
┌────────────────────────────┐
│ Check cache: photo-300.jpg │
└────────────────────────────┘
         │
    Not found?
         ▼
┌───────────────────────────┐
│ Fetch original: photo.jpg │
└───────────────────────────┘
         │
         ▼
┌───────────────────────────┐
│ Resize with Sharp (300px) │
└───────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Cache to S3: photo-300.jpg │
│ (async, fire-and-forget)   │
└────────────────────────────┘
         │
         ▼
┌──────────────────────┐
│ Return resized image │
└──────────────────────┘
```

### ✅ Resizable formats

Only raster images can be resized:

- `.png` `.jpg` `.jpeg` `.gif` `.webp` `.avif` `.tiff` `.bmp`

### ❌ Not resizable

- `.svg` `.ico` (vector/icon formats)
- Videos, audio, documents, archives

```typescript
// Check before resizing
if (mediasService.isResizable('photo.jpg')) {
  // ✅ Can resize
}

if (mediasService.isResizable('video.mp4')) {
  // ❌ Returns false - cannot resize videos
}
```

### 🚀 Pre-generation at Upload

Reduce latency by generating common image sizes at upload time instead of on first request:

```typescript
MediasModule.forRoot({
  s3: { /* ... */ },
  preGeneration: {
    sizes: [200, 400, 800],  // Sizes to pre-generate
  },
});
```

**With external queue (recommended for production):**

```typescript
MediasModule.forRoot({
  s3: { /* ... */ },
  preGeneration: {
    sizes: [200, 400, 800],
    dispatchJob: async (job) => {
      // Delegate to Bull, BullMQ, RabbitMQ, etc.
      await imageQueue.add('resize', job);
    },
  },
});
```

**Behavior:**
- Original is always uploaded first
- Pre-generation runs in background (fire-and-forget)
- Errors don't fail the upload (best effort)
- `getResizedImage()` still works as fallback if pre-generation fails

### 🌊 Streaming Resize (Low-Memory Mode)

For large images or high-throughput scenarios, use streaming resize:

```typescript
// Standard (buffer + cache) - recommended for most cases
const result = await mediasService.getResizedImage(fileName, 800);
res.send(result.buffer);

// Streaming (no cache) - for large files or memory constraints
const result = await mediasService.getResizedImageStream(fileName, 800);
result.stream.pipe(res);
```

**When to use streaming:**
- Very large images (>15MB)
- High-throughput, memory-constrained environments
- Infrequently accessed images (no caching benefit)

**Trade-offs:**

| Method              | Memory Usage | Caches to S3 | Content-Length | Best For                    |
| ------------------- | ------------ | ------------ | -------------- | --------------------------- |
| `getResizedImage`   | Higher       | ✅ Yes       | ✅ Known       | Most use cases              |
| `getResizedImageStream` | Lower    | ❌ No        | ❌ Unknown     | Large files, high throughput |

---

## 📡 HTTP Caching

The service provides full ETag support for both original and resized images:

```typescript
const result = await mediasService.getMediaStream(fileName, ifNoneMatch);

if (result.notModified) {
  // Return 304 Not Modified
  return res.status(304).end();
}

res.setHeader('ETag', result.etag);
res.setHeader('Content-Type', result.mimeType);
result.stream.pipe(res);
```

### 🔖 ETag Strategy

The module uses different ETag generation strategies depending on the content type:

| Content Type         | ETag Generation Method                                | Use Case                |
| -------------------- | ----------------------------------------------------- | ----------------------- |
| **Original media**   | MD5 hash of `fileName + lastModified + size`         | Stream-based serving    |
| **Resized images**   | MD5 hash of final resized buffer content              | Buffer-based serving    |

**Benefits:**
- **Original media**: ETags based on S3 metadata (no content download needed for 304 responses)
- **Resized images**: ETags based on actual content (deterministic, content-addressable)
- **99% bandwidth savings** on cache hits with 304 Not Modified responses
- **Compatible** with CDN and browser caching

---

## 🔐 Security

### ✅ Built-in protections

- **Path traversal prevention**: `../` patterns blocked
- **File extension whitelist**: Only allowed media types
- **Character validation**: Alphanumeric, hyphens, underscores only
- **Resize width limits**: 1-1200px by default (configurable via `maxResizeWidth`)
- **Upscale prevention**: Images won't be enlarged beyond original dimensions (configurable via `autoPreventUpscale`)
- **File size limits**: Original files >15MB rejected for resize (configurable via `maxOriginalFileSize`)

### ⚠️ Your responsibility

- Authentication & Authorization
- Rate limiting
- CORS configuration
- Request size limits

```typescript
// Example: Add auth guard to your controller
@Controller('api/medias')
@UseGuards(AuthGuard)
export class MyMediasController {
  constructor(private readonly mediasService: MediasService) {}

  @Get(':fileName')
  get(@Param('fileName') fileName: string) {
    return this.mediasService.getMediaStream(fileName);
  }
}
```

---

## 🔗 Frontend Integration

Works great with **[@bniddam-labs/lazy-media-vuejs](https://github.com/bniddam-labs/lazy-medias-manager-vuejs)**:

```vue
<template>
  <!-- Progressive blur-up loading -->
  <LazyImage src="http://localhost:3000/medias/photo.jpg" :sizes="[100, 400]" />

  <!-- Lazy video -->
  <LazyVideo src="http://localhost:3000/medias/video.mp4" />

  <!-- Lazy audio -->
  <LazyAudio src="http://localhost:3000/medias/song.mp3" />

  <!-- Lazy document -->
  <LazyDocument src="http://localhost:3000/medias/report.pdf" />
</template>
```

---

## 📚 API Reference

### MediasService Methods

| Method                                                    | Description                              |
| --------------------------------------------------------- | ---------------------------------------- |
| `getMediaStream(fileName, ifNoneMatch?)`                  | Stream media with ETag support           |
| `getResizedImage(fileName, size, ifNoneMatch?, format?)`  | Get/generate resized image (cached)      |
| `getResizedImageStream(fileName, size, ifNoneMatch?, format?)` | Stream resized image (no cache)     |
| `getMedia(fileName)`                                      | Get media as Buffer                      |
| `getMediaStat(fileName)`                                  | Get file metadata                        |
| `uploadMedia(fileName, buffer, originalName?)`            | Upload media to S3 (with pre-generation) |
| `deleteMedia(fileName)`                                   | Delete media from S3                     |
| `batchResize(items)`                                      | Batch resize multiple images             |
| `isImage(fileName)`                                       | Check if file is an image                |
| `isResizable(fileName)`                                   | Check if file can be resized             |
| `getMimeType(extension)`                                  | Get MIME type for extension              |
| `negotiateFormat(acceptHeader?)`                          | Get best format from Accept header       |

### 🔄 Batch Resize

Regenerate thumbnails or prepare variants in bulk:

```typescript
const results = await mediasService.batchResize([
  { fileName: 'photo1.jpg', sizes: [200, 400, 800] },
  { fileName: 'photo2.png', sizes: [200, 400] },
]);

// Results array:
// [
//   { fileName: 'photo1.jpg', size: 200, resizedFileName: 'photo1-200.jpg', success: true },
//   { fileName: 'photo1.jpg', size: 400, resizedFileName: 'photo1-400.jpg', success: true },
//   ...
// ]

// Check for failures
const failures = results.filter(r => !r.success);
if (failures.length > 0) {
  console.error('Some variants failed:', failures);
}
```

**Use cases:**
- Re-generate all thumbs after changing quality/format settings
- Prepare all sizes for an event, collection, or catalog
- Backoffice operations to pre-warm cache

### Exported Constants

```typescript
import {
  IMAGE_EXTENSIONS, // ['.png', '.jpg', ...]
  RESIZABLE_IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  ALL_MEDIA_EXTENSIONS,
  MIME_TYPES, // { '.png': 'image/png', ... }
} from '@bniddam-labs/medias-manager-nestjs';
```

---

## 🧪 Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Build
pnpm build

# Lint
pnpm lint
```

---

## 📄 License

MIT © [Benjamin Niddam](https://github.com/bniddam-labs)

---

<p align="center">
  Made with ❤️ and ☕
</p>
