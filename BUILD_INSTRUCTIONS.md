# Build Instructions for HoverTranslate Firefox Extension

This document provides step-by-step instructions to build the HoverTranslate extension from source code for Firefox Add-ons review.

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Operating System**: Windows, macOS, or Linux

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

### 1. Install Root Dependencies
```bash
npm install
```

### 2. Install Extension Dependencies
```bash
cd extension
npm install
cd ..
```

### 3. Install Popup Dependencies
```bash
cd popup
npm install
cd ..
```

## Build Process

### For Production Build (Firefox Store Submission)

1. **Set up Firefox manifest:**
```bash
npm run setup:firefox
```

2. **Build the extension:**
```bash
npm run build
```

### For Development Build

1. **Set up Firefox manifest:**
```bash
npm run setup:firefox
```

2. **Build development version:**
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

| Source File | Output File |
|-------------|-------------|
| `extension/src/background/background.ts` | `extension/dist/background.bundle.js` |
| `extension/src/content/content.ts` | `extension/dist/content.bundle.js` |
| `extension/src/content/styles.css` | `extension/dist/styles.css` |
| `popup/src/App.tsx` (and dependencies) | `popup/dist/assets/index-[hash].js` |
| `popup/src/index.html` | `popup/dist/index.html` |

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

All dependencies are explicitly listed in:
- `package.json` (root - build tools)
- `extension/package.json` (extension runtime dependencies)
- `popup/package.json` (popup UI dependencies)

No external CDN resources are used during the build process.

## Build Configuration

The build process is configured through:
- `extension/vite.background.config.ts` - Background script build
- `extension/vite.content.config.ts` - Content script build
- `popup/vite.config.ts` - Popup interface build

## Troubleshooting

**Common Issues:**

1. **Node version**: Ensure Node.js 18+ is installed
2. **Permission errors**: Run with appropriate permissions
3. **Missing dependencies**: Run `npm install` in all directories
4. **Build failures**: Check that all source files are present

**Support:**
If you encounter issues during the build process, the complete source code structure and dependencies are included in this archive for your review.