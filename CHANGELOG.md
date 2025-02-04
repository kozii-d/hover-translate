# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-02-04

### Added
- Added the ability to export saved translations from the dictionary in JSON and CSV format.
- Added Bing translator

### Changed
- Requests for translations are now sent directly to the Google Translate API from the client instead of my API server.
- Reduced the size of the extension bundle. Exclude unnecessary files.

### Fixed
- Fixed saving the translation to the dictionary when dragging subtitles

### Removed
-  Authentication logic.

## [1.0.1] - 2025-01-10

### Fixed
- Resolved an issue where the extension would stop working after navigating back to the YouTube homepage and then returning to a video.
- Fixed notification tooltip not appearing on embedded YouTube videos.

## [1.0.0] - 2025-01-01

- First release!
