# Video Thumbnail Generation - Design Spec

## Context

La lib medias-manager-nestjs gere le stockage S3 et le resize d'images, mais ne fait aucun traitement video. L'objectif est d'ajouter la generation automatique de thumbnails pour les videos uploadees, en extrayant une frame via ffmpeg puis en la resizant/convertissant avec Sharp.

## Decisions de design

| Decision | Choix | Raison |
|----------|-------|--------|
| Dependance ffmpeg | Directe via `fluent-ffmpeg` | Simple pour le consommateur, la lib gere tout |
| Trigger | A l'upload uniquement | Thumbnails prets immediatement, pas de generation on-demand |
| Timestamp | Configurable, defaut 10% | `thumbnailTimestamp` accepte secondes ou pourcentage |
| Tailles | Tableau de sizes (comme images) | `videoThumbnails: { sizes: [200, 400, 800] }` |
| Nommage | `{baseName}-thumb-{size}.{ext}` | Le prefixe `thumb` distingue des resized images |
| Format | Reutilise `preferredFormat` | Coherence avec le reste de la lib, pas de config supplementaire |
| Queue | Meme pattern que images | Inline (fire-and-forget) ou `dispatchJob` callback |

## Architecture : Nouveau `MediasVideoService`

Un service interne dedie, suivant le meme pattern que `MediasResizeService` pour les images.

### Pourquoi un nouveau service (pas d'extension de MediasResizeService)

- SRP : Sharp pour images vs ffmpeg pour video = 2 pipelines differents
- Isolation des dependances : ffmpeg n'impacte pas les tests/consommateurs qui n'utilisent que les images
- Le resize service fait deja 500+ lignes
- Coherence architecturale : 1 service = 1 domaine de traitement

## Flow a l'upload

```
uploadMedia("clip.mp4", buffer)
  -> S3 putFile (existant)
  -> onUploaded hook (existant, isImage: false)
  -> triggerPreGeneration -> skip (isResizable = false, inchange)
  -> triggerVideoThumbnailGeneration (NOUVEAU)
      -> isVideo(fileName) ? oui
      -> videoThumbnails config definie ? oui
      -> dispatchJob defini ?
          -> Oui : dispatch VideoThumbnailJob
          -> Non : video.generateThumbnailsInline() (fire-and-forget)
              -> ffprobe pour la duree
              -> ffmpeg extrait 1 frame au timestamp configure (defaut 10%)
              -> Pour chaque size: Sharp resize + format conversion
              -> Upload chaque thumbnail en S3 (skipPreGeneration=true)
              -> Fire onVideoThumbnailGenerated hook
```

## Convention de nommage

`videos/clip.mp4` + sizes `[200, 400]` + preferredFormat `webp` :
- `videos/clip-thumb-200.webp`
- `videos/clip-thumb-400.webp`

Methode `buildThumbnailFileName()` dans `MediasValidationService`.

## Interfaces

```typescript
interface VideoThumbnailOptions {
  sizes: number[];
  thumbnailTimestamp?: number | string; // secondes ou "10%", defaut "10%"
  dispatchJob?: (job: VideoThumbnailJob) => Promise<void>;
}

interface VideoThumbnailJob {
  fileName: string;
  sizes: number[];
  thumbnailTimestamp?: number | string;
}

interface VideoThumbnailGeneratedEvent {
  originalFileName: string;
  thumbnailFileName: string;
  requestedSize: number;
  durationMs: number;
  format: ImageFormat;
}

// Ajoute a MediasModuleOptions :
videoThumbnails?: VideoThumbnailOptions;
onVideoThumbnailGenerated?: (event: VideoThumbnailGeneratedEvent) => void;
```

## Serving des thumbnails

Les thumbnails sont des images normales en S3. Aucun code de serving special necessaire : `getMediaStream("clip-thumb-400.webp")` fonctionne deja.

## Degradation gracieuse

Le service verifie la disponibilite de ffmpeg au demarrage (`ffmpeg.getAvailableFormats()`). Si absent : log warning, `generateThumbnailsInline()` retourne silencieusement. Pas de crash.

## Fichiers impactes

| Fichier | Changement |
|---------|-----------|
| `package.json` | + `fluent-ffmpeg`, + `@types/fluent-ffmpeg` |
| `medias.constants.ts` | + constantes thumbnail |
| `interfaces/medias-module-options.interface.ts` | + VideoThumbnailOptions, VideoThumbnailJob, VideoThumbnailGeneratedEvent |
| `services/medias-validation.service.ts` | + `isVideo()`, + `buildThumbnailFileName()` |
| `services/medias-video.service.ts` | **NOUVEAU** |
| `medias.module.ts` | + MediasVideoService dans INTERNAL_SERVICES |
| `medias.service.ts` | + injection, + `isVideo()`, + `triggerVideoThumbnailGeneration()` |
| `src/index.ts` | + export nouveaux types |

## Constantes a ajouter

- `DEFAULT_THUMBNAIL_TIMESTAMP_PERCENT = 10`
- `PERCENTAGE_DIVISOR = 100`
- `THUMBNAIL_FILENAME_INFIX = 'thumb'`
- `FFMPEG_FRAME_COUNT = 1`

## Tests

- `medias-video.service.spec.ts` (nouveau) : mock fluent-ffmpeg, disponibilite, parseTimestamp, extractFrame, generateThumbnailsInline, degradation gracieuse
- `medias.service.spec.ts` (maj) : triggerVideoThumbnailGeneration dispatch/inline
- `medias-validation.service.spec.ts` (maj) : isVideo, buildThumbnailFileName

## Verification

1. `pnpm run build` -- compilation OK
2. `pnpm run lint` -- pas de violations
3. `pnpm run test` -- tous les tests passent
4. Upload video avec `videoThumbnails: { sizes: [200, 400] }` genere les fichiers `-thumb-*` en S3
5. Sans config `videoThumbnails`, aucun thumbnail genere
6. Sans ffmpeg installe, warning log et no-op
