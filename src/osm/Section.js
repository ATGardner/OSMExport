'use strict';
const _ = require('lodash');
const moment = require('moment');
const Connection = require('./Connection');
const Way = require('./Way');

/**
 * A Section is an array of OSM ways, which connect to each other (way-n END node is identical to way-n+1 START node)
 */
class Section {
    get start() {
        return this.ways[0].start;
    }

    get end() {
        return _.last(this.ways).end;
    }

    get startAndEnd() {
        const start = this.start;
        const end = this.end;
        return {
            start,
            end
        };
    }

    constructor() {
        this.ways = [];
    }

    addConnectedWays(ways) {
        let connection;
        do {
            const nextWay = this.getNextWay(ways);
            connection = nextWay.connection;
            this.addWay(nextWay.way, connection);
        } while (connection !== Connection.NONE);
    }

    getNextWay(ways) {
        if (!this.ways.length) {
            const [way] = ways.splice(0, 1);
            return {
                way,
                connection: Connection.END_START
            };
        }

        const {start: start1, end: end1} = this.startAndEnd;
        for (let i = 0; i < ways.length; i += 1) {
            const way = ways[i];
            const {start: start2, end: end2} = way.startAndEnd;
            let connection = Connection.NONE;
            if (end1.equals(start2)) {
                connection = Connection.END_START;
            } else if (end1.equals(end2)) {
                connection = Connection.END_END;
            } else if (start1.equals(end2)) {
                connection = Connection.START_END;
            } else if (start1.equals(start2)) {
                connection = Connection.START_START;
            }

            if (connection !== Connection.NONE) {
                ways.splice(i, 1);
                return {way: way, connection};
            }
        }

        return {
            connection: Connection.NONE
        };
    }

    addWay(way, connection) {
        if (connection === Connection.NONE) {
            return;
        }

        switch (connection) {
            case Connection.END_START:
                this.ways.push(way);
                break;
            case Connection.END_END:
                way.reverse();
                this.ways.push(way);
                break;
            case Connection.START_END:
                this.ways.unshift(way);
                break;
            case Connection.START_START:
                way.reverse();
                this.ways.unshift(way);
                break;
        }
    }

    getWays() {
        return this.ways;
    }

    combineWays(id) {
        const [firstWay] = this.ways;
        const way = new Way({
            $id: `combined-${id}`,
            $timestamp: moment.max(...this.ways.map(w => moment(w.$timestamp))).toISOString(),
            tags: {},
            nd: []
        });
        way.nodes = firstWay.nodes.slice(0);
        for (let i = 1; i < this.ways.length; i += 1) {
            const {nodes} = this.ways[i];
            way.nodes.push(...nodes.slice(1));
        }

        return way;
    }

    reverse() {
        this.ways.forEach(w => w.reverse());
        this.ways.reverse();
    }

    getDistanceTo(sections) {
        let {start: start1, end: end1} = sections.startAndEnd;
        start1 = start1.latLon;
        end1 = end1.latLon;
        let {start: start2, end: end2} = this.startAndEnd;
        start2 = start2.latLon;
        end2 = end2.latLon;
        const distanceES = end1.distanceTo(start2);
        const distanceEE = end1.distanceTo(end2);
        const distanceSE = start1.distanceTo(end2);
        const distanceSS = start1.distanceTo(start2);
        const value = Math.min(distanceES, distanceEE, distanceSE, distanceSS);
        let connection;
        switch (value) {
            case distanceES:
                connection = Connection.END_START;
                break;
            case distanceEE:
                connection = Connection.END_END;
                break;
            case distanceSE:
                connection = Connection.START_END;
                break;
            case distanceSS:
                connection = Connection.START_START;
                break;
        }

        return {
            value,
            connection
        };
    }
}

module.exports = Section;