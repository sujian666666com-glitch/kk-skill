#!/usr/bin/env node

/**
 * Subgraph Registry MCP Server
 *
 * Exposes the classified subgraph registry as MCP tools that agents can call
 * to discover and select the right subgraph before querying The Graph.
 *
 * Tools:
 *   - search_subgraphs: Filter by domain, network, protocol type, entity, keyword
 *   - recommend_subgraph: Natural language goal -> best subgraphs
 *   - get_subgraph_detail: Full classification detail for a specific subgraph
 *   - list_registry_stats: Available domains, networks, protocol types
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import express from "express";
import { fileURLToPath, pathToFileURL } from "url";
import { basename, dirname, join } from "path";
import { existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "fs";
import { get as httpsGet } from "https";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read from package.json rather than a literal. The hardcoded string had
// drifted to "0.8.20" while the package shipped 0.8.31 — eleven releases of
// every MCP client being told the wrong server version, which is the kind of
// thing that only surfaces when someone is debugging something else.
const PKG_VERSION = (() => {
  try {
    return JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf8"),
    ).version;
  } catch {
    return "0.0.0";
  }
})();

const DATA_DIR = join(__dirname, "..", "data");
const DB_PATH = join(DATA_DIR, "registry.db");
const OPENAPI_JSON_PATH = join(DATA_DIR, "openapi.json");
// Bundled with the npm package so runtime semantic search has zero
// network dependency. Same model fastembed uses at crawl time
// (Xenova/all-MiniLM-L6-v2) — vectors are bitwise-comparable.
const EMBEDDING_MODEL_DIR = join(DATA_DIR, "models", "Xenova", "all-MiniLM-L6-v2");
const GITHUB_DB_URL =
  "https://github.com/PaulieB14/subgraph-registry/raw/main/python/data/registry.db";

// SHA-256 of the registry.db shipped with this npm version. Any download or
// pre-bundled copy that doesn't match this hash is rejected — protects users
// against a compromised GitHub repo or man-in-the-middle on the download.
//
// HOW TO UPDATE WHEN REBUILDING THE REGISTRY:
//   1. Run the crawler to rebuild python/data/registry.db
//   2. shasum -a 256 python/data/registry.db
//   3. Paste the new hash here and bump package.json version
//   4. Update SKILL.md "Verifying the registry" section
const EXPECTED_DB_SHA256 =
  "425b7a5bde8f61d8ae2f26ea6e201ffd3308c3328a0547fb0d29530222eba0d2";
// Skip-verification escape hatch (set to "1" only if you're rebuilding the DB
// locally and know what you're doing — never set in agent-runtime defaults).
const SKIP_VERIFY = process.env.SUBGRAPH_REGISTRY_SKIP_VERIFY === "1";

// ── x402 gateway constants ─────────────────────────────────
// The Graph's public x402 gateway (live since 2026-05-08) lets agents pay
// per-query in USDC on Base without any API key. POST GraphQL to query_url_x402
// and the gateway returns HTTP 402 with a payment manifest; an x402 client
// (e.g. @graphprotocol/client-x402, x402-fetch) signs the EIP-3009 USDC
// transfer and retries automatically.
const X402_GATEWAY_BASE = "https://gateway.thegraph.com/api/x402";
const X402_PRICING = {
  amount_usd: 0.01,
  asset: "USDC",
  asset_contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  chain: "base",
  network: "eip155:8453",
  pay_to: "0x79DC34E41B2b591078d3dE222C43EcaaBD52FcCB", // Graph x402 gateway
  scheme: "exact",
  asset_transfer_method: "eip3009",
};

function buildQueryEndpoints(subgraphId) {
  return {
    // The keyed gateway URL. This used to carry `[api-key]` as a path segment,
    // a form the gateway no longer uses — an agent that string-replaced the
    // placeholder was building a URL that has not been correct for a while.
    // The current form takes the key in a header:
    //   POST https://gateway.thegraph.com/api/subgraphs/id/<ID>
    //   Authorization: Bearer <STUDIO_KEY>
    // Verified: without the header this returns HTTP 200 carrying a GraphQL
    // error body, `auth error: missing authorization header` — GraphQL signals
    // auth in the body, so do not treat 200 as success without reading it.
    query_url: `https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`,
    query_url_x402: `${X402_GATEWAY_BASE}/subgraphs/id/${subgraphId}`,

    // Both routes, stated side by side, because which one is right depends
    // entirely on what the caller already has. An agent embedded in a product
    // with a Studio key should use its key; a headless agent with a funded
    // wallet and no way to mint a key should use x402. Neither is "the
    // recommended one" — the previous wording put x402 first and labelled it
    // RECOMMENDED, which sent key-holding agents down a payment path they had
    // no reason to take, and which some hosts forbid outright.
    payment_options: {
      api_key: {
        url: `https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`,
        method: "POST",
        auth_header: "Authorization: Bearer <STUDIO_API_KEY>",
        get_a_key: "https://thegraph.com/studio/apikeys/",
        cost: "included in your Studio plan (100K free queries/month)",
        use_when: "you already have, or can obtain, a Graph Studio API key",
      },
      x402: {
        url: `${X402_GATEWAY_BASE}/subgraphs/id/${subgraphId}`,
        method: "POST",
        cost: "$0.01 USDC on Base per query",
        flow: "gateway returns HTTP 402 with a payment manifest; an x402 client (@graphprotocol/client-x402, x402-fetch) signs and retries automatically",
        use_when: "you have a funded wallet and no API key, and no human to mint one",
      },
    },
    pricing: X402_PRICING,
  };
}

// ── Download DB from GitHub if missing ─────────────────────

function sha256OfFile(path) {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function verifyDbOrThrow(path) {
  if (SKIP_VERIFY) {
    console.error(
      "SUBGRAPH_REGISTRY_SKIP_VERIFY=1 — skipping registry.db hash check."
    );
    return;
  }
  const actual = sha256OfFile(path);
  if (actual !== EXPECTED_DB_SHA256) {
    // Refuse to load a registry that doesn't match the known-good hash.
    // Delete the file so the next run gets a fresh download attempt instead
    // of caching a poisoned copy.
    try { unlinkSync(path); } catch (_) {}
    throw new Error(
      `registry.db SHA-256 mismatch.\n` +
        `  expected: ${EXPECTED_DB_SHA256}\n` +
        `  actual:   ${actual}\n` +
        `The downloaded registry does not match the version pinned to this ` +
        `npm package. Refusing to load. If you intentionally rebuilt the DB ` +
        `locally, set SUBGRAPH_REGISTRY_SKIP_VERIFY=1 to bypass.`
    );
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      httpsGet(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          writeFileSync(dest, Buffer.concat(chunks));
          resolve();
        });
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

async function ensureDb() {
  if (existsSync(DB_PATH)) {
    verifyDbOrThrow(DB_PATH);
    return;
  }
  mkdirSync(DATA_DIR, { recursive: true });
  console.error("Registry not found locally. Downloading from GitHub...");
  await downloadFile(GITHUB_DB_URL, DB_PATH);
  console.error("Downloaded registry.db — verifying SHA-256...");
  verifyDbOrThrow(DB_PATH);
  console.error("Registry verified OK.");
}

// ── Database ───────────────────────────────────────────────

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
  }
  return db;
}

// ── Network aliases ────────────────────────────────────────
// The corpus stores graph-node's chain IDs (`mainnet`, `arbitrum-one`,
// `matic`), but every human and every model says "ethereum", "arbitrum",
// "polygon" — and so does our own auto_description, which prints the pretty
// name from classifier.py NETWORK_NAMES. So an agent reads "Ethereum" in a
// description, passes network:"ethereum" back, and gets zero results with no
// error. SKILL.md made it worse by documenting `ethereum, arbitrum, base` as
// the example values; two of those three matched nothing.
// mainnet/bsc/arbitrum-one/matic alone are ~45% of the corpus.
const NETWORK_ALIASES = {
  ethereum: "mainnet",
  eth: "mainnet",
  "ethereum-mainnet": "mainnet",
  arbitrum: "arbitrum-one",
  "arbitrum one": "arbitrum-one",
  arb: "arbitrum-one",
  polygon: "matic",
  "polygon-pos": "matic",
  bnb: "bsc",
  "bnb-chain": "bsc",
  "binance-smart-chain": "bsc",
  binance: "bsc",
  op: "optimism",
  "optimism-mainnet": "optimism",
  avax: "avalanche",
  "avalanche-c-chain": "avalanche",
  xdai: "gnosis",
  zksync: "zksync-era",
  "zksync era": "zksync-era",
  blast: "blast-mainnet",
  "polygon-zk": "polygon-zkevm",
  near: "near-mainnet",
  mode: "mode-mainnet",
  sei: "sei-mainnet",
  ftm: "fantom",
};

// Normalize a caller-supplied chain name to the value stored in the corpus.
// Unknown values pass through untouched so a legitimate new chain still works.
function normalizeNetwork(name) {
  if (!name || typeof name !== "string") return name;
  const k = name.trim().toLowerCase();
  return NETWORK_ALIASES[k] || k;
}

// Networks the corpus actually contains, so a chain word in a goal can be told
// apart from a protocol that happens to share a chain's name. Built once from
// the DB rather than hardcoded, so a new chain in a re-crawl works immediately.
let _knownNetworks = null;
const KNOWN_NETWORKS = {
  has(name) {
    if (!name) return false;
    if (_knownNetworks === null) {
      try {
        _knownNetworks = new Set(
          getDb().prepare("SELECT DISTINCT network FROM subgraphs WHERE network IS NOT NULL")
            .all().map((r) => r.network),
        );
      } catch {
        _knownNetworks = new Set();
      }
    }
    return _knownNetworks.has(name);
  },
};

// ── Testnets ───────────────────────────────────────────────
// 723 of the 5,425 served, non-denied subgraphs (13.3%) are on testnets, and
// they compete directly with production because a testnet deployment's text is
// near-identical to its mainnet twin's — that is exactly how ENS Sepolia (58
// queries/30d) came to outrank ENS mainnet (34.8M queries/30d).
//
// Detected from the network name rather than a new column, so it works on the
// corpus already shipped. All 57 matching networks were checked by hand; the
// six without an explicit -testnet/-sepolia/-goerli suffix (chapel, fuji,
// holesky, holesky-beacon, mumbai, polygon-amoy) are the well-known BSC,
// Avalanche, Ethereum and Polygon testnets.
const TESTNET_MARKERS = [
  "sepolia", "goerli", "testnet", "devnet", "chapel", "fuji",
  "holesky", "mumbai", "amoy", "baobab", "rinkeby", "kovan",
];

function isTestnetNetwork(name) {
  if (!name) return false;
  const n = String(name).toLowerCase();
  return TESTNET_MARKERS.some((m) => n.includes(m));
}

// SQL fragment excluding testnets. Static string — the markers are a constant
// allowlist, never caller input, so there is nothing to bind or escape.
const NOT_TESTNET_SQL = TESTNET_MARKERS.map(
  (m) => `network NOT LIKE '%${m}%'`,
).join(" AND ");

// Whether to hide testnets for this call.
//
// The trap: a caller who explicitly asks for network:"sepolia" must not get an
// empty result because a default filter silently contradicts their request.
// An explicit testnet network always wins over the default exclusion.
function shouldExcludeTestnets({ include_testnets, network }) {
  if (include_testnets) return false;
  if (network && isTestnetNetwork(normalizeNetwork(network))) return false;
  return true;
}

// Tokenize a free-text query into searchable terms.
//
// The old inline version was `.filter((w) => w.length > 2)`, which silently
// dropped every protocol version token — "v2", "v3", "v4" are all two chars.
// That made "uniswap v3" byte-identical to "uniswap", so the single most
// natural way to disambiguate the largest protocol family in the corpus did
// nothing at all. Keep the length floor for noise words, but let version
// tokens through.
const VERSION_TOKEN_RE = /^v\d+$/;

// Function words carry no signal about WHICH subgraph is wanted, and because
// matching is substring-based they actively mislead: "reputation scores for
// onchain agents" scored forsage-x2-prod above agent0, because "for" is inside
// "forsage" and a display-name hit is worth 4 while agent0's two real matches
// ("reputation", "agents", in the description) were worth 1 each. Dropping them
// costs nothing — no one distinguishes two subgraphs by the word "the".
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "were",
  "get", "all", "any", "how", "what", "which", "who", "into", "onto", "over",
  "per", "via", "out", "its", "their", "your", "our", "his", "her",
  "show", "give", "find", "list", "want", "need", "using", "use", "used",
  "data", "info", "about", "some", "more", "most", "have", "has", "had",
]);

function queryTerms(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => (w.length > 2 || VERSION_TOKEN_RE.test(w)) && !STOPWORDS.has(w))
    .slice(0, 5);
}

// Re-rank candidates on WORD boundaries, which SQL LIKE cannot express.
//
// The SQL score treats any substring of a display name as a name hit, so
// "scores" scored scoresquare-base at full name weight and "for" scored
// forsage-x2-prod, both beating genuine description matches. A term that
// appears as a whole word is a real signal; a term that is merely a prefix of
// a longer word is not.
//
// Shared by search_subgraphs and recommend_subgraph. It lived only in
// recommend, which is why `search_subgraphs("reputation scores for onchain
// agents")` still returned scoresquare-base at #1 while recommend did not —
// two tools disagreeing because a fix was applied to one of them.
function boundaryRerank(rows, words) {
  if (!words.length) return rows;
  const res = words.map(
    (w) => new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)", "i"),
  );
  const score = (r) => {
    const name = r.display_name || "";
    const text = `${r.description || ""} ${r.auto_description || ""}`;
    let out = 0;
    res.forEach((re, i) => {
      if (re.test(name)) out += 6;
      else if (name.toLowerCase().includes(words[i])) out += 1;
      if (re.test(text)) out += 2;
    });
    return out;
  };
  return rows
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => b.s - a.s || (b.r.reliability_score || 0) - (a.r.reliability_score || 0))
    .map((x) => x.r);
}

// ── Maturity / cold-start handling ─────────────────────────
// reliability_score is built from four CUMULATIVE inputs (curation signal,
// indexer stake, lifetime query fees, 30d volume — see _reliability_score in
// python/classifier.py), so it measures accrued traction and therefore age.
// Measured on the 2026-08-25 corpus, served and non-denied:
//
//   age      n      avg reliability
//   <30d     64     0.107
//   30-90d   227    0.143
//   90-365d  1100   0.225
//   >1y      4034   0.313
//
// The newest entry in the global top 25 is 280 days old. A good subgraph
// deployed last month cannot rank, no matter how good it is — 59 of those 64
// sub-30-day subgraphs are already serving real query volume.
//
// Rather than reweight the score (which would silently change every existing
// caller's results and trade a measurable signal for a guess), surface the
// young matches SEPARATELY and label them honestly, so the agent makes the
// call. A label alone would not be enough: at 0.107 average, young subgraphs
// are not in the ranked page to be labelled, so this needs its own lookup.
const EMERGING_MAX_AGE_DAYS = 90;
const NEW_MAX_AGE_DAYS = 30;
const EMERGING_LIMIT = 3;

// Shared so the main search and its emerging companion query select exactly
// the same columns — they feed the same row mapper.
const SEARCH_COLS = `id, display_name, description, auto_description, domain, protocol_type, network,
           reliability_score, ipfs_hash, entity_count, canonical_entities,
           powered_by_substreams, active_allocation_count, example_query, denied_at, created_at,
           query_volume_30d`;

function ageDays(created_at) {
  if (!created_at) return null;
  return Math.max(0, Math.floor(Date.now() / 1000 - created_at) / 86400) | 0;
}

function maturityOf(created_at) {
  const d = ageDays(created_at);
  if (d === null) return "unknown";
  if (d < NEW_MAX_AGE_DAYS) return "new";
  if (d < EMERGING_MAX_AGE_DAYS) return "emerging";
  return "established";
}

const EMERGING_CAVEAT =
  "Recent deployments that matched your query but ranked below the main list " +
  "because reliability_score is cumulative (curation signal, indexer stake, " +
  "lifetime query fees, 30d volume) and so grows with age — the newest subgraph " +
  "in the whole registry's top 25 is 280 days old. A low score here is expected " +
  "at this age and is NOT evidence of a problem; these are unproven, not bad. " +
  "Prefer `subgraphs` for production work. Consider these when the protocol is " +
  "itself new (no mature deployment can exist), when you want the newest schema, " +
  "or when the ranked list missed what you asked for.";

// Young matches for the same filter, fetched separately because they cannot
// compete on the main ORDER BY. Returns [] on any failure — this is an
// enrichment, and it must never take down the search that already succeeded.
function findEmerging(where, params, excludeIds, selectCols) {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - EMERGING_MAX_AGE_DAYS * 86400;
    const notIn = excludeIds.length
      ? ` AND id NOT IN (${excludeIds.map(() => "?").join(",")})`
      : "";
    const sql = `
      SELECT ${selectCols}
      FROM subgraphs
      ${where ? `${where} AND` : "WHERE"} created_at > ?${notIn}
      ORDER BY reliability_score DESC
      LIMIT ?
    `;
    return getDb()
      .prepare(sql)
      .all(...params, cutoff, ...excludeIds, EMERGING_LIMIT);
  } catch {
    return [];
  }
}

// ── Tool Implementations ───────────────────────────────────

function searchSubgraphs({
  query = "",
  domain = "",
  network = "",
  protocol_type = "",
  entity = "",
  min_reliability = 0,
  include_unserved = false,
  include_denied = false,
  include_testnets = false,
  limit = 20,
} = {}) {
  const conditions = [];
  const params = [];

  // Default: hide deployments with 0 active indexer allocations — these
  // return "subgraph not found: no allocations" even though the ID is valid.
  if (!include_unserved) {
    conditions.push("active_allocation_count > 0");
  }

  // Default: hide curation-denied deployments (deniedAt > 0 on the network
  // subgraph — denied indexing rewards, typically spam, duplicates or
  // deprecations). classifier.py has persisted this since the denied_at
  // column landed, explicitly "so agents can filter denied subgraphs", but
  // nothing in this file ever read it, so the filter the crawler was feeding
  // did not exist. The 0.5 reliability penalty already keeps denied entries
  // out of the top of a ranked page — measured: 0 of the global top 20, and
  // none in any domain's top 10 — so this changes few results today. It
  // matters for the narrow queries where a denied fork IS the best textual
  // match, and it makes the signal visible either way via `denied` below.
  if (!include_denied) {
    conditions.push("denied_at = 0");
  }
  if (shouldExcludeTestnets({ include_testnets, network })) {
    conditions.push(`(${NOT_TESTNET_SQL})`);
  }

  if (domain) {
    conditions.push("domain = ?");
    params.push(domain);
  }
  if (network) {
    conditions.push("network = ?");
    params.push(normalizeNetwork(network));
  }
  if (protocol_type) {
    conditions.push("protocol_type = ?");
    params.push(protocol_type);
  }
  if (entity) {
    conditions.push('canonical_entities LIKE ?');
    params.push(`%"${entity}"%`);
  }
  if (min_reliability > 0) {
    conditions.push("reliability_score >= ?");
    params.push(min_reliability);
  }
  // Terms are OR'd for recall, then RANKED by how many of them matched.
  //
  // Before this, a multi-word query OR'd its terms and ordered the result by
  // reliability alone, so a high-reliability subgraph matching ONE incidental
  // word beat a lower-reliability one matching all three. The effect was that
  // being more specific made the answer worse: "aave lending arbitrum"
  // returned uniswap-v3-arbitrum, Arbitrum Minimal, camelot-amm-v3 and Graph
  // TAP — not one Aave subgraph — while the bare query "aave" was correct.
  //
  // Keep the OR (dropping to AND would kill recall on descriptions that
  // phrase things differently) and let matched_terms break the tie first.
  //
  // A hit in display_name is worth 3, a hit in the description 1. Counting
  // them equally is not enough on short terms, where LIKE '%term%' matches
  // half the corpus incidentally: searching "ens" scored ENS and four Uniswap
  // subgraphs at 1 apiece — "tokens" contains "ens" — and reliability then
  // handed the top slots to Uniswap. Weighting the name restores ENS to #1
  // without narrowing what still gets found.
  const matchParams = [];
  let matchExpr = "0";
  if (query) {
    const words = queryTerms(query);
    if (words.length) {
      matchExpr = words
        .map(() => "((CASE WHEN display_name LIKE ? THEN 3 ELSE 0 END) + (CASE WHEN (description LIKE ? OR auto_description LIKE ?) THEN 1 ELSE 0 END))")
        .join(" + ");
      words.forEach((w) => matchParams.push(`%${w}%`, `%${w}%`, `%${w}%`));

      const wordConds = words.map(() => "(display_name LIKE ? OR description LIKE ? OR auto_description LIKE ?)");
      words.forEach((w) => params.push(`%${w}%`, `%${w}%`, `%${w}%`));
      conditions.push(`(${wordConds.join(" OR ")})`);
    } else {
      conditions.push("(display_name LIKE ? OR description LIKE ? OR auto_description LIKE ?)");
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  // Over-fetch to allow dedup by IPFS hash (same deployment, different subgraph IDs)
  const fetchLimit = limit * 3;
  const sql = `
    SELECT ${SEARCH_COLS}, (${matchExpr}) AS matched_terms
    FROM subgraphs
    ${where}
    ORDER BY matched_terms DESC, reliability_score DESC
    LIMIT ?
  `;
  // Snapshot the filter params BEFORE the LIMIT is appended — the emerging
  // companion query reuses the same WHERE and must not inherit this LIMIT.
  const filterParams = [...params];

  // Positional binding order: the SELECT-clause scoring expression is bound
  // before the WHERE clause, so matchParams must lead. filterParams stays
  // WHERE-only, which is what the emerging companion query needs.
  const rows = boundaryRerank(
    getDb().prepare(sql).all(...matchParams, ...filterParams, fetchLimit),
    query ? queryTerms(query) : [],
  );
  // Dedup by IPFS hash — keep highest reliability per deployment
  const seenIpfs = new Set();
  const results = [];
  for (const r of rows) {
    if (r.ipfs_hash && seenIpfs.has(r.ipfs_hash)) continue;
    if (r.ipfs_hash) seenIpfs.add(r.ipfs_hash);
    results.push({
      id: r.id,
      display_name: r.display_name,
      description: (r.description || r.auto_description || "").slice(0, 300),
      domain: r.domain,
      protocol_type: r.protocol_type,
      network: r.network,
      reliability_score: r.reliability_score,
    // The registry has this number and the official Graph MCP's
    // get_deployment_30day_query_counts was observed returning 0 for
    // deployments that plainly serve traffic, so it could not break ties
    // between a real protocol and its forks. Surfacing it here is what lets a
    // caller tell Lido (4.7M queries/30d) from lido-copy.
    query_volume_30d: r.query_volume_30d ?? null,
      ipfs_hash: r.ipfs_hash,
      entity_count: r.entity_count,
      canonical_entities: JSON.parse(r.canonical_entities),
      powered_by_substreams: Boolean(r.powered_by_substreams),
      active_allocation_count: r.active_allocation_count || 0,
      // Curation-denied on the network subgraph. Only ever true when the
      // caller passed include_denied — surfaced so that choice stays visible
      // in the result rather than being silently carried.
      denied: Boolean(r.denied_at),
      testnet: isTestnetNetwork(r.network),
      // Ready-to-run GraphQL generated from this subgraph's actual schema — so an
      // agent can POST it to query_url_x402 immediately, no get_subgraph_detail round-trip.
      example_query: r.example_query || null,
      age_days: ageDays(r.created_at),
      maturity: maturityOf(r.created_at),
      ...buildQueryEndpoints(r.id),
    });
    if (results.length >= limit) break;
  }

  // Young matches that could not compete on the cumulative score. Same filter,
  // separate lookup, clearly labelled — never blended into `subgraphs`, so a
  // caller that ignores this field sees exactly what it saw before.
  const emerging = findEmerging(
    where,
    filterParams,
    results.map((x) => x.id),
    SEARCH_COLS,
  ).map((r) => ({
    id: r.id,
    display_name: r.display_name,
    description: (r.description || r.auto_description || "").slice(0, 300),
    domain: r.domain,
    protocol_type: r.protocol_type,
    network: r.network,
    reliability_score: r.reliability_score,
    // The registry has this number and the official Graph MCP's
    // get_deployment_30day_query_counts was observed returning 0 for
    // deployments that plainly serve traffic, so it could not break ties
    // between a real protocol and its forks. Surfacing it here is what lets a
    // caller tell Lido (4.7M queries/30d) from lido-copy.
    query_volume_30d: r.query_volume_30d ?? null,
    ipfs_hash: r.ipfs_hash,
    entity_count: r.entity_count,
    canonical_entities: JSON.parse(r.canonical_entities),
    powered_by_substreams: Boolean(r.powered_by_substreams),
    active_allocation_count: r.active_allocation_count || 0,
    denied: Boolean(r.denied_at),
    testnet: isTestnetNetwork(r.network),
    example_query: r.example_query || null,
    age_days: ageDays(r.created_at),
    maturity: maturityOf(r.created_at),
    ...buildQueryEndpoints(r.id),
  }));

  return {
    total: results.length,
    subgraphs: results,
    ...(emerging.length
      ? { emerging, emerging_caveat: EMERGING_CAVEAT }
      : {}),
    query_instructions: "This registry does DISCOVERY, not execution — it hands you the subgraph id and a ready-to-run `example_query`, and you run the query with whatever Graph client you already have. Two equally valid routes, pick by what you have: (a) API KEY — POST to `query_url` with header `Authorization: Bearer <STUDIO_API_KEY>` (get one at https://thegraph.com/studio/apikeys/, 100K free queries/month). Note the gateway returns HTTP 200 with a GraphQL error body when the header is missing, so read the body. (b) x402 — POST to `query_url_x402` and pay $0.01 USDC on Base per query, no key and no signup; the gateway answers 402 with a payment manifest and an x402 client signs and retries. Use (a) if you hold a key, (b) if you are headless with a funded wallet. If your client already has an official Graph MCP or gateway connector, just pass it the `id` from this result and ignore both URLs. See `payment_options` for the full shape of each.",
  };
}

function recommendSubgraph({ goal, chain = "" }) {
  const goalLower = goal.toLowerCase();

  const domainMap = {
    defi: ["defi", "swap", "trade", "lend", "borrow", "yield", "stake", "liquidity", "pool", "token"],
    nfts: ["nft", "collectible", "art", "marketplace"],
    dao: ["governance", "vote", "proposal", "dao"],
    identity: ["ens", "domain", "name", "identity"],
    infrastructure: ["indexer", "graph", "oracle"],
    social: ["social", "profile", "post", "lens"],
    gaming: ["game", "player", "quest"],
  };
  const typeMap = {
    dex: ["dex", "swap", "trade", "exchange", "amm", "uniswap", "sushi"],
    lending: ["lend", "borrow", "loan", "collateral", "aave", "compound"],
    bridge: ["bridge", "cross-chain"],
    staking: ["stake", "validator", "delegation"],
    // "call", "put" and "strike" are gone. They are ordinary English words —
    // "reputation" contains "put", so the goal "reputation scores for onchain
    // agents" inferred protocol_type ["options"] and returned the Polygon
    // Optimistic Oracle. "option" alone is specific enough to keep.
    options: ["option", "derivatives contract"],
    perpetuals: ["perp", "perpetual", "leverage", "margin"],
    governance: ["governance", "vote", "proposal"],
    "name-service": ["ens", "name service", "domain name"],
    "nft-marketplace": ["nft market", "opensea", "blur"],
  };

  // Match on word boundaries, not bare substrings. Boundaries alone would not
  // have saved "reputation"/"put" if "put" had stayed in the list — hence the
  // removals above and the demotion from filter to bonus below — but they do
  // stop "smart contract" inferring nfts via "art", and "start"/"chart"/
  // "party" doing the same.
  const hitsGoal = (kws) =>
    kws.some((k) =>
      new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(goalLower),
    );
  const domains = Object.entries(domainMap)
    .filter(([, kws]) => hitsGoal(kws))
    .map(([d]) => d);
  const ptypes = Object.entries(typeMap)
    .filter(([, kws]) => hitsGoal(kws))
    .map(([t]) => t);

  // recommend_subgraph exposes no include_* escape hatches — it answers "which
  // one should I use", so a curation-denied deployment is never the right
  // answer and the filter is unconditional here.
  const conditions = ["active_allocation_count > 0", "denied_at = 0"];
  if (shouldExcludeTestnets({ include_testnets: false, network: chain })) {
    conditions.push(`(${NOT_TESTNET_SQL})`);
  }
  const params = [];

  if (chain) {
    conditions.push("network = ?");
    params.push(normalizeNetwork(chain));
  }
  // The inferred domain/protocol_type used to go into the WHERE clause, so a
  // single bad substring collapsed the candidate pool instead of merely
  // mis-ordering it: "tokens" contains "ens" and cut 5,479 candidates to 78
  // with ENS on top, and chain:"arbitrum" returned total_matches 0 with no
  // error at all. Inference is a guess about intent; a guess belongs in the
  // ORDER BY, where being wrong costs a few positions, not every result.
  //
  // The text terms now ALWAYS constrain (they used to be skipped entirely
  // whenever anything was inferred), so the pool stays tied to what was
  // actually asked.
  const scoreParts = [];
  const scoreParams = [];
  let inferredChain = null;

  // A chain named in the goal is a chain, not part of a protocol's name.
  //
  // "lido staking on ethereum" scored Lido Ethereum (2,644 queries/30d) above
  // Lido (4,692,414) because "ethereum" matched Lido Ethereum's DISPLAY NAME
  // for +4, and the ordering is lexicographic — goal_score first, reliability
  // only as a tie-break — so a 0.88-vs-0.63 reliability gap and a 1,775x volume
  // gap never got a vote. The subgraph won for having the chain in its title.
  //
  // The chain already has its own column and its own normalizer. Pull chain
  // words out of the scoring terms and use them the way the `chain` parameter
  // is used, so "on ethereum" narrows the network instead of flattering any
  // subgraph that happens to be called something-Ethereum.
  const allWords = queryTerms(goalLower);
  const chainWords = [];
  const words = [];
  for (const w of allWords) {
    const canonical = normalizeNetwork(w);
    // Only treat it as a chain if it resolves to a network the corpus has —
    // otherwise a protocol genuinely called "Base" or "Mode" would vanish.
    if (canonical !== w || KNOWN_NETWORKS.has(canonical)) chainWords.push(canonical);
    else words.push(w);
  }
  // A chain word NEVER becomes a scoring term. The first version of this fell
  // back to `words.push(...chainWords)` whenever it could not use them as a
  // filter — and because chainWords hold the CANONICAL form, "on ethereum"
  // re-entered scoring as the token "mainnet" and scored +6 against any
  // display name containing it. Passing chain:"ethereum" with a goal ending
  // "on ethereum" therefore ranked Clearpool staking mainnet (vol 2) over Lido
  // (4,692,414), Mainnet Voting V2 over Snapshot, seer-outcome-tokens-mainnet
  // (vol 1) over ENS (34,835,842), and dropped EigenLayer out of the top 5
  // entirely. It made the explicit chain argument actively worse than omitting
  // it, which is the opposite of what an argument is for.
  //
  // Chain words are routing information. They filter, or they are discarded.
  const explicitChain = chain ? normalizeNetwork(chain) : null;
  if (!explicitChain && chainWords.length === 1) {
    conditions.push("network = ?");
    params.push(chainWords[0]);
  }
  // Report the chain actually in effect, whether it came from the argument or
  // the prose — a caller passing chain used to get inferred_chain: null, which
  // read as "your chain was ignored".
  inferredChain = explicitChain || (chainWords.length === 1 ? chainWords[0] : null);

  if (words.length) {
    const textConds = words.map(() => "(display_name LIKE ? OR description LIKE ? OR auto_description LIKE ?)");
    scoreParts.push(
      words
        .map(() => "((CASE WHEN display_name LIKE ? THEN 4 ELSE 0 END) + (CASE WHEN (description LIKE ? OR auto_description LIKE ?) THEN 1 ELSE 0 END))")
        .join(" + "),
    );
    words.forEach((w) => scoreParams.push(`%${w}%`, `%${w}%`, `%${w}%`));
    words.forEach((w) => params.push(`%${w}%`, `%${w}%`, `%${w}%`));
    conditions.push(`(${textConds.join(" OR ")})`);
  }
  if (domains.length) {
    scoreParts.push(`(CASE WHEN domain IN (${domains.map(() => "?").join(",")}) THEN 1 ELSE 0 END)`);
    scoreParams.push(...domains);
  }
  if (ptypes.length) {
    scoreParts.push(`(CASE WHEN protocol_type IN (${ptypes.map(() => "?").join(",")}) THEN 1 ELSE 0 END)`);
    scoreParams.push(...ptypes);
  }

  const goalScore = scoreParts.length ? scoreParts.join(" + ") : "0";
  const where = `WHERE ${conditions.join(" AND ")}`;
  const sql = `
    SELECT id, display_name, description, auto_description, domain, protocol_type, network,
           reliability_score, ipfs_hash, canonical_entities, active_allocation_count, example_query,
           query_volume_30d,
           (${goalScore}) AS goal_score
    FROM subgraphs
    ${where}
    ORDER BY goal_score DESC, reliability_score DESC
    LIMIT 60
  `;

  // SELECT-clause params bind before WHERE-clause params.
  let rows = getDb().prepare(sql).all(...scoreParams, ...params);

  rows = boundaryRerank(rows, words);

  // De-dup first so we batch the stability lookup over the trimmed set.
  const seenIpfs = new Set();
  const keep = [];
  for (const r of rows) {
    if (r.ipfs_hash && seenIpfs.has(r.ipfs_hash)) continue;
    if (r.ipfs_hash) seenIpfs.add(r.ipfs_hash);
    keep.push(r);
    if (keep.length >= 5) break;
  }
  // Batch the schema-stability lookup into ONE SELECT instead of N+1.
  // Falls back to {} if the schema_history table doesn't exist (pre-
  // feature DB snapshot).
  const stabMap = getSchemaStabilityBatch(keep.map((r) => r.id));
  const recommendations = keep.map((r) => {
    const stab = stabMap[r.id] || {
      schema_changed_at: null,
      schema_stable_days: null,
    };
    return {
      id: r.id,
      display_name: r.display_name,
      description: (r.description || r.auto_description || "").slice(0, 300),
      domain: r.domain,
      protocol_type: r.protocol_type,
      network: r.network,
      reliability_score: r.reliability_score,
    // The registry has this number and the official Graph MCP's
    // get_deployment_30day_query_counts was observed returning 0 for
    // deployments that plainly serve traffic, so it could not break ties
    // between a real protocol and its forks. Surfacing it here is what lets a
    // caller tell Lido (4.7M queries/30d) from lido-copy.
    query_volume_30d: r.query_volume_30d ?? null,
      ipfs_hash: r.ipfs_hash,
      canonical_entities: JSON.parse(r.canonical_entities),
      active_allocation_count: r.active_allocation_count || 0,
      example_query: r.example_query || null,
      schema_changed_at: stab.schema_changed_at,
      schema_stable_days: stab.schema_stable_days,
      ...buildQueryEndpoints(r.id),
    };
  });

  return {
    goal,
    chain_filter: chain || null,
    inferred_domain: domains.length ? domains : null,
    // Surfaced so a caller can see that "on ethereum" in their goal became a
    // network filter, and correct it if that was not what they meant.
    inferred_chain: inferredChain,
    inferred_protocol_type: ptypes.length ? ptypes : null,
    total_matches: recommendations.length,
    recommendations,
  };
}

function getSubgraphDetail({ subgraph_id }) {
  const row = getDb()
    .prepare("SELECT * FROM subgraphs WHERE id = ? OR ipfs_hash = ?")
    .get(subgraph_id, subgraph_id);

  if (!row) return { error: `Subgraph '${subgraph_id}' not found` };

  const result = { ...row };
  result.canonical_entities = JSON.parse(result.canonical_entities);
  result.categories = JSON.parse(result.categories);
  if (result.all_entities) result.all_entities = JSON.parse(result.all_entities);
  // Contract addresses extracted from the manifest — list of
  // {kind, name, address, network, startBlock}. Null on subgraphs we
  // haven't crawled with manifest support yet, or substreams-powered ones.
  if (result.contract_addresses) {
    try { result.contract_addresses = JSON.parse(result.contract_addresses); }
    catch { /* leave as string if not valid JSON */ }
  }
  if (!result.description && result.auto_description) {
    result.description = result.auto_description;
  }
  const endpoints = buildQueryEndpoints(result.id);
  result.query_url = endpoints.query_url;
  result.query_url_x402 = endpoints.query_url_x402;
  result.pricing = endpoints.pricing;

  // Schema-evolution fields. Surfaces how long the schema has been
  // stable (schema_stable_days) and the unix timestamp of the last
  // detected fingerprint change. Helps agents prefer mature subgraphs.
  const stab = getSchemaStabilityFor(result.id);
  result.schema_changed_at = stab.schema_changed_at;
  result.schema_stable_days = stab.schema_stable_days;
  // Don't leak the embedding blob to MCP callers — it's 1.5 KB of
  // float32 bytes that's only useful for cosine math inside the server.
  delete result.embedding;

  // Per-subgraph starter query generated by the crawler from this subgraph's
  // parsed schema. Falls back to the legacy generic example when the column
  // is empty (pre-feature DBs).
  const FALLBACK_EXAMPLE =
    "{ pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) { id token0 { symbol } token1 { symbol } totalValueLockedUSD } }";
  const exampleQuery = result.example_query || FALLBACK_EXAMPLE;

  result.query_instructions = {
    // No single recommendation: see payment_options on each result. Callers
    // hold either a Studio key or a wallet, rarely both, and the registry has
    // no way to know which — so it states both and lets the caller choose.
    recommended: null,
    routes: ["api_key", "x402"],
    x402: {
      url: endpoints.query_url_x402,
      payment: endpoints.pricing,
      flow: "POST GraphQL to url. Gateway returns HTTP 402 with a base64 payment-required header containing the payment manifest. Sign $0.01 USDC on Base with an x402 client and retry. No API key, no signup.",
      client_libraries: ["@graphprotocol/client-x402", "x402-fetch"],
      example_query: exampleQuery,
    },
    // Not "legacy" — this is the route most callers should take, and the one
    // some MCP hosts allow exclusively. The old text also told you to replace
    // an `[api-key]` placeholder that no longer exists in the URL.
    api_key: {
      url: endpoints.query_url,
      flow: "Get a key at https://thegraph.com/studio/apikeys/ (100K free queries/month), then POST GraphQL to url with header `Authorization: Bearer <STUDIO_API_KEY>`. The key goes in the header, not the path. A missing header returns HTTP 200 with a GraphQL error body, so read the body rather than trusting the status.",
      example_query: exampleQuery,
    },
    schema_hint: result.example_query
      ? "example_query above was generated from this subgraph's actual schema. Adapt the entity name + field selection as needed."
      : "Use the all_entities field above to see what entities and fields are available to query.",
  };
  return result;
}


