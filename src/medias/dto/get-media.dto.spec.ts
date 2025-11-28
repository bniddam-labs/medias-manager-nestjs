import { GetMediaParamsDto, GetMediaQueryDto } from './get-media.dto';
import { ZodValidationPipe, ZodValidationException } from 'nestjs-zod';
import { ArgumentMetadata } from '@nestjs/common';

describe('GetMediaParamsDto', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'param',
    metatype: GetMediaParamsDto,
    data: '',
  };

  describe('valid file names', () => {
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

  describe('invalid file names', () => {
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

    it('should reject invalid characters', () => {
      expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file@name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file#name.jpg' }, metadata)).toThrow(ZodValidationException);
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
