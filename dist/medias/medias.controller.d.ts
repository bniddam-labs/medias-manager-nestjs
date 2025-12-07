import { Request, Response } from 'express';
import { DeleteMediaParamsLooseDto } from './dto/delete-media.dto';
import { GetMediaParamsLooseDto, GetMediaQueryDto } from './dto/get-media.dto';
import { MediasService } from './medias.service';
export declare class MediasController {
    private readonly mediasService;
    private readonly logger;
    constructor(mediasService: MediasService);
    getMedia(params: GetMediaParamsLooseDto, query: GetMediaQueryDto, req: Request, res: Response): Promise<void>;
    deleteMedia(params: DeleteMediaParamsLooseDto): Promise<void>;
}
//# sourceMappingURL=medias.controller.d.ts.map