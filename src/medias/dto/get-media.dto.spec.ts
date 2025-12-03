import { GetMediaParamsDto, GetMediaParamsLooseDto, GetMediaQueryDto, createGetMediaParamsSchema } from './get-media.dto';
import { ZodValidationPipe, ZodValidationException } from 'nestjs-zod';
import { ArgumentMetadata } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';

describe('GetMediaParamsDto (strict mode - default)', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'param',
    metatype: GetMediaParamsDto,
    data: '',
  };

  describe('valid file names in strict mode', () => {
    const validFileNames = [
      // Images
      'photo.jpg',
      'photo.jpeg',
      'photo.png',
      'photo.gif',
      'photo.webp',
      'photo.svg',
      'photo.avif',
      // Videos
      'video.mp4',
      'video.webm',
      'video.mov',
      'video.avi',
      'video.mkv',
      // Audio
      'audio.mp3',
      'audio.wav',
      'audio.flac',
      'audio.aac',
      // Documents
      'document.pdf',
      'document.docx',
      'document.xlsx',
      // With folders
      'folder/photo.jpg',
      'folder/subfolder/video.mp4',
      // With special naming
      'my-file_v1.pdf',
      'image123.png',
    ];

    validFileNames.forEach((fileName) => {
      it(`should accept "${fileName}"`, async () => {
        const result = await pipe.transform({ fileName }, metadata);
        expect(result.fileName).toBe(fileName);
      });
    });
  });

  describe('invalid file names in strict mode', () => {
    it('should reject path traversal attempts', () => {
      expect(() => pipe.transform({ fileName: '../etc/passwd.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'folder/../secret.pdf' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: '/absolute/path.mp4' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject invalid extensions', () => {
      expect(() => pipe.transform({ fileName: 'file.exe' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file.sh' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file.bat' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject special characters in strict mode', () => {
      // These are rejected in strict mode (whitelist approach)
      expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file@name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file#name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: "file's (copy).jpg" }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file–name.jpg' }, metadata)).toThrow(ZodValidationException); // Unicode dash
    });

    it('should reject empty file names', () => {
      expect(() => pipe.transform({ fileName: '' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject file names that are too long', () => {
      const longFileName = 'a'.repeat(256) + '.jpg';
      expect(() => pipe.transform({ fileName: longFileName }, metadata)).toThrow(ZodValidationException);
    });
  });
});

describe('GetMediaParamsLooseDto (loose mode)', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'param',
    metatype: GetMediaParamsLooseDto,
    data: '',
  };

  describe('valid file names in loose mode', () => {
    const validFileNames = [
      // Basic file names
      'photo.jpg',
      'my-file_v1.pdf',
      'folder/photo.jpg',
      // Special characters (allowed in loose mode)
      'file name.jpg',
      'file@name.jpg',
      'file#name.jpg',
      "file's (copy).jpg",
      'file–name.jpg', // Unicode dash
    ];

    validFileNames.forEach((fileName) => {
      it(`should accept "${fileName}"`, async () => {
        const result = await pipe.transform({ fileName }, metadata);
        expect(result.fileName).toBe(fileName);
      });
    });
  });

  describe('invalid file names in loose mode', () => {
    it('should reject path traversal attempts', () => {
      expect(() => pipe.transform({ fileName: '../etc/passwd.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'folder/../secret.pdf' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: '/absolute/path.mp4' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject invalid extensions', () => {
      expect(() => pipe.transform({ fileName: 'file.exe' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject control characters', () => {
      // Control characters are still rejected in loose mode
      expect(() => pipe.transform({ fileName: 'file\x00name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file\x01name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file\nname.jpg' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject empty file names', () => {
      expect(() => pipe.transform({ fileName: '' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject file names that are too long', () => {
      const longFileName = 'a'.repeat(256) + '.jpg';
      expect(() => pipe.transform({ fileName: longFileName }, metadata)).toThrow(ZodValidationException);
    });
  });
});

describe('createGetMediaParamsSchema factory', () => {
  const pipe = new ZodValidationPipe();

  it('should create strict schema by default', () => {
    const StrictDto = createZodDto(createGetMediaParamsSchema());
    const metadata: ArgumentMetadata = { type: 'param', metatype: StrictDto, data: '' };

    expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
    expect(() => pipe.transform({ fileName: 'valid-file.jpg' }, metadata)).not.toThrow();
  });

  it('should create strict schema when strict=true', () => {
    const StrictDto = createZodDto(createGetMediaParamsSchema(true));
    const metadata: ArgumentMetadata = { type: 'param', metatype: StrictDto, data: '' };

    expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
  });

  it('should create loose schema when strict=false', () => {
    const LooseDto = createZodDto(createGetMediaParamsSchema(false));
    const metadata: ArgumentMetadata = { type: 'param', metatype: LooseDto, data: '' };

    expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).not.toThrow();
    expect(() => pipe.transform({ fileName: 'file\x00name.jpg' }, metadata)).toThrow(ZodValidationException);
  });
});

describe('GetMediaQueryDto', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: GetMediaQueryDto,
    data: '',
  };

  describe('size parameter', () => {
    it('should accept valid sizes', () => {
      expect(pipe.transform({ size: '100' }, metadata).size).toBe('100');
      expect(pipe.transform({ size: '1' }, metadata).size).toBe('1');
      expect(pipe.transform({ size: '5000' }, metadata).size).toBe('5000');
    });

    it('should accept undefined size', () => {
      const result = pipe.transform({}, metadata);
      expect(result.size).toBeUndefined();
    });

    it('should reject invalid sizes', () => {
      expect(() => pipe.transform({ size: '0' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ size: '-100' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ size: '5001' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ size: 'abc' }, metadata)).toThrow(ZodValidationException);
    });
  });
});
