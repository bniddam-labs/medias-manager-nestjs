# Media Deletion — Cascade & Hook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `deleteMediaWithVariants()` that deletes an original S3 file plus all its generated variants (resized images, video thumbnails), plus an `onDeleted` event hook.

**Architecture:** Four changes to existing files — a new `listFiles` method in the storage service, a new event interface + option in the module options interface, a new `deleteMediaWithVariants` method in the main service, and a controller update. All code follows the existing patterns (retry logic, logger calls, hook invocation).

**Tech Stack:** NestJS, MinIO (`nestjs-minio-client`), Jest (unit tests), TypeScript strict mode.

---

## File Map

| File | Change |
|------|--------|
| `src/medias/services/medias-storage.service.ts` | Add `listFiles(prefix)` method |
| `src/medias/interfaces/medias-module-options.interface.ts` | Add `MediaDeletedEvent` interface + `onDeleted` option |
| `src/medias/medias.service.ts` | Add `deleteMediaWithVariants(fileName)` method |
| `src/medias/medias.service.spec.ts` | Add `listObjects` to mock + tests for `deleteMediaWithVariants` |
| `src/medias/medias.controller.ts` | Update `DELETE` endpoint to call `deleteMediaWithVariants` |
| `src/medias/medias.controller.spec.ts` | Update mock + test to use `deleteMediaWithVariants` |
| `src/index.ts` | Export `MediaDeletedEvent` |

---

## Task 1: `listFiles` in `MediasStorageService`

**Files:**
- Modify: `src/medias/services/medias-storage.service.ts:184` (after `deleteFile`)
- Modify: `src/medias/medias.service.spec.ts:42` (add `listObjects` to mock client)

- [ ] **Step 1: Add `listObjects` to the mock client in the service spec**

In `src/medias/medias.service.spec.ts`, find the `mockMinioClient` object (around line 42) and add `listObjects`:

```typescript
const mockMinioClient = {
  getObject: jest.fn(),
  statObject: jest.fn(),
  putObject: jest.fn(),
  removeObject: jest.fn(),
  listObjects: jest.fn(),
};
```

- [ ] **Step 2: Write the failing test for `listFiles`**

Add this helper and test block in `src/medias/medias.service.spec.ts`, inside the `describe('MediasService', ...)` block, after the existing `deleteMedia` describe:

```typescript
const createMockListStream = (items: { name: string }[]) => {
  const stream = new Readable({ objectMode: true, read() {} });
  items.forEach((item) => stream.push(item));
  stream.push(null);
  return stream;
};

describe('deleteMediaWithVariants', () => {
  it('should delete original file and its variants', async () => {
    mockMinioClient.removeObject.mockResolvedValue({});
    mockMinioClient.listObjects.mockReturnValue(
      createMockListStream([
        { name: 'photo-300.webp' },
        { name: 'photo-800.jpg' },
        { name: 'photo-thumb-400.webp' },
        { name: 'photo-unrelated.webp' },
      ]),
    );

    await service.deleteMediaWithVariants('photo.jpg');

    expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'photo.jpg');
    expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'photo-300.webp');
    expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'photo-800.jpg');
    expect(mockMinioClient.removeObject).not.toHaveBeenCalledWith('test-bucket', 'photo-unrelated.webp');
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
pnpm test --testPathPattern="medias.service.spec" 2>&1 | tail -20
```

Expected: FAIL — `service.deleteMediaWithVariants is not a function`

- [ ] **Step 4: Add `listFiles` to `MediasStorageService`**

In `src/medias/services/medias-storage.service.ts`, add after the `deleteFile` method (after line 188):

```typescript
async listFiles(prefix: string): Promise<string[]> {
  this.logger.verbose('Listing files from S3', { prefix });
  const stream = this.minioService.client.listObjects(this.getBucketName(), prefix, true);
  return new Promise((resolve, reject) => {
    const files: string[] = [];
    stream.on('data', (item: { name?: string }) => {
      if (item.name) files.push(item.name);
    });
    stream.on('end', () => {
      this.logger.verbose('Files listed from S3', { prefix, count: files.length });
      resolve(files);
    });
    stream.on('error', (error: Error) => {
      this.logger.error('Failed to list files from S3', { prefix, error: error.message });
      reject(error);
    });
  });
}
```

---

## Task 2: `MediaDeletedEvent` interface + `onDeleted` option

**Files:**
- Modify: `src/medias/interfaces/medias-module-options.interface.ts`

- [ ] **Step 1: Add `MediaDeletedEvent` interface**

In `src/medias/interfaces/medias-module-options.interface.ts`, add after the `ProcessingCompletedEvent` interface (after line 102):

```typescript
/**
 * Event fired when a file and its variants are deleted
 */
export interface MediaDeletedEvent {
  /** Original file that was deleted */
  fileName: string;
  /** Variant files that were successfully deleted */
  deletedVariants: string[];
}
```

- [ ] **Step 2: Add `onDeleted` to `MediasModuleOptions`**

