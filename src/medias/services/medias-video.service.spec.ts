import { Test, TestingModule } from '@nestjs/testing';
import { MEDIAS_MODULE_OPTIONS } from '../medias.constants';
import { MediasLoggerService } from './medias-logger.service';
import { MediasStorageService } from './medias-storage.service';
import { MediasValidationService } from './medias-validation.service';
import { MediasVideoService } from './medias-video.service';

// Mock fluent-ffmpeg
// Use a holder object so the reference is stable when jest.mock is hoisted
const ffmpegMockHolder = {
  getAvailableFormats: jest.fn() as jest.Mock,
};

jest.mock('fluent-ffmpeg', () => {
  const ffmpegInstance = {
    seekInput: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function (this: any, _event: string, _cb: (...args: any[]) => void) {
      return this;
    }),
    pipe: jest.fn().mockReturnValue({
      on: jest.fn().mockImplementation(function (this: any, event: string, cb: (...args: any[]) => void) {
        if (event === 'end') {
          process.nextTick(() => cb());
        }
        if (event === 'data') {
          process.nextTick(() => cb(Buffer.from('fake-png-frame')));
        }
        return this;
      }),
    }),
  };

  const ffmpegFn: any = jest.fn().mockReturnValue(ffmpegInstance);
  ffmpegFn.ffprobe = jest.fn();
  ffmpegFn.getAvailableFormats = (...args: any[]) => ffmpegMockHolder.getAvailableFormats(...args);

  return { __esModule: true, default: ffmpegFn };
});

const mockGetAvailableFormats = ffmpegMockHolder.getAvailableFormats;

// Mock sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('thumbnail-data')),
    metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080, format: 'png' }),
  }));
});

describe('MediasVideoService', () => {
  let service: MediasVideoService;
  let mockStoragePutFile: jest.Mock;

  const mockOptions = {
    s3: {
      bucketName: 'test-bucket',
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'test',
      secretKey: 'test',
    },
    preferredFormat: 'jpeg' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStoragePutFile = jest.fn().mockResolvedValue(undefined);
    mockGetAvailableFormats.mockImplementation((cb: (err: Error | null, formats?: any) => void) => {
      cb(null, { mp4: {} });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasVideoService,
        MediasLoggerService,
        {
          provide: MediasStorageService,
          useValue: { putFile: mockStoragePutFile },
        },
        {
          provide: MediasValidationService,
          useValue: {
            isVideo: jest.fn().mockReturnValue(true),
            buildThumbnailFileName: jest.fn().mockImplementation(
              (fileName: string, size: number, ext: string) => `${fileName.replace(/\.[^.]+$/, '')}-thumb-${size}${ext}`,
            ),
          },
        },
        {
          provide: MEDIAS_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<MediasVideoService>(MediasVideoService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkFfmpegAvailability', () => {
    it('should detect ffmpeg as available', () => {
      expect(service.isFfmpegAvailable()).toBe(true);
    });

    it('should detect ffmpeg as unavailable', async () => {
      mockGetAvailableFormats.mockImplementation((cb: (err: Error | null) => void) => {
        cb(new Error('ffmpeg not found'));
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MediasVideoService,
          MediasLoggerService,
          {
            provide: MediasStorageService,
            useValue: { putFile: jest.fn() },
          },
          {
            provide: MediasValidationService,
            useValue: { isVideo: jest.fn(), buildThumbnailFileName: jest.fn() },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      const unavailableService = module.get<MediasVideoService>(MediasVideoService);
      await unavailableService.onModuleInit();

      expect(unavailableService.isFfmpegAvailable()).toBe(false);
    });
  });

  describe('parseTimestamp', () => {
    it('should return default 10% when undefined', () => {
      expect(service.parseTimestamp(undefined, 100)).toBe(10);
    });

    it('should return number directly when within duration', () => {
      expect(service.parseTimestamp(5.5, 100)).toBe(5.5);
    });

    it('should clamp number to duration', () => {
      expect(service.parseTimestamp(150, 100)).toBe(100);
    });

    it('should parse percentage string', () => {
      expect(service.parseTimestamp('25%', 200)).toBe(50);
    });

    it('should parse number string', () => {
      expect(service.parseTimestamp('30', 100)).toBe(30);
    });

    it('should fallback to default for invalid string', () => {
      expect(service.parseTimestamp('invalid', 100)).toBe(10);
    });
  });

  describe('generateThumbnailsInline', () => {
    it('should skip when ffmpeg is not available', async () => {
      mockGetAvailableFormats.mockImplementation((cb: (err: Error | null) => void) => {
        cb(new Error('ffmpeg not found'));
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MediasVideoService,
          MediasLoggerService,
          {
            provide: MediasStorageService,
            useValue: { putFile: mockStoragePutFile },
          },
          {
            provide: MediasValidationService,
            useValue: {
              isVideo: jest.fn().mockReturnValue(true),
              buildThumbnailFileName: jest.fn(),
            },
          },
          {
            provide: MEDIAS_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      const unavailableService = module.get<MediasVideoService>(MediasVideoService);
      await unavailableService.onModuleInit();

      await unavailableService.generateThumbnailsInline('video.mp4', Buffer.from('video'), [200, 400]);

      expect(mockStoragePutFile).not.toHaveBeenCalled();
    });
  });
});
