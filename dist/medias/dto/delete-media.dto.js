"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteMediaParamsDto = void 0;
const nestjs_zod_1 = require("nestjs-zod");
const zod_1 = require("zod");
const medias_constants_1 = require("../medias.constants");
const DeleteMediaParamsSchema = zod_1.z.object({
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
        const ext = val.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
        return ext ? medias_constants_1.ALL_MEDIA_EXTENSIONS.includes(ext) : false;
    }, {
        message: `Invalid file extension - allowed extensions: ${medias_constants_1.ALL_MEDIA_EXTENSIONS.join(', ')}`,
    })
        .refine((val) => {
        return /^[a-zA-Z0-9._/-]+$/.test(val);
    }, {
        message: 'File name contains invalid characters',
    }),
});
class DeleteMediaParamsDto extends (0, nestjs_zod_1.createZodDto)(DeleteMediaParamsSchema) {
}
exports.DeleteMediaParamsDto = DeleteMediaParamsDto;
//# sourceMappingURL=delete-media.dto.js.map