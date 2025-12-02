import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MediasService } from './medias.service';
import { MEDIAS_MODULE_OPTIONS } from './medias.constants';
import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';
import { MediasLoggerService, MediasStorageService, MediasValidationService, MediasResizeService } from './services';

// Mock sharp module
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized image data')),
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
    }),
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
        MediasLoggerService,
        MediasStorageService,
        MediasValidationService,
        MediasResizeService,
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

      // First call: check original file size (succeeds)
      mockMinioClient.statObject.mockResolvedValueOnce({
        size: 1024 * 1024, // 1MB, under the default 15MB limit
        lastModified: new Date('2024-01-01'),
        etag: 'original-etag',
        metaData: {},
      });
      // Second call: check for cached version (not found)
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));
      mockMinioClient.getObject.mockResolvedValue(mockStream);
      mockMinioClient.putObject.mockResolvedValue({});

      const result = await service.getResizedImage('photo.jpg', 300);

      expect(result.buffer).toBeDefined();
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.notModified).toBe(false);
    });

    it('should return cached version if available', async () => {
      const cachedBuffer = Buffer.from('cached image');
      const mockOriginalStat = {
        size: 1024 * 1024, // 1MB, under the default 15MB limit
        lastModified: new Date('2024-01-01'),
        etag: 'original-etag',
        metaData: {},
      };
      const mockCachedStat = {
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

      // First call: check original file size (succeeds)
      mockMinioClient.statObject.mockResolvedValueOnce(mockOriginalStat);
      // Second call: check for cached version (succeeds)
      mockMinioClient.statObject.mockResolvedValueOnce(mockCachedStat);
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getResizedImage('photo.jpg', 300);

      expect(result.buffer.toString()).toBe('cached image');
      expect(result.notModified).toBe(false);
    });

    it('should throw BadRequestException when size exceeds max', async () => {
      await expect(service.getResizedImage('photo.jpg', 10000)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when original file size exceeds maxOriginalFileSize', async () => {
      const hugeFileSize = 20 * 1024 * 1024; // 20MB, exceeds default 15MB limit
      mockMinioClient.statObject.mockResolvedValueOnce({
        size: hugeFileSize,
        lastModified: new Date('2024-01-01'),
        etag: 'huge-file-etag',
        metaData: {},
      });

      await expect(service.getResizedImage('huge-photo.jpg', 300)).rejects.toThrow(
        /Image too large to resize on-the-fly/,
      );
    });

    it('should prevent upscaling when autoPreventUpscale is true (default)', async () => {
      const smallImageWidth = 200; // Original image is 200px wide
      const requestedSize = 500; // User requests 500px wide

      const mockStream = new Readable({
        read() {
          this.push(Buffer.from('small image data'));
          this.push(null);
        },
      });

      // Mock resize spy to track calls
      const resizeSpy = jest.fn().mockReturnThis();
      const toBufferSpy = jest.fn().mockResolvedValue(Buffer.from('resized image data'));
      const metadataSpy = jest.fn().mockResolvedValue({
        width: smallImageWidth,
        height: 150,
        format: 'jpeg',
      });

      // Mock Sharp for this test - need to mock twice (once for metadata, once for resize)
      const sharpMock = require('sharp');
      // First call: for metadata
      sharpMock.mockImplementationOnce(() => ({
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('temp')),
        metadata: metadataSpy,
      }));
      // Second call: for actual resize
      sharpMock.mockImplementationOnce(() => ({
        resize: resizeSpy,
        toBuffer: toBufferSpy,
        metadata: jest.fn(),
      }));

      // Check original file size (succeeds)
      mockMinioClient.statObject.mockResolvedValueOnce({
        size: 1024 * 100, // 100KB
        lastModified: new Date('2024-01-01'),
        etag: 'small-etag',
        metaData: {},
      });
      // Check for cached version (not found)
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));
      mockMinioClient.getObject.mockResolvedValue(mockStream);
      mockMinioClient.putObject.mockResolvedValue({});

      const result = await service.getResizedImage('small-photo.jpg', requestedSize);

      expect(result.buffer).toBeDefined();
      // The service should have called resize with the original width (200), not the requested size (500)
      expect(resizeSpy).toHaveBeenCalledWith(smallImageWidth);
      expect(resizeSpy).not.toHaveBeenCalledWith(requestedSize);
    });

    it('should allow upscaling when autoPreventUpscale is false', async () => {
      // Create a new service instance with autoPreventUpscale disabled
      const moduleWithUpscaleAllowed: TestingModule = await Test.createTestingModule({
        providers: [
          MediasService,
          MediasLoggerService,
          MediasStorageService,
          MediasValidationService,
          MediasResizeService,
          {
            provide: MinioService,
            useValue: {
              client: mockMinioClient,
            },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: {
              ...mockOptions,
              autoPreventUpscale: false, // Disable upscale prevention
            },
          },
        ],
      }).compile();

      const serviceWithUpscale = moduleWithUpscaleAllowed.get<MediasService>(MediasService);

      const smallImageWidth = 200;
      const requestedSize = 500;

      const mockStream = new Readable({
        read() {
          this.push(Buffer.from('small image data'));
          this.push(null);
        },
      });

      // Mock resize spy to track calls
      const resizeSpy = jest.fn().mockReturnThis();
      const toBufferSpy = jest.fn().mockResolvedValue(Buffer.from('upscaled image data'));
      const metadataSpy = jest.fn().mockResolvedValue({
        width: smallImageWidth,
        height: 150,
        format: 'jpeg',
      });

      // Mock Sharp for this test - only need one call since autoPreventUpscale is false
      // (no metadata check needed)
      const sharpMock = require('sharp');
      sharpMock.mockImplementationOnce(() => ({
        resize: resizeSpy,
        toBuffer: toBufferSpy,
        metadata: metadataSpy,
      }));

      // Check original file size (succeeds)
      mockMinioClient.statObject.mockResolvedValueOnce({
        size: 1024 * 100, // 100KB
        lastModified: new Date('2024-01-01'),
        etag: 'small-etag',
        metaData: {},
      });
      // Check for cached version (not found)
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));
      mockMinioClient.getObject.mockResolvedValue(mockStream);
      mockMinioClient.putObject.mockResolvedValue({});

      const result = await serviceWithUpscale.getResizedImage('small-photo.jpg', requestedSize);

      expect(result.buffer).toBeDefined();
      // The service should have called resize with the requested size (500), not the original width (200)
      expect(resizeSpy).toHaveBeenCalledWith(requestedSize);
      expect(resizeSpy).not.toHaveBeenCalledWith(smallImageWidth);
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
