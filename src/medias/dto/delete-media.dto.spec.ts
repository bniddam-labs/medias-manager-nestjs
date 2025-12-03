import { DeleteMediaParamsDto, DeleteMediaParamsLooseDto, createDeleteMediaParamsSchema } from './delete-media.dto';
import { ZodValidationPipe, ZodValidationException } from 'nestjs-zod';
import { ArgumentMetadata } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';

describe('DeleteMediaParamsDto (strict mode - default)', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'param',
    metatype: DeleteMediaParamsDto,
    data: '',
  };

  describe('valid file names in strict mode', () => {
    const validFileNames = [
      // Images
      'photo.jpg',
      'photo.png',
      // Videos
      'video.mp4',
      'video.webm',
      // Audio
      'audio.mp3',
      'audio.wav',
      // Documents
      'document.pdf',
      'document.docx',
      // With folders
      'folder/photo.jpg',
      'folder/subfolder/video.mp4',
      // With special naming
      'my-file_v1.pdf',
      'image123.png',
    ];

    validFileNames.forEach((fileName) => {
      it(`should accept "${fileName}"`, () => {
        const result = pipe.transform({ fileName }, metadata);
        expect(result.fileName).toBe(fileName);
      });
    });
  });

  describe('invalid file names in strict mode', () => {
    it('should reject path traversal attempts', () => {
      expect(() => pipe.transform({ fileName: '../etc/passwd.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'folder/../secret.pdf' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject invalid extensions', () => {
      expect(() => pipe.transform({ fileName: 'file.exe' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file.sh' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject special characters in strict mode', () => {
      // These are rejected in strict mode (whitelist approach)
      expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file@name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: "file's (copy).jpg" }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file–name.jpg' }, metadata)).toThrow(ZodValidationException); // Unicode dash
    });
  });
});

describe('DeleteMediaParamsLooseDto (loose mode)', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'param',
    metatype: DeleteMediaParamsLooseDto,
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
      "file's (copy).jpg",
      'file–name.jpg', // Unicode dash
    ];

    validFileNames.forEach((fileName) => {
      it(`should accept "${fileName}"`, () => {
        const result = pipe.transform({ fileName }, metadata);
        expect(result.fileName).toBe(fileName);
      });
    });
  });

  describe('invalid file names in loose mode', () => {
    it('should reject path traversal attempts', () => {
      expect(() => pipe.transform({ fileName: '../etc/passwd.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'folder/../secret.pdf' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject invalid extensions', () => {
      expect(() => pipe.transform({ fileName: 'file.exe' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file.sh' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject control characters', () => {
      // Control characters are still rejected in loose mode
      expect(() => pipe.transform({ fileName: 'file\x00name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file\nname.jpg' }, metadata)).toThrow(ZodValidationException);
    });
  });
});

describe('createDeleteMediaParamsSchema factory', () => {
  const pipe = new ZodValidationPipe();

  it('should create strict schema by default', () => {
    const StrictDto = createZodDto(createDeleteMediaParamsSchema());
    const metadata: ArgumentMetadata = { type: 'param', metatype: StrictDto, data: '' };

    expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
    expect(() => pipe.transform({ fileName: 'valid-file.jpg' }, metadata)).not.toThrow();
  });

  it('should create strict schema when strict=true', () => {
    const StrictDto = createZodDto(createDeleteMediaParamsSchema(true));
    const metadata: ArgumentMetadata = { type: 'param', metatype: StrictDto, data: '' };

    expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
  });

  it('should create loose schema when strict=false', () => {
    const LooseDto = createZodDto(createDeleteMediaParamsSchema(false));
    const metadata: ArgumentMetadata = { type: 'param', metatype: LooseDto, data: '' };

    expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).not.toThrow();
    expect(() => pipe.transform({ fileName: 'file\x00name.jpg' }, metadata)).toThrow(ZodValidationException);
  });
});
