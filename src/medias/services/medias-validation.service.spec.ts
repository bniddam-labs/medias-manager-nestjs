import { Test, TestingModule } from '@nestjs/testing';
import { MEDIAS_MODULE_OPTIONS } from '../medias.constants';
import { MediasLoggerService } from './medias-logger.service';
import { MediasValidationService } from './medias-validation.service';

describe('MediasValidationService', () => {
  let service: MediasValidationService;

  const mockOptions = {
    s3: {
      bucketName: 'test-bucket',
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'test',
      secretKey: 'test',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasValidationService,
        MediasLoggerService,
        {
          provide: MEDIAS_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<MediasValidationService>(MediasValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isVideo', () => {
    it('should return true for video files', () => {
      expect(service.isVideo('video.mp4')).toBe(true);
      expect(service.isVideo('video.webm')).toBe(true);
      expect(service.isVideo('video.mov')).toBe(true);
      expect(service.isVideo('video.avi')).toBe(true);
      expect(service.isVideo('video.mkv')).toBe(true);
      expect(service.isVideo('video.m4v')).toBe(true);
      expect(service.isVideo('video.wmv')).toBe(true);
      expect(service.isVideo('video.flv')).toBe(true);
    });

    it('should return false for non-video files', () => {
      expect(service.isVideo('photo.jpg')).toBe(false);
      expect(service.isVideo('audio.mp3')).toBe(false);
      expect(service.isVideo('document.pdf')).toBe(false);
      expect(service.isVideo('photo.png')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(service.isVideo('video.MP4')).toBe(true);
      expect(service.isVideo('video.MOV')).toBe(true);
    });
  });

  describe('buildThumbnailFileName', () => {
    it('should build thumbnail name for simple file', () => {
      expect(service.buildThumbnailFileName('clip.mp4', 200, '.jpg')).toBe('clip-thumb-200.jpg');
    });

    it('should build thumbnail name with directory', () => {
      expect(service.buildThumbnailFileName('videos/clip.mp4', 400, '.webp')).toBe('videos/clip-thumb-400.webp');
    });

    it('should build thumbnail name with nested directory', () => {
      expect(service.buildThumbnailFileName('a/b/c/clip.mp4', 800, '.avif')).toBe('a/b/c/clip-thumb-800.avif');
    });

    it('should handle different output extensions', () => {
      expect(service.buildThumbnailFileName('clip.mov', 200, '.jpg')).toBe('clip-thumb-200.jpg');
      expect(service.buildThumbnailFileName('clip.avi', 200, '.webp')).toBe('clip-thumb-200.webp');
    });
  });
});
