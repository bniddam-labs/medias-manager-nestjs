import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MediasService } from './medias.service';
import { MEDIAS_MODULE_OPTIONS } from './medias.constants';
import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';

// Mock sharp module
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized image data')),
  }));
});

describe('MediasService', () => {
  let service: MediasService;

  const mockMinioClient = {
    getObject: jest.fn(),
    statObject: jest.fn(),
    putObject: jest.fn(),
    removeObject: jest.fn(),
  };

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
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasService,
        {
          provide: MinioService,
          useValue: {
            client: mockMinioClient,
          },
        },
        {
          provide: MEDIAS_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<MediasService>(MediasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isImage', () => {
    it('should return true for image files', () => {
      expect(service.isImage('photo.jpg')).toBe(true);
      expect(service.isImage('photo.jpeg')).toBe(true);
      expect(service.isImage('photo.png')).toBe(true);
      expect(service.isImage('photo.gif')).toBe(true);
      expect(service.isImage('photo.webp')).toBe(true);
      expect(service.isImage('photo.svg')).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(service.isImage('video.mp4')).toBe(false);
      expect(service.isImage('audio.mp3')).toBe(false);
      expect(service.isImage('document.pdf')).toBe(false);
    });
  });

  describe('isResizable', () => {
    it('should return true for resizable image files', () => {
      expect(service.isResizable('photo.jpg')).toBe(true);
      expect(service.isResizable('photo.jpeg')).toBe(true);
      expect(service.isResizable('photo.png')).toBe(true);
      expect(service.isResizable('photo.gif')).toBe(true);
      expect(service.isResizable('photo.webp')).toBe(true);
      expect(service.isResizable('photo.avif')).toBe(true);
    });

    it('should return false for non-resizable images', () => {
      expect(service.isResizable('photo.svg')).toBe(false);
      expect(service.isResizable('photo.ico')).toBe(false);
      expect(service.isResizable('photo.bmp')).toBe(false);
    });

    it('should return false for non-image files', () => {
      expect(service.isResizable('video.mp4')).toBe(false);
      expect(service.isResizable('audio.mp3')).toBe(false);
      expect(service.isResizable('document.pdf')).toBe(false);
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types for images', () => {
      expect(service.getMimeType('.jpg')).toBe('image/jpeg');
      expect(service.getMimeType('.jpeg')).toBe('image/jpeg');
      expect(service.getMimeType('.png')).toBe('image/png');
      expect(service.getMimeType('.gif')).toBe('image/gif');
      expect(service.getMimeType('.webp')).toBe('image/webp');
    });

    it('should return correct MIME types for videos', () => {
      expect(service.getMimeType('.mp4')).toBe('video/mp4');
      expect(service.getMimeType('.webm')).toBe('video/webm');
      expect(service.getMimeType('.mov')).toBe('video/quicktime');
    });

    it('should return correct MIME types for audio', () => {
      expect(service.getMimeType('.mp3')).toBe('audio/mpeg');
      expect(service.getMimeType('.wav')).toBe('audio/wav');
      expect(service.getMimeType('.flac')).toBe('audio/flac');
    });

    it('should return correct MIME types for documents', () => {
      expect(service.getMimeType('.pdf')).toBe('application/pdf');
      expect(service.getMimeType('.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(service.getMimeType('.xyz')).toBe('application/octet-stream');
    });

    it('should be case-insensitive', () => {
      expect(service.getMimeType('.JPG')).toBe('image/jpeg');
      expect(service.getMimeType('.MP4')).toBe('video/mp4');
    });
  });

  describe('getMediaStream', () => {
    it('should return stream with metadata', async () => {
      const mockStream = new Readable({ read() {} });
      const mockStat = {
        size: 1000,
        lastModified: new Date('2024-01-01'),
        etag: 'abc123',
        metaData: {},
      };

      mockMinioClient.statObject.mockResolvedValue(mockStat);
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getMediaStream('test.mp4');

      expect(result.stream).toBe(mockStream);
      expect(result.mimeType).toBe('video/mp4');
      expect(result.size).toBe(1000);
      expect(result.notModified).toBe(false);
    });

    it('should return notModified when ETag matches', async () => {
      const mockStat = {
        size: 1000,
        lastModified: new Date('2024-01-01'),
        etag: 'abc123',
        metaData: {},
      };

      mockMinioClient.statObject.mockResolvedValue(mockStat);

      const etag = service.generateETag('test.mp4', mockStat.lastModified, mockStat.size);
      const result = await service.getMediaStream('test.mp4', etag);

      expect(result.notModified).toBe(true);
    });
  });

  describe('getResizedImage', () => {
    it('should throw BadRequestException for non-image files', async () => {
      await expect(service.getResizedImage('video.mp4', 300)).rejects.toThrow(BadRequestException);
      await expect(service.getResizedImage('audio.mp3', 300)).rejects.toThrow(BadRequestException);
      await expect(service.getResizedImage('document.pdf', 300)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-resizable images', async () => {
      await expect(service.getResizedImage('icon.svg', 300)).rejects.toThrow(BadRequestException);
      await expect(service.getResizedImage('icon.ico', 300)).rejects.toThrow(BadRequestException);
    });

    it('should resize and return buffer for valid images', async () => {
      const mockStream = new Readable({
        read() {
          this.push(Buffer.from('image data'));
          this.push(null);
        },
      });

      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found')); // No cached version
      mockMinioClient.getObject.mockResolvedValue(mockStream);
      mockMinioClient.putObject.mockResolvedValue({});

      const result = await service.getResizedImage('photo.jpg', 300);

      expect(result.buffer).toBeDefined();
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.notModified).toBe(false);
    });

    it('should return cached version if available', async () => {
      const cachedBuffer = Buffer.from('cached image');
      const mockStat = {
        size: cachedBuffer.length,
        lastModified: new Date('2024-01-01'),
        etag: 'cached-etag',
        metaData: {},
      };

      const mockStream = new Readable({
        read() {
          this.push(cachedBuffer);
          this.push(null);
        },
      });

      mockMinioClient.statObject.mockResolvedValue(mockStat);
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getResizedImage('photo.jpg', 300);

      expect(result.buffer.toString()).toBe('cached image');
      expect(result.notModified).toBe(false);
    });

    it('should throw BadRequestException when size exceeds max', async () => {
      await expect(service.getResizedImage('photo.jpg', 10000)).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadMedia', () => {
    it('should upload file to S3', async () => {
      mockMinioClient.putObject.mockResolvedValue({});

      await service.uploadMedia('test.pdf', Buffer.from('content'));

      expect(mockMinioClient.putObject).toHaveBeenCalledWith('test-bucket', 'test.pdf', Buffer.from('content'));
    });
  });

  describe('deleteMedia', () => {
    it('should delete file from S3', async () => {
      mockMinioClient.removeObject.mockResolvedValue({});

      await service.deleteMedia('test.pdf');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'test.pdf');
    });
  });

  describe('getImageStream', () => {
    it('should throw BadRequestException for non-image files', async () => {
      await expect(service.getImageStream('video.mp4')).rejects.toThrow(BadRequestException);
    });

    it('should return stream for image files', async () => {
      const mockStream = new Readable({ read() {} });
      const mockStat = {
        size: 1000,
        lastModified: new Date('2024-01-01'),
        etag: 'abc123',
        metaData: {},
      };

      mockMinioClient.statObject.mockResolvedValue(mockStat);
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getImageStream('photo.jpg');

      expect(result.stream).toBe(mockStream);
      expect(result.mimeType).toBe('image/jpeg');
    });
  });
});
