'use strict';
const _ = require('lodash');
const Element = require('./Element');
const moment = require('moment');

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
        builder.addTrack({
            name: this.getName(),
            time: this.timestamp
        }, segments);
    }

    reverse() {
        this.nodes.reverse();
    }

    markDistance(prev) {
        let node;
        for (let i = 0; i < this.nodes.length; i += 1) {
            node = this.nodes[i];
            node.distance = prev ? prev.distance + prev.distanceTo(node) : 0;
            prev = node;
        }

        return node;
    }
}

module.exports = Way;