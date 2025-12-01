import { BadRequestException, Controller, Delete, Get, InternalServerErrorException, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { DeleteMediaParamsDto } from './dto/delete-media.dto';
import { GetMediaParamsDto, GetMediaQueryDto } from './dto/get-media.dto';
import { MediasService } from './medias.service';

@Controller()
export class MediasController {
  private readonly logger = new Logger(MediasController.name);

  constructor(private readonly mediasService: MediasService) {}

  @Get('*fileName')
  async getMedia(@Param() params: GetMediaParamsDto, @Query() query: GetMediaQueryDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    // Wildcard params return an array in path-to-regexp v8
    const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
    const { size } = query;
    const ifNoneMatch = req.headers['if-none-match'] as string | undefined;

    try {
      // If size is requested, attempt to resize (only works for images)
      if (size && parseInt(size, 10) > 0) {
        const requestedSize = parseInt(size, 10);

        // Check if file is resizable before attempting
        if (!this.mediasService.isResizable(fileName)) {
          if (this.mediasService.isImage(fileName)) {
            throw new BadRequestException(`This image format does not support resizing. Serve without size parameter.`);
          }
          throw new BadRequestException(`Cannot resize non-image files. Remove the size parameter to serve the file.`);
        }

        const result = await this.mediasService.getResizedImage(fileName, requestedSize, ifNoneMatch);

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
        // Serve original file (any media type)
        const result = await this.mediasService.getMediaStream(fileName, ifNoneMatch);

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
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error serving media: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Error serving media');
    }
  }

  @Delete('*fileName')
  async deleteMedia(@Param() params: DeleteMediaParamsDto): Promise<void> {
    const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
    return this.mediasService.deleteMedia(fileName);
  }
}
