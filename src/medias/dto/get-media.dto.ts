import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ALL_MEDIA_EXTENSIONS, MAX_FILENAME_LENGTH, MAX_RESIZE_WIDTH_LIMIT } from '../medias.constants';

/**
 * Zod schema for media file path parameters with security validation
 * Accepts all supported media types
 */
const GetMediaParamsSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(MAX_FILENAME_LENGTH, 'File name is too long')
    .refine(
      (val) => {
        // Prevent path traversal attacks
        const sanitized = val.replace(/\\/g, '/');
        return !sanitized.includes('../') && !sanitized.includes('/..') && !sanitized.startsWith('/');
      },
      {
        message: 'Invalid file name - path traversal detected',
      },
    )
    .refine(
      (val) => {
        // Ensure valid file extension
        const ext = val.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
        return ext ? ALL_MEDIA_EXTENSIONS.includes(ext) : false;
      },
      {
        message: `Invalid file extension - allowed extensions: ${ALL_MEDIA_EXTENSIONS.join(', ')}`,
      },
    )
    .refine(
      (val) => {
        // Allow alphanumeric, hyphens, underscores, dots, and forward slashes for folder paths
        return /^[a-zA-Z0-9._/-]+$/.test(val);
      },
      {
        message: 'File name contains invalid characters',
      },
    ),
});

/**
 * Zod schema for optional size query parameter (for image resizing)
 */
const GetMediaQuerySchema = z.object({
  size: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0 && num <= MAX_RESIZE_WIDTH_LIMIT;
      },
      {
        message: `Size must be a positive integer between 1 and ${MAX_RESIZE_WIDTH_LIMIT}`,
      },
    ),
});

export class GetMediaParamsDto extends createZodDto(GetMediaParamsSchema) {}
export class GetMediaQueryDto extends createZodDto(GetMediaQuerySchema) {}
