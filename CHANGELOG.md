# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 4.2: Error State System**
  - Centralized error codes utility in `src/utils/errors.js`.
  - Reusable `<AsyncBoundary>` component with loading, error, and empty states.
  - Exponential backoff cooldown (1s, 2s, 5s) for retry button actions.
  - Safe-wrapping IPC registration helper `safeHandle` in `index.js`.
  - Offline warning banner at the top of the main layout, rendering when internet connection is lost.