// ── JSON-LD per-subgraph well-known shape ─────────────────────────────────
// Stable, machine-readable manifest other crawlers and agents can index
// without going through MCP. Served at /.well-known/subgraph/{id}.jsonld and
// /subgraphs/{id}.jsonld (alias, same payload).
// Every JSON-LD document used to carry @context and @id under
// subgraph-registry.paulieb14.dev, a hostname that has never resolved
// (NXDOMAIN). A JSON-LD processor that dereferences the context gets nothing,
// and the @id identified each subgraph by a URL that 404s — so the documents
// the README calls "auto-discoverable" were undiscoverable by construction.
//
// Two changes. The context is inlined, because a context that must be fetched
// is a dependency on a host we do not run. And @id now defaults to The Graph's
// explorer, which is the canonical, resolving identifier for a subgraph and is
// where we want an agent following the link to end up anyway.
//
// Set SUBGRAPH_REGISTRY_BASE_URL to serve these under your own origin (the
// --http-only transport does exactly that).
const PUBLIC_BASE_URL = (process.env.SUBGRAPH_REGISTRY_BASE_URL || "").replace(/\/+$/, "");
const EXPLORER_BASE = "https://thegraph.com/explorer/subgraphs";

function subgraphIri(id) {
  return PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/subgraphs/${id}` : `${EXPLORER_BASE}/${id}`;
}

const JSONLD_CONTEXT = {
  "@vocab": "https://schema.org/",
  id: "@id",
  name: "https://schema.org/name",
  description: "https://schema.org/description",
  network: "https://schema.org/provider",
  SubgraphDeployment: "https://schema.org/Dataset",
};

function buildJsonLdManifest(row) {
  if (!row) return null;
  const detail = getSubgraphDetail({ subgraph_id: row.id });
  if (detail?.error) return null;
  return {
    "@context": JSONLD_CONTEXT,
    "@type": "SubgraphDeployment",
    "@id": subgraphIri(row.id),
    id: row.id,
    ipfsHash: row.ipfs_hash,
    name: row.display_name,
    description: row.description || row.auto_description,
    network: row.network,
    classification: {
      domain: row.domain,
      protocolType: row.protocol_type,
      confidence: row.classification_confidence,
    },
    entities: detail.all_entities || [],
    canonicalEntities: detail.canonical_entities || [],
    contracts: detail.contract_addresses || null,
    reliabilityScore: row.reliability_score,
    activeIndexers: row.active_allocation_count,
    queryVolume30d: row.query_volume_30d,
    endpoints: {
      x402: detail.query_url_x402,
      apiKey: detail.query_url,
    },
    exampleQuery: detail.query_instructions?.x402?.example_query || null,
    poweredBySubstreams: !!row.powered_by_substreams,
    pricing: detail.pricing,
  };
}

function listRegistryStats() {
  const d = getDb();
  const domains = d
    .prepare("SELECT domain, COUNT(*) as count FROM subgraphs GROUP BY domain ORDER BY count DESC")
    .all();
  const networks = d
    .prepare("SELECT network, COUNT(*) as count FROM subgraphs WHERE network IS NOT NULL GROUP BY network ORDER BY count DESC")
    .all();
  const ptypes = d
    .prepare("SELECT protocol_type, COUNT(*) as count FROM subgraphs GROUP BY protocol_type ORDER BY count DESC")
    .all();
  const total = d.prepare("SELECT COUNT(*) as c FROM subgraphs").get().c;

  return {
    total_subgraphs: total,
    domains: Object.fromEntries(domains.map((r) => [r.domain, r.count])),
    networks: Object.fromEntries(networks.map((r) => [r.network, r.count])),
    protocol_types: Object.fromEntries(ptypes.map((r) => [r.protocol_type, r.count])),
  };
}

// ── Semantic search (vector embeddings) ───────────────────
// At crawl time the Python pipeline computes a 384-dim
// sentence-transformers/all-MiniLM-L6-v2 embedding per subgraph and
// stores it as a little-endian float32 BLOB in the `embedding` column.
// At query time the Node MCP server loads the SAME model architecture
// via @xenova/transformers (quantized INT8 ONNX bundled under
// data/models/) and embeds the query string once, then ranks rows by
// cosine similarity. No PyTorch, no Python sidecar — runtime is pure
// JS + sqlite.
//
// IMPORTANT: vectors are NOT bitwise-identical across runtimes. The JS
// side is INT8-quantized; the Python side is float32. Top-K rankings
// are stable but absolute scores can drift by ~0.01-0.03. The default
// `min_score: 0.3` is calibrated for the quantized JS side. If you
// run cross-runtime cosine comparisons, expect approximate not exact
// agreement.

let _embedderPromise = null;

async function getEmbedder() {
  // Lazy single-load; ~23 MB ONNX. First call latency ~1-2s on cold
  // start, subsequent calls are ~5-20ms per query embed.
  if (!_embedderPromise) {
    _embedderPromise = (async () => {
      // Dynamic import keeps the cold-start cost off the critical
      // path of tools that don't need embeddings (search_subgraphs,
      // get_subgraph_detail, list_registry_stats).
      const { pipeline, env } = await import("@xenova/transformers");
      // Prefer the locally-bundled model so the package works offline
      // and at zero-egress hosting. Falls back to the HF hub if the
      // bundled dir is missing (e.g. running from a git checkout
      // before the model stage step has run).
      if (existsSync(EMBEDDING_MODEL_DIR)) {
        env.localModelPath = join(DATA_DIR, "models");
        env.allowRemoteModels = false;
      }
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { quantized: true },
      );
      return extractor;
    })();
  }
  return _embedderPromise;
}

async function embedQuery(text) {
  const extractor = await getEmbedder();
  // pooling: "mean" + normalize: true matches sentence-transformers
  // default — identical to what fastembed produces server-side.
  const output = await extractor(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array of length 384
  return output.data;
}

function blobToFloat32(buf) {
  // SQLite returns the BLOB as a Node Buffer. better-sqlite3's Buffers
  // are views into a pooled slab with NO byteOffset alignment guarantee
  // — and Float32Array requires byteOffset to be a multiple of 4. Wrap-
  // without-copy used to throw `RangeError: start offset of Float32Array
  // should be a multiple of 4` on any row whose blob landed at an odd
  // offset (~7/8 of the time in production). Copy the bytes into a
  // fresh aligned ArrayBuffer instead — the 1.5 KB/row alloc dwarfs the
  // cosine compute that follows anyway.
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  );
  return new Float32Array(ab);
}

