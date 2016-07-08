'use strict';
const express = require('express'),
    ua = require('universal-analytics'),
    winston = require('winston'),
    cache = require('./cache'),
    osm2gpx = require('./osm2gpx'),
    app = express();

winston.level = 'verbose';
app.use(ua.middleware('UA-18054605-12', {cookieName: '_ga'}));

//1660381
//5775913
//282071
app.get('/osm2gpx', function ({query: {relationId}, visitor}, res) {
    return osm2gpx.getRelation(visitor, relationId)
        .then(path => {
                res.download(path);
            },
            error => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.write(error);
                res.send();
            });
});

app.listen(process.env.PORT || 1337, function () {
    winston.info(`OSM2GPX listening on port ${process.env.PORT || 1337}!`);
});
