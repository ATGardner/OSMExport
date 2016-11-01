'use strict';
const _ = require('lodash');
const Element = require('./Element');
const moment = require('moment');

function createMarkerNode(start, end, distance) {
    const bearing = start.bearingTo(end);
    const latLon = start.destinationPoint(distance, bearing);
}

class Way extends Element {
    get timestamp() {
        return moment(this.element.$timestamp);
    }

    get start() {
        return this.nodes[0];
    }

    get end() {
        return _.last(this.nodes);
    }

    get startAndEnd() {
        return {
            start: this.start,
            end: this.end
        };
    }

    constructor(way, nodesMap) {
        super(way);
        this.nodes = way.nd.map(({$ref}) => nodesMap.get($ref));
    }

    createGpx(builder, limit) {
        const points = this.nodes.map(n => n.getPointData());
        const segments = limit ? _.chunk(points, limit) : [points];
        for (let i = 0; i < segments.length; i += 1) {
            builder.addTrack({
                name: `${this.getName()}-seg${i}`,
                time: this.timestamp
            }, [segments[i]]);
        }
    }

    reverse() {
        this.nodes.reverse();
    }

    markDistance(prev, markerDiff) {
        let node;
        let prevMarker = prev ? Math.floor(prev.distance / markerDiff) : 0;
        const markerNodes = [];
        for (let i = 0; i < this.nodes.length; i += 1) {
            node = this.nodes[i];
            const distance = prev ? prev.distance + prev.distanceTo(node) : 0;
            node.distance = distance;
            const nextMarker = Math.floor(distance / markerDiff);
            if (distance % markerDiff === 0) {
                markerNodes.push(node);
            } else if (prevMarker < nextMarker) {
                prevMarker = nextMarker;
                const prevNode = i === 0 ? prev : this.nodes[i - 1];
                const bearing = prevNode.initialBearingTo(node);
                const distance = (prevMarker - prevNode.distance / markerDiff) * markerDiff;
                const markerNode = prevNode.destinationPoint(distance, bearing, prevMarker);
                markerNodes.push(markerNode);
            }

            prev = node;
        }

        return markerNodes;
    }
}

module.exports = Way;