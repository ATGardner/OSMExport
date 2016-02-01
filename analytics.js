'use strict';
let ua = require('universal-analytics');

class Analytics {
    constructor() {
        this.visitor = ua('UA-18054605-12');
    }

    sendEvent(action, label) {
        this.visitor.event({
            ec: `OSM2GPX`,
            ea: action,
            el: label,
            aip: true
        }).send();
    }

    sendException(description) {
        this.visitor.event({
            exceptionDescription: description,
            isExceptionFatal: true,
            aip: true
        }).send();
    }
}

module.exports = Analytics;