function cosineSim(a, b) {
  // Assumes vectors are already L2-normalized (they are: the embedder
  // is called with normalize:true and fastembed normalizes by default).
  // For normalized vectors, cosine sim == dot product.
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

async function semanticSearchSubgraphs({
  query,
  limit = 10,
  min_score = 0.3,
  include_unserved = false,
  include_denied = false,
  include_testnets = false,
  domain = "",
  network = "",
  protocol_type = "",
  min_reliability = 0,
}) {
  if (!query || typeof query !== "string") {
    return { error: "query is required and must be a string" };
  }
  // Clamp limit — the inputSchema declares maximum:50 but MCP clients
  // don't validate by default. Without the clamp, `limit: 10000` just
  // sorts more results pointlessly.
  limit = Math.max(1, Math.min(Number(limit) || 10, 50));
  if (typeof min_score !== "number" || isNaN(min_score)) min_score = 0.3;

  const qvec = await embedQuery(query);

  // SQL pre-filter shaves ~14k → <1k rows for narrow queries (e.g.
  // "lending positions on Arbitrum"). Cosine math runs only on the
  // post-filter set.
  // Exclude the handful of null-ipfs "shell" rows — they carry embeddings but
  // are unqueryable (no deployment) so they must not surface as recommendations.
  const conditions = ["embedding IS NOT NULL", "ipfs_hash != ''", "ipfs_hash IS NOT NULL"];
  const params = [];
  if (!include_unserved) {
    conditions.push("active_allocation_count > 0");
  }
  if (!include_denied) {
    conditions.push("denied_at = 0");
  }
  if (shouldExcludeTestnets({ include_testnets, network })) {
    conditions.push(`(${NOT_TESTNET_SQL})`);
  }
  if (domain) {
    conditions.push("domain = ?");
    params.push(domain);
  }
  if (network) {
    conditions.push("network = ?");
    params.push(normalizeNetwork(network));
  }
  if (protocol_type) {
    conditions.push("protocol_type = ?");
    params.push(protocol_type);
  }
  if (typeof min_reliability === "number" && min_reliability > 0) {
    conditions.push("reliability_score >= ?");
    params.push(min_reliability);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const rows = getDb()
    .prepare(
      `SELECT id, display_name, description, auto_description, domain,
              protocol_type, network, reliability_score, ipfs_hash,
              entity_count, canonical_entities, powered_by_substreams,
              active_allocation_count, example_query, denied_at, created_at,
              query_volume_30d, embedding
       FROM subgraphs
       ${where}`,
    )
    .all(...params);

  // Score every row. With ~14k subgraphs × 384 floats this is ~5ms on
  // a modern x64 box — cheap enough to do linearly per request.
  const scored = [];
  const seenIpfs = new Set();
  for (const r of rows) {
    const vec = blobToFloat32(r.embedding);
    const score = cosineSim(qvec, vec);
    if (score < min_score) continue;
    scored.push({ row: r, score });
  }
  // Rank on similarity WEIGHTED by reliability, not similarity alone.
  //
  // Pure cosine made this the only tool in the package that ignored the
  // registry's own quality signal, and testnets win on pure cosine because
  // their text is near-identical to mainnet's. Observed: "ENS domain name
  // registrations" put ENS Sepolia (58 queries/30d, reliability 0.2463) above
  // ENS mainnet (34.8M queries/30d, reliability 0.9775) on a cosine margin of
  // 0.0105 — a rounding error deciding between a toy and the real thing.
  //
  // The 0.5 floor is deliberate: reliability is itself age-biased (see the
  // maturity block above), so a multiplier that ran to 0 would re-bury every
  // new subgraph and undo the emerging work. At 0.5 + 0.5*r a brand-new
  // subgraph keeps half its similarity and can still outrank an established
  // one it genuinely beats on meaning, while a 0.01 cosine tie resolves
  // toward the subgraph that is actually serving traffic.
  const effective = (s) => s.score * (0.5 + 0.5 * (s.row.reliability_score || 0));
  scored.sort((a, b) => effective(b) - effective(a));

  const results = [];
  for (const { row: r, score } of scored) {
    if (r.ipfs_hash && seenIpfs.has(r.ipfs_hash)) continue;
    if (r.ipfs_hash) seenIpfs.add(r.ipfs_hash);
    results.push({
      id: r.id,
      display_name: r.display_name,
      description: (r.description || r.auto_description || "").slice(0, 300),
      domain: r.domain,
      protocol_type: r.protocol_type,
      network: r.network,
      reliability_score: r.reliability_score,
    // The registry has this number and the official Graph MCP's
    // get_deployment_30day_query_counts was observed returning 0 for
    // deployments that plainly serve traffic, so it could not break ties
    // between a real protocol and its forks. Surfacing it here is what lets a
    // caller tell Lido (4.7M queries/30d) from lido-copy.
    query_volume_30d: r.query_volume_30d ?? null,
      ipfs_hash: r.ipfs_hash,
      entity_count: r.entity_count,
      canonical_entities: JSON.parse(r.canonical_entities),
      powered_by_substreams: Boolean(r.powered_by_substreams),
      active_allocation_count: r.active_allocation_count || 0,
      denied: Boolean(r.denied_at),
      testnet: isTestnetNetwork(r.network),
      example_query: r.example_query || null,
      // No `emerging` companion list here: this tool ranks by cosine score,
      // not reliability_score, so a three-week-old subgraph can and does take
      // the top slot on merit. The cold-start bias is a property of the ranked
      // search, not of semantic search — what this tool needs is the label, so
      // a caller knows a strong match is also unproven.
      age_days: ageDays(r.created_at),
      maturity: maturityOf(r.created_at),
      semantic_score: Number(score.toFixed(4)),
      ...buildQueryEndpoints(r.id),
    });
    if (results.length >= limit) break;
  }

  return {
    query,
    total: results.length,
    model: "sentence-transformers/all-MiniLM-L6-v2",
    subgraphs: results,
    query_instructions:
      "Each result includes both query routes in `payment_options` — a keyed gateway URL (Authorization: Bearer <STUDIO_API_KEY>) and an x402 URL ($0.01 USDC on Base, no key). Use whichever your client already has. semantic_score is cosine similarity in [0,1]; values >0.5 are typically strong matches.",
  };
}

// ── Schema evolution ──────────────────────────────────────
// schema_history is append-only: one row per fingerprint change for a
// given subgraph_id. Read at query time to surface "how long has this
// schema been stable?" so agents can prefer subgraphs whose contract
// of data is mature.

function getSchemaChanges({ subgraph_id, since_timestamp = 0 }) {
  if (!subgraph_id || typeof subgraph_id !== "string") {
    return { error: "subgraph_id is required and must be a string" };
  }
  // Coerce since_timestamp to a non-negative integer. SQLite has loose
  // typing so passing a string like "2024-01-01" used to silently match
  // nothing; passing NaN matched everything. Validate at the boundary.
  let since = Number(since_timestamp);
  if (!Number.isFinite(since) || since < 0) since = 0;
  since = Math.floor(since);

  // Always return the same key set so agents can pattern-match against
  // a stable shape even when the schema_history table is missing.
  const now = Math.floor(Date.now() / 1000);
  const baseShape = {
    subgraph_id,
    total_changes: 0,
    last_changed_at: null,
    stable_days: null,
    changed_within_24h: false,
    changed_within_7d: false,
    changes: [],
  };

  let rows;
  try {
    rows = getDb()
      .prepare(
        `SELECT fingerprint, prev_fingerprint, detected_at, ipfs_hash
         FROM schema_history
         WHERE subgraph_id = ? AND detected_at >= ?
           AND prev_fingerprint IS NOT NULL
         ORDER BY detected_at DESC`,
      )
      .all(subgraph_id, since);
  } catch (err) {
    // schema_history table doesn't exist yet (pre-feature DB snapshot).
    return {
      ...baseShape,
      note: "schema_history table not present in this registry.db — feature ships in v0.7+.",
    };
  }

  // Baselines are excluded from `rows`, so "no rows" now means "never changed
  // since we first saw it" rather than "no history". Those are very different
  // claims to an agent deciding whether a schema is safe to depend on, and
  // collapsing them to stable_days: null loses the distinction. Report the
  // first sighting separately and measure stability from it, so a subgraph
  // that has genuinely never changed reads as stable — which is the honest
  // answer, and the one the old code accidentally gave everybody.
  let first_seen_at = null;
  try {
    const fs = getDb()
      .prepare(
        "SELECT MIN(detected_at) AS t FROM schema_history WHERE subgraph_id = ?",
      )
      .get(subgraph_id);
    first_seen_at = fs && fs.t != null ? fs.t : null;
  } catch {
    first_seen_at = null;
  }

  const never_changed = rows.length === 0;
  const last_changed_at = rows.length > 0 ? rows[0].detected_at : null;
  const stable_since = last_changed_at !== null ? last_changed_at : first_seen_at;
  const stable_days =
    stable_since !== null
      ? Math.round(((now - stable_since) / 86400) * 10) / 10
      : null;

  return {
    subgraph_id,
    total_changes: rows.length,
    never_changed,
    first_seen_at,
    last_changed_at,
    stable_days,
    stable_days_basis: never_changed ? "first_seen" : "last_change",
    changed_within_24h:
      last_changed_at !== null && now - last_changed_at < 86400,
    changed_within_7d:
      last_changed_at !== null && now - last_changed_at < 86400 * 7,
    changes: rows.map((r) => ({
      fingerprint: r.fingerprint,
      prev_fingerprint: r.prev_fingerprint,
      detected_at: r.detected_at,
      ipfs_hash: r.ipfs_hash,
    })),
  };
}

function getSchemaStabilityFor(id) {
  // Light-weight helper used by get_subgraph_detail to enrich a single
  // row with schema-stability fields. Falls back to nulls if the
  // schema_history table doesn't exist (older DB snapshots). For
  // recommend_subgraph, use getSchemaStabilityBatch instead — it
  // collapses N queries into one.
  try {
    const r = getDb()
      .prepare(
        "SELECT MAX(detected_at) AS schema_changed_at " +
          "FROM schema_history WHERE subgraph_id = ? " +
          "AND prev_fingerprint IS NOT NULL",
      )
      .get(id);
    if (!r || r.schema_changed_at == null) {
      return { schema_changed_at: null, schema_stable_days: null };
    }
    const now = Math.floor(Date.now() / 1000);
    const days = Math.round(((now - r.schema_changed_at) / 86400) * 10) / 10;
    return { schema_changed_at: r.schema_changed_at, schema_stable_days: days };
  } catch (_) {
    return { schema_changed_at: null, schema_stable_days: null };
  }
}

function getSchemaStabilityBatch(ids) {
  // Single GROUP BY query for up to ~5-50 subgraph IDs. Returns a map
  // { [id]: { schema_changed_at, schema_stable_days } }. Empty map on
  // missing table or empty input.
  if (!Array.isArray(ids) || ids.length === 0) return {};
  try {
    const placeholders = ids.map(() => "?").join(",");
    const rows = getDb()
      .prepare(
        `SELECT subgraph_id, MAX(detected_at) AS schema_changed_at
         FROM schema_history
         WHERE subgraph_id IN (${placeholders})
           AND prev_fingerprint IS NOT NULL
         GROUP BY subgraph_id`,
      )
      .all(...ids);
    const now = Math.floor(Date.now() / 1000);
    const out = {};
    for (const r of rows) {
      if (r.schema_changed_at == null) {
        out[r.subgraph_id] = {
          schema_changed_at: null,
          schema_stable_days: null,
        };
        continue;
      }
      out[r.subgraph_id] = {
        schema_changed_at: r.schema_changed_at,
        schema_stable_days:
          Math.round(((now - r.schema_changed_at) / 86400) * 10) / 10,
      };
    }
    return out;
  } catch (_) {
    return {};
  }
}

// ── MCP Server ─────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_subgraphs",
    description:
      "Search and filter the classified subgraph registry (15,000+ subgraphs). Filter by domain (defi, nfts, dao, gaming, identity, infrastructure, social, analytics), network (mainnet, arbitrum-one, base, matic, bsc, optimism, avalanche), protocol_type (dex, lending, bridge, staking, options, perpetuals, nft-marketplace, yield-aggregator, governance, name-service), canonical entity type (liquidity_pool, trade, token, position, vault, loan, collateral, liquidation, nft_collection, nft_item, nft_sale, proposal, delegate, domain_name, account, transaction, daily_snapshot, hourly_snapshot), or free-text keyword. Returns subgraphs ranked by reliability score. Discovery only — this tool does not execute GraphQL. Each result carries the subgraph id, a ready-to-run example_query, and both query routes in `payment_options`: a keyed gateway URL (Authorization: Bearer) or an x402 URL ($0.01 USDC on Base, no key). Pass the id to your own Graph client if you have one. Plus age_days and maturity (new | emerging | established). Because reliability_score is cumulative it structurally favours older deployments, so a separate `emerging` list carries recent matches that ranked below the main cut for age rather than quality — read `emerging_caveat` before offering one to a user.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Free-text search across names and descriptions" },
        domain: { type: "string", description: "Filter by domain: defi, nfts, dao, gaming, identity, infrastructure, social, analytics" },
        network: { type: "string", description: "Filter by chain: mainnet, arbitrum-one, base, matic, bsc, optimism, avalanche, etc." },
        protocol_type: { type: "string", description: "Filter by protocol type: dex, lending, bridge, staking, options, perpetuals, etc." },
        entity: { type: "string", description: "Filter by canonical entity: liquidity_pool, trade, token, position, vault, loan, etc." },
        min_reliability: { type: "number", description: "Minimum reliability score (0-1). Higher = more query fees, volume, curation signal, and indexer allocation. NOTE: all four inputs are cumulative, so this score rises with age — setting a floor here filters out good recent subgraphs along with bad ones." },
        limit: { type: "integer", description: "Max results to return (default: 20)", default: 20 },
        include_unserved: {
          type: "boolean",
          description: "Include subgraphs with 0 active indexer allocations (returns 'no allocations' on query). Default false.",
          default: false,
        },
        include_denied: {
          type: "boolean",
          description: "Include curation-denied deployments (deniedAt > 0 — denied indexing rewards, typically spam, duplicates or deprecations). Default false. When true, each result carries denied: true so the choice stays visible.",
          default: false,
        },
        include_testnets: {
          type: "boolean",
          description: "Include testnet deployments (sepolia, goerli, holesky, chapel, fuji, mumbai, amoy, *-testnet). Default false — a testnet twin's text is near-identical to its mainnet original, so it competes for the top slot without being the thing anyone wanted. Ignored when you explicitly request a testnet network, so network:\"sepolia\" still works. Each result carries testnet: true|false.",
          default: false,
        },
      },
    },
  },
  {
    name: "recommend_subgraph",
    description:
      "Given a natural-language goal like 'find DEX trades on Arbitrum' or 'get lending liquidation data', returns the best matching subgraphs with reliability scores. Automatically infers domain and protocol type from the goal. Discovery only — it returns ids and starter queries, it does not execute GraphQL. Each result carries both query routes in `payment_options`: a keyed gateway URL (Authorization: Bearer <STUDIO_API_KEY>) or an x402 URL ($0.01 USDC on Base, no key).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        goal: { type: "string", description: "What you want to do, e.g. 'query Uniswap pool data on Base'" },
        chain: { type: "string", description: "Optional chain filter: mainnet, arbitrum-one, base, matic, etc." },
      },
      required: ["goal"],
    },
  },
  {
    name: "get_subgraph_detail",
    description:
      "Get full classification detail for a specific subgraph by its subgraph ID or IPFS hash. Returns domain, protocol type, canonical entities, all entity names with field counts, reliability score, signal data, both query URLs (x402 and legacy), the x402 pricing manifest ($0.01 USDC on Base), and step-by-step instructions for both query paths.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subgraph_id: { type: "string", description: "Subgraph ID or IPFS hash (Qm...)" },
      },
      required: ["subgraph_id"],
    },
  },
  {
    name: "list_registry_stats",
    description:
      "Get an overview of the subgraph registry: total count, available domains, networks, and protocol types with counts. Use this to understand what data is available before searching.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "semantic_search_subgraphs",
    description:
      "Semantic vector search over the subgraph registry. Embeds the query string with sentence-transformers/all-MiniLM-L6-v2 (the same model architecture used at crawl time; the runtime uses an INT8-quantized ONNX build so absolute scores can drift ~0.01-0.03 from the float32 reference but top-K rankings are stable) and ranks subgraphs by cosine similarity against the precomputed 384-dim embedding of each subgraph's description + entities + protocol metadata. Prefer this over search_subgraphs when the goal is fuzzy, paraphrased, or describes a use-case rather than a literal protocol/entity name. Supports the same domain/network/protocol_type/min_reliability pre-filters as search_subgraphs (applied as SQL WHERE before cosine scoring for performance). Returns the same shape as search_subgraphs plus a `semantic_score` in [0,1] (>0.5 is typically a strong match).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Natural-language description of the data the agent wants to query, e.g. 'on-chain options market activity' or 'lending positions near liquidation'",
        },
        limit: {
          type: "integer",
          description: "Max results to return (default 10, max 50)",
          default: 10,
          minimum: 1,
          maximum: 50,
        },
        min_score: {
          type: "number",
          description: "Minimum cosine similarity to include (0-1). Default 0.3.",
          default: 0.3,
        },
        include_unserved: {
          type: "boolean",
          description: "Include subgraphs with 0 active indexer allocations (returns 'no allocations' on query). Default false.",
          default: false,
        },
        include_denied: {
          type: "boolean",
          description: "Include curation-denied deployments (deniedAt > 0 — denied indexing rewards, typically spam, duplicates or deprecations). Default false. When true, each result carries denied: true so the choice stays visible.",
          default: false,
        },
        include_testnets: {
          type: "boolean",
          description: "Include testnet deployments (sepolia, goerli, holesky, chapel, fuji, mumbai, amoy, *-testnet). Default false — a testnet twin's text is near-identical to its mainnet original, so it competes for the top slot without being the thing anyone wanted. Ignored when you explicitly request a testnet network, so network:\"sepolia\" still works. Each result carries testnet: true|false.",
          default: false,
        },
        domain: {
          type: "string",
          description: "Pre-filter by domain (defi, nfts, dao, gaming, identity, infrastructure, social, analytics)",
        },
        network: {
          type: "string",
          description: "Pre-filter by chain (mainnet, arbitrum-one, base, matic, bsc, optimism, avalanche, etc.)",
        },
        protocol_type: {
          type: "string",
          description: "Pre-filter by protocol type (dex, lending, bridge, staking, options, perpetuals, etc.)",
        },
        min_reliability: {
          type: "number",
          description: "Pre-filter: minimum reliability score (0-1).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_schema_changes",
    description:
      "Return chronological schema-fingerprint changes for a subgraph. Each row is one detected fingerprint change with prev_fingerprint, fingerprint, and detected_at (unix seconds). Use to assess schema stability before depending on a subgraph: a long stable_days value means the schema contract is mature; a recent changed_within_24h means the upstream protocol just shipped a schema update and queries may need to be revisited.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subgraph_id: {
          type: "string",
          description: "Subgraph ID (the same id used by other tools)",
        },
        since_timestamp: {
          type: "integer",
          description: "Only return changes detected at or after this unix timestamp (seconds). Default 0 (full history).",
          default: 0,
        },
      },
      required: ["subgraph_id"],
    },
  },
];

