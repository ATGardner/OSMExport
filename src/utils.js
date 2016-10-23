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

class Section {
    constructor(way) {
        this.ways = [way];
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

    reverse() {
        for (const way of this.ways) {
            reverseWay(way)
        }

        this.ways.reverse();
    }

    getStart() {
        const [{nodes: [start]}] = this.ways;
        return start;
    }

    getEnd() {
        const {nodes} = this.ways[this.ways.length - 1];
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

function getNextWay(ways, section) {
    const {start: start1, end: end1} = section.getStartAndEnd();
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

function reverseWay(way) {
    way.nodes.reverse();
}

function getNextSection(sections, sortedSections) {
    const result = getFirstAndLast(sortedSections);
    const [firstSection, lastSection] = result;
    const start = firstSection.getStart();
    const end = lastSection.getEnd();
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

function addSectionToSortedSections(sections, section, connection) {
    if (connection === Connection.NONE) {
        return;
    }

    switch (connection) {
        case Connection.END_START:
            sections.push(section);
            break;
        case Connection.END_END:
            section.reverse();
            sections.push(section);
            break;
        case Connection.START_END:
            sections.unshift(section);
            break;
        case Connection.START_START:
            section.reverse();
            sections.unshift(section);
            break;
    }
}

function sortSections(sections) {
    const sortedSections = sections.splice(0, 1);
    do {
        const {section, connection} = getNextSection(sections, sortedSections);
        addSectionToSortedSections(sortedSections, section, connection);
    } while (sections.length);
    return sortedSections;
}

function sortWays(relation) {
    const ways = relation.members.filter(({type}) => type === 'way');
    const sections = [];
    do {
        const [way] = ways.splice(0, 1);
        const section = new Section(way);
        let connection;
        do {
            const nextWay = getNextWay(ways, section);
            connection = nextWay.connection;
            section.addWay(nextWay.way, connection);
        } while (connection !== Connection.NONE);
        sections.push(section);
    } while (ways.length);
    relation.sections = sortSections(sections);
    const relationNodes = relation.members.filter(({type}) => type === 'node');
    relation.members = _.flatten(relation.sections.map(s => s.ways));
    relation.members.push([...relationNodes]);
}

function joinWays(relation) {
    sortWays(relation);
}

module.exports = {
    sortWays
};