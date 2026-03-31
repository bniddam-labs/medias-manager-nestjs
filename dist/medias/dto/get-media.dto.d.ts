import { z } from 'zod';
export declare const createGetMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const GetMediaParamsDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>, false>;
export declare class GetMediaParamsDto extends GetMediaParamsDto_base {
}
declare const GetMediaParamsLooseDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>, false>;
export declare class GetMediaParamsLooseDto extends GetMediaParamsLooseDto_base {
}
declare const GetMediaQueryDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    size: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, false>;
export declare class GetMediaQueryDto extends GetMediaQueryDto_base {
}
export {};
//# sourceMappingURL=get-media.dto.d.ts.map