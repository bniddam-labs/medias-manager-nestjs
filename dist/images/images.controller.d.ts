import { Request, Response } from 'express';
import { DeleteImageParamsDto } from './dto/delete-image.dto';
import { GetImageParamsDto, GetImageQueryDto } from './dto/get-image.dto';
import { ImagesService } from './images.service';
export declare class ImagesController {
    private readonly imagesService;
    private readonly logger;
    constructor(imagesService: ImagesService);
    getFile(params: GetImageParamsDto, query: GetImageQueryDto, req: Request, res: Response): Promise<void>;
    deleteFile(params: DeleteImageParamsDto): Promise<void>;
}
//# sourceMappingURL=images.controller.d.ts.map