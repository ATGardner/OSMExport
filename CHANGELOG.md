# Changelog

## [2.2.0](https://github.com/ATGardner/OSMExport/compare/v2.1.1...v2.2.0) (2026-08-13)


### Features

* **chart:** add HTTPRoute and Ingress templates ([#531](https://github.com/ATGardner/OSMExport/issues/531)) ([b6c62bc](https://github.com/ATGardner/OSMExport/commit/b6c62bc85c7b1f982d8e913bc25a227770c818fe))
* **ci:** build the image for amd64 and arm64 ([#534](https://github.com/ATGardner/OSMExport/issues/534)) ([77d00ee](https://github.com/ATGardner/OSMExport/commit/77d00ee12a5f7b5aaeb553a4616b2ae8d55a6748))


### Bug Fixes

* **ci:** publish release charts without the `v` prefix ([#529](https://github.com/ATGardner/OSMExport/issues/529)) ([e6d08bb](https://github.com/ATGardner/OSMExport/commit/e6d08bbe4be2abd6584a5a4c811b2dc52db9d3b9))
* **ci:** sweep unreferenced package versions by reachability ([#535](https://github.com/ATGardner/OSMExport/issues/535)) ([f4dd787](https://github.com/ATGardner/OSMExport/commit/f4dd787f21a697022d2b84579cbc60946fb27ba0))

## [2.1.1](https://github.com/ATGardner/OSMExport/compare/v2.1.0...v2.1.1) (2026-08-13)


### Bug Fixes

* **ci:** only run CI on branch pushes, not tags ([#526](https://github.com/ATGardner/OSMExport/issues/526)) ([9b12214](https://github.com/ATGardner/OSMExport/commit/9b122142d8b52d884174434da044bad4b47c1696))
* **ci:** wait before pruning a deleted branch's images ([#528](https://github.com/ATGardner/OSMExport/issues/528)) ([5c81885](https://github.com/ATGardner/OSMExport/commit/5c81885312f58ec12818d6d307f10374ca9f51c1))

## [2.1.0](https://github.com/ATGardner/OSMExport/compare/v2.0.1...v2.1.0) (2026-08-13)


### Features

* add GitHub Actions workflow to enforce conventional PR titles ([#520](https://github.com/ATGardner/OSMExport/issues/520)) ([8e8cb68](https://github.com/ATGardner/OSMExport/commit/8e8cb682fefb89770d4ae60d30c09ce0d72732a9))


### Bug Fixes

* **ci:** run release-please with a GitHub App token ([#525](https://github.com/ATGardner/OSMExport/issues/525)) ([35be176](https://github.com/ATGardner/OSMExport/commit/35be176405c7be1b4e75208cc78285c2afa1edb0))
* **deps:** Lock file maintenance ([#523](https://github.com/ATGardner/OSMExport/issues/523)) ([6969204](https://github.com/ATGardner/OSMExport/commit/6969204027d4756b264a0884c36f47d96d48a7e0))
