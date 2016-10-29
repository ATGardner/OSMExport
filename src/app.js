'use strict';
const express = require('express');
const moment = require('moment');
const sanitize = require('sanitize-filename');
const ua = require('universal-analytics');
const winston = require('winston');
const cache = require('./cache');
const osm2gpx = require('./osm2gpx');
const app = express();

winston.level = 'verbose';
if (app.get('env') === 'production') {
    app.use(ua.middleware('UA-18054605-12', {cookieName: '_ga'}));
}

//http://localhost:1337/osm2gpx?relationId=1660381
//http://localhost:1337/osm2gpx?relationId=282071
//1660381
//5775913
//282071
app.get('/osm2gpx', function ({query, visitor}, res) {
    return osm2gpx.getRelation(visitor, query)
        .then(gpxFileName => res.download(gpxFileName),
            ({stack}) => {
                res.writeHead(500, {'Content-Type': 'text/plain'});
                res.write(stack);
                res.send();
            });
});

app.listen(process.env.PORT || 1337, function () {
    winston.info(`OSM2GPX listening on port ${process.env.PORT || 1337}!`);
});
