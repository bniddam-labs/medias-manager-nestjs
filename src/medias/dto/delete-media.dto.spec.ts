import { DeleteMediaParamsDto } from './delete-media.dto';
import { ZodValidationPipe, ZodValidationException } from 'nestjs-zod';
import { ArgumentMetadata } from '@nestjs/common';

describe('DeleteMediaParamsDto', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'param',
    metatype: DeleteMediaParamsDto,
    data: '',
  };

  describe('valid file names', () => {
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
    ];

    validFileNames.forEach((fileName) => {
      it(`should accept "${fileName}"`, () => {
        const result = pipe.transform({ fileName }, metadata);
        expect(result.fileName).toBe(fileName);
      });
    });
  });

  describe('invalid file names', () => {
    it('should reject path traversal attempts', () => {
      expect(() => pipe.transform({ fileName: '../etc/passwd.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'folder/../secret.pdf' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject invalid extensions', () => {
      expect(() => pipe.transform({ fileName: 'file.exe' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file.sh' }, metadata)).toThrow(ZodValidationException);
    });

    it('should reject invalid characters', () => {
      expect(() => pipe.transform({ fileName: 'file name.jpg' }, metadata)).toThrow(ZodValidationException);
      expect(() => pipe.transform({ fileName: 'file@name.jpg' }, metadata)).toThrow(ZodValidationException);
    });
  });
});
