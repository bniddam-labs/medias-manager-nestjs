import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MediasController } from './medias.controller';
import { MediasService } from './medias.service';
import { Response, Request } from 'express';
import { Readable } from 'stream';

describe('MediasController', () => {
  let controller: MediasController;
  let mediasService: jest.Mocked<MediasService>;

  const mockResponse = () => {
    const res: Partial<Response> = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  const mockRequest = (headers: Record<string, string> = {}) => {
    return { headers } as Request;
  };

  beforeEach(async () => {
    const mockMediasService = {
      isImage: jest.fn(),
      isResizable: jest.fn(),
      getMediaStream: jest.fn(),
      getResizedImage: jest.fn(),
      deleteMedia: jest.fn(),
      negotiateFormat: jest.fn().mockReturnValue('original'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediasController],
      providers: [
        {
          provide: MediasService,
          useValue: mockMediasService,
        },
      ],
    }).compile();

    controller = module.get<MediasController>(MediasController);
    mediasService = module.get(MediasService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMedia', () => {
    it('should stream media file without size parameter', async () => {
      const mockStream = new Readable({ read() {} });
      const res = mockResponse();
      const req = mockRequest();

      mediasService.getMediaStream.mockResolvedValue({
        stream: mockStream,
        mimeType: 'video/mp4',
        size: 1000,
        etag: '"abc123"',
        lastModified: new Date(),
        notModified: false,
      });

      // Mock pipe
      mockStream.pipe = jest.fn().mockReturnValue(mockStream);
      mockStream.on = jest.fn().mockReturnValue(mockStream);

      await controller.getMedia({ fileName: 'video.mp4' }, {}, req, res);

      expect(mediasService.getMediaStream).toHaveBeenCalledWith('video.mp4', undefined);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });

    it('should return 304 when not modified', async () => {
      const res = mockResponse();
      const req = mockRequest({ 'if-none-match': '"abc123"' });

      mediasService.getMediaStream.mockResolvedValue({
        stream: null as any,
        mimeType: 'video/mp4',
        size: 1000,
        etag: '"abc123"',
        lastModified: new Date(),
        notModified: true,
      });

      await controller.getMedia({ fileName: 'video.mp4' }, {}, req, res);

      expect(res.status).toHaveBeenCalledWith(304);
      expect(res.end).toHaveBeenCalled();
    });

    it('should resize image when size parameter is provided', async () => {
      const res = mockResponse();
      const req = mockRequest();

      mediasService.isResizable.mockReturnValue(true);
      mediasService.getResizedImage.mockResolvedValue({
        buffer: Buffer.from('resized'),
        mimeType: 'image/jpeg',
        etag: '"resized123"',
        notModified: false,
      });

      await controller.getMedia({ fileName: 'photo.jpg' }, { size: '300' }, req, res);

      expect(mediasService.getResizedImage).toHaveBeenCalledWith('photo.jpg', 300, undefined, 'original');
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to resize non-resizable image', async () => {
      const res = mockResponse();
      const req = mockRequest();

      mediasService.isResizable.mockReturnValue(false);
      mediasService.isImage.mockReturnValue(true);

      await expect(controller.getMedia({ fileName: 'icon.svg' }, { size: '300' }, req, res)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to resize non-image file', async () => {
      const res = mockResponse();
      const req = mockRequest();

      mediasService.isResizable.mockReturnValue(false);
      mediasService.isImage.mockReturnValue(false);

      await expect(controller.getMedia({ fileName: 'video.mp4' }, { size: '300' }, req, res)).rejects.toThrow(BadRequestException);
    });

    it('should handle array fileName from wildcard route', async () => {
      const mockStream = new Readable({ read() {} });
      const res = mockResponse();
      const req = mockRequest();

      mediasService.getMediaStream.mockResolvedValue({
        stream: mockStream,
        mimeType: 'image/jpeg',
        size: 1000,
        etag: '"abc123"',
        lastModified: new Date(),
        notModified: false,
      });

      mockStream.pipe = jest.fn().mockReturnValue(mockStream);
      mockStream.on = jest.fn().mockReturnValue(mockStream);

      await controller.getMedia({ fileName: ['folder', 'subfolder', 'photo.jpg'] as any }, {}, req, res);

      expect(mediasService.getMediaStream).toHaveBeenCalledWith('folder/subfolder/photo.jpg', undefined);
    });
  });

  describe('deleteMedia', () => {
    it('should delete media file', async () => {
      mediasService.deleteMedia.mockResolvedValue(undefined);

      await controller.deleteMedia({ fileName: 'video.mp4' });

      expect(mediasService.deleteMedia).toHaveBeenCalledWith('video.mp4');
    });

    it('should handle array fileName from wildcard route', async () => {
      mediasService.deleteMedia.mockResolvedValue(undefined);

      await controller.deleteMedia({ fileName: ['folder', 'video.mp4'] as any });

      expect(mediasService.deleteMedia).toHaveBeenCalledWith('folder/video.mp4');
    });
  });
});
