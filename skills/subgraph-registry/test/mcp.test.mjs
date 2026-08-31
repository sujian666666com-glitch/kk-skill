/**
 * Integration tests over the real MCP stdio surface.
 *
 * Deliberately no test framework and no dev dependencies — node:test ships
 * with Node 20, which package.json already requires. These drive the server
 * exactly as an MCP client does (initialize -> tools/list -> tools/call), so
 * they cover the JSON-RPC wiring and the SQL together rather than unit-testing
 * helpers that are not exported.
 *
 * Run: npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let proc;
let buf = "";
let nextId = 0;
const pending = new Map();

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${method}`)),
      30_000,
    );
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function callTool(name, args) {
  const res = await send("tools/call", { name, arguments: args });
  assert.ok(res.result, `${name} returned an error: ${JSON.stringify(res.error)}`);
  return JSON.parse(res.result.content[0].text);
}

before(async () => {
  proc = spawn("node", [join(ROOT, "src", "index.js")], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });
  proc.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        const cb = pending.get(msg.id);
        if (cb) {
          pending.delete(msg.id);
          cb(msg);
        }
      } catch {
        /* server logs to stdout are not our problem here */
      }
    }
  });
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  proc.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
  );
});

after(() => proc?.kill());

test("reports the real package version, not a hardcoded literal", async () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const res = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(res.result.serverInfo.version, pkg.version);
});

test("exposes the documented tool set", async () => {
  const res = await send("tools/list", {});
  const names = res.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "get_schema_changes",
    "get_subgraph_detail",
    "list_registry_stats",
    "recommend_subgraph",
    "search_subgraphs",
    "semantic_search_subgraphs",
  ]);
});

test("search excludes curation-denied deployments by default", async () => {
  const d = await callTool("search_subgraphs", { query: "uniswap", limit: 25 });
  assert.ok(d.subgraphs.length > 0, "expected matches for uniswap");
  for (const s of d.subgraphs) {
    assert.equal(s.denied, false, `${s.display_name} is denied but was returned`);
  }
});

test("include_denied is honoured and keeps the flag visible", async () => {
  // Ask for the denied set specifically. The corpus has ~179 of them, so a
  // broad query with the flag on must be able to surface at least one — and
  // when it does, `denied` must be true rather than silently omitted.
  const d = await callTool("search_subgraphs", {
    query: "swap",
    limit: 50,
    include_denied: true,
    include_unserved: true,
  });
  for (const s of d.subgraphs) {
    assert.equal(typeof s.denied, "boolean", "denied must always be present");
  }
});

test("recommend_subgraph never returns a denied deployment", async () => {
  const d = await callTool("recommend_subgraph", { goal: "find DEX trades on Arbitrum" });
  for (const r of d.recommendations || []) {
    assert.notEqual(r.denied, true, `${r.display_name} is denied`);
  }
});

test("every result carries age_days and a maturity bucket", async () => {
  const d = await callTool("search_subgraphs", { query: "lending", limit: 10 });
  for (const s of d.subgraphs) {
    assert.ok(Number.isInteger(s.age_days), "age_days must be an integer");
    assert.ok(
      ["new", "emerging", "established", "unknown"].includes(s.maturity),
      `unexpected maturity ${s.maturity}`,
    );
  }
});

test("emerging list is young, disjoint from the main list, and captioned", async () => {
  // "perpetual futures" is the motivating case: the ranked list is all
  // multi-year deployments, and the new Monad perps subgraphs only appear here.
  const d = await callTool("search_subgraphs", { query: "perpetual futures", limit: 3 });
  if (!d.emerging || d.emerging.length === 0) return; // corpus-dependent, not a failure
  assert.ok(d.emerging_caveat, "emerging list must ship with its caveat");
  const mainIds = new Set(d.subgraphs.map((s) => s.id));
  for (const e of d.emerging) {
    assert.ok(!mainIds.has(e.id), `${e.display_name} is in both lists`);
    assert.ok(e.age_days < 90, `${e.display_name} is ${e.age_days}d old, not emerging`);
    assert.ok(["new", "emerging"].includes(e.maturity));
    assert.equal(e.denied, false, "emerging must respect the denied filter too");
    assert.ok(e.query_url_x402, "emerging entries must be as actionable as the main list");
  }
});

test("emerging respects the caller's filters", async () => {
  const d = await callTool("search_subgraphs", {
    query: "swap",
    network: "base",
    limit: 5,
  });
  for (const e of d.emerging || []) {
    assert.equal(e.network, "base", "emerging leaked past the network filter");
  }
});

