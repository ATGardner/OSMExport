'use strict';
let express = require('express'),
    app = express(),
    Analytics = require('./analytics'),
    cache = require('./cache'),
    osm2gpx = require('./osm2gpx');

//1660381
//5775913
//282071
app.get('/osm2gpx', function (req, res) {
    let analytics = new Analytics(),
        relationId = req.query.relationId;
    analytics.sendEvent(`Get`, relationId);
    cache.get(relationId)
        .catch(() => {
            analytics.sendEvent(`Cache miss`, relationId);
            return osm2gpx(relationId)
                .then(gpx => cache.put(gpx));
        })
        .then(path => {
                analytics.sendEvent(`Download`, relationId);
                res.download(path);
            },
            error => {
                analytics.sendException(error);
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
