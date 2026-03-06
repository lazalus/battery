import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const data = JSON.parse(readFileSync(resolve(ROOT, "data/battery-specs.json"), "utf-8"));
const catalog = JSON.parse(readFileSync(resolve(ROOT, "data/vehicle-catalog.json"), "utf-8"));

const popular = [
  "아반떼", "쏘나타", "그랜저", "투싼", "싼타페",
  "K5", "K3", "쏘렌토", "카니발", "셀토스", "코나",
  "모닝", "레이", "스포티지", "스타렉스", "팰리세이드",
];

console.log("=== 현대/기아 주요 차종 OEM 배터리 스펙 검증 ===\n");

for (const brand of catalog.brands) {
  if (brand.name !== "현대자동차" && brand.name !== "기아자동차") continue;

  for (const model of brand.models) {
    const matched = popular.some((p) => model.name.includes(p));
    if (!matched) continue;

    console.log(`[${brand.name}] ${model.name}`);
    for (const trim of model.trims || []) {
      const spec = data.specs[String(trim.id)];
      const oem = spec?.oemSpec;
      if (oem) {
        const pol = oem.polarity || "?";
        console.log(`  ${trim.name}  =>  ${oem.capacity}Ah ${pol} ${oem.type}  [${oem.codes.join(", ")}]`);
      } else {
        console.log(`  ${trim.name}  =>  (데이터 없음)`);
      }
    }
    console.log();
  }
}

// Stats: how many have no polarity
const entries = Object.values(data.specs).filter((e) => e.oemSpec);
const noPol = entries.filter((e) => e.oemSpec.polarity === null);
console.log("=== 전체 통계 ===");
console.log(`총 트림: ${Object.keys(data.specs).length}`);
console.log(`스펙 확보: ${entries.length}`);
console.log(`극성 확인: ${entries.length - noPol.length}`);
console.log(`극성 미확인: ${noPol.length}`);
