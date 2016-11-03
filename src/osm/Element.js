'use strict';
const _ = require('lodash');

function transformTags(tags = []) {
    tags = _.castArray(tags);
    return new Map(tags.map(({$k, $v}) => [$k, $v]));
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