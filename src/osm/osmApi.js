'use strict';
const fetch = require('node-fetch');

async function overpassQuery(query) {
  const body = `[out:json][timeout:25];${query}`;
  const result = await fetch('http://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    throw new Error(result.status);
  }

  return result.json();
}

function fetchRelation(relationId) {
  return overpassQuery(
    `relation(${relationId});
    (._;>;);
    out body meta;`,
  );
}

function fetchNodesInRelation(relationId) {
  return overpassQuery(`
    relation(${relationId})->.r;
    way(r.r) -> .w;
    node(w.w) -> .n;
    (
      .n;
      .w;
      .r;
    )->.all;
    .all out body meta;
  `);
}

function fetchWater(relationId, buffer) {
  return overpassQuery(
    `rel(${relationId});
    node["amenity"="drinking_water"](around:${buffer});
    out body;`,
  );
}

module.exports = {
  fetchRelation,
  fetchNodesInRelation,
  fetchWater,
};