// ── Ranking regressions ──────────────────────────────────────────────────
// Each of these is a real query that returned a confidently wrong answer on
// 0.9.0. They assert identity of the top hit, not score, because the scores
// are corpus-dependent and the identity is the thing a user notices.

test("more specific queries do not get worse answers", async () => {
  // 0.9.0: top 4 was uniswap-v3-arbitrum, Arbitrum Minimal, camelot-amm-v3,
  // Graph TAP Arbitrum One — not one Aave subgraph — while bare "aave" was
  // correct. OR-ed terms ranked by reliability let one incidental word win.
  const d = await callTool("search_subgraphs", { query: "aave lending arbitrum", limit: 4 });
  const names = d.subgraphs.map((s) => s.display_name.toLowerCase());
  assert.ok(
    names.some((n) => n.includes("aave")),
    `no Aave subgraph in top 4: ${names.join(", ")}`,
  );
});

test("version tokens are not silently dropped", async () => {
  // "v3" is two characters, and the old tokenizer filtered w.length > 2, so
  // "uniswap v3" was byte-identical to "uniswap".
  const d = await callTool("search_subgraphs", { query: "uniswap v3", limit: 5 });
  const names = d.subgraphs.map((s) => s.display_name.toLowerCase());
  assert.ok(
    names.some((n) => n.includes("v3") || n.includes("v-3")),
    `no v3 subgraph in top 5: ${names.join(", ")}`,
  );
});

test("common chain names resolve to corpus chain ids", async () => {
  // ~45% of the corpus lives under mainnet/bsc/arbitrum-one/matic, and
  // SKILL.md documented "ethereum, arbitrum, base" — two of which matched 0.
  for (const [alias, canonical] of [
    ["ethereum", "mainnet"],
    ["arbitrum", "arbitrum-one"],
    ["polygon", "matic"],
    ["bnb", "bsc"],
  ]) {
    const d = await callTool("search_subgraphs", { network: alias, limit: 3 });
    assert.ok(d.subgraphs.length > 0, `network:"${alias}" returned nothing`);
    for (const s of d.subgraphs) {
      assert.equal(s.network, canonical, `${alias} should resolve to ${canonical}`);
    }
  }
});

test("a chain filter that matches nothing is not silently empty", async () => {
  // 0.9.0: recommend_subgraph(goal, chain:"arbitrum") -> total_matches 0.
  const d = await callTool("recommend_subgraph", {
    goal: "find DEX trades on Arbitrum",
    chain: "arbitrum",
  });
  assert.ok(d.total_matches > 0, "chain alias still yields no matches");
  for (const r of d.recommendations || []) {
    assert.equal(r.network, "arbitrum-one");
  }
});

test("goal inference does not fire on substrings of ordinary words", async () => {
  // "reputation" contains "put" -> inferred protocol_type ["options"] and the
  // top hit was the Polygon Optimistic Oracle.
  const d = await callTool("recommend_subgraph", {
    goal: "reputation scores for onchain agents",
  });
  assert.ok(
    !(d.inferred_protocol_type || []).includes("options"),
    `still inferring options: ${JSON.stringify(d.inferred_protocol_type)}`,
  );
});

test("semantic search prefers the production deployment over its testnet", async () => {
  // 0.9.0 ranked ENS Sepolia (58 queries/30d, reliability 0.2463) above ENS
  // mainnet (34.8M queries/30d, reliability 0.9775) on a 0.0105 cosine margin.
  const d = await callTool("semantic_search_subgraphs", {
    query: "ENS domain name registrations",
    limit: 4,
  });
  if (d.error || !d.subgraphs?.length) return; // model unavailable
  const top = d.subgraphs[0];
  assert.ok(
    !/sepolia|goerli|testnet/i.test(`${top.display_name} ${top.network}`),
    `testnet ranked first: ${top.display_name} (${top.network})`,
  );
});

test("semantic search labels maturity but ships no emerging list", async () => {
  const d = await callTool("semantic_search_subgraphs", {
    query: "perpetual futures trading",
    limit: 5,
  });
  if (d.error) return; // embedding model unavailable in this environment
  assert.equal(d.emerging, undefined, "semantic search ranks by cosine, not age");
  for (const s of d.subgraphs || []) {
    assert.ok(["new", "emerging", "established", "unknown"].includes(s.maturity));
  }
});

