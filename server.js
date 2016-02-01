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
        ec: `OSM2GPX`,
        ea: `Get`,
        el: relationId,
        aip: true
    }).send();
    cache.get(relationId)
        .catch(() => {
            visitor.event({
                ec: `OSM2GPX`,
                ea: `Cache miss`,
                el: relationId,
                aip: true
            }).send();
            return osm2gpx(relationId)
                .then(gpx => cache.put(gpx));
        })
        .then(path => {
                visitor.exception({
                    ec: `OSM2GPX`,
                    ea: `Download`,
                    el: relationId,
                    aip: true
                }).send();
                res.download(path);
            },
            error => {
                visitor.event({
                    exceptionDescription: error,
                    isExceptionFatal: true,
                    aip: true
                }).send();
                console.error(error);
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
