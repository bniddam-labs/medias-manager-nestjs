import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Zod schema for delete path parameters with security validation
const DeleteImageParamsSchema = z.object({
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
        const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        return validExtensions.some((ext) => val.toLowerCase().endsWith(ext));
      },
      {
        message: 'Invalid file extension - only .png, .jpg, .jpeg, .gif, .webp are allowed',
      },
    )
    .refine(
      (val) => {
        // Only allow alphanumeric, hyphens, underscores, and dots
        return /^[a-zA-Z0-9._-]+$/.test(val);
      },
      {
        message: 'File name contains invalid characters',
      },
    ),
});

// Create DTO from Zod schema
export class DeleteImageParamsDto extends createZodDto(DeleteImageParamsSchema) {}
