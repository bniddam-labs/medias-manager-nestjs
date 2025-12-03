"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMediaQueryDto = exports.GetMediaParamsLooseDto = exports.GetMediaParamsDto = exports.createGetMediaParamsSchema = void 0;
const nestjs_zod_1 = require("nestjs-zod");
const zod_1 = require("zod");
const medias_constants_1 = require("../medias.constants");
const commonFileNameRefinements = (schema) => schema
    .min(1, 'File name is required')
    .max(medias_constants_1.MAX_FILENAME_LENGTH, 'File name is too long')
    .refine((val) => {
    const sanitized = val.replace(/\\/g, '/');
    return !sanitized.includes('../') && !sanitized.includes('/..') && !sanitized.startsWith('/');
}, {
    message: 'Invalid file name - path traversal detected',
})
    .refine((val) => {
    const ext = val.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    return ext ? medias_constants_1.ALL_MEDIA_EXTENSIONS.includes(ext) : false;
}, {
    message: `Invalid file extension - allowed extensions: ${medias_constants_1.ALL_MEDIA_EXTENSIONS.join(', ')}`,
});
const strictFilenameRefinement = (val) => /^[a-zA-Z0-9._/-]+$/.test(val);
const looseFilenameRefinement = (val) => !/[\x00-\x1F]/.test(val);
const createGetMediaParamsSchema = (strict = true) => zod_1.z.object({
    fileName: commonFileNameRefinements(zod_1.z.string()).refine(strict ? strictFilenameRefinement : looseFilenameRefinement, {
        message: strict ? 'File name contains invalid characters - only alphanumeric, dots, hyphens, underscores, and slashes are allowed' : 'File name contains invalid control characters',
    }),
});
exports.createGetMediaParamsSchema = createGetMediaParamsSchema;
const GetMediaParamsSchema = (0, exports.createGetMediaParamsSchema)(true);
const GetMediaParamsLooseSchema = (0, exports.createGetMediaParamsSchema)(false);
const GetMediaQuerySchema = zod_1.z.object({
    size: zod_1.z
        .string()
        .optional()
        .refine((val) => {
        if (!val)
            return true;
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0 && num <= medias_constants_1.MAX_RESIZE_WIDTH_LIMIT;
    }, {
        message: `Size must be a positive integer between 1 and ${medias_constants_1.MAX_RESIZE_WIDTH_LIMIT}`,
    }),
});
class GetMediaParamsDto extends (0, nestjs_zod_1.createZodDto)(GetMediaParamsSchema) {
}
exports.GetMediaParamsDto = GetMediaParamsDto;
class GetMediaParamsLooseDto extends (0, nestjs_zod_1.createZodDto)(GetMediaParamsLooseSchema) {
}
exports.GetMediaParamsLooseDto = GetMediaParamsLooseDto;
class GetMediaQueryDto extends (0, nestjs_zod_1.createZodDto)(GetMediaQuerySchema) {
}
exports.GetMediaQueryDto = GetMediaQueryDto;
//# sourceMappingURL=get-media.dto.js.map