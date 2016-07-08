'use strict';
let _ = require('lodash'),
    fs = require('fs'),
    moment = require('moment'),
    path = require('path'),
    sanitize = require('sanitize-filename'),
    schedule = require('node-schedule'),
    winston = require('winston'),
    CACHE_DIR = 'cache';

function removeOldRelationFiles(relationId) {
    const relationDir = path.join(CACHE_DIR, relationId),
        files = fs.readdirSync(relationDir);
    if (_.isEmpty(files)) {
        fs.rmdirSync(relationDir);
        return;
    }

    const fileName = path.join(relationDir, files[0]),
        stat = fs.statSync(fileName);
    if (moment().diff(stat.birthtime, 'weeks') > 1) {
        fs.unlinkSync(fileName);
        fs.rmdirSync(relationDir);
    }
}

function exists(path) {
    try {
        fs.accessSync(path);
        return true;
    } catch (e) {
        return false;
    }
}

function removeOldFiles() {
    winston.verbose('Removing old files');
    try {
        const relationDirs = fs.readdirSync(CACHE_DIR);
        for (const relationId in relationDirs) {
            removeOldRelationFiles(relationId);
        }
    } catch (e) {
        winston.error('Failed removing old files', e);
    }
}

function init() {
    winston.verbose('Scheduling remove old files');
    schedule.scheduleJob('0 0 * * * *', removeOldFiles);
}

function get(relationId) {
    try {
        const relationDir = path.join('cache', relationId),
            dirExists = exists(relationDir);
        if (!dirExists) {
            winston.verbose(`Relation dir does not exist, relationId: ${relationId}`);
            return;
        }

        const files = fs.readdirSync(relationDir);
        if (_.isEmpty(files)) {
            winston.verbose(`Relation dir does is empty, relationId: ${relationId}`);
            return;
        }

        const fileName = path.join(relationDir, files[0]),
            stat = fs.statSync(fileName);
        return {
            fileName,
            timestamp: stat.birthtime
        };
    } catch (e) {
        winston.error('Failed getting from cache', e);
    }
}

function put(gpx) {
    try {
        const cacheExists = exists(CACHE_DIR);
        if (!cacheExists) {
            winston.verbose('Creating cache base dir');
            fs.mkdirSync(CACHE_DIR);
        }

        const relationDir = path.join(CACHE_DIR, gpx.relationId),
            fileName = path.join(relationDir, `${sanitize(gpx.name)}-${moment(gpx.timestamp).format('YY-MM-DD')}.gpx`);
        fs.mkdirSync(relationDir);
        fs.writeFileSync(fileName, gpx.xml);
        return fileName;
    } catch (e) {
        winston.error('Failed putting into cache', e);
        throw e;
    }
}

init();
module.exports = {
    get,
    put
};