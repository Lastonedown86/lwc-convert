# Changelog

## [1.8.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.7.0...v1.8.0) (2026-01-29)


### Features

* Interactive Dashboard and Settings Redesign ([#33](https://github.com/Lastonedown86/lwc-convert/issues/33)) ([32f36eb](https://github.com/Lastonedown86/lwc-convert/commit/32f36ebbcd3b5512abdc32a212c9c5eb3494d66f))

## [1.7.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.6.1...v1.7.0) (2026-01-27)


### Features

* add 3 UX quick wins - prettier grading, project root detection, and success toast ([8f79780](https://github.com/Lastonedown86/lwc-convert/commit/8f797804ec46fed3fef6443cb5f5c8f5b3a99211))

## [1.6.1](https://github.com/Lastonedown86/lwc-convert/compare/v1.6.0...v1.6.1) (2026-01-27)


### Bug Fixes

* use dynamic version in TUI header instead of hardcoded v1.3.1 ([c85a5bc](https://github.com/Lastonedown86/lwc-convert/commit/c85a5bc639e76f74a91d78e1e1ac2be719459849))

## [1.6.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.5.0...v1.6.0) (2026-01-27)


### Features

* enhance TUI with grade badges and step progress visualization ([bbaa7d8](https://github.com/Lastonedown86/lwc-convert/commit/bbaa7d89c68c891ec98e5907a2ecd2808b03c8bf))

## [1.5.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.4.0...v1.5.0) (2026-01-27)


### Features

* add CSV export for grading and update notifications ([5ddf4e5](https://github.com/Lastonedown86/lwc-convert/commit/5ddf4e5b9d1ddcbb1f7db3add33d0bde8ac7f6df))

## [1.4.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.3.5...v1.4.0) (2026-01-27)


### Features

* detect Aura components that extend other components ([d24b304](https://github.com/Lastonedown86/lwc-convert/commit/d24b3044e2e6d6363a7f1e9d7de8e9ff2b1cb69d))


### Bug Fixes

* lock visible rows to initial terminal size on mount ([3ed116c](https://github.com/Lastonedown86/lwc-convert/commit/3ed116ccadf5a481daab1e4b7c512afbb9cbeb9e))
* remove terminal resize listener to prevent disorienting re-renders ([da673c9](https://github.com/Lastonedown86/lwc-convert/commit/da673c96ee97f63dd9f3e813b2b6e0b329b1a156))
* scroll to keep selection visible when terminal is resized ([df48338](https://github.com/Lastonedown86/lwc-convert/commit/df48338617822fd1434c25b84bd2dbfa5a7fe98c))

## [1.3.5](https://github.com/Lastonedown86/lwc-convert/compare/v1.3.4...v1.3.5) (2026-01-26)


### Bug Fixes

* quote glob patterns in npm scripts for cross-platform compatibility ([6783e58](https://github.com/Lastonedown86/lwc-convert/commit/6783e580f53a4e7ccd811d1c7822c9dc98c95d0c))

## [1.3.4](https://github.com/Lastonedown86/lwc-convert/compare/v1.3.3...v1.3.4) (2026-01-26)


### Bug Fixes

* use tsx instead of ts-node for dev script ([d1728db](https://github.com/Lastonedown86/lwc-convert/commit/d1728dbb74ddf8374a7fb79c93ac3057d7d37412))

## [1.3.3](https://github.com/Lastonedown86/lwc-convert/compare/v1.3.2...v1.3.3) (2026-01-26)


### Bug Fixes

* switch to tsup bundler for ESM compatibility ([1aab5bf](https://github.com/Lastonedown86/lwc-convert/commit/1aab5bff9d3791e5161ef281c17917d0c26d0efd))

## [1.3.2](https://github.com/Lastonedown86/lwc-convert/compare/v1.3.1...v1.3.2) (2026-01-26)


### Bug Fixes

* add TUI keywords for npm discoverability ([475fb94](https://github.com/Lastonedown86/lwc-convert/commit/475fb940bbff53de5b6efe51457edf8a42600c06))

## [1.3.1](https://github.com/Lastonedown86/lwc-convert/compare/v1.3.0...v1.3.1) (2026-01-25)


### Bug Fixes

* add VF component (.component) discovery to grading and convert commands ([#19](https://github.com/Lastonedown86/lwc-convert/issues/19)) ([52a6122](https://github.com/Lastonedown86/lwc-convert/commit/52a612251ea12a5a25ae43c96894604e7e319563))

## [1.3.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.2.1...v1.3.0) (2026-01-25)


### Features

* add interactive TUI for grade complexity ([#17](https://github.com/Lastonedown86/lwc-convert/issues/17)) ([9f54955](https://github.com/Lastonedown86/lwc-convert/commit/9f54955fca3738da1de8854536da46fbc293745d))

## [1.2.1](https://github.com/Lastonedown86/lwc-convert/compare/v1.2.0...v1.2.1) (2026-01-25)


### Bug Fixes

* add support for VF components (.component files) ([81f4133](https://github.com/Lastonedown86/lwc-convert/commit/81f4133a29f582a069778c9a5f73608277ccb54a))
* improve project scanning to read sfdx-project.json ([4077442](https://github.com/Lastonedown86/lwc-convert/commit/40774426fce7fe8fb9c897712ae31673c292ce5d))

## [1.2.0] - 2026-01-25
- Add feature XYZ

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.1.4...v1.2.0) (2026-01-25)


### Features

* add dependency graph analyzer for migration planning ([2ce8d79](https://github.com/Lastonedown86/lwc-convert/commit/2ce8d798f0775925a380940b1a51c368dba1322b))

## [1.1.4](https://github.com/Lastonedown86/lwc-convert/compare/v1.1.3...v1.1.4) (2026-01-25)


### Bug Fixes

* use logger for error output in interactive mode ([a47d183](https://github.com/Lastonedown86/lwc-convert/commit/a47d18381d99381680a3daba9f55241d19f6cbd6))

## [1.1.3](https://github.com/Lastonedown86/lwc-convert/compare/v1.1.2...v1.1.3) (2026-01-25)


### Bug Fixes

* use logger instead of console.warn for consistency ([4f3e216](https://github.com/Lastonedown86/lwc-convert/commit/4f3e21612622b5047184f9e84021231e2d7401bc))

## [1.1.2](https://github.com/Lastonedown86/lwc-convert/compare/v1.1.1...v1.1.2) (2026-01-25)


### Bug Fixes

* use dynamic version in grading reports ([984a687](https://github.com/Lastonedown86/lwc-convert/commit/984a687a5c3f946a05a4c31dbbfd21f054a6b8aa))

## [1.1.1](https://github.com/Lastonedown86/lwc-convert/compare/v1.1.0...v1.1.1) (2026-01-25)


### Bug Fixes

* update default Salesforce API version to 62.0 ([7e48125](https://github.com/Lastonedown86/lwc-convert/commit/7e481256de9c48e1526cb67c7a7fefa6902ffbd0))

## [1.1.0](https://github.com/Lastonedown86/lwc-convert/compare/v1.0.2...v1.1.0) (2026-01-25)


### Features

* automate releases with conventional commits ([12fb08e](https://github.com/Lastonedown86/lwc-convert/commit/12fb08e1dacc90a6ec506c29e483034929714257))


### Bug Fixes

* remove duplicate icon in logger ([0829626](https://github.com/Lastonedown86/lwc-convert/commit/0829626749c1a2d769ae8c6f03442797c5e0d973))
* sync CLI version with package.json ([f7768bc](https://github.com/Lastonedown86/lwc-convert/commit/f7768bc5354303f3377eb399395b062d05bacdaf))

## [Unreleased]

### Added
- GitHub Actions workflow for automated npm publishing
- Release script for version management
- CHANGELOG.md for tracking changes

### Changed
- Enhanced CI/CD pipeline with automated releases

## [1.0.0] - 2026-01-23

### Added
- Initial release of lwc-convert CLI tool
- Aura component to LWC conversion
- Visualforce to LWC conversion
- Interactive CLI with confidence scoring
- Session storage for conversion history
- Test case comparison between source and converted components
- Comprehensive test suite
- CI workflow for build and test status checks

[Unreleased]: https://github.com/Lastonedown86/lwc-convert/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Lastonedown86/lwc-convert/releases/tag/v1.0.0
