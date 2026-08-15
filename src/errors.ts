/*
 * Their own module rather than living beside the code that throws them: the
 * OSM client raises `NotFoundError` and `relation.ts` raises
 * `BadRequestError`, and `relation.ts` already imports the client. Keeping the
 * classes here is what stops that from becoming an import cycle.
 *
 * `name` is assigned as a field so it survives into logs, where the class
 * name alone would not appear.
 */

export class BadRequestError extends Error {
  name = 'BadRequestError';
}

/*
 * The requested relation is not something OSM can hand back — it never
 * existed, or it has been deleted. Distinct from `BadRequestError`, which is a
 * malformed request rather than a well-formed one naming something absent.
 */
export class NotFoundError extends Error {
  name = 'NotFoundError';
}
