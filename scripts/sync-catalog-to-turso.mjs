import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

function parseTrim(rawTrimName) {
  const raw = String(rawTrimName ?? "").trim();
  const yearMatch = raw.match(/\(([^)]+)\)\s*$/);
  const yearLabel = yearMatch ? yearMatch[1].trim() : null;
  const engineLabel = yearMatch ? raw.replace(/\s*\([^)]+\)\s*$/, "").trim() : raw;

  return {
    name: raw,
    yearLabel,
    engineLabel,
  };
}

async function loadCatalog() {
  const catalogPath = path.join(process.cwd(), "data", "vehicle-catalog.json");
  const raw = await fs.readFile(catalogPath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required.");
  }

  const catalog = await loadCatalog();
  const adapter = new PrismaLibSQL({ url, authToken });
  const prisma = new PrismaClient({ adapter });

  let brandCount = 0;
  let modelCount = 0;
  let trimCount = 0;

  try {
    for (const brand of catalog.brands ?? []) {
      const brandRow = await prisma.vehicleBrand.upsert({
        where: { sourceId: Number(brand.id) },
        update: {
          name: String(brand.name ?? ""),
          origin: String(brand.origin ?? ""),
        },
        create: {
          sourceId: Number(brand.id),
          name: String(brand.name ?? ""),
          origin: String(brand.origin ?? ""),
        },
      });
      brandCount += 1;

      for (const model of brand.models ?? []) {
        const modelRow = await prisma.vehicleModel.upsert({
          where: { sourceId: Number(model.id) },
          update: {
            name: String(model.name ?? ""),
            brandId: brandRow.id,
          },
          create: {
            sourceId: Number(model.id),
            name: String(model.name ?? ""),
            brandId: brandRow.id,
          },
        });
        modelCount += 1;

        for (const trim of model.trims ?? []) {
          const parsed = parseTrim(trim.name);

          await prisma.vehicleTrim.upsert({
            where: { sourceId: Number(trim.id) },
            update: {
              name: parsed.name,
              yearLabel: parsed.yearLabel,
              engineLabel: parsed.engineLabel,
              modelId: modelRow.id,
            },
            create: {
              sourceId: Number(trim.id),
              name: parsed.name,
              yearLabel: parsed.yearLabel,
              engineLabel: parsed.engineLabel,
              modelId: modelRow.id,
            },
          });
          trimCount += 1;
        }
      }
    }

    console.log(
      `Synced catalog to Turso (brands=${brandCount}, models=${modelCount}, trims=${trimCount})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
