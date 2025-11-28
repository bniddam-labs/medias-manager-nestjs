import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Zod schema for query parameters
const GetImageQuerySchema = z.object({
  size: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0 && num <= 5000;
      },
      {
        message: 'Size must be a positive integer between 1 and 5000',
      },
    ),
});

// Zod schema for path parameters with security validation
const GetImageParamsSchema = z.object({
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
        // Allow alphanumeric, hyphens, underscores, dots, and forward slashes for folder paths
        return /^[a-zA-Z0-9._/-]+$/.test(val);
      },
      {
        message: 'File name contains invalid characters',
      },
    ),
});

// Create DTOs from Zod schemas
export class GetImageQueryDto extends createZodDto(GetImageQuerySchema) {}
export class GetImageParamsDto extends createZodDto(GetImageParamsSchema) {}
