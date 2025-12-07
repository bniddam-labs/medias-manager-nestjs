import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  skipNodeModulesBundle: true,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    'nestjs-minio-client',
    'nestjs-zod',
    'sharp',
    'zod',
    'reflect-metadata',
    'rxjs',
    'express',
  ],
});
