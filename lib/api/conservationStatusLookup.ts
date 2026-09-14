/**
 * Shared IUCN conservation-status lookup via Wikidata.
 *
 * Wikidata stores each species' IUCN Red List category as claim P141
 * ("IUCN conservation status"). It is free, needs no API key, and covers
 * species worldwide — a good server-side source for the extinction status
 * shown on bird cards (and for deciding whether a sighting is a rare find).
 *
 * Batch lookups use the SPARQL endpoint so a whole list of birds resolves
 * in a single request (the action API rate-limits per-IP very aggressively).
 */

import type { ConservationCode } from '@/lib/utils/conservationStatus';

/** In-memory cache — hits and misses are both cached (like wikiImageLookup). */
const statusCache = new Map<string, ConservationCode | null>();

/** Wikidata items for each IUCN Red List category (values of property P141). */
const IUCN_STATUS_QIDS: Record<string, ConservationCode> = {
  Q211005: 'LC', // least concern
  Q719675: 'NT', // near threatened
  Q278113: 'VU', // vulnerable
  Q11394: 'EN', // endangered species
  Q219127: 'CR', // critically endangered
  Q239509: 'EW', // extinct in the wild
  Q237350: 'EX', // extinct
};

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const REQUEST_HEADERS = {
  'User-Agent': 'BirdingDiscovery/1.0 (hobby project; conservation status lookup)',
};

/** Fetch JSON, retrying a couple of times on 429 (honouring Retry-After). */
async function fetchJsonWithRetry(url: string, headers: HeadersInit): Promise<unknown | null> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    const response = await fetch(url, { headers });

    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after')) || 10;
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 30) * 1000));
      continue;
    }

    if (!response.ok) return null;
    return response.json();
  }
  return null;
}

function codeFromQid(qid: string): ConservationCode | null {
  return IUCN_STATUS_QIDS[qid] ?? null;
}

/** Pick the highest-ranked status among claim rows (preferred > normal). */
function pickByRank<T extends { rank: string; code: ConservationCode }>(rows: T[]): ConservationCode | null {
  return (
    rows.find((r) => r.rank === 'preferred')?.code ?? rows[0]?.code ?? null
  );
}

/** SPARQL query resolving a batch of scientific names to their P141 status. */
function buildBatchSparqlQuery(scientificNames: readonly string[]): string {
  const values = scientificNames.map((name) => JSON.stringify(name)).join(' ');
  return `
SELECT ?sci ?qid ?rank WHERE {
  VALUES ?sci { ${values} }
  ?item wdt:P225 ?sci .
  ?item p:P141 ?stmt .
  ?stmt ps:P141 ?status .
  ?stmt wikibase:rank ?rank .
  BIND(STRAFTER(STR(?status), "http://www.wikidata.org/entity/") AS ?qid)
}`.trim();
}

/** Resolve many birds at once via one SPARQL query. Returns QID per name. */
async function fetchStatusesBySparql(
  scientificNames: readonly string[],
): Promise<Map<string, ConservationCode | null>> {
  const results = new Map<string, ConservationCode | null>();
  if (scientificNames.length === 0) return results;

  try {
    const query = buildBatchSparqlQuery(scientificNames);
    const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
    const data = (await fetchJsonWithRetry(url, {
      ...REQUEST_HEADERS,
      Accept: 'application/sparql-results+json',
    })) as {
      results?: {
        bindings?: { sci?: { value?: string }; qid?: { value?: string }; rank?: { value?: string } }[];
      };
    } | null;

    if (!data) return results;

    // Group all claim rows per scientific name, then pick the best rank
    const rowsByName = new Map<string, { rank: string; code: ConservationCode }[]>();
    for (const binding of data.results?.bindings ?? []) {
      const name = binding.sci?.value;
      const code = codeFromQid(binding.qid?.value ?? '');
      if (!name || !code) continue;
      const rank = binding.rank?.value?.toLowerCase().includes('preferred')
        ? 'preferred'
        : 'normal';
      if (!rowsByName.has(name)) rowsByName.set(name, []);
      rowsByName.get(name)!.push({ rank, code });
    }

    for (const [name, rows] of rowsByName) {
      results.set(name, pickByRank(rows));
    }
  } catch (error) {
    console.error('Wikidata SPARQL status lookup failed:', error);
  }

  return results;
}

/**
 * Find the Wikidata item for a taxon by name (scientific name matches
 * against labels and aliases). Prefers items described as a species.
 */
