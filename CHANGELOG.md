# Changelog

## 0.1.0-beta.4 — 2026-03-26
- Added capability helpers: `getCapabilities`, `canPutObject`, `canPinObject`,
  `canUnpinObject`, `canAnnounceDiscovery`, `retainObject`, `canRetainObject`
- Updated node mode docs for `client`, `edge`, and `server`
- Extended status response typing with mode and capability flags
- Improved error handling for client-mode restricted operations
- Added tests for node mode behaviors

## 0.1.0-beta.3 — 2026-03-17
- Added object APIs: `putObject`, `getObject`, `fetchObject`, `findProviders`
- Added pin management: `pinObject`, `unpinObject`
- Improved libp2p RPC handling and JSON parsing
- Updated TypeScript build configuration
- Updated README and examples
- Added unit tests for status and discovery logic

## 0.1.0-beta.2 — 2025-09-28
- Added discovery support (`announceDiscovery`, `lookupDiscovery`)
- Added `autoAttach()` helper for attaching to a running `dl-dht` node
- Improved SDK structure and exports
- Initial object and provider helper methods

## 0.1.0-beta.1 — 2025-09-22
- First beta release of `@delabs/dl-dht-sdk`
- Basic libp2p RPC client for `dl-dht`
- Supported operations: put, get, delete, status
- Requires a running `dl-dht` node