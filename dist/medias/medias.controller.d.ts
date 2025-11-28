import { Request, Response } from 'express';
import { DeleteMediaParamsDto } from './dto/delete-media.dto';
import { GetMediaParamsDto, GetMediaQueryDto } from './dto/get-media.dto';
import { MediasService } from './medias.service';
export declare class MediasController {
    private readonly mediasService;
    private readonly logger;
    constructor(mediasService: MediasService);
    getMedia(params: GetMediaParamsDto, query: GetMediaQueryDto, req: Request, res: Response): Promise<void>;
    deleteMedia(params: DeleteMediaParamsDto): Promise<void>;
}
//# sourceMappingURL=medias.controller.d.ts.map