async function overpassQuery(query: string) {
  const body = `[out:json][timeout:25];${query}`;
  const result = await fetch('http://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    const body = await result.json().catch(() => ({})) as any;
    throw new Error(body.error || `Request failed with status ${result.status}`);
  }

  return result.json();
}

export function fetchRelation(relationId: string) {
  return overpassQuery(`
    relation(${relationId});
    (._;>;);
    out body meta;
  `);
}

export function fetchNodesInRelation(relationId: string) {
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
