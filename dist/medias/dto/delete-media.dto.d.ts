import { z } from 'zod';
export declare const createDeleteMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>;
declare const DeleteMediaParamsDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>, false>;
export declare class DeleteMediaParamsDto extends DeleteMediaParamsDto_base {
}
declare const DeleteMediaParamsLooseDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodString;
}, z.core.$strip>, false>;
export declare class DeleteMediaParamsLooseDto extends DeleteMediaParamsLooseDto_base {
}
export {};
//# sourceMappingURL=delete-media.dto.d.ts.map