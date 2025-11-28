import { Test, TestingModule } from '@nestjs/testing';
import { MediasModule } from './medias.module';
import { MediasService } from './medias.service';
import { MEDIAS_MODULE_OPTIONS } from './medias.constants';

describe('MediasModule', () => {
  const mockOptions = {
    s3: {
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'test',
      secretKey: 'test',
      region: 'us-east-1',
      bucketName: 'test-bucket',
    },
  };

  describe('forRoot', () => {
    it('should provide MediasService', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [MediasModule.forRoot(mockOptions)],
      }).compile();

      const service = module.get<MediasService>(MediasService);
      expect(service).toBeDefined();
    });

    it('should provide module options', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [MediasModule.forRoot(mockOptions)],
      }).compile();

      const options = module.get(MEDIAS_MODULE_OPTIONS);
      expect(options).toEqual(mockOptions);
    });
  });

  describe('forRootAsync', () => {
    it('should provide MediasService with useFactory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          MediasModule.forRootAsync({
            useFactory: () => mockOptions,
          }),
        ],
      }).compile();

      const service = module.get<MediasService>(MediasService);
      expect(service).toBeDefined();
    });
  });
});