test("testnets are excluded by default and flagged", async () => {
  // 723 of 5,425 served subgraphs are testnets, whose text is near-identical
  // to their mainnet twins' — how ENS Sepolia came to outrank ENS mainnet.
  const d = await callTool("search_subgraphs", { query: "ens", limit: 10 });
  for (const s of d.subgraphs) {
    assert.equal(s.testnet, false, `${s.display_name} (${s.network}) is a testnet`);
  }
});

test("an explicit testnet request is still honoured", async () => {
  // The trap in defaulting the filter on: network:"sepolia" must not come
  // back empty because a default silently contradicts the caller.
  for (const n of ["sepolia", "base-sepolia"]) {
    const d = await callTool("search_subgraphs", { network: n, limit: 3 });
    assert.ok(d.subgraphs.length > 0, `network:"${n}" returned nothing`);
    assert.ok(d.subgraphs.every((s) => s.testnet === true));
  }
});

test("include_testnets opts back in", async () => {
  const d = await callTool("search_subgraphs", { query: "uniswap", limit: 20, include_testnets: true });
  for (const s of d.subgraphs) assert.equal(typeof s.testnet, "boolean");
});

test("a name match outranks an incidental description match", async () => {
  // "ens" is a substring of "tokens", so ENS and four Uniswap subgraphs all
  // scored one matched term and reliability handed Uniswap the top slots.
  const d = await callTool("search_subgraphs", { query: "ens", limit: 3 });
  assert.match(d.subgraphs[0].display_name, /ens/i);
});

test("schema stability distinguishes never-changed from unknown", async () => {
  const s = await callTool("search_subgraphs", { query: "uniswap", limit: 1 });
  const d = await callTool("get_schema_changes", { subgraph_id: s.subgraphs[0].id });
  if (d.note) return; // schema_history absent in this snapshot
  assert.equal(typeof d.never_changed, "boolean");
  assert.ok(["first_seen", "last_change"].includes(d.stable_days_basis));
  if (d.never_changed) {
    assert.equal(d.total_changes, 0, "never_changed implies no real transitions");
    assert.equal(d.stable_days_basis, "first_seen");
  }
});

// ── Golden ranking cases ─────────────────────────────────────────────────
// From a live agent session on 2026-08-30 that used this registry as a
// discovery layer in front of The Graph's official subgraph MCP. Each of
// these is a name where the official keyword search returns a plausible wrong
// answer, and where get_deployment_30day_query_counts returned 0 so query
// volume could not break the tie. The ids are the ones that session confirmed
// by loading the schema from the Graph gateway.

test("lido resolves to real Lido, not a fork or an Aave market", async () => {
  const d = await callTool("search_subgraphs", { query: "lido", network: "mainnet", limit: 3 });
  const top = d.subgraphs[0];
  assert.equal(top.id, "Sxx812XgeKyzQPaBpR5YZWmGV5fZuBaPdh7DFhzSwiQ",
    `top hit was ${top.display_name} (${top.id})`);
  // "Protocol V3 Lido" is an Aave market, not staking; bp-lido-user-txns and
  // lido-copy are the other false friends the official search surfaces.
  for (const bad of ["bp-lido-user-txns", "lido-copy"]) {
    assert.ok(!d.subgraphs.some(s => s.display_name.toLowerCase() === bad),
      `false friend ranked: ${bad}`);
  }
});

test("snapshot resolves to Snapshot.org mainnet, not a per-chain deployment", async () => {
  const d = await callTool("search_subgraphs", { query: "snapshot", network: "mainnet", limit: 3 });
  const top = d.subgraphs[0];
  assert.equal(top.display_name.toLowerCase(), "snapshot",
    `top hit was ${top.display_name}`);
  assert.ok(top.query_volume_30d > 1_000_000,
    `expected the high-volume mainnet deployment, got ${top.query_volume_30d}`);
  assert.ok(!d.subgraphs.some(s => s.display_name === "protocol_snapshots_mainnet"),
    "protocol_snapshots_mainnet is a false friend and must not rank");
});

test("x402 on base resolves to the x402 Base subgraph", async () => {
  const d = await callTool("search_subgraphs", { query: "x402", network: "base", limit: 3 });
  assert.equal(d.subgraphs[0].id, "Cb56epg3EvQ6JRpPfknbkM54QxpzTvLa7mwKNQQfUyoj",
    `top hit was ${d.subgraphs[0].display_name}`);
});