In `src/medias/interfaces/medias-module-options.interface.ts`, find the `onProcessingCompleted` option (look for it in `MediasModuleOptions`) and add `onDeleted` after it:

```typescript
/**
 * Optional: Callback fired when a file and its variants are deleted via deleteMediaWithVariants.
 *
 * Not fired by the simple deleteMedia() method.
 */
onDeleted?: (event: MediaDeletedEvent) => void;
```

- [ ] **Step 3: Commit**

```bash
git add src/medias/interfaces/medias-module-options.interface.ts
git commit -m "feat(deletion): add MediaDeletedEvent interface and onDeleted hook option"
```

---

## Task 3: `deleteMediaWithVariants` in `MediasService`

**Files:**
- Modify: `src/medias/medias.service.ts` (add method after `deleteMedia`)
- Modify: `src/medias/medias.service.spec.ts` (complete the tests from Task 1)

- [ ] **Step 1: Add `deleteMediaWithVariants` to `MediasService`**

In `src/medias/medias.service.ts`, find the `deleteMedia` method (around line 404) and add `deleteMediaWithVariants` immediately after it:

```typescript
/**
 * Delete a media file and all its S3 variants (resized images, video thumbnails).
 *
 * Variants are discovered via S3 listing with prefix `{baseName}-` and filtered
 * by the naming convention `{baseName}-{size}.{ext}` or `{baseName}-thumb-{size}.{ext}`.
 * Fires the `onDeleted` hook with the list of successfully deleted variants.
 */
async deleteMediaWithVariants(fileName: string): Promise<void> {
  await this.deleteMedia(fileName);

  const lastDot = fileName.lastIndexOf('.');
  const baseName = lastDot !== -1 ? fileName.slice(0, lastDot) : fileName;
  const prefix = `${baseName}-`;

  const candidates = await this.storage.listFiles(prefix);

  const escapedBaseName = baseName.replace(/[.[\]{}()*+?\\^$|#]/g, '\\$&');
  const variantRegex = new RegExp(`^${escapedBaseName}(-\\d+|-thumb-\\d+)\\.\\w+$`);
  const variants = candidates.filter((name) => variantRegex.test(name));

  const deletedVariants: string[] = [];
  for (const variant of variants) {
    try {
      await this.storage.deleteFile(variant);
      deletedVariants.push(variant);
    } catch (error) {
      this.logWarn('Variant file not found during cascade delete, skipping', {
        variant,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (this.options.onDeleted) {
    this.options.onDeleted({ fileName, deletedVariants });
  }
}
```

- [ ] **Step 2: Run the test written in Task 1 to confirm it passes**

```bash
pnpm test --testPathPattern="medias.service.spec" --testNamePattern="deleteMediaWithVariants" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 3: Write additional tests for `deleteMediaWithVariants`**

Add these test cases inside the `describe('deleteMediaWithVariants', ...)` block in `src/medias/medias.service.spec.ts`:

```typescript
it('should handle video thumbnails naming convention', async () => {
  mockMinioClient.removeObject.mockResolvedValue({});
  mockMinioClient.listObjects.mockReturnValue(
    createMockListStream([
      { name: 'videos/clip-thumb-200.webp' },
      { name: 'videos/clip-thumb-800.webp' },
    ]),
  );

  await service.deleteMediaWithVariants('videos/clip.mp4');

  expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'videos/clip.mp4');
  expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'videos/clip-thumb-200.webp');
  expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'videos/clip-thumb-800.webp');
});

it('should log a warning when a variant deletion fails', async () => {
  mockMinioClient.removeObject
    .mockResolvedValueOnce({}) // original
    .mockRejectedValueOnce(new Error('Not Found')); // variant fails
  mockMinioClient.listObjects.mockReturnValue(
    createMockListStream([{ name: 'photo-300.webp' }]),
  );

  await service.deleteMediaWithVariants('photo.jpg');

  // Should not throw — deletion of original succeeded
  expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'photo.jpg');
});

it('should fire onDeleted hook with deleted variants list', async () => {
  const onDeleted = jest.fn();
  // Rebuild module with onDeleted option
  const moduleWithHook = await Test.createTestingModule({
    providers: [
      MediasService,
      MediasLoggerService,
      MediasStorageService,
      MediasValidationService,
      MediasResizeService,
      MediasVideoService,
      { provide: MinioService, useValue: { client: mockMinioClient } },
      { provide: MEDIAS_MODULE_OPTIONS, useValue: { ...mockOptions, onDeleted } },
    ],
  }).compile();
  const serviceWithHook = moduleWithHook.get<MediasService>(MediasService);

  mockMinioClient.removeObject.mockResolvedValue({});
  mockMinioClient.listObjects.mockReturnValue(
    createMockListStream([{ name: 'photo-400.webp' }]),
  );

  await serviceWithHook.deleteMediaWithVariants('photo.jpg');

  expect(onDeleted).toHaveBeenCalledWith({
    fileName: 'photo.jpg',
    deletedVariants: ['photo-400.webp'],
  });
});

