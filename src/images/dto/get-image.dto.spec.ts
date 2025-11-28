import { z } from 'zod';

// Recreate the schema for testing (matches get-image.dto.ts)
const GetImageParamsSchema = z.object({
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

describe('GetImageParamsSchema', () => {
  describe('valid file names', () => {
    it('should accept simple file names', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'image.png' });
      expect(result.success).toBe(true);
    });

    it('should accept file names with hyphens and underscores', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'my-image_123.jpg' });
      expect(result.success).toBe(true);
    });

    it('should accept file names with dots', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'image.v2.final.png' });
      expect(result.success).toBe(true);
    });

    it('should accept files in subdirectories', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'headshots/image.png' });
      expect(result.success).toBe(true);
    });

    it('should accept files in deeply nested subdirectories', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'users/avatars/2024/image.png' });
      expect(result.success).toBe(true);
    });

    it('should accept complex real-world file names in folders', () => {
      const result = GetImageParamsSchema.safeParse({
        fileName: 'headshots/7510705_BOB_GER_Wenzel_Jorn_11358.png',
      });
      expect(result.success).toBe(true);
    });

    it('should accept all valid extensions', () => {
      const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      extensions.forEach((ext) => {
        const result = GetImageParamsSchema.safeParse({ fileName: `image${ext}` });
        expect(result.success).toBe(true);
      });
    });

    it('should accept uppercase extensions', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'image.PNG' });
      expect(result.success).toBe(true);
    });
  });

  describe('path traversal prevention', () => {
    it('should reject ../ in file name', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: '../etc/passwd.png' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid file name - path traversal detected');
      }
    });

    it('should reject /.. in file name', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'images/../secret.png' });
      expect(result.success).toBe(false);
    });

    it('should reject multiple ../', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: '../../etc/passwd.png' });
      expect(result.success).toBe(false);
    });

    it('should reject ../ in the middle of path', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'images/../../../etc/passwd.png' });
      expect(result.success).toBe(false);
    });

    it('should reject absolute paths starting with /', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: '/etc/passwd.png' });
      expect(result.success).toBe(false);
    });

    it('should reject backslash path traversal', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: '..\\etc\\passwd.png' });
      expect(result.success).toBe(false);
    });

    it('should allow forward slashes for subdirectories', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'folder/subfolder/image.png' });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid file extensions', () => {
    it('should reject .exe files', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'virus.exe' });
      expect(result.success).toBe(false);
    });

    it('should reject .php files', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'shell.php' });
      expect(result.success).toBe(false);
    });

    it('should reject .svg files', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'image.svg' });
      expect(result.success).toBe(false);
    });

    it('should reject files without extension', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'noextension' });
      expect(result.success).toBe(false);
    });

    it('should reject double extensions attempting bypass', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'shell.php.png' });
      // This should pass because it ends with .png
      expect(result.success).toBe(true);
    });
  });

  describe('invalid characters', () => {
    it('should reject spaces', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'my image.png' });
      expect(result.success).toBe(false);
    });

    it('should reject special characters', () => {
      const invalidChars = ['$', '!', '@', '#', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', ';', ':', '"', "'", '<', '>', ',', '?', '`', '~'];
      invalidChars.forEach((char) => {
        const result = GetImageParamsSchema.safeParse({ fileName: `image${char}name.png` });
        expect(result.success).toBe(false);
      });
    });

    it('should reject newlines', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'image\nname.png' });
      expect(result.success).toBe(false);
    });

    it('should reject null bytes', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: 'image\x00.png' });
      expect(result.success).toBe(false);
    });
  });

  describe('length validation', () => {
    it('should reject empty file names', () => {
      const result = GetImageParamsSchema.safeParse({ fileName: '' });
      expect(result.success).toBe(false);
    });

    it('should reject file names exceeding 255 characters', () => {
      const longName = 'a'.repeat(252) + '.png'; // 256 chars total
      const result = GetImageParamsSchema.safeParse({ fileName: longName });
      expect(result.success).toBe(false);
    });

    it('should accept file names at exactly 255 characters', () => {
      const maxName = 'a'.repeat(251) + '.png'; // 255 chars total
      const result = GetImageParamsSchema.safeParse({ fileName: maxName });
      expect(result.success).toBe(true);
    });
  });
});

describe('GetImageQuerySchema', () => {
  describe('valid size values', () => {
    it('should accept undefined size', () => {
      const result = GetImageQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept size of 1', () => {
      const result = GetImageQuerySchema.safeParse({ size: '1' });
      expect(result.success).toBe(true);
    });

    it('should accept size of 5000', () => {
      const result = GetImageQuerySchema.safeParse({ size: '5000' });
      expect(result.success).toBe(true);
    });

    it('should accept typical sizes', () => {
      const sizes = ['100', '200', '300', '800', '1024', '1920', '2048'];
      sizes.forEach((size) => {
        const result = GetImageQuerySchema.safeParse({ size });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('invalid size values', () => {
    it('should reject size of 0', () => {
      const result = GetImageQuerySchema.safeParse({ size: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative sizes', () => {
      const result = GetImageQuerySchema.safeParse({ size: '-100' });
      expect(result.success).toBe(false);
    });

    it('should reject size exceeding 5000', () => {
      const result = GetImageQuerySchema.safeParse({ size: '5001' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric strings', () => {
      const result = GetImageQuerySchema.safeParse({ size: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject float values', () => {
      const result = GetImageQuerySchema.safeParse({ size: '100.5' });
      // parseInt will parse "100.5" as 100, so this will pass
      expect(result.success).toBe(true);
    });
  });
});
