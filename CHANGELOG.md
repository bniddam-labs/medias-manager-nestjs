# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2025-11-28

### Fixed
- Fixed `path-to-regexp` v8 compatibility for NestJS 11
- Changed route syntax from `:fileName(*)` to `*fileName`
- Handle array params from wildcard routes

### Added
- GitHub Actions CI workflow (lint, test, build on Node 20/22/24)
- Dependabot configuration for automated dependency updates
- Auto-commit of dist/ build on push to main
- CodeQL security analysis workflow
- New scripts: `format:check`, `lint:check`, `typecheck`
- CI badge in README
- `.nvmrc` file for Node version management
- `engines` field in package.json

### Changed
- dist/ folder now gitignored, built only by CI

## [2.0.3] - 2025-11-27

### Added
- Initial public release
- S3/MinIO integration with nestjs-minio-client
- On-demand image resizing with Sharp
- HTTP caching with ETag support
- Streaming support for large files
- Zod-based input validation
- Dynamic module pattern (forRoot/forRootAsync)
- Optional built-in controller
