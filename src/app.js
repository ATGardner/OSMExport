'use strict';
const express = require('express');
const moment = require('moment');
const sanitize = require('sanitize-filename');
const ua = require('universal-analytics');
const winston = require('winston');
const osm2gpx = require('./osm2gpx');
const app = express();

winston.level = 'verbose';
if (app.get('env') === 'production') {
    app.use(ua.middleware('UA-18054605-12', {cookieName: '_ga'}));
}

function sendEvent(visitor, action, label) {
    winston.info(`${action} - ${label}`);
    if (visitor) {
        visitor.event({
            ec: 'OSM2GPXv4',
            ea: action,
            el: label,
            aip: true
        }).send();
    }
}

function sendTiming(visitor, variable, time) {
    winston.info(`${variable} - ${time}ms`);
    if (visitor) {
        visitor.timing({
            utc: 'OSM2GPXv4',
            utv: variable,
            utt: time,
            aip: true
        }).send();
    }
}

//http://localhost:3000/osm2gpx?relationId=1660381&combineWays=0
//http://localhost:3000/osm2gpx?relationId=282071&combineWays=1&segmentLimit=0
//http://localhost:3000/osm2gpx?relationId=282071&markerDiff=1609.34
//1660381
//5775913
//282071
app.get('/osm2gpx', ({query, query: {relationId}, visitor}, res) => {
    const start = moment();
    sendEvent(visitor, 'Creating gpx', relationId);
    return osm2gpx.getRelation(query)
        .then(
            ({fileName, gpx}) => {
                const end = moment().diff(start);
                sendTiming(visitor, 'getRelationTime', end);
                fileName = encodeURI(sanitize(fileName));
                res.set({
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                    'Content-Type': 'application/xml'
                });
                return res.send(gpx);
            },
            error => {
                const end = moment().diff(start);
                sendTiming(visitor, 'failureTime', end);
                sendEvent(visitor, 'Error', `${relationId} - ${error}`);
                res.writeHead(500, {'Content-Type': 'text/plain'});
                res.write(error.stack);
                res.send();
            }
        );
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    winston.info(`OSM2GPX listening on port ${port}!`);
});