const HANDLERS = {
  search_subgraphs: searchSubgraphs,
  recommend_subgraph: recommendSubgraph,
  get_subgraph_detail: getSubgraphDetail,
  list_registry_stats: listRegistryStats,
  semantic_search_subgraphs: semanticSearchSubgraphs,
  get_schema_changes: getSchemaChanges,
};

function createServer() {
  const server = new Server(
    { name: "subgraph-registry", version: PKG_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = HANDLERS[name];
    if (!handler) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }
    try {
      // semantic_search_subgraphs is async (model load + embed); all
      // other handlers are sync but `await` is a no-op on plain values.
      const result = await handler(args || {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  });

  return server;
}

// ── SSE/HTTP Transport (OpenClaw + remote agents) ──────────

function startHttpTransport(port) {
  const app = express();
  const sessions = new Map();

  app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    sessions.set(transport.sessionId, transport);

    const server = createServer();

    res.on("close", () => {
      sessions.delete(transport.sessionId);
    });

    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.status(400).json({ error: "Invalid or expired session" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", subgraphs: getDb().prepare("SELECT COUNT(*) as c FROM subgraphs").get().c });
  });

  // ── payql compatibility shim ─────────────────────────────────────
  // payql (npm `payql`, same author) advertises PAYQL_REGISTRY_URL as a "free
  // discovery source (e.g. your own subgraph registry)" — but it POSTs the
  // Graph network subgraph's GraphQL document and reads
  // `data.subgraphMetadataSearch`, a shape this registry has never served. So
  // pointing payql here returned zero hits and, because the response still
  // parsed as JSON, it failed as an empty success rather than an error. The
  // two projects were built to compose and the seam between them was dead.
  //
  // Serve that shape. No GraphQL engine needed: the only input that varies is
  // the `text` variable, and the result set is what search_subgraphs already
  // computes. Answering in the incumbent's vocabulary means payql works
  // against this registry with no change on its side.
  //
  // Token amounts are returned as wei-scale strings because payql divides them
  // by 1e18 (weiToGRT); handing back plain GRT would under-report by 1e18.
  app.post("/graphql", express.json({ limit: "256kb" }), (req, res) => {
    try {
      const text = String(req.body?.variables?.text ?? "");
      const first = Math.max(1, Math.min(Number(req.body?.variables?.first) || 10, 50));
      // payql sends a prefix tsquery ("uniswap:* | v3:*"); strip the fulltext
      // operators back to plain words before handing them to LIKE matching.
      const plain = text.replace(/:\*/g, " ").replace(/[|&()]/g, " ").trim();
      const { subgraphs = [] } = searchSubgraphs({ query: plain, limit: first });
      res.json({
        data: {
          subgraphMetadataSearch: subgraphs.map((s) => ({
            displayName: s.display_name,
            description: s.description,
            categories: s.domain ? [s.domain] : [],
            subgraphs: [
              {
                id: s.id,
                active: true,
                currentSignalledTokens: null,
                currentVersion: {
                  subgraphDeployment: {
                    ipfsHash: s.ipfs_hash,
                    stakedTokens: null,
                    signalledTokens: null,
                    queryFeesAmount: null,
                  },
                },
              },
            ],
          })),
        },
      });
    } catch (err) {
      // Answer in GraphQL's error shape so a client that only knows GraphQL
      // sees a failure instead of an empty success — the exact trap this
      // route exists to close.
      res.status(500).json({ errors: [{ message: String(err?.message || err) }] });
    }
  });

  // ── OpenAPI 3.1 spec (auto-generated at release time) ────────────
  // scripts/gen-openapi.js inventories the TOOLS array + the REST
  // routes below and writes data/openapi.json. We serve the file
  // verbatim so consumers and codegens can hit a stable URL.
  app.get("/.well-known/openapi.json", (_req, res) => {
    if (!existsSync(OPENAPI_JSON_PATH)) {
      res.status(404).json({
        error: "openapi.json not present in this build",
        hint: "Run `node scripts/gen-openapi.js` to generate it.",
      });
      return;
    }
    try {
      const spec = JSON.parse(readFileSync(OPENAPI_JSON_PATH, "utf8"));
      res.type("application/json").json(spec);
    } catch (err) {
      res.status(500).json({ error: "openapi.json parse failed: " + err.message });
    }
  });

  // ── Stable per-subgraph manifest for ecosystem crawlers ───────────────
  // Other tools (E&N tooling, indexer dashboards, agent frameworks) can
  // hit this without needing MCP. JSON-LD so the shape is auto-discoverable.
  const serveManifest = (req, res) => {
    const id = req.params.id;
    const row = getDb()
      .prepare("SELECT * FROM subgraphs WHERE id = ? OR ipfs_hash = ?")
      .get(id, id);
    if (!row) {
      res.status(404).json({ error: `Subgraph '${id}' not found` });
      return;
    }
    const manifest = buildJsonLdManifest(row);
    if (!manifest) {
      res.status(500).json({ error: "Manifest build failed" });
      return;
    }
    res.type("application/ld+json").json(manifest);
  };

  // Canonical .well-known location + a friendlier alias under /subgraphs/
  app.get("/.well-known/subgraph/:id.jsonld", serveManifest);
  app.get("/subgraphs/:id.jsonld", serveManifest);

  // Discovery index so a crawler that doesn't know the ID can find one:
  // returns the top 100 by reliability with their .jsonld URLs.
  app.get("/.well-known/subgraph-index.jsonld", (_req, res) => {
    const rows = getDb()
      .prepare(
        "SELECT id, display_name, network, domain, reliability_score " +
        "FROM subgraphs WHERE active_allocation_count > 0 " +
        "ORDER BY reliability_score DESC LIMIT 100"
      ).all();
    res.type("application/ld+json").json({
      "@context": JSONLD_CONTEXT,
      "@type": "SubgraphIndex",
      generatedAt: new Date().toISOString(),
      count: rows.length,
      subgraphs: rows.map((r) => ({
        "@id": subgraphIri(r.id),
        id: r.id,
        name: r.display_name,
        network: r.network,
        domain: r.domain,
        reliabilityScore: r.reliability_score,
        manifest: `/.well-known/subgraph/${r.id}.jsonld`,
      })),
    });
  });

  app.listen(port, () => {
    console.error(`SSE transport listening on http://localhost:${port}/sse`);
    console.error(`Well-known manifest at http://localhost:${port}/.well-known/subgraph/{id}.jsonld`);
  });
}

// ── Entry Point ────────────────────────────────────────────

async function main() {
  await ensureDb();

  const subgraphCount = getDb().prepare("SELECT COUNT(*) as c FROM subgraphs").get().c;
  const httpPort = process.env.MCP_HTTP_PORT || (process.argv.includes("--http") ? "3848" : null);
  const httpOnly = process.argv.includes("--http-only");

  // Start SSE/HTTP transport if requested
  if (httpPort || httpOnly) {
    const port = parseInt(httpPort || "3848", 10);
    startHttpTransport(port);
  }

  // Start stdio transport (default, skip if --http-only)
  if (!httpOnly) {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  console.error(`Subgraph Registry MCP server running (${subgraphCount} subgraphs)`);
}

// ── Exports for tooling (OpenAPI generator, tests) ────────
// scripts/gen-openapi.js imports TOOLS + REST_ROUTES at build time.
// Inventory the HTTP routes declaratively here so generator + runtime
// stay in lockstep — drift would silently mis-document the API.
export const REST_ROUTES = [
  {
    method: "get",
    path: "/health",
    summary: "Liveness probe + total subgraph count",
    response: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ok"] },
        subgraphs: { type: "integer" },
      },
      required: ["status", "subgraphs"],
    },
  },
  {
    method: "post",
    path: "/graphql",
    summary: "payql compatibility — search results in subgraphMetadataSearch shape",
    description:
      "Answers a `subgraphMetadataSearch` query in The Graph network subgraph's shape, so payql (PAYQL_REGISTRY_URL) can use this registry as a free discovery source with no change on its side. Only the `text` and `first` variables are read; results come from the same index search_subgraphs uses.",
    response: { type: "object", description: "{ data: { subgraphMetadataSearch: [...] } }" },
  },
  {
    method: "get",
    path: "/.well-known/subgraph/{id}.jsonld",
    summary: "JSON-LD manifest for a single subgraph (canonical location)",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
    response: { type: "object", description: "JSON-LD SubgraphDeployment manifest" },
  },
  {
    method: "get",
    path: "/subgraphs/{id}.jsonld",
    summary: "JSON-LD manifest alias (same payload as /.well-known/...)",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
    response: { type: "object", description: "JSON-LD SubgraphDeployment manifest" },
  },
  {
    method: "get",
    path: "/.well-known/subgraph-index.jsonld",
    summary: "Top-100 subgraphs by reliability with their manifest URLs",
    response: { type: "object", description: "JSON-LD SubgraphIndex" },
  },
  {
    method: "get",
    path: "/.well-known/openapi.json",
    summary: "This OpenAPI spec, self-served for discovery",
    response: { type: "object", description: "OpenAPI 3.1 document" },
  },
];

export { TOOLS };

// Only auto-start when invoked as the entry point — importing the
// module for tooling (scripts/gen-openapi.js, tests) MUST NOT spawn
// the MCP server or open the SQLite file. Use pathToFileURL so the
// comparison works on Windows where process.argv[1] uses backslashes
// while import.meta.url is forward-slashed.
// Whether this file was RUN, as opposed to imported (scripts/gen-openapi.js
// imports it for TOOLS[] and must not spawn a server).
//
// This has to compare real paths. npm installs a bin as a symlink —
// node_modules/.bin/subgraph-registry-mcp -> ../subgraph-registry-mcp/src/index.js
// — and Node sets import.meta.url to the RESOLVED target while argv[1] keeps
// the symlink. So the old comparison was:
//
//   pathToFileURL(argv[1]) = file:///…/node_modules/.bin/subgraph-registry-mcp
//   import.meta.url        = file:///…/subgraph-registry-mcp/src/index.js
//   basename(argv[1])      = "subgraph-registry-mcp"   (not "index.js")
//
// Both branches false, so main() never ran: the process exited 0, instantly,
// silently, and every MCP host reported "Connection closed" with 0 tools. It
// worked in local testing only because `node src/index.js` satisfies the
// basename fallback — which is exactly why no test caught it. The package has
// never once started over npx.
//
// realpathSync collapses the symlink on both sides, so npx, `npm i -g`, a
// direct path and a symlinked directory all agree. Note the URL comparison was
// already unreliable on its own: on macOS a /var path resolves to /private/var,
// so even a direct run failed that branch and survived on the basename check.
const _isMain =
  process.argv[1] !== undefined &&
  (() => {
    try {
      return realpathSync(process.argv[1]) === realpathSync(__filename);
    } catch {
      return false;
    }
  })();

if (_isMain) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
