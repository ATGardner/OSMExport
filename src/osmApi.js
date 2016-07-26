'use strict';
const fetch = require('node-fetch'),
    jxon = require('jxon');

function request(url) {
    return fetch(url)
        .then(res => {
            if (!res.ok) {
                return Promise.reject(`Failed OSM request, url: '${url}'`);
            }

            return res.text();
        })
        .then(res => jxon.stringToJs(res));
}

function fetchRelation(relationId, full) {
    const url = `http://api.openstreetmap.org/api/0.6/relation/${relationId}${full ? '/full' : ''}`;
    return request(url);
}

module.exports = {
    fetchRelation: fetchRelation
};