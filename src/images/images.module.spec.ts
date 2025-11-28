import { ImagesModule } from './images.module';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { IMAGES_MODULE_OPTIONS } from './images.constants';
import { ImagesModuleOptionsFactory } from './interfaces/images-module-options.interface';

// Mock the MinioModule
jest.mock('nestjs-minio-client', () => ({
  MinioModule: {
    register: jest.fn().mockReturnValue({
      module: class MockMinioModule {},
      providers: [
        {
          provide: 'MINIO_CONNECTION',
          useValue: {
            getObject: jest.fn(),
            statObject: jest.fn(),
            putObject: jest.fn(),
            removeObject: jest.fn(),
          },
        },
      ],
      exports: ['MINIO_CONNECTION'],
    }),
    registerAsync: jest.fn().mockReturnValue({
      module: class MockMinioModule {},
      providers: [
        {
          provide: 'MINIO_CONNECTION',
          useValue: {
            getObject: jest.fn(),
            statObject: jest.fn(),
            putObject: jest.fn(),
            removeObject: jest.fn(),
          },
        },
      ],
      exports: ['MINIO_CONNECTION'],
    }),
  },
  MinioService: class MockMinioService {
    client = {
      getObject: jest.fn(),
      statObject: jest.fn(),
      putObject: jest.fn(),
      removeObject: jest.fn(),
    };
  },
}));

describe('ImagesModule', () => {
  const mockS3Options = {
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'test',
    secretKey: 'test',
    region: 'us-east-1',
    bucketName: 'test-bucket',
  };

  describe('forRoot', () => {
    it('should create module without controller by default', () => {
      const dynamicModule = ImagesModule.forRoot({
        s3: mockS3Options,
      });

      expect(dynamicModule.module).toBe(ImagesModule);
      expect(dynamicModule.controllers).toEqual([]);
      expect(dynamicModule.exports).toContain(ImagesService);
    });

    it('should create module without controller when registerController is false', () => {
      const dynamicModule = ImagesModule.forRoot({
        s3: mockS3Options,
        registerController: false,
      });

      expect(dynamicModule.controllers).toEqual([]);
    });

    it('should create module with controller when registerController is true', () => {
      const dynamicModule = ImagesModule.forRoot({
        s3: mockS3Options,
        registerController: true,
      });

      expect(dynamicModule.controllers).toContain(ImagesController);
    });

    it('should provide IMAGES_MODULE_OPTIONS', () => {
      const dynamicModule = ImagesModule.forRoot({
        s3: mockS3Options,
      });

      const optionsProvider = dynamicModule.providers?.find((p: any) => p.provide === IMAGES_MODULE_OPTIONS);
      expect(optionsProvider).toBeDefined();
      expect((optionsProvider as any).useValue.s3).toEqual(mockS3Options);
    });

    it('should provide ImagesService', () => {
      const dynamicModule = ImagesModule.forRoot({
        s3: mockS3Options,
      });

      expect(dynamicModule.providers).toContain(ImagesService);
    });
  });

  describe('forRootAsync', () => {
    it('should create module with useFactory', () => {
      const dynamicModule = ImagesModule.forRootAsync({
        useFactory: () => ({
          s3: mockS3Options,
        }),
      });

      expect(dynamicModule.module).toBe(ImagesModule);
      expect(dynamicModule.exports).toContain(ImagesService);
    });

    it('should create module without controller by default', () => {
      const dynamicModule = ImagesModule.forRootAsync({
        useFactory: () => ({
          s3: mockS3Options,
        }),
      });

      expect(dynamicModule.controllers).toEqual([]);
    });

    it('should create module with controller when registerController is true', () => {
      const dynamicModule = ImagesModule.forRootAsync({
        registerController: true,
        useFactory: () => ({
          s3: mockS3Options,
        }),
      });

      expect(dynamicModule.controllers).toContain(ImagesController);
    });

    it('should support inject option with useFactory', () => {
      const dynamicModule = ImagesModule.forRootAsync({
        useFactory: (_configService: any) => ({
          s3: mockS3Options,
        }),
        inject: ['ConfigService'],
      });

      const optionsProvider = dynamicModule.providers?.find((p: any) => p.provide === IMAGES_MODULE_OPTIONS);
      expect((optionsProvider as any).inject).toContain('ConfigService');
    });

    it('should support imports option', () => {
      const MockModule = { module: class MockModule {} };
      const dynamicModule = ImagesModule.forRootAsync({
        imports: [MockModule as any],
        useFactory: () => ({
          s3: mockS3Options,
        }),
      });

      expect(dynamicModule.imports).toContainEqual(MockModule);
    });

    it('should support useClass option', () => {
      class TestOptionsFactory implements ImagesModuleOptionsFactory {
        createImagesModuleOptions() {
          return { s3: mockS3Options };
        }
      }

      const dynamicModule = ImagesModule.forRootAsync({
        useClass: TestOptionsFactory,
      });

      expect(dynamicModule.providers?.length).toBeGreaterThan(1);
    });

    it('should support useExisting option', () => {
      class ExistingFactory implements ImagesModuleOptionsFactory {
        createImagesModuleOptions() {
          return { s3: mockS3Options };
        }
      }

      const dynamicModule = ImagesModule.forRootAsync({
        useExisting: ExistingFactory,
      });

      const optionsProvider = dynamicModule.providers?.find((p: any) => p.provide === IMAGES_MODULE_OPTIONS);
      expect((optionsProvider as any).inject).toContain(ExistingFactory);
    });
  });
});
