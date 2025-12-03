import { BadRequestException, Controller, Delete, Get, InternalServerErrorException, Logger, NotFoundException, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { DeleteMediaParamsLooseDto } from './dto/delete-media.dto';
import { GetMediaParamsLooseDto, GetMediaQueryDto } from './dto/get-media.dto';
import { HTTP_STATUS } from './medias.constants';
import { MediasService } from './medias.service';

@Controller('medias')
export class MediasController {
  private readonly logger = new Logger(MediasController.name);

  constructor(private readonly mediasService: MediasService) {}

  @Get('*fileName')
  async getMedia(@Param() params: GetMediaParamsLooseDto, @Query() query: GetMediaQueryDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    const startTime = Date.now();

    // Wildcard params return an array in path-to-regexp v8
    const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
    const { size } = query;
    const ifNoneMatch = req.headers['if-none-match'] as string | undefined;
    const acceptHeader = req.headers['accept'] as string | undefined;

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

        // Negotiate format based on Accept header
        const format = this.mediasService.negotiateFormat(acceptHeader);

        const result = await this.mediasService.getResizedImage(fileName, requestedSize, ifNoneMatch, format);

        const duration = Date.now() - startTime;

        if (result.notModified) {
          res.setHeader('X-Processing-Time', `${duration}ms`);
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Resize', 'yes');
          res.status(HTTP_STATUS.NOT_MODIFIED).end();
          return;
        }

        // Add Vary: Accept for proper CDN caching
        res.setHeader('Vary', 'Accept');
        res.setHeader('X-Processing-Time', `${duration}ms`);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Resize', 'yes');
        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Length', result.buffer.length);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('ETag', result.etag);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(result.buffer);
      } else {
        // Serve original file (any media type)
        const result = await this.mediasService.getMediaStream(fileName, ifNoneMatch);

        const duration = Date.now() - startTime;

        if (result.notModified) {
          res.setHeader('X-Processing-Time', `${duration}ms`);
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Resize', 'no');
          res.status(HTTP_STATUS.NOT_MODIFIED).end();
          return;
        }

        res.setHeader('X-Processing-Time', `${duration}ms`);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Resize', 'no');
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
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).end();
          }
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error serving media: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Error serving media');
    }
  }

  @Delete('*fileName')
  async deleteMedia(@Param() params: DeleteMediaParamsLooseDto): Promise<void> {
    const fileName = Array.isArray(params.fileName) ? params.fileName.join('/') : params.fileName;
    return this.mediasService.deleteMedia(fileName);
  }
}
