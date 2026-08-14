import {observeOsmApiQuery} from '../metrics.ts';

const API_BASE = 'https://api.openstreetmap.org/api/0.6';

/*
 * Enough to carry the API's own sentence, short enough that a proxy's HTML
 * error page cannot flood the log line it ends up on.
 */
const MAX_ERROR_DETAIL = 500;

/*
 * Failures arrive as a plain text body, and sometimes in an `Error` response
 * header instead — never as JSON, which is why parsing the body as JSON used
 * to leave every failure indistinguishable from every other one. Whitespace is
 * collapsed so a multi-line body stays a single log line.
 *
 * Falling back on emptiness rather than absence: the API answers a deleted
 * relation with an `Error` header that is present but blank, which `??` would
 * take for a message and stop looking.
 */
async function describeFailure(response: Response): Promise<string> {
  const header = response.headers.get('Error')?.trim() ?? '';
  /*
   * Only `text/plain`, which is what the API itself answers with. A path it
   * does not route at all falls through to the Rails frontend and comes back
   * as a full HTML page, and half a kilobyte of markup in the log line says
   * strictly less than the status code does.
   */
  const isPlainText = response.headers
    .get('Content-Type')
    ?.startsWith('text/plain');
  const body = header || !isPlainText ? '' : await response.text();
  const detail = (header || body).replace(/\s+/g, ' ').trim();
  const status = `${response.status} ${response.statusText}`.trim();
  return detail
    ? `Request failed with status ${status} - ${detail.slice(0, MAX_ERROR_DETAIL)}`
    : `Request failed with status ${status}`;
}

/*
 * `kind` is what labels the metric — the path embeds the relation id, so using
 * it would mint a new series per relation exported.
 */
function osmApiRequest(kind: string, path: string) {
  return observeOsmApiQuery(kind, async () => {
    const result = await fetch(`${API_BASE}${path}`, {
      /*
       * Kept from the Overpass client, which rejected undici's default
       * `User-Agent: node` with a 406. The editing API serves that UA fine,
       * but its usage policy asks for an identifying one and blocks by agent
       * when it has to, so this stays.
       */
      headers: {'User-Agent': 'OSMExport/2.0.1'},
    });
    if (!result.ok) {
      throw new Error(await describeFailure(result));
    }

    return result.json();
  });
}

export function fetchRelation(relationId: number) {
  /*
   * `/full` returns the relation, its member ways, and every node of those
   * ways — precisely what the Overpass `(._;>;)` recursion this replaces
   * produced, in the same OSM JSON shape `osmtogeojson` consumes, and with the
   * `meta` attributes the export needs for its timestamp.
   *
   * Overpass was answering this with 504s
   * (`Dispatcher_Client::request_read_and_idx::timeout`): its public instance
   * allows two concurrent slots per IP and the query never got one. The
   * editing API has no such queue, and serves the same relation in seconds.
   */
  return osmApiRequest('relation', `/relation/${relationId}/full.json`);
}
