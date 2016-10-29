'use strict';
const _ = require('lodash');

function transformTags(tags = []) {
    return new Map(Object.keys(tags).map(k => [k, tags[k]]));
}

class Element {
    getName(key = 'name') {
        return this.tags.get(key) || this.tags.get('name') || this.id;
    }

    get id() {
        return this.element.$id;
    }

    constructor(element) {
        this.element = element;
        this.tags = transformTags(element.tag);
    }
}

module.exports = Element;