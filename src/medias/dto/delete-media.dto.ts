import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ALL_MEDIA_EXTENSIONS } from '../medias.constants';

/**
 * Zod schema for delete media path parameters with security validation
 */
const DeleteMediaParamsSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
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

export class DeleteMediaParamsDto extends createZodDto(DeleteMediaParamsSchema) {}
