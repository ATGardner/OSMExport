declare module 'gpx' {
  export interface GpxPoint {
    latitude: number;
    longitude: number;
    name?: string;
  }
  export interface GpxFileMeta {
    description?: string;
    name?: string;
    creator?: string;
    time?: string;
  }
  export interface GpxTrackMeta {
    name?: string;
    time?: string;
  }
  class GpxFileBuilder {
    constructor(meta?: GpxFileMeta);
    addWayPoints(points: GpxPoint | GpxPoint[]): this;
    addTrack(meta: GpxTrackMeta, points: GpxPoint[]): this;
    xml(): string;
  }
  const gpx: { GpxFileBuilder: typeof GpxFileBuilder };
  export = gpx;
}