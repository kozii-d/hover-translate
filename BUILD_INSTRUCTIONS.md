# Build Instructions for HoverTranslate Firefox Extension

This document provides step-by-step instructions to build the HoverTranslate extension from source code for Firefox Add-ons review.

## Prerequisites

- **Node.js**: 24.12.0 or newer (the version in `.nvmrc`)
- **npm**: 11.6.2 or newer
- **Operating System**: Windows, macOS, or Linux

`.npmrc` sets `engine-strict`, so `npm ci` stops with an error on an older Node.js or npm.

The submitted package was built on Linux x86_64 with Node.js 24.12.0 and npm 11.6.2. The same steps with Node.js 24.14.0 and npm 11.9.0 produce byte-identical `extension/dist/` and `popup/dist/`.

## Project Structure

```
hover-translate/
├── extension/           # Extension source code
│   ├── src/            # TypeScript source files
│   ├── package.json    # Extension dependencies
│   └── vite.*.config.ts # Build configuration
├── popup/              # Popup interface source code
│   ├── src/            # React TypeScript source
│   ├── package.json    # Popup dependencies
│   └── vite.config.ts  # Build configuration
├── _locales/           # Internationalization files
├── assets/             # Extension icons and assets
├── manifest.firefox.json # Firefox-specific manifest
└── package.json        # Root package file
```

## Installation Steps

`npm ci` installs exactly the versions in each `package-lock.json`.

### 1. Install Root Dependencies

```bash
npm ci
```

It also sets up the git hooks used during development (husky). Outside a git checkout, such as the unpacked source archive, it prints `.git can't be found` and the install carries on; the build does not use them.

### 2. Install Extension Dependencies

```bash
cd extension
npm ci
cd ..
```

### 3. Install Popup Dependencies

```bash
cd popup
npm ci
cd ..
```

## Build Process

### For Production Build (Firefox Store Submission)

1. **Set up Firefox manifest:**

```bash
npm run setup:firefox
```

1. **Build the extension:**

```bash
npm run build
```

### For Development Build

1. **Set up Firefox manifest:**

```bash
npm run setup:firefox
```

1. **Build development version:**

```bash
npm run build:dev
```

## Build Output

After running the build commands, the following files are generated:

- `extension/dist/background.bundle.js` - Background script
- `extension/dist/content.bundle.js` - Content script
- `extension/dist/styles.css` - Content styles
- `popup/dist/index.html` - Popup HTML
- `popup/dist/assets/` - Popup JavaScript and CSS files

## Source to Output Mapping

| Source File                              | Output File                           |
| ---------------------------------------- | ------------------------------------- |
| `extension/src/background/background.ts` | `extension/dist/background.bundle.js` |
| `extension/src/content/content.ts`       | `extension/dist/content.bundle.js`    |
| `extension/src/content/styles.css`       | `extension/dist/styles.css`           |
| `popup/src/App.tsx` (and dependencies)   | `popup/dist/assets/index-[hash].js`   |
| `popup/src/index.html`                   | `popup/dist/index.html`               |

## Build Tools Used

- **Vite**: Modern build tool and development server
- **TypeScript**: Type checking and compilation
- **React**: UI framework for popup interface
- **Rollup**: Module bundling (via Vite)
- **Concurrently**: Run multiple build processes in parallel

## Verification Steps

To verify the build matches the submitted extension:

1. Follow the installation and build steps above
2. Compare the generated files in `extension/dist/` and `popup/dist/`
3. File sizes and functionality should match the submitted extension exactly

## Dependencies

All dependencies are listed with exact versions in:

- `package.json` (root - build tools)
- `extension/package.json` (extension runtime dependencies)
- `popup/package.json` (popup UI dependencies)

Each has a `package-lock.json` next to it.

No external CDN resources are used during the build process.

## Build Configuration

The build process is configured through:

- `extension/vite.background.config.ts` - Background script build
- `extension/vite.content.config.ts` - Content script build
- `popup/vite.config.ts` - Popup interface build

## Troubleshooting

**Common Issues:**

1. **Node version**: Ensure Node.js 24.12.0 or newer is installed (`nvm use` reads `.nvmrc`)
2. **Permission errors**: Run with appropriate permissions
3. **Missing dependencies**: Run `npm ci` in all three directories
4. **Build failures**: Check that all source files are present

**Support:**
If you encounter issues during the build process, the complete source code structure and dependencies are included in this archive for your review.
