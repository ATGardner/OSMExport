'use strict';

import fetch from 'node-fetch';

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

export function fetchRelation(relationId) {
  return overpassQuery(`
    relation(${relationId});
    (._;>;);
    out body meta;
  `);
}

export function fetchNodesInRelation(relationId) {
  return overpassQuery(`
    relation(${relationId}) -> .r;
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
