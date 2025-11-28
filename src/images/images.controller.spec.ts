import { Test, TestingModule } from '@nestjs/testing';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { Response, Request } from 'express';
import { Readable } from 'stream';
import { InternalServerErrorException } from '@nestjs/common';

describe('ImagesController', () => {
  let controller: ImagesController;
  let imagesService: jest.Mocked<ImagesService>;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;

  beforeEach(async () => {
    const mockImagesService = {
      getImageStream: jest.fn(),
      getResizedImage: jest.fn(),
      deleteFile: jest.fn(),
    };

    mockResponse = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      headers: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        {
          provide: ImagesService,
          useValue: mockImagesService,
        },
      ],
    }).compile();

    controller = module.get<ImagesController>(ImagesController);
    imagesService = module.get(ImagesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFile', () => {
    describe('original images (no size)', () => {
      it('should serve original image with correct headers', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          },
        });
        mockStream.pipe = jest.fn().mockReturnValue(mockStream);
        mockStream.on = jest.fn().mockReturnThis();

        imagesService.getImageStream.mockResolvedValue({
          stream: mockStream,
          mimeType: 'image/png',
          size: 1024,
          etag: '"abc123"',
          lastModified: new Date('2024-01-01'),
          notModified: false,
        });

        await controller.getFile(
          { fileName: 'test.png' },
          {},
          mockRequest as Request,
          mockResponse as Response,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Length', 1024);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('ETag', '"abc123"');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000, immutable');
        expect(mockStream.pipe).toHaveBeenCalledWith(mockResponse);
      });

      it('should return 304 when client has cached version', async () => {
        mockRequest.headers = { 'if-none-match': '"abc123"' };

        imagesService.getImageStream.mockResolvedValue({
          stream: null as any,
          mimeType: 'image/png',
          size: 1024,
          etag: '"abc123"',
          lastModified: new Date('2024-01-01'),
          notModified: true,
        });

        await controller.getFile(
          { fileName: 'test.png' },
          {},
          mockRequest as Request,
          mockResponse as Response,
        );

        expect(mockResponse.status).toHaveBeenCalledWith(304);
        expect(mockResponse.end).toHaveBeenCalled();
      });

      it('should handle files in subdirectories', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          },
        });
        mockStream.pipe = jest.fn().mockReturnValue(mockStream);
        mockStream.on = jest.fn().mockReturnThis();

        imagesService.getImageStream.mockResolvedValue({
          stream: mockStream,
          mimeType: 'image/png',
          size: 2048,
          etag: '"xyz789"',
          lastModified: new Date('2024-01-01'),
          notModified: false,
        });

        await controller.getFile(
          { fileName: 'headshots/user123.png' },
          {},
          mockRequest as Request,
          mockResponse as Response,
        );

        expect(imagesService.getImageStream).toHaveBeenCalledWith('headshots/user123.png', undefined);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          'inline; filename="headshots/user123.png"',
        );
      });
    });

    describe('resized images (with size)', () => {
      it('should serve resized image with correct headers', async () => {
        const mockBuffer = Buffer.from('fake image data');

        imagesService.getResizedImage.mockResolvedValue({
          buffer: mockBuffer,
          mimeType: 'image/png',
          etag: '"resized123"',
          notModified: false,
        });

        await controller.getFile(
          { fileName: 'test.png' },
          { size: '300' },
          mockRequest as Request,
          mockResponse as Response,
        );

        expect(imagesService.getResizedImage).toHaveBeenCalledWith('test.png', 300, undefined);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Length', mockBuffer.length);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('ETag', '"resized123"');
        expect(mockResponse.send).toHaveBeenCalledWith(mockBuffer);
      });

      it('should return 304 for cached resized image', async () => {
        mockRequest.headers = { 'if-none-match': '"resized123"' };

        imagesService.getResizedImage.mockResolvedValue({
          buffer: null as any,
          mimeType: 'image/png',
          etag: '"resized123"',
          notModified: true,
        });

        await controller.getFile(
          { fileName: 'test.png' },
          { size: '300' },
          mockRequest as Request,
          mockResponse as Response,
        );

        expect(mockResponse.status).toHaveBeenCalledWith(304);
        expect(mockResponse.end).toHaveBeenCalled();
      });

      it('should handle resized files in subdirectories', async () => {
        const mockBuffer = Buffer.from('fake resized image');

        imagesService.getResizedImage.mockResolvedValue({
          buffer: mockBuffer,
          mimeType: 'image/jpeg',
          etag: '"subdirresized"',
          notModified: false,
        });

        await controller.getFile(
          { fileName: 'avatars/2024/user.jpg' },
          { size: '150' },
          mockRequest as Request,
          mockResponse as Response,
        );

        expect(imagesService.getResizedImage).toHaveBeenCalledWith('avatars/2024/user.jpg', 150, undefined);
      });
    });
  });

  describe('deleteFile', () => {
    it('should call service to delete file', async () => {
      imagesService.deleteFile.mockResolvedValue(undefined);

      await controller.deleteFile({ fileName: 'test.png' });

      expect(imagesService.deleteFile).toHaveBeenCalledWith('test.png');
    });

    it('should delete files in subdirectories', async () => {
      imagesService.deleteFile.mockResolvedValue(undefined);

      await controller.deleteFile({ fileName: 'headshots/user123.png' });

      expect(imagesService.deleteFile).toHaveBeenCalledWith('headshots/user123.png');
    });
  });

  describe('error handling', () => {
    it('should throw InternalServerErrorException on service error for original images', async () => {
      imagesService.getImageStream.mockRejectedValue(new Error('S3 connection failed'));

      await expect(
        controller.getFile(
          { fileName: 'test.png' },
          {},
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on service error for resized images', async () => {
      imagesService.getResizedImage.mockRejectedValue(new Error('Sharp processing failed'));

      await expect(
        controller.getFile(
          { fileName: 'test.png' },
          { size: '300' },
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle stream errors gracefully', async () => {
      const mockStream = new Readable({
        read() {
          this.push(null);
        },
      });
      
      // Create handlers storage
      const handlers: Record<string, Function> = {};
      mockStream.pipe = jest.fn().mockReturnValue(mockStream);
      mockStream.on = jest.fn().mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
        return mockStream;
      });

      imagesService.getImageStream.mockResolvedValue({
        stream: mockStream,
        mimeType: 'image/png',
        size: 1024,
        etag: '"abc123"',
        lastModified: new Date('2024-01-01'),
        notModified: false,
      });

      await controller.getFile(
        { fileName: 'test.png' },
        {},
        mockRequest as Request,
        mockResponse as Response,
      );

      // Verify error handler was registered
      expect(mockStream.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should pass If-None-Match header to service', async () => {
      mockRequest.headers = { 'if-none-match': '"etag123"' };

      const mockStream = new Readable({
        read() {
          this.push(null);
        },
      });
      mockStream.pipe = jest.fn().mockReturnValue(mockStream);
      mockStream.on = jest.fn().mockReturnThis();

      imagesService.getImageStream.mockResolvedValue({
        stream: mockStream,
        mimeType: 'image/png',
        size: 1024,
        etag: '"different"',
        lastModified: new Date('2024-01-01'),
        notModified: false,
      });

      await controller.getFile(
        { fileName: 'test.png' },
        {},
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(imagesService.getImageStream).toHaveBeenCalledWith('test.png', '"etag123"');
    });

    it('should pass If-None-Match header to resize service', async () => {
      mockRequest.headers = { 'if-none-match': '"etag456"' };

      imagesService.getResizedImage.mockResolvedValue({
        buffer: Buffer.from('resized'),
        mimeType: 'image/png',
        etag: '"different"',
        notModified: false,
      });

      await controller.getFile(
        { fileName: 'test.png' },
        { size: '200' },
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(imagesService.getResizedImage).toHaveBeenCalledWith('test.png', 200, '"etag456"');
    });
  });
});
