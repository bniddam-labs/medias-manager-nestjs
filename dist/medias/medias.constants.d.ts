export declare const MEDIAS_MODULE_OPTIONS = "MEDIAS_MODULE_OPTIONS";
export declare const RESIZABLE_IMAGE_EXTENSIONS: string[];
export declare const IMAGE_EXTENSIONS: string[];
export declare const VIDEO_EXTENSIONS: string[];
export declare const AUDIO_EXTENSIONS: string[];
export declare const DOCUMENT_EXTENSIONS: string[];
export declare const ARCHIVE_EXTENSIONS: string[];
export declare const ALL_MEDIA_EXTENSIONS: string[];
export declare const MIME_TYPES: Record<string, string>;
export declare const DEFAULT_MAX_RESIZE_WIDTH = 1200;
export declare const DEFAULT_MAX_ORIGINAL_FILE_SIZE: number;
export declare const SIZE_UNITS: {
    readonly KILOBYTE: 1024;
    readonly MEGABYTE: number;
};
export declare const MAX_FILENAME_LENGTH = 255;
export declare const MAX_RESIZE_WIDTH_LIMIT = 5000;
export declare const HTTP_STATUS: {
    readonly NOT_MODIFIED: 304;
    readonly INTERNAL_SERVER_ERROR: 500;
};
export type ImageFormat = 'original' | 'jpeg' | 'webp' | 'avif';
export declare const IMAGE_QUALITY: {
    readonly JPEG: 85;
    readonly WEBP: 80;
    readonly AVIF: 75;
};
export declare const FORMAT_PRIORITY: Record<ImageFormat, number>;
export declare const RETRY_CONFIG: {
    readonly MAX_ATTEMPTS: 3;
    readonly INITIAL_BACKOFF_MS: 50;
    readonly BACKOFF_MULTIPLIER: 2;
};
export declare const TRANSIENT_S3_ERROR_CODES: string[];
export declare const S3_METADATA_KEYS: {
    readonly WIDTH: "x-amz-meta-width";
    readonly HEIGHT: "x-amz-meta-height";
    readonly MIME_TYPE: "x-amz-meta-mime";
    readonly ORIGINAL_NAME: "x-amz-meta-original-name";
    readonly UPLOADED_AT: "x-amz-meta-uploaded-at";
};
//# sourceMappingURL=medias.constants.d.ts.map