it('should not include unmatched files in deletedVariants', async () => {
  const onDeleted = jest.fn();
  const moduleWithHook = await Test.createTestingModule({
    providers: [
      MediasService,
      MediasLoggerService,
      MediasStorageService,
      MediasValidationService,
      MediasResizeService,
      MediasVideoService,
      { provide: MinioService, useValue: { client: mockMinioClient } },
      { provide: MEDIAS_MODULE_OPTIONS, useValue: { ...mockOptions, onDeleted } },
    ],
  }).compile();
  const serviceWithHook = moduleWithHook.get<MediasService>(MediasService);

  mockMinioClient.removeObject.mockResolvedValue({});
  mockMinioClient.listObjects.mockReturnValue(
    createMockListStream([
      { name: 'photo-300.webp' },    // valid variant
      { name: 'photo-other.webp' },  // not a variant (no numeric size)
    ]),
  );

  await serviceWithHook.deleteMediaWithVariants('photo.jpg');

  expect(onDeleted).toHaveBeenCalledWith({
    fileName: 'photo.jpg',
    deletedVariants: ['photo-300.webp'],
  });
  expect(mockMinioClient.removeObject).not.toHaveBeenCalledWith('test-bucket', 'photo-other.webp');
});
```

- [ ] **Step 4: Run all service tests**

```bash
pnpm test --testPathPattern="medias.service.spec" 2>&1 | tail -20
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/medias/services/medias-storage.service.ts src/medias/medias.service.ts src/medias/medias.service.spec.ts
git commit -m "feat(deletion): add listFiles to storage and deleteMediaWithVariants to service"
```

---

## Task 4: Update `MediasController` + controller test

**Files:**
- Modify: `src/medias/medias.controller.ts:169-173`
- Modify: `src/medias/medias.controller.spec.ts`

- [ ] **Step 1: Update the controller test mock and describe block**

In `src/medias/medias.controller.spec.ts`:

1. In the `mockMediasService` object (around line 28), replace `deleteMedia: jest.fn()` with `deleteMediaWithVariants: jest.fn()`.

2. Replace the entire `describe('deleteMedia', ...)` block (lines 182-198) with:

```typescript
describe('deleteMedia', () => {
  it('should delete media file and its variants', async () => {
    mediasService.deleteMediaWithVariants.mockResolvedValue(undefined);

    await controller.deleteMedia({ fileName: 'video.mp4' });

    expect(mediasService.deleteMediaWithVariants).toHaveBeenCalledWith('video.mp4');
  });

  it('should handle array fileName from wildcard route', async () => {
    mediasService.deleteMediaWithVariants.mockResolvedValue(undefined);

    await controller.deleteMedia({ fileName: ['folder', 'video.mp4'] as any });

    expect(mediasService.deleteMediaWithVariants).toHaveBeenCalledWith('folder/video.mp4');
  });
});
```

- [ ] **Step 2: Run the controller test to confirm it fails**

```bash
pnpm test --testPathPattern="medias.controller.spec" --testNamePattern="deleteMedia" 2>&1 | tail -20
```

Expected: FAIL — `mediasService.deleteMediaWithVariants is not a function`

- [ ] **Step 3: Update the controller**

In `src/medias/medias.controller.ts`, replace the `deleteMedia` method body (lines 169-173):

```typescript
@Delete('*fileName')
async deleteMedia(@Param() params: DeleteMediaParamsLooseDto): Promise<void> {
  const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
  return this.mediasService.deleteMediaWithVariants(fileName);
}
```

- [ ] **Step 4: Run the controller test to confirm it passes**

```bash
pnpm test --testPathPattern="medias.controller.spec" 2>&1 | tail -20
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/medias/medias.controller.ts src/medias/medias.controller.spec.ts
git commit -m "feat(deletion): update built-in controller to use deleteMediaWithVariants"
```

---

## Task 5: Export + final validation

**Files:**
- Modify: `src/index.ts:10` (add `MediaDeletedEvent` to the type exports)

- [ ] **Step 1: Export `MediaDeletedEvent` from `src/index.ts`**

In `src/index.ts`, find the existing export block for event types and add `MediaDeletedEvent`:

```typescript
export type {
  CacheHitEvent,
  FileUploadedEvent,
  ImageResizedEvent,
  MediaDeletedEvent,
  MediasLogLevel,
  MediasModuleAsyncOptions,
  MediasModuleOptions,
  MediasModuleOptionsFactory,
  MediasPreGenerationOptions,
  PreGenerateJob,
  ProcessingCompletedEvent,
  S3Options,
  VideoThumbnailGeneratedEvent,
  VideoThumbnailJob,
  VideoThumbnailOptions,
} from './medias/interfaces/medias-module-options.interface';
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test 2>&1 | tail -30
```

Expected: All test suites PASS, no failures.

- [ ] **Step 3: Build**

```bash
pnpm run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(deletion): export MediaDeletedEvent from public API"
```
