"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteMediaParamsLooseDto = exports.DeleteMediaParamsDto = exports.createDeleteMediaParamsSchema = void 0;
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
const createDeleteMediaParamsSchema = (strict = true) => zod_1.z.object({
    fileName: commonFileNameRefinements(zod_1.z.string()).refine(strict ? strictFilenameRefinement : looseFilenameRefinement, {
        message: strict ? 'File name contains invalid characters - only alphanumeric, dots, hyphens, underscores, and slashes are allowed' : 'File name contains invalid control characters',
    }),
});
exports.createDeleteMediaParamsSchema = createDeleteMediaParamsSchema;
const DeleteMediaParamsSchema = (0, exports.createDeleteMediaParamsSchema)(true);
const DeleteMediaParamsLooseSchema = (0, exports.createDeleteMediaParamsSchema)(false);
class DeleteMediaParamsDto extends (0, nestjs_zod_1.createZodDto)(DeleteMediaParamsSchema) {
}
exports.DeleteMediaParamsDto = DeleteMediaParamsDto;
class DeleteMediaParamsLooseDto extends (0, nestjs_zod_1.createZodDto)(DeleteMediaParamsLooseSchema) {
}
exports.DeleteMediaParamsLooseDto = DeleteMediaParamsLooseDto;
//# sourceMappingURL=delete-media.dto.js.map