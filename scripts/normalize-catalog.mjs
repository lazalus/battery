#!/usr/bin/env node
/**
 * vehicle-catalog.json 정규화 스크립트
 *
 * 1. 연식 포맷 통일: XX~XX년 (2자리+년)
 * 2. 4자리 연도 → 2자리 변환
 * 3. "08~11 년" → "08~11년" 공백 제거
 * 4. 완전 중복 트림 제거 (ID 작은 것 유지)
 * 5. 오타/불필요 공백 정리
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(__dirname, '../data/vehicle-catalog.json');

const data = JSON.parse(readFileSync(catalogPath, 'utf-8'));

let stats = {
  yearSpaceFixed: 0,      // "08~11 년" → "08~11년"
  fourDigitFixed: 0,       // "2021년" → "21년"
  duplicatesRemoved: 0,    // 완전 중복 제거
  typoFixed: 0,            // 오타/공백 정리
  totalTrims: 0,
};

function normalizeTrimName(name) {
  let fixed = name;

  // 1) 불필요 다중 공백 → 단일 공백
  fixed = fixed.replace(/\s{2,}/g, ' ');

  // 2) "가솔 린" → "가솔린", "디 젤" → "디젤" 등 오타 수정
  const typoMap = {
    '가솔 린': '가솔린',
    '디 젤': '디젤',
    '하이브리 드': '하이브리드',
    '1 세대': '1세대',
    '2 세대': '2세대',
    '3 세대': '3세대',
  };
  for (const [wrong, right] of Object.entries(typoMap)) {
    if (fixed.includes(wrong)) {
      fixed = fixed.replace(wrong, right);
      stats.typoFixed++;
    }
  }

  // 3) 4자리 연도 → 2자리: "(2021년" → "(21년", "2021~" → "21~"
  fixed = fixed.replace(/(\(?\s*)(\d{4})\s*(년?\s*[~\-])/g, (_, prefix, year, sep) => {
    const short = year.slice(2);
    stats.fourDigitFixed++;
    return `${prefix}${short}${sep.replace(/\s/g, '')}`;
  });
  fixed = fixed.replace(/([~\-]\s*)(\d{4})\s*(년)/g, (_, sep, year, suffix) => {
    const short = year.slice(2);
    stats.fourDigitFixed++;
    return `${sep.replace(/\s/g, '')}${short}${suffix}`;
  });

  // 4) "08~11 년" → "08~11년" (숫자와 년 사이 공백 제거)
  fixed = fixed.replace(/(\d{2})\s+년/g, (_, num) => {
    stats.yearSpaceFixed++;
    return `${num}년`;
  });

  // 5) "~ 현재" → "~현재", "~ " 정리
  fixed = fixed.replace(/\s*~\s*/g, '~');

  // 6) 괄호 안 공백 정리: "( " → "(", " )" → ")"
  fixed = fixed.replace(/\(\s+/g, '(');
  fixed = fixed.replace(/\s+\)/g, ')');

  // 최종 trim
  fixed = fixed.trim();

  return fixed;
}

// 정규화 + 중복 제거
let totalBefore = 0;
let totalAfter = 0;

data.brands.forEach(brand => {
  brand.models.forEach(model => {
    totalBefore += model.trims.length;

    // 1) 트림명 정규화
    model.trims.forEach(trim => {
      trim.name = normalizeTrimName(trim.name);
    });

    // 2) 완전 중복 제거 (정규화 후 이름이 동일한 것 → ID 작은 것 유지)
    const seen = new Map();
    const deduped = [];
    for (const trim of model.trims) {
      const key = trim.name;
      if (seen.has(key)) {
        stats.duplicatesRemoved++;
        // 더 작은 ID를 유지
        const existing = seen.get(key);
        if (trim.id < existing.id) {
          // 교체
          const idx = deduped.indexOf(existing);
          deduped[idx] = trim;
          seen.set(key, trim);
        }
      } else {
        seen.set(key, trim);
        deduped.push(trim);
      }
    }
    model.trims = deduped;
    totalAfter += deduped.length;
  });
});

// stats 업데이트
data.stats.trimCount = totalAfter;

// 저장
writeFileSync(catalogPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

console.log('=== 정규화 완료 ===');
console.log(`연식 공백 수정 (XX 년 → XX년): ${stats.yearSpaceFixed}건`);
console.log(`4자리→2자리 변환: ${stats.fourDigitFixed}건`);
console.log(`오타/공백 수정: ${stats.typoFixed}건`);
console.log(`중복 트림 제거: ${stats.duplicatesRemoved}건`);
console.log(`트림 수: ${totalBefore} → ${totalAfter}`);
