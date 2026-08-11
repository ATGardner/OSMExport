/*
 * @types/geodesy is unusable under moduleResolution: nodenext. It declares
 * "type": "module" but its .d.ts files import each other without extensions
 * (`import LatLonEllipsoidal from "./latlon-ellipsoidal"`), which ESM
 * resolution rejects. The base class then resolves to an error type and every
 * inherited member — the constructor, lat, lon — disappears from the subclass.
 * skipLibCheck hides the diagnostic, not the consequence.
 *
 * So: declare only what we use, against geodesy's own source.
 */
declare module 'geodesy/latlon-ellipsoidal-vincenty.js' {
  class LatLonEllipsoidalVincenty {
    constructor(lat: number, lon: number, height?: number);
    get lat(): number;
    get lon(): number;
    get height(): number;
    distanceTo(point: LatLonEllipsoidalVincenty): number;
    initialBearingTo(point: LatLonEllipsoidalVincenty): number;
    finalBearingTo(point: LatLonEllipsoidalVincenty): number;
    destinationPoint(
      distance: number,
      initialBearing: number,
    ): LatLonEllipsoidalVincenty;
  }

  export default LatLonEllipsoidalVincenty;
}
