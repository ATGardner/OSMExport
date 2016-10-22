'use strict';
const moment = require('moment');

function getFirstAndLast(array) {
    return [array[0], array[array.length - 1]];
}

function equalNodes({$lat: lat1, $lon: lon1}, {$lat: lat2, $lon: lon2}) {
    return lat1 === lat2 && lon1 === lon2;
}

const Connection = {
    NONE: Symbol('NONE'),
    END_START: Symbol('END_START'),
    END_END: Symbol('END_END'),
    START_END: Symbol('START_END'),
    START_START: Symbol('START_START'),
};

function getNextWay(ways, {nodes: nodes1}) {
    const [start1, end1] = getFirstAndLast(nodes1);
    for (let i = 0; i < ways.length; i += 1) {
        const way2 = ways[i];
        const {nodes: nodes2} = way2;
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
            return {way: way2, connection};
        }
    }

    return {
        connection: Connection.NONE
    };
}

function combineNodes(way1, way2, connection) {
    if (connection === Connection.NONE) {
        return;
    }

    const {nodes: nodes1, $timestamp: timestamp1} = way1;
    const {nodes: nodes2, $timestamp: timestamp2} = way2;
    way1.$timestamp = moment.max(moment(timestamp1), moment(timestamp2)).toISOString();
    switch (connection) {
        case Connection.END_START: {
            const rest = nodes2.slice(1);
            nodes1.push(...rest);
            break;
        }
        case Connection.END_END: {
            const rest = nodes2.slice(0, -1).reverse();
            nodes1.push(...rest);
            break;
        }
        case Connection.START_END:{
            const rest = nodes2.slice(0, -1);
            nodes1.unshift(...rest);
            break;
        }
        case Connection.START_START: {
            const rest = nodes2.slice(1).reverse();
            nodes1.unshift(...rest);
            break;
        }
    }
}

function joinWays(relation) {
    const ways = relation.members.filter(({type}) => type === 'way');
    const relationNodes = relation.members.filter(({type}) => type === 'node');
    const combinedWays = [];
    let id = 0;
    do {
        const [firstWay] = ways.splice(0, 1);
        const way1 = {
            $id: `combined-${id}`,
            nodes: firstWay.nodes.slice(0),
            $timestamp: firstWay.$timestamp,
            tags: {},
            type: 'way'
        };
        let connection;
        do {
            const nextWay = getNextWay(ways, way1);
            connection = nextWay.connection;
            combineNodes(way1, nextWay.way, connection);
        } while (connection !== Connection.NONE);
        combinedWays.push(way1);
        id += 1;
    } while (ways.length);
    combinedWays.push(...relationNodes);
    relation.members = combinedWays;
}

module.exports = {
    joinWays
};