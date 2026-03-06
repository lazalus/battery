#!/usr/bin/env node

/**
 * Collect OEM battery specs for all vehicle trims.
 *
 * Fetches the Rocket Battery category page for each trim
 * (trimId == Rocket category ID), parses product codes,
 * and determines the OEM battery spec (capacity + polarity + type).
 *
 * Usage:  node scripts/collect-battery-specs.mjs
 * Output: data/battery-specs.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ROCKET_BASE = "https://rocketbattery.kr";
const CONCURRENCY = 4;
const DELAY_MS = 400;
const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeCode(raw) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function extractProductCode(text) {
  const patterns = [
    /\b(AGM\s*\d{2,3}[A-Z]{0,2})\b/i,
    /\b(EFB\s*\d{2,3}[A-Z]{0,2})\b/i,
    /\b(DIN\s*\d{2,5}(?:-\d{2,3})?[A-Z]{0,3})\b/i,
    /\b(GB\s*\d{2,5}(?:-\d{2,3})?[A-Z]{0,3})\b/i,
    /\b(DF\s*\d{2,5}[A-Z]{0,3})\b/i,
    /\b(HK\s*\d{2,5}[A-Z]{0,3})\b/i,
    /\b(MF\s*\d{2,5}[A-Z]{0,3})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return normalizeCode(match[1]);
    }
  }
  return null;
}

function parseSpec(code) {
  if (!code) return null;

  const normalized = normalizeCode(code);

  // Determine type
  let type = "standard";
  if (normalized.startsWith("AGM")) type = "AGM";
  else if (normalized.startsWith("EFB")) type = "EFB";

  // 1) Simple format: GB80L, GB90R, DIN80L, AGM70, MF80 etc.
  const simpleMatch = normalized.match(
    /(?:GB|DIN|DF|AGM|EFB|MF|HK)(\d{2,3})\s*([RL])?\s*$/
  );
  if (simpleMatch) {
    const capacity = Number(simpleMatch[1]);
    if (Number.isFinite(capacity) && capacity >= 30 && capacity <= 230) {
      return {
        capacity,
        polarity: simpleMatch[2] ? simpleMatch[2].toUpperCase() : null,
        type,
      };
    }
  }

  // 2) DIN standard code: GB56219, GB55066, GB58034, etc.
  //    5XXYY -> capacity = 5XX - 500,  6XXYY -> capacity = 6XX - 500
  const dinMatch = normalized.match(/(?:GB|DIN|DF)?([56]\d{4})/);
  if (dinMatch) {
    const dinCode = dinMatch[1];
    const prefix3 = Number(dinCode.slice(0, 3));
    const capacity = prefix3 - 500;
    if (Number.isFinite(capacity) && capacity >= 30 && capacity <= 230) {
      return { capacity, polarity: null, type };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Rocket HTML parser  (same logic as compatible-batteries route)
// ---------------------------------------------------------------------------

function stripTags(v) {
  return v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function decodeHtml(v) {
  return v
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}

function parseRocketPage(html) {
  const blocks = [
    ...html.matchAll(
      /<li\s+id="anchorBoxId_(\d+)"[\s\S]*?<\/li>\s*(?=<li\s+id="anchorBoxId_|<\/ul>)/g
    ),
  ];

  const products = [];
  for (const block of blocks) {
    const section = block[0];

    const nameRaw =
      section.match(
        /class="df-prl-name[\s\S]*?<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/a>/
      )?.[1] ?? "";
    const specRaw =
      section.match(
        /summary_desc[\s\S]*?<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/
      )?.[1] ?? "";

    const name = stripTags(decodeHtml(nameRaw));
    const spec = stripTags(decodeHtml(specRaw));

    const code = extractProductCode(spec) || extractProductCode(name);
    if (code) {
      products.push({ name, code, spec });
    }
  }

  return products;
}

// ---------------------------------------------------------------------------
// Fetch with retry
// ---------------------------------------------------------------------------

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

// ---------------------------------------------------------------------------
// Determine OEM spec from product list
// ---------------------------------------------------------------------------

function determineOemSpec(products) {
  const specs = products.map((p) => parseSpec(p.code)).filter(Boolean);

  if (specs.length === 0) return null;

  // Group by capacity
  const capCounts = {};
  for (const s of specs) {
    capCounts[s.capacity] = (capCounts[s.capacity] || 0) + 1;
  }
  const dominantCapacity = Number(
    Object.entries(capCounts).sort((a, b) => b[1] - a[1])[0][0]
  );

  // Filter to dominant capacity
  const filtered = specs.filter((s) => s.capacity === dominantCapacity);

  // Determine polarity from dominant capacity items
  const polCounts = { R: 0, L: 0 };
  for (const s of filtered) {
    if (s.polarity) polCounts[s.polarity]++;
  }

  let polarity = null;
  if (polCounts.R > 0 && polCounts.L === 0) polarity = "R";
  else if (polCounts.L > 0 && polCounts.R === 0) polarity = "L";
  else if (polCounts.R > 0 && polCounts.L > 0) {
    // Both present — pick the one that appears first (Rocket usually lists OEM first)
    for (const s of filtered) {
      if (s.polarity) {
        polarity = s.polarity;
        break;
      }
    }
  }

  // Determine type
  const typeCounts = {};
  for (const s of filtered) {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  }
  const dominantType = Object.entries(typeCounts).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  // Confidence
  const totalWithPolarity = polCounts.R + polCounts.L;
  const polarityAgreed =
    totalWithPolarity > 0
      ? Math.max(polCounts.R, polCounts.L) / totalWithPolarity
      : 0;

  let confidence = "low";
  if (polarityAgreed >= 1 && totalWithPolarity >= 2) confidence = "high";
  else if (polarityAgreed >= 0.7) confidence = "medium";
  else if (polarity) confidence = "medium";

  const codes = [...new Set(products.map((p) => p.code))];

  return {
    capacity: dominantCapacity,
    polarity,
    type: dominantType,
    confidence,
    codes,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const catalog = JSON.parse(
    readFileSync(resolve(ROOT, "data/vehicle-catalog.json"), "utf-8")
  );

  // Collect all trims
  const allTrims = [];
  for (const brand of catalog.brands) {
    for (const model of brand.models) {
      for (const trim of model.trims || []) {
        allTrims.push({
          trimId: trim.id,
          trimName: trim.name,
          brandName: brand.name,
          modelName: model.name,
        });
      }
    }
  }

  console.log(`Total trims: ${allTrims.length}`);
  console.log(`Concurrency: ${CONCURRENCY}, delay: ${DELAY_MS}ms`);
  console.log("---");

  const specs = {};
  let done = 0;
  let errors = 0;
  let empty = 0;

  // Process in batches
  for (let i = 0; i < allTrims.length; i += CONCURRENCY) {
    const batch = allTrims.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (trim) => {
        const url = `${ROCKET_BASE}/product/list.html?cate_no=${trim.trimId}`;
        const html = await fetchWithRetry(url);
        const products = parseRocketPage(html);
        return { trim, products };
      })
    );

    for (const result of results) {
      done++;

      if (result.status === "rejected") {
        errors++;
        continue;
      }

      const { trim, products } = result.value;

      if (products.length === 0) {
        empty++;
        specs[trim.trimId] = {
          trimName: trim.trimName,
          brandName: trim.brandName,
          modelName: trim.modelName,
          oemSpec: null,
          productCount: 0,
        };
        continue;
      }

      const oemSpec = determineOemSpec(products);

      specs[trim.trimId] = {
        trimName: trim.trimName,
        brandName: trim.brandName,
        modelName: trim.modelName,
        oemSpec,
        productCount: products.length,
      };
    }

    // Progress
    if (done % 20 === 0 || done === allTrims.length) {
      const pct = ((done / allTrims.length) * 100).toFixed(1);
      process.stdout.write(
        `\r[${pct}%] ${done}/${allTrims.length} done | ${errors} errors | ${empty} empty`
      );
    }

    if (i + CONCURRENCY < allTrims.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n---");

  // Stats
  const entries = Object.values(specs);
  const withSpec = entries.filter((e) => e.oemSpec);
  const highConf = withSpec.filter((e) => e.oemSpec.confidence === "high");
  const medConf = withSpec.filter((e) => e.oemSpec.confidence === "medium");
  const lowConf = withSpec.filter((e) => e.oemSpec.confidence === "low");
  const noPolarity = withSpec.filter((e) => !e.oemSpec.polarity);

  console.log(`Specs found: ${withSpec.length} / ${entries.length}`);
  console.log(`  High confidence: ${highConf.length}`);
  console.log(`  Medium confidence: ${medConf.length}`);
  console.log(`  Low confidence: ${lowConf.length}`);
  console.log(`  No polarity: ${noPolarity.length}`);
  console.log(`  Empty (no products): ${empty}`);
  console.log(`  Errors: ${errors}`);

  // Save
  const output = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    totalTrims: allTrims.length,
    specsFound: withSpec.length,
    specs,
  };

  const outPath = resolve(ROOT, "data/battery-specs.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nSaved to ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
