# Changelog

## [2.6.0](https://github.com/ATGardner/OSMExport/compare/v2.5.0...v2.6.0) (2026-08-16)


### Features

* **observability:** add a Grafana dashboard for the exported metrics ([#552](https://github.com/ATGardner/OSMExport/issues/552)) ([4a3ac9e](https://github.com/ATGardner/OSMExport/commit/4a3ac9e6ed1b2e0e89f77fc328ef9568387fd360))


### Bug Fixes

* **osm:** send the real app version in the User-Agent ([#554](https://github.com/ATGardner/OSMExport/issues/554)) ([ec2cb76](https://github.com/ATGardner/OSMExport/commit/ec2cb7621bc187dce1e8897a08451628cb75db86))

## [2.5.0](https://github.com/ATGardner/OSMExport/compare/v2.4.0...v2.5.0) (2026-08-15)


### Features

* **export:** add kml and kmz endpoints for Google Earth ([#544](https://github.com/ATGardner/OSMExport/issues/544)) ([acec9a4](https://github.com/ATGardner/OSMExport/commit/acec9a40dd27f96c14c9c09c773c0229de3f3154))


### Bug Fixes

* **api:** answer 404 for a relation OSM cannot return ([#547](https://github.com/ATGardner/OSMExport/issues/547)) ([1300882](https://github.com/ATGardner/OSMExport/commit/1300882dc4e5bcf3e85546a8048fc27117220c30))
* **osm:** fetch relations from the OSM API instead of Overpass ([#545](https://github.com/ATGardner/OSMExport/issues/545)) ([78f252f](https://github.com/ATGardner/OSMExport/commit/78f252f144d91b68924143c0121c11f92a61c839))

## [2.4.0](https://github.com/ATGardner/OSMExport/compare/v2.3.0...v2.4.0) (2026-08-14)


### Features

* **logging:** cap the log files by size and count ([#540](https://github.com/ATGardner/OSMExport/issues/540)) ([32fd443](https://github.com/ATGardner/OSMExport/commit/32fd443efe57a62ac81fb5dff4f78c2931b3bb08))
* **metrics:** export prometheus metrics on a separate port ([#542](https://github.com/ATGardner/OSMExport/issues/542)) ([77bc227](https://github.com/ATGardner/OSMExport/commit/77bc227e5ae0b20155fcbef8c92ae240fb7c7413))


### Bug Fixes

* **logging:** write to stdout in production ([#543](https://github.com/ATGardner/OSMExport/issues/543)) ([1f5be29](https://github.com/ATGardner/OSMExport/commit/1f5be296b2e68a72bbd4c00e760fb648f28863e7))

## [2.3.0](https://github.com/ATGardner/OSMExport/compare/v2.2.0...v2.3.0) (2026-08-14)


### Features

* **api:** validate query params and reject bad input with 400 ([#537](https://github.com/ATGardner/OSMExport/issues/537)) ([b101685](https://github.com/ATGardner/OSMExport/commit/b1016855c91662f625625b6433a6e04a2e6a1720))
* **chart:** add optional PVC for the winston log files ([#539](https://github.com/ATGardner/OSMExport/issues/539)) ([96e6287](https://github.com/ATGardner/OSMExport/commit/96e628751f7b1a93d86675236d7f3fd17d7584ad))

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
