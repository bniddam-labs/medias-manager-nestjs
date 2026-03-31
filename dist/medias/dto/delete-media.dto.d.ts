import { type ZodDto } from 'nestjs-zod';
import { z } from 'zod';
export declare const createDeleteMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const DeleteMediaParamsSchema: z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const DeleteMediaParamsLooseSchema: z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const DeleteMediaParamsDtoBase: ZodDto<typeof DeleteMediaParamsSchema>;
export declare class DeleteMediaParamsDto extends DeleteMediaParamsDtoBase {
}
declare const DeleteMediaParamsLooseDtoBase: ZodDto<typeof DeleteMediaParamsLooseSchema>;
export declare class DeleteMediaParamsLooseDto extends DeleteMediaParamsLooseDtoBase {
}
export {};
//# sourceMappingURL=delete-media.dto.d.ts.map