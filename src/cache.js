'use strict';
const _ = require('lodash');
const fs = require('fs');
const moment = require('moment');
const path = require('path');
const schedule = require('node-schedule');
const winston = require('winston');
const CACHE_DIR = 'cache';

function removeOldRelationFiles(relationId) {
    const relationDir = path.join(CACHE_DIR, relationId);
    const files = fs.readdirSync(relationDir);
    if (_.isEmpty(files)) {
        fs.rmdirSync(relationDir);
        return;
    }

    const fileName = path.join(relationDir, files[0]);
    const stat = fs.statSync(fileName);
    if (moment().diff(stat.birthtime, 'weeks') > 1) {
        fs.unlinkSync(fileName);
        fs.rmdirSync(relationDir);
    }
}

function removeOldFiles() {
    winston.verbose('Removing old files');
    try {
        const relationDirs = fs.readdirSync(CACHE_DIR);
        for (const relationId of relationDirs) {
            removeOldRelationFiles(relationId);
        }
    } catch (e) {
        winston.error('Failed removing old files', e);
    }
}

function ensureDir(path) {
    const dirExists = fs.existsSync(path);
    if (!dirExists) {
        winston.verbose(`Creating ${path} dir`);
        fs.mkdirSync(path);
    }
}

function init() {
    winston.verbose('Scheduling remove old files');
    schedule.scheduleJob('0 0 * * * *', removeOldFiles);
}

function get(relationId) {
    try {
        const relationDir = path.join('cache', relationId);
        const dirExists = fs.existsSync(relationDir);
        if (!dirExists) {
            winston.verbose(`Relation dir does not exist, relationId: ${relationId}`);
            return;
        }

        const files = fs.readdirSync(relationDir);
        if (_.isEmpty(files)) {
            winston.verbose(`Relation dir is empty, relationId: ${relationId}`);
            return;
        }

        const metadataFileName = path.join(relationDir, 'metadata.osm');
        const metadata = JSON.parse(fs.readFileSync(metadataFileName));
        const gpxFileName = path.join(relationDir, 'data.gpx');
        return {
            metadata,
            gpxFileName
        };
    } catch (e) {
        winston.error('Failed getting from cache', e);
    }
}

function put(metadata, gpx) {
    try {
        ensureDir(CACHE_DIR);
        const relationDir = path.join(CACHE_DIR, metadata.relationId);
        ensureDir(relationDir);
        metadata = _.omit(metadata, 'members');
        const metadataFileName = path.join(relationDir, 'metadata.osm');
        fs.writeFileSync(metadataFileName, JSON.stringify(metadata));
        const gpxFileName = path.join(relationDir, 'data.gpx');
        fs.writeFileSync(gpxFileName, gpx);
        return {
            metadata,
            gpxFileName
        };
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