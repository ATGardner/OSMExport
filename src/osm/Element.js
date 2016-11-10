'use strict';

class Element {
    getName(key = 'name') {
        return this.tags[key || 'name'] || this.id;
    }

    get id() {
        return this.element.id;
    }

    get tags() {
        return this.element.tags || {};
    }

    constructor(element) {
        this.element = element;
    }
}

module.exports = Element;