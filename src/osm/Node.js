'use strict';
const LatLon = require('geodesy').LatLonEllipsoidal;
const Element = require('./Element');

class Node extends Element {
    get lat() {
        return this.element.lat;
    }

    get lon() {
        return this.element.lon;
    }

    get latLon() {
        return new LatLon(this.lat, this.lon);
    }

    getPointData() {
        return {
            latitude: this.lat,
            longitude: this.lon,
            name: this.getName()
        };
    }

    createGpx(builder) {
        const point = this.getPointData();
        builder.addWayPoints(point);
    }

    distanceTo(other) {
        return this.latLon.distanceTo(other.latLon);
    }

    initialBearingTo(other) {
        return this.latLon.initialBearingTo(other.latLon);
    }

    destinationPoint(distance, bearing, id) {
        const {lat, lon} = this.latLon.destinationPoint(distance, bearing);
        return new Node({
            id,
            lat,
            lon,
            tags: {}
        });
    }

    equals(other) {
        if (this === other) {
            return true;
        }

        if (!(other instanceof Node)) {
            return false;
        }

        if (this.id === other.id) {
            return true;
        }

        return this.lat === other.lat && this.lon === other.lon;
    }
}

module.exports = Node;