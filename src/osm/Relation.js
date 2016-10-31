'use strict';
const _ = require('lodash');
const moment = require('moment');
const Element = require('./Element');
const Node = require('./Node');
const Sections = require('./Sections');
const Way = require('./Way');

class Relation extends Element {
    get timestamp() {
        return moment(this.element.$timestamp);
    }

    get subRelationIds() {
        return this.relations.map(r => r.id);
    }

    set subRelations(value) {
        for (const subRelation of value) {
            const index = this.members.findIndex(m => m instanceof Relation && m.id === subRelation.id);
            this.members[index] = subRelation;
        }
    }

    get nodes() {
        return this.members.filter(m => m instanceof Node);
    }

    get ways() {
        return this.members.filter(m => m instanceof Way);
    }

    get relations() {
        return this.members.filter(m => m instanceof Relation);
    }

    constructor({relation = [], node = [], way = []}) {
        relation = _.castArray(relation);
        super(relation[0]);
        if (this.element.member) {
            const nodesMap = new Map(node.map(n => [n.$id, new Node(n)]));
            const wayMap = new Map(way.map(w => [w.$id, new Way(w, nodesMap)]));
            const relationsMap = new Map(relation.filter(r => r.$id !== this.id).map(r => [r.$id, new Relation({relation: r})]));
            relationsMap.delete(this.id);
            this.members = this.element.member.map(({$type, $ref}) => {
                switch ($type) {
                    case 'node':
                        return nodesMap.get($ref);
                    case 'way':
                        return wayMap.get($ref);
                    case 'relation':
                        return relationsMap.get($ref);
                }
            });
        }
    }

    createGpx(builder, limit) {
        _.castArray(this.members).map(m => m.createGpx(builder, limit));
    }

    createSections() {
        const sections = new Sections();
        sections.addWays(this.ways);
        return sections;
    }

    sortWays() {
        const nodes = this.nodes;
        const sections = this.createSections();
        this.members = sections.getWays();
        this.members.push(...nodes);
    }

    combineWays() {
        const nodes = this.nodes;
        const sections = this.createSections();
        this.members = sections.combineWays();
        this.members.push(...nodes);
    }

    calculateDistances(markerDiff) {
        let endNode = undefined;
        for (const w of this.ways) {
            const markerNodes = w.markDistance(endNode, markerDiff);
            endNode = w.end;
            this.members.push(...markerNodes);
        }
    }
}

module.exports = Relation;