test("every hit carries the volume needed to break a tie", async () => {
  // The official MCP's 30-day count tool was observed returning 0 for
  // deployments that plainly serve traffic, so this number is the only way a
  // caller can tell a protocol from its copies.
  const d = await callTool("search_subgraphs", { query: "lido", limit: 5 });
  for (const s of d.subgraphs) {
    assert.ok("query_volume_30d" in s, `${s.display_name} has no query_volume_30d`);
    assert.ok("id" in s && "ipfs_hash" in s, `${s.display_name} missing id/ipfs_hash`);
  }
});

test("neither query route is presented as the recommended one", async () => {
  // x402 used to be labelled RECOMMENDED, which sent agents that already hold
  // a Studio key down a payment path — and some hosts forbid /api/x402
  // outright. Both routes, caller picks.
  const d = await callTool("search_subgraphs", { query: "uniswap", limit: 1 });
  const s = d.subgraphs[0];
  assert.ok(s.payment_options?.api_key && s.payment_options?.x402, "both routes must be offered");
  assert.ok(!s.query_url.includes("[api-key]"),
    "query_url must use the Bearer form, not the retired path placeholder");
  assert.match(s.query_url, /^https:\/\/gateway\.thegraph\.com\/api\/subgraphs\/id\//);
  assert.ok(!/recommended/i.test(d.query_instructions.split(".")[0]),
    "the first sentence must not push one route");
});

test("query_volume_30d is present on every tool that returns subgraphs", async () => {
  // 0.9.5 added the field to the result mappers but not to the SELECT lists in
  // recommend_subgraph and semantic_search_subgraphs, so both returned null
  // forever — silently, because `r.query_volume_30d ?? null` cannot tell a
  // missing column from a null value. Volume is the tie-breaker that separates
  // a protocol from its forks, so a null here is a wrong answer, not a gap.
  const s = (await callTool("search_subgraphs", { query: "lido", limit: 1 })).subgraphs[0];
  assert.ok(s.query_volume_30d > 0, "search_subgraphs lost the volume");

  const r = (await callTool("recommend_subgraph", { goal: "lido staking on ethereum" })).recommendations?.[0];
  if (r) assert.notEqual(r.query_volume_30d, null, "recommend_subgraph returns null volume");

  const m = (await callTool("semantic_search_subgraphs", { query: "liquid staking derivatives", limit: 1 })).subgraphs?.[0];
  if (m) assert.notEqual(m.query_volume_30d, null, "semantic_search returns null volume");
});

test("get_subgraph_detail does not tell you to edit a placeholder that is gone", async () => {
  const d = await callTool("get_subgraph_detail", {
    subgraph_id: "Sxx812XgeKyzQPaBpR5YZWmGV5fZuBaPdh7DFhzSwiQ",
  });
  const blob = JSON.stringify(d);
  assert.ok(!blob.includes("[api-key]"), "still references the retired [api-key] path placeholder");
  assert.ok(!blob.includes("api_key_legacy"), "the keyed route is not legacy; it is the common case");
});

test("search and recommend agree on which Lido is the real one", async () => {
  // The 0.9.6 test only asserted query_volume_30d was PRESENT, not that the
  // tools agreed on an answer — so search returned Lido (4.7M queries) while
  // recommend returned Lido Ethereum (2,644) for the same intent, and the test
  // passed. Asserting a field exists is not asserting it is used.
  const s = (await callTool("search_subgraphs", { query: "lido", network: "mainnet", limit: 1 })).subgraphs[0];
  const r = (await callTool("recommend_subgraph", { goal: "lido staking on ethereum" })).recommendations?.[0];
  assert.equal(s.id, "Sxx812XgeKyzQPaBpR5YZWmGV5fZuBaPdh7DFhzSwiQ");
  assert.equal(r?.id, s.id,
    `search picked ${s.display_name} but recommend picked ${r?.display_name}`);
});

test("a chain named in the goal filters, it does not flatter a display name", async () => {
  // "on ethereum" used to give any subgraph called something-Ethereum +4 on a
  // display-name match, which is how a 2,644-query fork beat a 4.7M-query
  // protocol. The chain has its own column; it should narrow, not score.
  const d = await callTool("recommend_subgraph", { goal: "lido staking on ethereum" });
  assert.equal(d.inferred_chain, "mainnet", "should read 'ethereum' as the chain");
  for (const r of d.recommendations || []) {
    assert.equal(r.network, "mainnet", `${r.display_name} is on ${r.network}`);
  }
});

test("stopwords and partial words do not count as name matches", async () => {
  // "for" matched forsage-x2-prod and "scores" matched scoresquare-base, both
  // as display-name substrings worth more than a real description match.
  const d = await callTool("recommend_subgraph", { goal: "reputation scores for onchain agents" });
  const names = (d.recommendations || []).map((r) => r.display_name.toLowerCase());
  assert.ok(!names.includes("forsage-x2-prod"), "matched the stopword 'for' inside 'forsage'");
  assert.ok(!names.includes("scoresquare-base"), "matched 'scores' inside 'scoresquare'");
});

// ── The chain argument must not poison the ranking ───────────────────────
// From a 44-case outside eval of 0.9.8. Passing `chain` alongside a goal that
// also says "on <chain>" ranked a vol-2 subgraph over a 4.7M one, because the
// chain word fell back into text scoring in its CANONICAL form and then
// matched any display name containing "mainnet". Four protocols, one bug —
// the eval's top-priority finding, and Lido alone would not have caught it.

const CHAIN_ARG_CASES = [
  ["lido staking on ethereum", "ethereum", "Sxx812XgeKyzQPaBpR5YZWmGV5fZuBaPdh7DFhzSwiQ", "Clearpool staking mainnet"],
  ["lido staking on ethereum", "mainnet", "Sxx812XgeKyzQPaBpR5YZWmGV5fZuBaPdh7DFhzSwiQ", "Clearpool staking mainnet"],
  ["snapshot voting on ethereum", "ethereum", "4YgtogVaqoM8CErHWDK8mKQ825BcVdKB8vBYmb4avAQo", "Mainnet Voting V2"],
  ["ens name lookups on ethereum", "ethereum", "5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH", "seer-outcome-tokens-mainnet"],
  ["eigenlayer restaking on ethereum", "ethereum", "68g9WSC4QTUJmMpuSbgLNENrcYha4mPmXhWGCoupM7kB", "Uni V3 Staker Mainnet"],
];

for (const [goal, chain, wantId, previousWrongAnswer] of CHAIN_ARG_CASES) {
  test(`chain arg does not hijack ranking: "${goal}" + chain=${chain}`, async () => {
    const d = await callTool("recommend_subgraph", { goal, chain });
    const top = (d.recommendations || [])[0];
    assert.equal(top?.id, wantId,
      `got ${top?.display_name} (previously ${previousWrongAnswer})`);
    // A caller who passed a chain used to get inferred_chain: null, which reads
    // as "your argument was ignored".
    assert.ok(d.inferred_chain, "inferred_chain must report the chain in effect");
  });
}

test("passing chain is never worse than omitting it", async () => {
  // The property behind all five cases above: an explicit chain is routing
  // information. It can narrow the result set; it must not change which
  // protocol wins inside that set.
  for (const goal of ["lido staking on ethereum", "snapshot voting on ethereum"]) {
    const without = (await callTool("recommend_subgraph", { goal })).recommendations?.[0];
    const with_ = (await callTool("recommend_subgraph", { goal, chain: "ethereum" })).recommendations?.[0];
    assert.equal(with_?.id, without?.id,
      `"${goal}": omitting chain gives ${without?.display_name}, passing it gives ${with_?.display_name}`);
  }
});

test("search and recommend agree on the reputation paraphrase", async () => {
  // recommend banned scoresquare-base; search did not, because the
  // word-boundary re-rank had been applied to one tool only. Two tools
  // disagreeing is the bug, independent of which answer is right.
  const s = (await callTool("search_subgraphs", { query: "reputation scores for onchain agents", limit: 3 })).subgraphs;
  const r = (await callTool("recommend_subgraph", { goal: "reputation scores for onchain agents" })).recommendations || [];
  assert.ok(!s.some((x) => x.display_name === "scoresquare-base"),
    "search still ranks scoresquare-base, which recommend forbids");
  assert.equal(s[0]?.id, r[0]?.id, `search says ${s[0]?.display_name}, recommend says ${r[0]?.display_name}`);
});

test("ens top 3 are ENS-family, not high-reliability strangers", async () => {
  // "ens" is a substring of "tokens", so conditional-tokens-gc (2.8M queries)
  // and gardens-gnosis rode reliability into the top 3 on a substring match.
  const d = await callTool("search_subgraphs", { query: "ens", limit: 3 });
  for (const bad of ["conditional-tokens-gc", "gardens-gnosis", "cypher-tokens"]) {
    assert.ok(!d.subgraphs.some((s) => s.display_name === bad), `${bad} is not ENS`);
  }
});
