import { type ZodDto } from 'nestjs-zod';
import { z } from 'zod';
export declare const createGetMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const GetMediaParamsSchema: z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const GetMediaParamsLooseSchema: z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const GetMediaQuerySchema: z.ZodObject<{
    size: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const GetMediaParamsDtoBase: ZodDto<typeof GetMediaParamsSchema>;
export declare class GetMediaParamsDto extends GetMediaParamsDtoBase {
}
declare const GetMediaParamsLooseDtoBase: ZodDto<typeof GetMediaParamsLooseSchema>;
export declare class GetMediaParamsLooseDto extends GetMediaParamsLooseDtoBase {
}
declare const GetMediaQueryDtoBase: ZodDto<typeof GetMediaQuerySchema>;
export declare class GetMediaQueryDto extends GetMediaQueryDtoBase {
}
export {};
//# sourceMappingURL=get-media.dto.d.ts.map