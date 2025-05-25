# Changelog

All notable changes to this project will be documented in this file.

## [1.1.3] - Unreleased

### Added
- Toast notifications for errors and warnings.
- Warning notification when switching translators if the selected language is not supported by the new translator.

### Changed
- Enabled auto-save for Settings and Customize forms. Changes are now saved automatically without requiring a "Save" button.

## [1.1.2] - Unreleased

### Added
- UI language support for: Spanish, French, German, Polish, Portuguese (Brazil), Portuguese (Portugal), Japanese, Korean, and Hindi.

### Fixed
- Improved the logic for observing subtitles in the video player.

## [1.1.1] - 2025-05-02

### Added
- Added the ability to enable/disable the dictionary.
- Added the ability to enable/disable permanent multiply selection instead of holding the Shift key.
- Added the ability to enable/disable notifications.

## [1.1.0] - 2025-02-04

### Added
- Added the ability to export saved translations from the dictionary in JSON and CSV format.
- Added Bing translator.

### Changed
- Requests for translations are now sent directly to the Google Translate API from the client instead of my API server.
- Reduced the size of the extension bundle. Exclude unnecessary files.

### Fixed
- Fixed saving the translation to the dictionary when dragging subtitles.

### Removed
-  Authentication logic.

## [1.0.1] - 2025-01-10

### Fixed
- Resolved an issue where the extension would stop working after navigating back to the YouTube homepage and then returning to a video.
- Fixed the notification tooltip not appearing on embedded YouTube videos.

## [1.0.0] - 2025-01-01

- First release!
