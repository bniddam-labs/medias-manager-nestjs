import {
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DeleteImageParamsDto } from './dto/delete-image.dto';
import { GetImageParamsDto, GetImageQueryDto } from './dto/get-image.dto';
import { ImagesService } from './images.service';

@Controller('images')
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);

  constructor(private readonly imagesService: ImagesService) {}

  @Get('*fileName')
  async getFile(
    @Param() params: GetImageParamsDto,
    @Query() query: GetImageQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Wildcard params return an array in path-to-regexp v8, join segments into a path string
    const fileName = Array.isArray(params.fileName)
      ? params.fileName.join('/')
      : params.fileName;
    const { size } = query;
    const ifNoneMatch = req.headers['if-none-match'] as string | undefined;

    try {
      if (size && parseInt(size, 10) > 0) {
        // Serve resized image
        const result = await this.imagesService.getResizedImage(fileName, parseInt(size, 10), ifNoneMatch);

        if (result.notModified) {
          res.status(304).end();
          return;
        }

        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Length', result.buffer.length);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('ETag', result.etag);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(result.buffer);
      } else {
        // Serve original image
        const result = await this.imagesService.getImageStream(fileName, ifNoneMatch);

        if (result.notModified) {
          res.status(304).end();
          return;
        }

        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Length', result.size);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('ETag', result.etag);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Last-Modified', result.lastModified.toUTCString());

        result.stream.pipe(res);

        result.stream.on('error', (error) => {
          this.logger.error(`Stream error: ${error.message}`);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });
      }
    } catch (error) {
      this.logger.error(`Error serving image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Error serving image');
    }
  }

  @Delete('*fileName')
  async deleteFile(@Param() params: DeleteImageParamsDto): Promise<void> {
    // Wildcard params return an array in path-to-regexp v8, join segments into a path string
    const fileName = Array.isArray(params.fileName)
      ? params.fileName.join('/')
      : params.fileName;
    return this.imagesService.deleteFile(fileName);
  }
}
