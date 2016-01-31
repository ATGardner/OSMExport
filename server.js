'use strict';
let express = require('express'),
    app = express(),
    ua = require('universal-analytics'),
    cache = require('./cache'),
    osm2gpx = require('./osm2gpx');

//1660381
//5775913
//282071
app.get('/osm2gpx', function (req, res) {
    let visitor = ua('UA-18054605-12'),
        relationId = req.query.relationId;
    visitor.event({
        eventCategory: `OSM2GPX`,
        eventAction: `Get`,
        eventLabel: relationId
    }).send();
    cache.get(relationId)
        .catch(() => {
            visitor.event({
                eventCategory: `OSM2GPX`,
                eventAction: `Cache miss`,
                eventLabel: relationId,
                anonymizeIp: true
            }).send();
            return osm2gpx(relationId)
                .then(xml => cache.put(relationId, xml));
        })
        .then(path => {
                visitor.exception({
                    eventCategory: `OSM2GPX`,
                    eventAction: `Download`,
                    eventLabel: relationId,
                    anonymizeIp: true
                }).send();
                res.download(path);
            },
            error => {
                visitor.event({
                    exceptionDescription: error,
                    isExceptionFatal: true,
                    anonymizeIp: true
                }).send();
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.write(error);
                res.end();
            });
});

cache.init()
    .then(() => {
        app.listen(process.env.PORT || 1337, function () {
            console.log(`Example app listening on port ${process.env.PORT || 1337}!`);
        });
    });
