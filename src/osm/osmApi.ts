import {observeOverpassQuery} from '../metrics.ts';

interface OverpassError {
  error?: string;
}

/*
 * `kind` is what labels the metric — the query text itself embeds the relation
 * id, so using it would mint a new series per relation exported.
 */
function overpassQuery(kind: string, query: string) {
  return observeOverpassQuery(kind, async () => {
    const body = `[out:json][timeout:25];${query}`;
    const result = await fetch('http://overpass-api.de/api/interpreter', {
      method: 'POST',
      body,
      /*
       * Overpass rejects undici's default `User-Agent: node` with a 406.
       * node-fetch used to send its own UA, so this only surfaced once it went.
       */
      headers: {'User-Agent': 'OSMExport/2.0.1'},
    });
    if (!result.ok) {
      const errorBody = (await result
        .json()
        .catch(() => ({}))) as OverpassError;
      throw new Error(
        errorBody.error || `Request failed with status ${result.status}`,
      );
    }

    return result.json();
  });
}

export function fetchRelation(relationId: number) {
  return overpassQuery(
    'relation',
    `
    relation(${relationId});
    (._;>;);
    out body meta;
  `,
  );
}

export function fetchNodesInRelation(relationId: number) {
  return overpassQuery(
    'nodes',
    `
    relation(${relationId}) -> .r;
    way(r.r) -> .w;
    node(w.w) -> .n;
    (
      .n;
      .w;
      .r;
    )->.all;
    .all out body meta;
  `,
  );
}
