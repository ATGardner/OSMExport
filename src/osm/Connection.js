'use strict';

const Connection = {
    NONE: Symbol('NONE'),
    END_START: Symbol('END_START'),
    END_END: Symbol('END_END'),
    START_END: Symbol('START_END'),
    START_START: Symbol('START_START'),
};

module.exports = Connection;