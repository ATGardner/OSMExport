'use strict';
const _ = require('lodash');
const Element = require('./Element');
const moment = require('moment');

function fixGaps(segments) {
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const [firstNodeOfNextSegment] = segments[i + 1];
    segment.push(firstNodeOfNextSegment);
  }
}

class Way extends Element {
  get timestamp() {
    return moment(this.element.timestamp);
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

  get type() {
    return 'Way';
  }

  constructor(way, nodesMap) {
    super(way);
    this.nodes = way.nodes.map(id => nodesMap.get(id));
  }

  createGpx(builder, limit) {
    const points = this.nodes.map(n => n.getPointData());
    const segments = limit > 1 ? _.chunk(points, limit - 1) : [points];
    fixGaps(segments);
    for (let i = 0; i < segments.length; i += 1) {
      builder.addTrack(
        {
          name: `${this.getName()}-seg${i}`,
          time: this.timestamp
        },
        [segments[i]]
      );
    }
  }

  reverse() {
    this.nodes.reverse();
  }

  markDistance(prevNode, markerDiff) {
    const markerNodes = [];
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      if (!prevNode) {
        node.distance = 0;
        const markerNode = node.destinationPoint(0, 0, 0);
        markerNode.distance = 0;
        markerNodes.push(markerNode);
      } else {
        let prevMarker = Math.floor(prevNode.distance / markerDiff);
        node.distance = prevNode.distance + prevNode.distanceTo(node);
        const nextMarker = Math.floor(node.distance / markerDiff);
        if (prevMarker < nextMarker) {
          const bearing = prevNode.initialBearingTo(node);
          const distance = (nextMarker - prevNode.distance / markerDiff) *
            markerDiff;
          const markerNode = prevNode.destinationPoint(
            distance,
            bearing,
            nextMarker
          );
          markerNode.distance = nextMarker;
          markerNodes.push(markerNode);
          prevMarker = nextMarker;
        }
      }

      prevNode = node;
    }

    return markerNodes;
  }
}

module.exports = Way;
