# Contributor Guide

## Project layout

- `src/extension/` is the browser-side extension injected into the Bilibili UI. It owns React settings UI, page hooks, request/response interception, and browser storage.
- `src/inject/` is the Electron-side patch code. It is bundled as CommonJS and copied into the unpacked upstream application during the bootstrap process.
- `src/common/` contains shared TypeScript utilities.
- `tools/` bootstraps the upstream Bilibili/Electron application and creates platform packages. Treat generated `app/`, `dist/`, `tmp/`, and `cache/` contents as build artifacts.
- `res/` contains packaged assets, scripts, icons, and Electron declarations.

## Technology stack

- TypeScript with strict compiler settings
- React 19, Redux Toolkit, Ant Design, and Sass for the injected settings UI
- Vite for extension and injection bundles
- Electron 43 and electron-builder for desktop packaging
- pnpm 10 for dependency management

## Development workflow

1. Use a current Node.js LTS release and pnpm 10 (`corepack enable` is a convenient way to provide pnpm).
   NixOS users can instead enter the repository shell with `nix develop`.
2. Run `pnpm install` to install dependencies.
3. Run `tools/setup-bilibili.sh` once when the upstream Electron application has not been prepared. It downloads/unpacks the application, builds the extension, and writes generated files under `app/`.
4. Use `pnpm dev` to rebuild source bundles on change, or `pnpm build` for a one-off production bundle.
5. Start the prepared application with `bin/bilibili`.

## Checks

- Run `pnpm build` after TypeScript or bundling changes.
- Run `pnpm lint` for linting changes or before handing off a non-trivial TypeScript change.
- Run `git diff --check` before finalizing edits.

## Editing rules

- Change files under `src/`, `res/`, `tools/`, or `conf/`; do not hand-edit generated `app/` or `dist/` files.
- Preserve the existing injection boundary: browser/page code belongs in `src/extension/`, while Electron main-process behavior belongs in `src/inject/`.
- Keep request hooks resilient: failures must log and leave the original server response usable.
- When adding user-visible behavior, update all three root READMEs when the documentation is language-neutral.
