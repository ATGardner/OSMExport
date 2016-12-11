'use strict';
require('isomorphic-fetch');

function request(body) {
    return fetch('http://overpass-api.de/api/interpreter', {
        method: 'POST',
        body
    })
        .then(result => {
            if (!result.ok) {
                return Promise.reject(result.status);
            }

            return result.json();
        });
}

function fetchRelation(relationId) {
    return request(`[out:json][timeout:25];relation(${relationId});(._;>;);out body meta;`);
}

function fetchWater(relationId, buffer) {
    return request(`[out:json][timeout:25];rel(${relationId});node["amenity"="drinking_water"](around:${buffer});out body;`);
}

module.exports = {
    fetchRelation,
    fetchWater
};