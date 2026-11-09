/**
 * Detection of RSPB-operated OSM features from the raw tags Geoapify and
 * Overpass already return. Best-effort and stateless: a missing tag simply
 * means no badge.
 */

const RSPB_WORD = /\brspb\b/i;
const RSPB_FULL_NAME = /royal society for the protection of birds/i;
const RSPB_WIKIDATA_QID = 'Q1892802';

function isRspbName(value: string | undefined): boolean {
  if (!value) return false;
  return RSPB_WORD.test(value) || RSPB_FULL_NAME.test(value);
}

function isRspbQid(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toUpperCase() === RSPB_WIKIDATA_QID;
}

/**
 * Would the given OSM tags (an element's `tags` or a Geoapify feature's
 * `datasource.raw`) mark the feature as run by the RSPB? Matches:
 * - `operator` naming the RSPB (operator=rspb, operator=RSPB, 'RSPB, ...',
 *   'The RSPB', the spelled-out Royal Society for the Protection of Birds)
 * - `operator:wikidata` = Q1892802 (the RSPB Wikidata QID)
 * - `brand` naming the RSPB, or `brand:wikidata` = Q1892802
 */
export function isRspbOperated(tags: Record<string, string | undefined> | undefined): boolean {
  if (!tags) return false;

  if (isRspbName(tags.operator)) return true;
  if (isRspbQid(tags['operator:wikidata'])) return true;

  return isRspbName(tags.brand) || isRspbQid(tags['brand:wikidata']);
}
