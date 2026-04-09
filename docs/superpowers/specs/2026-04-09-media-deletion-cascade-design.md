# Media Deletion — Cascade & Hook

**Date:** 2026-04-09
**Status:** Approved

## Context

The current `deleteMedia(fileName)` only deletes the original file from S3. When an image or video is uploaded, the library may generate variants (resized images: `photo-300.webp`, video thumbnails: `clip-thumb-400.webp`). These variants are orphaned when the original is deleted.

## Goals

- Add `deleteMediaWithVariants(fileName)` that deletes the original + all S3 variants
- Add `onDeleted` event hook for observability, consistent with existing hooks
- Update the built-in demo controller to use `deleteMediaWithVariants`

## Out of Scope

- No changes to the existing `deleteMedia()` method (stays simple, single-file)
- No config-based variant discovery (S3 listing only)
- No changes to validation DTOs

---

## Design

### 1. `MediasStorageService` — `listFiles(prefix: string): Promise<string[]>`

New method using MinIO's `listObjects` (recursive, non-recursive not needed since prefix scopes the results). Returns an array of object names matching the prefix. Does not throw on empty result.

### 2. `MediaDeletedEvent` interface

```typescript
export interface MediaDeletedEvent {
  /** Original file that was deleted */
  fileName: string;
  /** Variant files that were successfully deleted */
  deletedVariants: string[];
}
```

Location: `src/medias/interfaces/medias-module-options.interface.ts`, alongside existing event interfaces.

### 3. `MediasModuleOptions` — `onDeleted` hook

```typescript
onDeleted?: (event: MediaDeletedEvent) => void;
```

Optional callback, same pattern as `onUploaded`, `onImageResized`, etc.

### 4. `MediasService` — `deleteMediaWithVariants(fileName: string): Promise<void>`

**Algorithm:**

1. Delete the original file via existing `deleteMedia(fileName)`
2. Compute `baseName` — file name without extension (e.g. `avatars/photo` from `avatars/photo.jpg`)
3. List S3 objects with prefix `{baseName}-`
4. Filter results with regex: `^{escapedBaseName}(-\d+|-thumb-\d+)\.\w+$`
   - Matches image resize variants: `photo-300.webp`, `photo-800.jpg`
   - Matches video thumbnail variants: `clip-thumb-200.webp`, `clip-thumb-800.webp`
   - Excludes unrelated files that happen to share a prefix
5. For each matched variant:
   - Attempt deletion via `storage.deleteFile(variant)`
   - If file not found (404): log warning, skip
   - Collect successfully deleted names
6. Fire `onDeleted({ fileName, deletedVariants })` if hook is configured

**Variant naming conventions covered:**
| Pattern | Example |
|---------|---------|
| `{baseName}-{size}.{ext}` | `photo-300.webp` |
| `{baseName}-thumb-{size}.{ext}` | `clip-thumb-400.webp` |

### 5. `MediasController` (built-in) — use `deleteMediaWithVariants`

The `DELETE *fileName` endpoint is updated to call `deleteMediaWithVariants` instead of `deleteMedia`. This demonstrates the full cascade behavior when the built-in controller is enabled.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Original file not found | `NotFoundException` thrown (same as current `deleteMedia`) |
| Variant not found on S3 | Log warning, continue — not an error |
| S3 transient error on variant delete | Existing retry logic via `withRetry` |
| S3 listing fails | Propagate error (unexpected, likely auth/config issue) |

---

## Public API Changes

- **New:** `MediasService.deleteMediaWithVariants(fileName: string): Promise<void>`
- **New:** `MediaDeletedEvent` interface (exported from `src/index.ts`)
- **New:** `onDeleted` option in `MediasModuleOptions`
- **Updated:** Built-in controller `DELETE` endpoint uses `deleteMediaWithVariants`
- **Unchanged:** `MediasService.deleteMedia(fileName)` (still available, no cascade)

---

## Testing

- Unit test `deleteMediaWithVariants`: mock storage `listFiles` + `deleteFile`, verify correct variants deleted and `onDeleted` fired
- Unit test warning log when a variant returns 404 during deletion
- Unit test `listFiles` in `MediasStorageService` with a mock MinIO client
- Controller test: verify `DELETE` endpoint calls `deleteMediaWithVariants`
