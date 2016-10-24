'use strict';
const _ = require('lodash');
const moment = require('moment');
const LatLon = require('geodesy').LatLonEllipsoidal;

function getFirstAndLast(array) {
    return [array[0], array[array.length - 1]];
}

function equalNodes({$lat: lat1, $lon: lon1}, {$lat: lat2, $lon: lon2}) {
    return lat1 === lat2 && lon1 === lon2;
}

function toLatLon({$lat, $lon}) {
    return new LatLon($lat, $lon);
}

const Connection = {
    NONE: Symbol('NONE'),
    END_START: Symbol('END_START'),
    END_END: Symbol('END_END'),
    START_END: Symbol('START_END'),
    START_START: Symbol('START_START'),
};

/**
 * A Section is an array of OSM ways, which connect to each other (way-n END node is identical to way-n+1 START node)
 */
class Section {
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
        const {start: start1, end: end1} = this.getStartAndEnd();
        if (!start1) {
            const [way] = ways.splice(0, 1);
            return {
                way,
                connection: Connection.END_START
            };
        }

        for (let i = 0; i < ways.length; i += 1) {
            const way = ways[i];
            const {nodes: nodes2} = way;
            const [start2, end2] = getFirstAndLast(nodes2);
            let connection = Connection.NONE;
            if (equalNodes(end1, start2)) {
                connection = Connection.END_START;
            } else if (equalNodes(end1, end2)) {
                connection = Connection.END_END;
            } else if (equalNodes(start1, end2)) {
                connection = Connection.START_END;
            } else if (equalNodes(start1, start2)) {
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
                reverseWay(way);
                this.ways.push(way);
                break;
            case Connection.START_END:
                this.ways.unshift(way);
                break;
            case Connection.START_START:
                reverseWay(way);
                this.ways.unshift(way);
                break;
        }
    }

    getWays() {
        return this.ways;
    }

    combineWays(id) {
        const [firstWay] = this.ways;
        const way = {
            $id: `combined-${id}`,
            nodes: firstWay.nodes.slice(0),
            $timestamp: moment.max(...this.ways.map(w => moment(w.$timestamp))).toISOString(),
            tags: {},
            type: 'way'
        };
        for (let i = 1; i < this.ways.length; i += 1) {
            const {nodes} = this.ways[i];
            way.nodes.push(...nodes.slice(1));
        }

        return way;
    }

    reverse() {
        for (const way of this.ways) {
            reverseWay(way)
        }

        this.ways.reverse();
    }

    getStart() {
        const [{nodes: [start]} = {nodes: []}] = this.ways;
        return start;
    }

    getEnd() {
        const {nodes} = this.ways[this.ways.length - 1] || {nodes: []};
        return nodes[nodes.length - 1];
    }

    getStartAndEnd() {
        const start = this.getStart();
        const end = this.getEnd();
        return {
            start,
            end
        };
    }

    getDistanceTo(start1, end1) {
        start1 = toLatLon(start1);
        end1 = toLatLon(end1);
        let {start: start2, end: end2} = this.getStartAndEnd();
        start2 = toLatLon(start2);
        end2 = toLatLon(end2);
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

class Sections {
    constructor() {
        this.sortedSections = [];
    }

    addWays(ways) {
        const sections = [];
        do {
            const section = new Section();
            section.addConnectedWays(ways);
            sections.push(section);
        } while (ways.length);
        this.addSections(sections);

    }

    addSections(sections) {
        do {
            const {section, connection} = this.getClosestSection(sections);
            this.addSection(section, connection);
        } while (sections.length);
    }

    getClosestSection(sections) {
        const {start, end} = this.getStartAndEnd();
        if (!start) {
            const [section] = sections.splice(0, 1);
            return {
                section,
                connection: Connection.END_START
            };
        }

        let minDistance = {
            value: Number.MAX_VALUE,
            connection: Connection.NONE
        };
        let minIndex;
        for (let i = 0; i < sections.length; i += 1) {
            const section = sections[i];
            const distance = section.getDistanceTo(start, end);
            if (distance.value < minDistance.value) {
                minDistance = distance;
                minIndex = i;
            }
        }

        const [section] = sections.splice(minIndex, 1);
        return {
            section,
            connection: minDistance.connection
        };
    }

    addSection(section, connection) {
        if (connection === Connection.NONE) {
            return;
        }

        switch (connection) {
            case Connection.END_START:
                this.sortedSections.push(section);
                break;
            case Connection.END_END:
                section.reverse();
                this.sortedSections.push(section);
                break;
            case Connection.START_END:
                this.sortedSections.unshift(section);
                break;
            case Connection.START_START:
                section.reverse();
                this.sortedSections.unshift(section);
                break;
        }
    }

    getWays() {
        return _.flatten(this.sortedSections.map(s => s.getWays()))
    }

    combineWays() {
        return this.sortedSections.map((s, i) => s.combineWays(i));
    }

    getStartAndEnd() {
        const [firstSection, lastSection] = getFirstAndLast(this.sortedSections);
        if (!firstSection) {
            return {};
        }

        const start = firstSection.getStart();
        const end = lastSection.getEnd();
        return {
            start,
            end
        };
    }
}

function reverseWay(way) {
    way.nodes.reverse();
}

function createSections(relation) {
    const ways = relation.members.filter(({type}) => type === 'way');
    const sections = new Sections();
    sections.addWays(ways);
    return sections;
}

function sortWays(relation) {
    const sections = createSections(relation);
    const relationNodes = relation.members.filter(({type}) => type === 'node');
    relation.members = sections.getWays();
    relation.members.push([...relationNodes]);
}

function combineWays(relation) {
    const sections = createSections(relation);
    const relationNodes = relation.members.filter(({type}) => type === 'node');
    relation.members = sections.combineWays();
    relation.members.push([...relationNodes]);
}

module.exports = {
    sortWays,
    combineWays
};