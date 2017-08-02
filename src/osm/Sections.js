'use strict';
const _ = require('lodash');
const Connection = require('./Connection');
const Section = require('./Section');

class Sections {
  constructor() {
    this.sortedSections = [];
  }

  get start() {
    return this.sortedSections[0].start;
  }

  get end() {
    return _.last(this.sortedSections).end;
  }

  get startAndEnd() {
    return {
      start: this.start,
      end: this.end
    };
  }

  get ways() {
    return _.flatten(this.sortedSections.map(s => s.ways));
  }

  addWays(ways) {
    const sections = [];
    do {
      const section = new Section();
      section.addConnectedWays(ways);
      sections.push(section);
    } while (ways.length);
    this.addSections(sections);
  }

  addSections(sections) {
    do {
      const { section, connection } = this.getClosestSection(sections);
      this.addSection(section, connection);
    } while (sections.length);
  }

  getClosestSection(sections) {
    if (!this.sortedSections.length) {
      const [section] = sections.splice(0, 1);
      return {
        section,
        connection: Connection.END_START
      };
    }

    let minDistance = {
      value: Number.MAX_VALUE,
      connection: Connection.NONE
    };
    let minIndex;
    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      const distance = section.getDistanceTo(this);
      if (distance.value < minDistance.value) {
        minDistance = distance;
        minIndex = i;
      }
    }

    const [section] = sections.splice(minIndex, 1);
    return {
      section,
      connection: minDistance.connection
    };
  }

  addSection(section, connection) {
    if (connection === Connection.NONE) {
      return;
    }

    switch (connection) {
      case Connection.END_START:
        this.sortedSections.push(section);
        break;
      case Connection.END_END:
        section.reverse();
        this.sortedSections.push(section);
        break;
      case Connection.START_END:
        this.sortedSections.unshift(section);
        break;
      case Connection.START_START:
        section.reverse();
        this.sortedSections.unshift(section);
        break;
    }
  }

  combineWays() {
    return this.sortedSections//.reverse()
      .map((s, i) => {
        // s.reverse();
        return s.combineWays(i);
      });
  }

  reverse() {
    this.sortedSections.map(s => s.reverse());
    this.sortedSections.reverse();
  }
}

module.exports = Sections;
