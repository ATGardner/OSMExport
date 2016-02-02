'use strict';
let fetch = require('node-fetch'),
    parseString = require('xml2js').parseString;

function parseData(xml) {
    return new Promise((resolve, reject) => parseString(xml, (err, result) => {
        if (err) {
            console.error(`Failed parsing xml, err: ${err}`);
            reject(err);
        } else {
            resolve(result);
        }
    }));
}

function request(url) {
    return fetch(url)
        .then(res => {
            if (!res.ok) {
                return Promise.reject(`Failed OSM request, url: '${url}'`);
            }

            return res.text();
        })
        .then(parseData);
}

function fetchRelation(relationId, full) {
    let url = `http://api.openstreetmap.org/api/0.6/relation/${relationId}${full ? '/full' : ''}`;
    return request(url);
}

module.exports = {
    fetchRelation: fetchRelation
};