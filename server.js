'use strict';
//let express = require('express'),
//    app = express(),
//    cache = require('./cache'),
//    osm2gpx = require('./osm2gpx');

//1660381
//5775913
//282071
//app.get('/osm2gpx', function (req, res) {
//    let relationId = req.query.relationId;
//    cache.get(relationId)
//        .catch(() => {
//            return osm2gpx(relationId)
//                .then(xml => cache.put(relationId, xml));
//        })
//        .then(path => {
//                res.download(path);
//                //res.writeHead(200, {'Content-Type': 'text/xml'});
//                //res.write(xml);
//                //res.end();
//            },
//            error => {
//                res.writeHead(200, {'Content-Type': 'text/plain'});
//                res.write(error);
//                res.end();
//            });
//});
//cache.init()
//    .then(() => app.listen(1337));

var http = require('http');
var port = process.env.PORT || 1337;
http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World\n');
}).listen(port);