import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ALL_MEDIA_EXTENSIONS, MAX_FILENAME_LENGTH } from '../medias.constants';

/**
 * Common validation refinements for file names (security-critical, always applied)
 */
const commonFileNameRefinements = (schema: z.ZodString) =>
  schema
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
    );

/**
 * Strict filename validation (whitelist approach - default)
 * Only allows: a-z, A-Z, 0-9, dots, hyphens, underscores, forward slashes
 */
const strictFilenameRefinement = (val: string) => /^[a-zA-Z0-9._/-]+$/.test(val);

/**
 * Loose filename validation (blacklist approach)
 * Blocks only control characters (0x00-0x1F)
 * Allows: spaces, parentheses, apostrophes, Unicode, etc.
 */
// eslint-disable-next-line no-control-regex
const looseFilenameRefinement = (val: string) => !/[\x00-\x1F]/.test(val);

/**
 * Create a DeleteMediaParams schema with configurable strictness
 * @param strict - When true (default), uses whitelist validation. When false, uses blacklist (loose) validation.
 */
export const createDeleteMediaParamsSchema = (strict = true) =>
  z.object({
    fileName: commonFileNameRefinements(z.string()).refine(strict ? strictFilenameRefinement : looseFilenameRefinement, {
      message: strict ? 'File name contains invalid characters - only alphanumeric, dots, hyphens, underscores, and slashes are allowed' : 'File name contains invalid control characters',
    }),
  });

/**
 * Zod schema for delete media path parameters with strict security validation (default)
 * Uses whitelist approach - only alphanumeric, dots, hyphens, underscores, and slashes are allowed.
 * Security checks (path traversal, extensions) are always applied.
 *
 * For loose mode validation (backward compatibility with existing S3 files),
 * use createDeleteMediaParamsSchema(false) or DeleteMediaParamsLooseDto
 */
const DeleteMediaParamsSchema = createDeleteMediaParamsSchema(true);

/**
 * Loose mode schema for backward compatibility with existing S3 files
 * Accepts Unicode, spaces, parentheses, etc.
 */
const DeleteMediaParamsLooseSchema = createDeleteMediaParamsSchema(false);

/** Strict mode DTO (default) - only alphanumeric, dots, hyphens, underscores, slashes */
export class DeleteMediaParamsDto extends createZodDto(DeleteMediaParamsSchema) {}

/** Loose mode DTO - accepts Unicode, spaces, parentheses, etc. */
export class DeleteMediaParamsLooseDto extends createZodDto(DeleteMediaParamsLooseSchema) {}
