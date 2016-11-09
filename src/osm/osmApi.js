'use strict';
require('isomorphic-fetch');
// const jxon = require('jxon');

// function request(url) {
//     return fetch(url)
//         .then(res => {
//             if (!res.ok) {
//                 return Promise.reject(`Failed OSM request, url: '${url}'`);
//             }
//
//             return res.text();
//         })
//         .then(res => jxon.stringToJs(res));
// }

function request(body) {
    return fetch('http://overpass-api.de/api/interpreter', {
        method: 'POST',
        body
    }).then(result => {
        if (!result.ok) {
            return Promise.reject(result.status);
        }

        return result.json();
    })
}

function fetchRelation(relationId) {
    return request(`[out:json][timeout:25];relation(${relationId});(._;>;);out body meta;`);
}

module.exports = {
    fetchRelation: fetchRelation
};