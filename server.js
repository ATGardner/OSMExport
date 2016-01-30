'use strict';
let express = require('express'),
    app = express(),
    cache = require('./cache'),
    osm2gpx = require('./osm2gpx');

//1660381
//5775913
//282071
//app.get('/osm2gpx', function (req, res) {
//    console.log('Got a req');
//    let relationId = req.query.relationId;
//    console.log(`Relation Id is ${relationId}`);
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

app.get('/', function (req, res) {
    res.send('Hello World from express!');
});

app.listen(process.env.PORT || 3000, function () {
    console.log(`Example app listening on port ${process.env.PORT || 3000}!`);
});

//console.log('before init');
//cache.init()
//    .then(() => {
//        console.log('before listen');
//        app.listen(1337);
//        console.log('after listen');
//    });

//var http = require('http');
//var port = process.env.PORT || 1337;
//http.createServer(function(req, res) {
//    res.writeHead(200, { 'Content-Type': 'text/plain' });
//    res.end('Hello World\n');
//}).listen(port);