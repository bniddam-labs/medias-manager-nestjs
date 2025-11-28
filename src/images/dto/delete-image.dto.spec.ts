import { z } from 'zod';

// Recreate the schema for testing (matches delete-image.dto.ts)
const DeleteImageParamsSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
    .refine(
      (val) => {
        const sanitized = val.replace(/\\/g, '/');
        return !sanitized.includes('../') && !sanitized.includes('/..') && !sanitized.startsWith('/');
      },
      {
        message: 'Invalid file name - path traversal detected',
      },
    )
    .refine(
      (val) => {
        const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        return validExtensions.some((ext) => val.toLowerCase().endsWith(ext));
      },
      {
        message: 'Invalid file extension - only .png, .jpg, .jpeg, .gif, .webp are allowed',
      },
    )
    .refine(
      (val) => {
        return /^[a-zA-Z0-9._/-]+$/.test(val);
      },
      {
        message: 'File name contains invalid characters',
      },
    ),
});

describe('DeleteImageParamsSchema', () => {
  describe('valid file names', () => {
    it('should accept simple file names', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: 'image.png' });
      expect(result.success).toBe(true);
    });

    it('should accept files in subdirectories', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: 'headshots/image.png' });
      expect(result.success).toBe(true);
    });

    it('should accept files in deeply nested subdirectories', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: 'users/avatars/2024/image.png' });
      expect(result.success).toBe(true);
    });

    it('should accept complex real-world file names in folders', () => {
      const result = DeleteImageParamsSchema.safeParse({
        fileName: 'headshots/7510705_BOB_GER_Wenzel_Jorn_11358.png',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('path traversal prevention', () => {
    it('should reject ../ in file name', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: '../etc/passwd.png' });
      expect(result.success).toBe(false);
    });

    it('should reject /.. in file name', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: 'images/../secret.png' });
      expect(result.success).toBe(false);
    });

    it('should reject absolute paths starting with /', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: '/etc/passwd.png' });
      expect(result.success).toBe(false);
    });

    it('should reject backslash path traversal', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: '..\\etc\\passwd.png' });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid file extensions', () => {
    it('should reject non-image files', () => {
      const result = DeleteImageParamsSchema.safeParse({ fileName: 'script.js' });
      expect(result.success).toBe(false);
    });
  });
});
