'use strict';
const _ = require('lodash');
const moment = require('moment');
const Element = require('./Element');
const Node = require('./Node');
const Sections = require('./Sections');
const Way = require('./Way');

class Relation extends Element {
    get timestamp() {
        return moment(this.element.timestamp);
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

    constructor(relations, ways, nodes) {
        relations = _.castArray(relations);
        const [relation] = relations;
        super(relation);
        if (relation.members) {
            const nodesMap = new Map(nodes.map(n => [n.id, new Node(n)]));
            const wayMap = new Map(ways.map(w => [w.id, new Way(w, nodesMap)]));
            const relationsMap = new Map(relations.filter(r => r.id !== relation.id).map(r => [r.id, new Relation({relation: r})]));
            this.members = relation.members.map(({type, ref}) => {
                switch (type) {
                    case 'node':
                        return nodesMap.get(ref);
                    case 'way':
                        return wayMap.get(ref);
                    case 'relation':
                        return relationsMap.get(ref);
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

    * getAllNodes() {
        yield * this.nodes;
        for (const way of this.ways) {
            yield * way.nodes;
        }

        for (const sub of this.relations) {
            yield * sub.getAllNodes();
        }
    }

    addNodes(nodes) {
        for (const node of nodes) {
            let minDistance = Number.MAX_VALUE;
            let closestNode = undefined;
            for (const n2 of this.getAllNodes()) {
                const distance = node.distanceTo(n2);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestNode = n2;
                }
            }

            node.distance = closestNode.distance;
            node.offTrail = minDistance;
            this.members.push(node);
        }
    }
}

module.exports = Relation;
