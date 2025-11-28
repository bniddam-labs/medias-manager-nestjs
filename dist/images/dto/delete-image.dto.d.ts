import { z } from 'zod';
declare const DeleteImageParamsDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    fileName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
}, {
    fileName: string;
}>> & {
    io: "input";
};
export declare class DeleteImageParamsDto extends DeleteImageParamsDto_base {
}
export {};
//# sourceMappingURL=delete-image.dto.d.ts.map