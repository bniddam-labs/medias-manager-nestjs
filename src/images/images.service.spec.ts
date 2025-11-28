import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ImagesService } from './images.service';
import { IMAGES_MODULE_OPTIONS } from './images.constants';
import { MinioService } from 'nestjs-minio-client';
import { Readable } from 'stream';

// Mock sharp module
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized image data')),
  }));
});

describe('ImagesService', () => {
  let service: ImagesService;

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
        ImagesService,
        {
          provide: MinioService,
          useValue: {
            client: mockMinioClient,
          },
        },
        {
          provide: IMAGES_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for .png', () => {
      expect(service.getMimeType('.png')).toBe('image/png');
    });

    it('should return correct MIME type for .jpg', () => {
      expect(service.getMimeType('.jpg')).toBe('image/jpeg');
    });

    it('should return correct MIME type for .jpeg', () => {
      expect(service.getMimeType('.jpeg')).toBe('image/jpeg');
    });

    it('should return correct MIME type for .gif', () => {
      expect(service.getMimeType('.gif')).toBe('image/gif');
    });

    it('should return correct MIME type for .webp', () => {
      expect(service.getMimeType('.webp')).toBe('image/webp');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(service.getMimeType('.xyz')).toBe('application/octet-stream');
    });

    it('should be case-insensitive', () => {
      expect(service.getMimeType('.PNG')).toBe('image/png');
      expect(service.getMimeType('.JPG')).toBe('image/jpeg');
    });
  });

  describe('generateETag', () => {
    it('should generate consistent ETags for same input', () => {
      const date = new Date('2024-01-01');
      const etag1 = service.generateETag('test.png', date, 1024);
      const etag2 = service.generateETag('test.png', date, 1024);
      expect(etag1).toBe(etag2);
    });

    it('should generate different ETags for different files', () => {
      const date = new Date('2024-01-01');
      const etag1 = service.generateETag('test1.png', date, 1024);
      const etag2 = service.generateETag('test2.png', date, 1024);
      expect(etag1).not.toBe(etag2);
    });

    it('should generate different ETags for different sizes', () => {
      const date = new Date('2024-01-01');
      const etag1 = service.generateETag('test.png', date, 1024);
      const etag2 = service.generateETag('test.png', date, 2048);
      expect(etag1).not.toBe(etag2);
    });

    it('should wrap ETag in quotes', () => {
      const etag = service.generateETag('test.png', new Date(), 1024);
      expect(etag).toMatch(/^".*"$/);
    });
  });

  describe('generateETagFromBuffer', () => {
    it('should generate consistent ETags for same buffer', () => {
      const buffer = Buffer.from('test data');
      const etag1 = service.generateETagFromBuffer(buffer);
      const etag2 = service.generateETagFromBuffer(buffer);
      expect(etag1).toBe(etag2);
    });

    it('should generate different ETags for different buffers', () => {
      const buffer1 = Buffer.from('test data 1');
      const buffer2 = Buffer.from('test data 2');
      const etag1 = service.generateETagFromBuffer(buffer1);
      const etag2 = service.generateETagFromBuffer(buffer2);
      expect(etag1).not.toBe(etag2);
    });
  });

  describe('getFileStream', () => {
    it('should return a readable stream', async () => {
      const mockStream = new Readable({
        read() {
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getFileStream('test.png');

      expect(result).toBe(mockStream);
      expect(mockMinioClient.getObject).toHaveBeenCalledWith('test-bucket', 'test.png');
    });

    it('should handle files in subdirectories', async () => {
      const mockStream = new Readable({
        read() {
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      await service.getFileStream('headshots/user123.png');

      expect(mockMinioClient.getObject).toHaveBeenCalledWith('test-bucket', 'headshots/user123.png');
    });

    it('should throw NotFoundException when file not found', async () => {
      mockMinioClient.getObject.mockRejectedValue(new Error('Not found'));

      await expect(service.getFileStream('nonexistent.png')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFileStat', () => {
    it('should return file metadata', async () => {
      const mockStat = {
        size: 1024,
        lastModified: new Date('2024-01-01'),
        etag: '"abc123"',
        metaData: {},
      };
      mockMinioClient.statObject.mockResolvedValue(mockStat);

      const result = await service.getFileStat('test.png');

      expect(result).toEqual(mockStat);
      expect(mockMinioClient.statObject).toHaveBeenCalledWith('test-bucket', 'test.png');
    });

    it('should handle files in subdirectories', async () => {
      const mockStat = {
        size: 2048,
        lastModified: new Date('2024-01-01'),
        etag: '"xyz789"',
        metaData: {},
      };
      mockMinioClient.statObject.mockResolvedValue(mockStat);

      await service.getFileStat('avatars/2024/user.jpg');

      expect(mockMinioClient.statObject).toHaveBeenCalledWith('test-bucket', 'avatars/2024/user.jpg');
    });

    it('should throw NotFoundException when file not found', async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error('Not found'));

      await expect(service.getFileStat('nonexistent.png')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getImageStream', () => {
    it('should return stream with metadata', async () => {
      const mockStream = new Readable({
        read() {
          this.push(null);
        },
      });
      const mockStat = {
        size: 1024,
        lastModified: new Date('2024-01-01'),
        etag: '"abc123"',
        metaData: {},
      };

      mockMinioClient.statObject.mockResolvedValue(mockStat);
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getImageStream('test.png');

      expect(result.stream).toBe(mockStream);
      expect(result.mimeType).toBe('image/png');
      expect(result.size).toBe(1024);
      expect(result.notModified).toBe(false);
    });

    it('should return notModified when ETag matches', async () => {
      const mockStat = {
        size: 1024,
        lastModified: new Date('2024-01-01'),
        etag: '"abc123"',
        metaData: {},
      };

      mockMinioClient.statObject.mockResolvedValue(mockStat);

      const etag = service.generateETag('test.png', mockStat.lastModified, mockStat.size);
      const result = await service.getImageStream('test.png', etag);

      expect(result.notModified).toBe(true);
      expect(mockMinioClient.getObject).not.toHaveBeenCalled();
    });

    it('should handle files in subdirectories', async () => {
      const mockStream = new Readable({
        read() {
          this.push(null);
        },
      });
      const mockStat = {
        size: 2048,
        lastModified: new Date('2024-01-01'),
        etag: '"xyz789"',
        metaData: {},
      };

      mockMinioClient.statObject.mockResolvedValue(mockStat);
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getImageStream('headshots/user123.png');

      expect(result.mimeType).toBe('image/png');
      expect(mockMinioClient.statObject).toHaveBeenCalledWith('test-bucket', 'headshots/user123.png');
    });
  });

  describe('uploadFile', () => {
    it('should upload buffer to S3', async () => {
      const buffer = Buffer.from('test data');
      mockMinioClient.putObject.mockResolvedValue({});

      await service.uploadFile('test.png', buffer);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith('test-bucket', 'test.png', buffer);
    });

    it('should upload to subdirectories', async () => {
      const buffer = Buffer.from('test data');
      mockMinioClient.putObject.mockResolvedValue({});

      await service.uploadFile('headshots/user123.png', buffer);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith('test-bucket', 'headshots/user123.png', buffer);
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3', async () => {
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.deleteFile('test.png');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'test.png');
    });

    it('should delete files in subdirectories', async () => {
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.deleteFile('headshots/user123.png');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith('test-bucket', 'headshots/user123.png');
    });
  });

  describe('getFile', () => {
    it('should return file as buffer', async () => {
      const mockData = Buffer.from('test file content');
      const mockStream = new Readable({
        read() {
          this.push(mockData);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getFile('test.png');

      expect(result).toEqual(mockData);
    });

    it('should handle files in subdirectories', async () => {
      const mockData = Buffer.from('subdir file content');
      const mockStream = new Readable({
        read() {
          this.push(mockData);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getFile('folder/subfolder/test.png');

      expect(result).toEqual(mockData);
      expect(mockMinioClient.getObject).toHaveBeenCalledWith('test-bucket', 'folder/subfolder/test.png');
    });

    it('should throw NotFoundException when file not found', async () => {
      mockMinioClient.getObject.mockRejectedValue(new Error('Not found'));

      await expect(service.getFile('nonexistent.png')).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException from getFileStream', async () => {
      mockMinioClient.getObject.mockRejectedValue(new NotFoundException('File not found'));

      await expect(service.getFile('nonexistent.png')).rejects.toThrow(NotFoundException);
    });

    it('should handle stream errors', async () => {
      const mockStream = new Readable({
        read() {
          this.emit('error', new Error('Stream error'));
        },
      });
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      await expect(service.getFile('test.png')).rejects.toThrow();
    });
  });

  describe('getResizedImage', () => {
    it('should return cached resized image if available', async () => {
      const cachedBuffer = Buffer.from('cached resized image');
      const mockStat = {
        size: cachedBuffer.length,
        lastModified: new Date('2024-01-01'),
        etag: '"cached"',
        metaData: {},
      };

      // First call for cached file stat - succeeds
      mockMinioClient.statObject.mockResolvedValueOnce(mockStat);

      // Second call for cached file content
      const mockStream = new Readable({
        read() {
          this.push(cachedBuffer);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValueOnce(mockStream);

      const result = await service.getResizedImage('test.png', 300);

      expect(result.buffer).toEqual(cachedBuffer);
      expect(result.mimeType).toBe('image/png');
      expect(result.notModified).toBe(false);
      expect(mockMinioClient.statObject).toHaveBeenCalledWith('test-bucket', 'test-300.png');
    });

    it('should return notModified when cached ETag matches', async () => {
      const mockStat = {
        size: 1024,
        lastModified: new Date('2024-01-01'),
        etag: '"cached"',
        metaData: {},
      };

      mockMinioClient.statObject.mockResolvedValueOnce(mockStat);

      const etag = service.generateETag('test-300.png', mockStat.lastModified, mockStat.size);
      const result = await service.getResizedImage('test.png', 300, etag);

      expect(result.notModified).toBe(true);
      expect(mockMinioClient.getObject).not.toHaveBeenCalled();
    });

    it('should generate resized image when cache not found', async () => {
      // First call - cached file not found
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));

      // Second call - original file stat
      const originalBuffer = Buffer.from('original image');
      const mockStream = new Readable({
        read() {
          this.push(originalBuffer);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValueOnce(mockStream);
      mockMinioClient.putObject.mockResolvedValue({});

      const result = await service.getResizedImage('test.png', 300);

      expect(result.buffer).toEqual(Buffer.from('resized image data'));
      expect(result.mimeType).toBe('image/png');
      expect(result.notModified).toBe(false);
    });

    it('should upload resized image to cache asynchronously', async () => {
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));

      const originalBuffer = Buffer.from('original image');
      const mockStream = new Readable({
        read() {
          this.push(originalBuffer);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValueOnce(mockStream);
      mockMinioClient.putObject.mockResolvedValue({});

      await service.getResizedImage('test.png', 300);

      // Allow async upload to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        'test-300.png',
        expect.any(Buffer),
      );
    });

    it('should handle subdirectory files correctly', async () => {
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));

      const originalBuffer = Buffer.from('original image');
      const mockStream = new Readable({
        read() {
          this.push(originalBuffer);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValueOnce(mockStream);
      mockMinioClient.putObject.mockResolvedValue({});

      const result = await service.getResizedImage('headshots/user.png', 150);

      expect(result.mimeType).toBe('image/png');
      // Note: current implementation uses basename, so cached file is 'user-150.png' not 'headshots/user-150.png'
      expect(mockMinioClient.getObject).toHaveBeenCalledWith('test-bucket', 'headshots/user.png');
    });

    it('should return notModified when generated image ETag matches', async () => {
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));

      const originalBuffer = Buffer.from('original image');
      const mockStream = new Readable({
        read() {
          this.push(originalBuffer);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValueOnce(mockStream);

      // Generate the expected ETag
      const resizedBuffer = Buffer.from('resized image data');
      const expectedEtag = service.generateETagFromBuffer(resizedBuffer);

      const result = await service.getResizedImage('test.png', 300, expectedEtag);

      expect(result.notModified).toBe(true);
    });

    it('should silently handle cache upload failures', async () => {
      mockMinioClient.statObject.mockRejectedValueOnce(new Error('Not found'));

      const originalBuffer = Buffer.from('original image');
      const mockStream = new Readable({
        read() {
          this.push(originalBuffer);
          this.push(null);
        },
      });
      mockMinioClient.getObject.mockResolvedValueOnce(mockStream);
      mockMinioClient.putObject.mockRejectedValue(new Error('Upload failed'));

      // Should not throw
      const result = await service.getResizedImage('test.png', 300);

      expect(result.buffer).toEqual(Buffer.from('resized image data'));
    });
  });

  describe('getBucketName (via other methods)', () => {
    it('should throw when bucket name not configured (caught as NotFoundException in getFileStream)', async () => {
      // Create service with missing bucket name
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImagesService,
          {
            provide: MinioService,
            useValue: { client: mockMinioClient },
          },
          {
            provide: IMAGES_MODULE_OPTIONS,
            useValue: { s3: {} }, // No bucketName
          },
        ],
      }).compile();

      const serviceNoBucket = module.get<ImagesService>(ImagesService);

      // getBucketName throws InternalServerErrorException, but getFileStream wraps all errors as NotFoundException
      await expect(serviceNoBucket.getFileStream('test.png')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException in deleteFile when bucket name not configured', async () => {
      // Create service with missing bucket name
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImagesService,
          {
            provide: MinioService,
            useValue: { client: mockMinioClient },
          },
          {
            provide: IMAGES_MODULE_OPTIONS,
            useValue: { s3: {} }, // No bucketName
          },
        ],
      }).compile();

      const serviceNoBucket = module.get<ImagesService>(ImagesService);

      // deleteFile doesn't have try-catch, so InternalServerErrorException propagates
      try {
        await serviceNoBucket.deleteFile('test.png');
        fail('Expected InternalServerErrorException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect((error as InternalServerErrorException).message).toBe('S3 bucket name not configured');
      }
    });
  });
});
