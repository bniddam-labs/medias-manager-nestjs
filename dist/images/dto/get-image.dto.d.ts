import { z } from 'zod';
declare const GetImageQueryDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    size: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    size?: string | undefined;
}, {
    size?: string | undefined;
}>> & {
    io: "input";
};
export declare class GetImageQueryDto extends GetImageQueryDto_base {
}
declare const GetImageParamsDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
export declare class GetImageParamsDto extends GetImageParamsDto_base {
}
export {};
//# sourceMappingURL=get-image.dto.d.ts.map