async function findTaxonItem(name: string): Promise<string | null> {
  try {
    const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(
      name,
    )}&language=en&type=item&format=json&limit=5`;

    const data = (await fetchJsonWithRetry(url, REQUEST_HEADERS)) as {
      search?: { id: string; description?: string }[];
    } | null;
    if (!data) return null;

    const results = data.search ?? [];
    if (results.length === 0) return null;

    const speciesMatch = results.find((r) =>
      r.description?.toLowerCase().includes('species'),
    );
    return (speciesMatch ?? results[0]).id;
  } catch (error) {
    console.error(`Wikidata entity search failed for "${name}":`, error);
    return null;
  }
}

/** Read a single taxon's IUCN status (property P141) via the action API. */
async function fetchIucnStatus(entityId: string): Promise<ConservationCode | null> {
  try {
    const url = `${WIKIDATA_API}?action=wbgetclaims&entity=${encodeURIComponent(
      entityId,
    )}&property=P141&format=json`;

    const data = (await fetchJsonWithRetry(url, REQUEST_HEADERS)) as {
      claims?: Record<
        string,
        {
          rank?: string;
          mainsnak?: {
            snaktype?: string;
            datavalue?: { value?: { id?: string } };
          };
        }[]
      >;
    } | null;
    if (!data) return null;

    const rows: { rank: string; code: ConservationCode }[] = [];
    for (const claim of data.claims?.P141 ?? []) {
      const snak = claim?.mainsnak;
      if (!snak || snak.snaktype !== 'value') continue;
      const code = codeFromQid(snak.datavalue?.value?.id ?? '');
      if (code) rows.push({ rank: claim.rank ?? 'normal', code });
    }

    return pickByRank(rows);
  } catch (error) {
    console.error(`Wikidata IUCN status fetch failed for "${entityId}":`, error);
    return null;
  }
}

/**
 * Look up a single bird's IUCN conservation status from Wikidata.
 * Resolution order:
 *  1. In-memory cache (keyed by the scientific name, or common name if absent)
 *  2. Wikidata item for the scientific name
 *  3. Wikidata item for the common name (fallback)
 *
 * Both successful and unsuccessful lookups are cached so that repeated
 * calls for the same bird don't hit Wikidata again.
 */
export async function lookupConservationStatus(
  name: string,
  scientificName?: string,
): Promise<ConservationCode | null> {
  const cacheKey = (scientificName || name).toLowerCase().trim();

  if (statusCache.has(cacheKey)) {
    return statusCache.get(cacheKey)!;
  }

  let entityId: string | null = null;
  if (scientificName) {
    entityId = await findTaxonItem(scientificName);
  }

  // Fall back to the common name if the scientific name matched nothing
  if (!entityId && name && name.toLowerCase().trim() !== (scientificName ?? '').toLowerCase().trim()) {
    entityId = await findTaxonItem(name);
  }

  const status = entityId ? await fetchIucnStatus(entityId) : null;

  statusCache.set(cacheKey, status);
  return status;
}

/**
 * Look up conservation statuses for a batch of birds.
 *
 * Uncached birds with a scientific name are resolved with a single SPARQL
 * request; anything left (no scientific name, or not found) falls back to
 * individual action-API lookups. Results — including misses — are cached.
 * Keyed by each bird's `name`, preserving input order and duplicates.
 */
export async function lookupConservationStatuses(
  birds: readonly { name: string; scientificName?: string }[],
): Promise<Record<string, ConservationCode | null>> {
  const results: Record<string, ConservationCode | null> = {};

  // Deduplicate uncached birds by their cache key
  const pending = new Map<string, { name: string; scientificName?: string }>();
  for (const bird of birds) {
    const cacheKey = (bird.scientificName || bird.name).toLowerCase().trim();
    if (statusCache.has(cacheKey)) {
      results[bird.name] = statusCache.get(cacheKey)!;
    } else if (!pending.has(cacheKey)) {
      pending.set(cacheKey, bird);
    }
  }

  const pendingBirds = [...pending.values()];

  // 1) Batch-resolve species that have a scientific name via SPARQL
  const withSciName = pendingBirds.filter(
    (b) => b.scientificName && b.scientificName.trim() !== '',
  );
  const sciNames = [...new Set(withSciName.map((b) => b.scientificName!.trim()))];
  const sparqlResults = await fetchStatusesBySparql(sciNames);

  const stillPending: { name: string; scientificName?: string }[] = [];
  for (const bird of pendingBirds) {
    const sciName = bird.scientificName?.trim();
    const resolved = sciName ? sparqlResults.get(sciName) : undefined;

    if (resolved !== undefined) {
      const cacheKey = (bird.scientificName || bird.name).toLowerCase().trim();
      statusCache.set(cacheKey, resolved);
      results[bird.name] = resolved;
    } else {
      stillPending.push(bird);
    }
  }

  // 2) Fall back to per-item lookups for anything the batch query missed
  if (stillPending.length > 0) {
    let next = 0;
    const workers = Array.from(
      { length: Math.min(2, stillPending.length) },
      async function worker(): Promise<void> {
        while (next < stillPending.length) {
          const bird = stillPending[next++];
          const status = await lookupConservationStatus(bird.name, bird.scientificName);
          results[bird.name] = status;
        }
      },
    );
    await Promise.all(workers);
  }

  return results;
}
