"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetImageParamsDto = exports.GetImageQueryDto = void 0;
const nestjs_zod_1 = require("nestjs-zod");
const zod_1 = require("zod");
const GetImageQuerySchema = zod_1.z.object({
    size: zod_1.z
        .string()
        .optional()
        .refine((val) => {
        if (!val)
            return true;
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0 && num <= 5000;
    }, {
        message: 'Size must be a positive integer between 1 and 5000',
    }),
});
const GetImageParamsSchema = zod_1.z.object({
    fileName: zod_1.z
        .string()
        .min(1, 'File name is required')
        .max(255, 'File name is too long')
        .refine((val) => {
        const sanitized = val.replace(/\\/g, '/');
        return !sanitized.includes('../') && !sanitized.includes('/..') && !sanitized.startsWith('/');
    }, {
        message: 'Invalid file name - path traversal detected',
    })
        .refine((val) => {
        const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        return validExtensions.some((ext) => val.toLowerCase().endsWith(ext));
    }, {
        message: 'Invalid file extension - only .png, .jpg, .jpeg, .gif, .webp are allowed',
    })
        .refine((val) => {
        return /^[a-zA-Z0-9._/-]+$/.test(val);
    }, {
        message: 'File name contains invalid characters',
    }),
});
class GetImageQueryDto extends (0, nestjs_zod_1.createZodDto)(GetImageQuerySchema) {
}
exports.GetImageQueryDto = GetImageQueryDto;
class GetImageParamsDto extends (0, nestjs_zod_1.createZodDto)(GetImageParamsSchema) {
}
exports.GetImageParamsDto = GetImageParamsDto;
//# sourceMappingURL=get-image.dto.js.map