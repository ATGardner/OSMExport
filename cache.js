'use strict';
let _ = require('lodash'),
    moment = require('moment'),
    fs = require('fs');

function readdir(path) {
    console.log(`Reading dir '${path}'`);
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err) {
                console.error(`Failed reading dir, error: ${err}`);
                reject(err);
            } else {
                resolve(files);
            }
        })
    });
}

function stat(path) {
    console.log(`Reading stats for '${path}'`);
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if (err) {
                console.error(`Failed reading stats, error: ${err}`);
                reject(err);
            } else {
                resolve(stats);
            }
        })
    });
}

function unlink(path) {
    console.log(`Deleting '${path}'`);
    return new Promise((resolve, reject) => {
        fs.unlink(path, err => {
            if (err) {
                console.error(`Failed deleting file, error: ${err}`);
                reject(err);
            } else {
                resolve();
            }
        })
    });
}

function removeOldFiles() {
    return readdir('cache')
        .then(files => {
            let now = moment(),
                promises = _.map(files, f => {
                    let path = `cache/${f}`;
                    return stat(path)
                        .then(stat => {
                            if (now.diff(stat.birthtime, 'seconds') > 5) {
                                return unlink(path);
                            }
                        });
                });
            return Promise.all(promises);
        });
}

function exists(path) {
    return new Promise((resolve, reject) => {
        console.log(`Checking if '${path}' exists`);
        fs.exists(path, exists => {
            console.log(`Result: ${exists}`);
            if (exists) {
                resolve();
            } else {
                reject();
            }
        });
    });
}

function mkdir(path) {
    return new Promise((resolve, reject) => {
        console.log(`Making directory '${path}'`);
        fs.mkdir(path, err => {
            if (err) {
                console.error(`Failed making directory, error: ${err}`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function writeFile(path, data) {
    console.log(`Writing file, path: '${path}'`);
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, err => {
            if (err) {
                console.error(`Failed writing file, error: ${err}`);
                reject(err);
            } else {
                resolve();
            }
        })
    });
}

function init() {
    let path = 'cache';
    return exists(path)
        .catch(() => mkdir(path));
}

function get(relationId) {
    let path = `cache/${relationId}.gpx`;
    return removeOldFiles()
        .then(() => exists(path))
        .then(() => path);
}


function put(relationId, xml) {
    let path = `cache/${relationId}.gpx`;
    return writeFile(path, xml)
        .then(() => path);
}

module.exports = {
    init: init,
    get: get,
    put: put
};