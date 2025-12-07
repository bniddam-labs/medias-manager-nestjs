import { z } from 'zod';
export declare const createDeleteMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>;
declare const DeleteMediaParamsDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
export declare class DeleteMediaParamsDto extends DeleteMediaParamsDto_base {
}
declare const DeleteMediaParamsLooseDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
export declare class DeleteMediaParamsLooseDto extends DeleteMediaParamsLooseDto_base {
}
export {};
//# sourceMappingURL=delete-media.dto.d.ts.map