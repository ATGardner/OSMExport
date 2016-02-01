'use strict';
let _ = require('lodash'),
    fs = require('fs'),
    moment = require('moment'),
    path = require('path'),
    sanitize = require('sanitize-filename');

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

function removeOldRelationFiles(relationId) {
    let relationDir = path.join('cache', relationId);
    return readdir(relationDir)
        .then(files => {
            if (_.isEmpty(files)) {
                return;
            }

            let fileName = path.join(relationDir, files[0]);
            return stat(fileName)
                .then(stat => {
                    if (moment().diff(stat.birthtime, 'seconds') > 1) {
                        return unlink(fileName)
                            .then(() => rmdir(relationDir));
                    }
                })
        });
}

function removeOldFiles() {
    return readdir('cache')
        .then(relationDirs => {
            let promises = _.map(relationDirs, removeOldRelationFiles);
            return Promise.all(promises);
        });
}

function exists(dir) {
    return new Promise((resolve, reject) => {
        console.log(`Checking if '${dir}' exists`);
        fs.exists(dir, exists => {
            console.log(`Result: ${exists}`);
            if (exists) {
                resolve();
            } else {
                reject();
            }
        });
    });
}

function mkdir(dir) {
    return new Promise((resolve, reject) => {
        console.log(`Making directory '${dir}'`);
        fs.mkdir(dir, err => {
            if (err && err.code !== 'EEXIST') {
                console.error(`Failed making directory, error: ${err}`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function rmdir(dir) {
    return new Promise((resolve, reject) => {
        console.log(`Removing directory '${dir}'`);
        fs.rmdir(dir, err => {
            if (err) {
                console.error(`Failed removing directory, error: ${err}`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function writeFile(path, data) {
    return new Promise((resolve, reject) => {
        console.log(`Writing file, path: '${path}'`);
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
    let cacheDir = 'cache';
    return exists(cacheDir)
        .catch(() => mkdir(cacheDir));
}

function get(relationId) {
    let relationDir = path.join('cache', relationId);
    return removeOldFiles()
        .then(() => exists(relationDir))
        .then(() => readdir(relationDir))
        .then(files => {
            if (_.isEmpty(files)) {
                return Promise.reject();
            }

            return path.join(relationDir, files[0]);
        });
}

function put(gpx) {
    let relationDir = path.join('cache', gpx.relationId),
        fileName = path.join(relationDir, `${sanitize(gpx.name)}-${moment(gpx.time).format('YY-MM-DD')}.gpx`);
    return mkdir(relationDir)
        .then(() => writeFile(fileName, gpx.xml))
        .then(() => fileName);
}

module.exports = {
    init: init,
    get: get,
    put: put
};