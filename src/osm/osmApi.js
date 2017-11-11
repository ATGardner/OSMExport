'use strict';
const fetch = require('node-fetch');
const osmtogeojson = require('osmtogeojson');

async function overpassQuery(query) {
  const body = `[out:json][timeout:25];${query}`;
  const result = await fetch('http://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    throw new Error(result.status);
  }

  const osmJson = await result.json();
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return true;
    },
  });
}

function fetchRelation(relationId) {
  return overpassQuery(`relation(${relationId});(._;>;);out body meta;`);
}

function fetchWater(relationId, buffer) {
  return overpassQuery(
    `rel(${relationId});node["amenity"="drinking_water"](around:${
      buffer
    });out body;`,
  );
}

module.exports = {
  fetchRelation,
  fetchWater,
};
