'use strict';
let express = require('express'),
    app = express(),
    cache = require('./cache'),
    osm2gpx = require('./osm2gpx');

//1660381
//5775913
//282071
app.get('/osm2gpx', function (req, res) {
    console.log('Got a req');
    let relationId = req.query.relationId;
    console.log(`Relation Id is ${relationId}`);
    cache.get(relationId)
        .catch(() => {
            return osm2gpx(relationId)
                .then(xml => cache.put(relationId, xml));
        })
        .then(path => {
                res.download(path);
            },
            error => {
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
