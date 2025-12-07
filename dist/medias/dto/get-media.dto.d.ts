import { z } from 'zod';
export declare const createGetMediaParamsSchema: (strict?: boolean) => z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>;
declare const GetMediaParamsDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
export declare class GetMediaParamsDto extends GetMediaParamsDto_base {
}
declare const GetMediaParamsLooseDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
export declare class GetMediaParamsLooseDto extends GetMediaParamsLooseDto_base {
}
declare const GetMediaQueryDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    size: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    size?: string | undefined;
}, {
    size?: string | undefined;
}>> & {
    io: "input";
};
export declare class GetMediaQueryDto extends GetMediaQueryDto_base {
}
export {};
//# sourceMappingURL=get-media.dto.d.ts.map