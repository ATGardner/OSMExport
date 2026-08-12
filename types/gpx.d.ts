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
  export interface GpxFileBuilder {
    addWayPoints(points: GpxPoint | GpxPoint[]): this;

    addTrack(meta: GpxTrackMeta, points: GpxPoint[]): this;

    xml(): string;
  }
  const gpx: {
    GpxFileBuilder: new (meta?: GpxFileMeta) => GpxFileBuilder;
  };
  export = gpx;
}
