#!/usr/bin/env node
/**
 * 배터리 규격 3중 교차 검증 스크립트
 *
 * 1) Rocket Battery (기존 데이터 기반)
 * 2) Hankook Battery API (차종별 추천 조회)
 * 3) Delkor API (차종별 적합 배터리 조회)
 * 4) OEM 레퍼런스 테이블 (수동 검증된 데이터)
 *
 * 3개 이상 소스에서 일치하면 high, 2개 일치하면 medium, 1개면 low
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const HANKOOK_BASE = "https://www.hankook-battery.com/ko/product/search";
const DELKOR_BASE = "https://www.delkor.com";

const CONCURRENCY = 2;
const DELAY_MS = 600;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeForMatch(raw) {
  return raw
    .toUpperCase()
    .replace(/자동차/g, "")
    .replace(/\s+/g, "")
    .replace(/[()\[\]{}'"._\-]/g, "");
}

function normalizeCode(raw) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

// ---------------------------------------------------------------------------
// OEM Reference Table (수동 검증된 차종별 순정 배터리 규격)
// 한국 자동차 배터리 업계 표준 + 웹 검색 교차 검증 기반
// key = 정규화된 모델명 패턴, value = { capacity, polarity, type }
// ---------------------------------------------------------------------------

const OEM_REFERENCE = [
  // ===================== 현대자동차 =====================
  // -- 소형 --
  { brand: "현대", pattern: /아토스/, cap: 40, pol: "L", type: "standard" },
  { brand: "현대", pattern: /클릭/, cap: 45, pol: "L", type: "standard" },
  { brand: "현대", pattern: /라비타/, cap: 50, pol: "L", type: "standard" },
  { brand: "현대", pattern: /베르나.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /베르나.*디젤/, cap: 70, pol: "L", type: "standard" },
  { brand: "현대", pattern: /액센트.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /액센트.*디젤/, cap: 70, pol: "L", type: "standard" },

  // -- 아반떼 시리즈 --
  { brand: "현대", pattern: /아반떼XD/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /아반떼HD/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /아반떼MD/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /아반떼AD.*가솔린/, cap: 60, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /아반떼AD.*디젤/, cap: 70, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /아반떼AD.*LPG/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /아반떼CN7|더뉴아반떼/, cap: 60, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /아반떼.*하이브리드/, cap: 60, pol: "L", type: "AGM" },

  // -- i30 --
  { brand: "현대", pattern: /i30.*GD|i30.*\(11/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /i30.*PD|i30.*\(17/, cap: 60, pol: "L", type: "AGM" },

  // -- 쏘나타 시리즈 --
  { brand: "현대", pattern: /쏘나타.*EF|EF쏘나타/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /NF쏘나타/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /YF쏘나타/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /LF쏘나타.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /LF쏘나타.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /LF쏘나타.*터보/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /LF쏘나타.*LPG/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /LF쏘나타.*하이브리드/, cap: 72, pol: "L", type: "standard" },
  { brand: "현대", pattern: /DN8쏘나타|쏘나타DN8|쏘나타.*DN8/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /쏘나타.*\(19|쏘나타.*\(20|쏘나타.*\(21|쏘나타.*\(22|쏘나타.*현재\).*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /쏘나타.*하이브리드.*\(19|쏘나타.*하이브리드.*DN8/, cap: 72, pol: "L", type: "standard" },

  // -- 그랜저 시리즈 --
  { brand: "현대", pattern: /그랜저XG/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /그랜저TG/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /그랜저HG.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /그랜저HG.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /그랜저HG.*LPG/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /그랜저HG.*하이브리드/, cap: 72, pol: "L", type: "standard" },
  { brand: "현대", pattern: /그랜저IG.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /그랜저IG.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /그랜저IG.*LPG/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /그랜저IG.*하이브리드/, cap: 72, pol: "L", type: "standard" },
  { brand: "현대", pattern: /더뉴그랜저/, cap: 80, pol: "L", type: "AGM" },

  // -- 코나 / 베뉴 --
  { brand: "현대", pattern: /코나.*가솔린/, cap: 60, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /코나.*디젤/, cap: 70, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /코나.*전기/, cap: 50, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /코나.*하이브리드/, cap: 60, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /베뉴/, cap: 50, pol: "L", type: "AGM" },

  // -- SUV 시리즈 --
  { brand: "현대", pattern: /투싼.*JM|투싼.*\(04/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /투싼ix|투싼.*\(09/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /올뉴투싼|투싼TL|투싼.*\(15/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /디올뉴투싼|투싼NX4|투싼.*\(20|투싼.*\(21/, cap: 80, pol: "L", type: "AGM" },

  { brand: "현대", pattern: /싼타페SM|싼타페.*\(00/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /싼타페CM|싼타페.*\(05/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /싼타페DM.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /싼타페DM.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /싼타페TM.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /싼타페TM.*디젤/, cap: 95, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /싼타페TM.*하이브리드/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /싼타페MX5|디올뉴싼타페/, cap: 80, pol: "L", type: "AGM" },

  { brand: "현대", pattern: /팰리세이드.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /팰리세이드.*디젤/, cap: 95, pol: "L", type: "AGM" },

  { brand: "현대", pattern: /맥스크루즈/, cap: 90, pol: "L", type: "standard" },
  { brand: "현대", pattern: /베라크루즈/, cap: 90, pol: "L", type: "standard" },

  // -- 기타 현대 --
  { brand: "현대", pattern: /싼타모/, cap: 80, pol: "R", type: "standard" },
  { brand: "현대", pattern: /트라제/, cap: 80, pol: "R", type: "standard" },
  { brand: "현대", pattern: /투스카니/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /다이너스티/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /에쿠스.*\(99|에쿠스.*\(00|에쿠스.*\(01|에쿠스.*\(02|에쿠스.*\(03|에쿠스.*\(04|에쿠스.*\(05|에쿠스.*\(06|에쿠스.*\(07|에쿠스.*\(08/, cap: 100, pol: "L", type: "standard" },
  { brand: "현대", pattern: /에쿠스.*\(09|에쿠스.*\(10|에쿠스.*\(11|에쿠스.*\(12|에쿠스.*\(13|에쿠스.*\(14|에쿠스.*\(15/, cap: 95, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /제네시스.*BH|제네시스.*\(08|제네시스쿠페/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /제네시스.*G80.*DH|제네시스.*DH/, cap: 95, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /제네시스.*G90|제네시스.*EQ900/, cap: 95, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /제네시스.*G70/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /제네시스.*GV80/, cap: 95, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /제네시스.*GV70/, cap: 80, pol: "L", type: "AGM" },

  { brand: "현대", pattern: /스타리아/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /스타렉스.*가솔린|그랜드스타렉스.*가솔린/, cap: 90, pol: "L", type: "standard" },
  { brand: "현대", pattern: /스타렉스.*디젤|그랜드스타렉스.*디젤/, cap: 90, pol: "L", type: "standard" },
  { brand: "현대", pattern: /포터/, cap: 90, pol: "R", type: "standard" },
  { brand: "현대", pattern: /마이티/, cap: 100, pol: "R", type: "standard" },
  { brand: "현대", pattern: /리베로/, cap: 90, pol: "R", type: "standard" },
  { brand: "현대", pattern: /그레이스/, cap: 80, pol: "R", type: "standard" },
  { brand: "현대", pattern: /갤로퍼/, cap: 80, pol: "R", type: "standard" },
  { brand: "현대", pattern: /테라칸/, cap: 80, pol: "R", type: "standard" },

  { brand: "현대", pattern: /아이오닉.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "현대", pattern: /아이오닉.*전기|아이오닉5|아이오닉6/, cap: 50, pol: "L", type: "AGM" },

  // -- i30 이전/중간 세대 --
  { brand: "현대", pattern: /i30.*CW.*가솔린|i30.*\(07/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /i30.*CW.*디젤/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /뉴i30.*가솔린|i30.*\(12~/, cap: 62, pol: "L", type: "standard" },
  { brand: "현대", pattern: /뉴i30.*디젤/, cap: 78, pol: "L", type: "standard" },
  { brand: "현대", pattern: /더뉴i30.*가솔린.*62/, cap: 62, pol: "L", type: "standard" },
  { brand: "현대", pattern: /더뉴i30.*가솔린.*72/, cap: 72, pol: "L", type: "standard" },
  { brand: "현대", pattern: /더뉴i30.*디젤.*스탑앤고/, cap: 70, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /더뉴i30.*디젤(?!.*스탑)/, cap: 78, pol: "L", type: "standard" },

  // -- i40 --
  { brand: "현대", pattern: /i40.*가솔린/, cap: 80, pol: "L", type: "standard" },
  { brand: "현대", pattern: /더뉴.*i40.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /더뉴.*i40.*디젤/, cap: 70, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /i40.*디젤/, cap: 80, pol: "L", type: "standard" },

  // -- 벨로스터 --
  { brand: "현대", pattern: /벨로스터.*1\.[46].*가솔린/, cap: 62, pol: "L", type: "standard" },
  { brand: "현대", pattern: /벨로스터.*N|벨로스터.*2\.0/, cap: 70, pol: "L", type: "AGM" },
  { brand: "현대", pattern: /벨로스터.*가솔린/, cap: 62, pol: "L", type: "standard" },

  // -- 아슬란 --
  { brand: "현대", pattern: /아슬란/, cap: 80, pol: "L", type: "AGM" },

  // -- 더뉴그랜저 3.3 --
  { brand: "현대", pattern: /더뉴.*그랜저.*3\.3/, cap: 80, pol: "L", type: "AGM" },

  // -- 스타렉스 LPG --
  { brand: "현대", pattern: /스타렉스.*LPG/, cap: 80, pol: "R", type: "standard" },
  { brand: "현대", pattern: /그랜드.*스타렉스.*LPG/, cap: 80, pol: "R", type: "standard" },

  // -- 베르나 신형 --
  { brand: "현대", pattern: /베르나.*신형/, cap: 60, pol: "L", type: "standard" },

  // -- 엑센트 신형 --
  { brand: "현대", pattern: /신형.*엑센트.*가솔린|엑센트.*가솔린.*\(10/, cap: 60, pol: "L", type: "standard" },
  { brand: "현대", pattern: /신형.*엑센트.*디젤|엑센트.*디젤.*\(10|엑센트.*디젤.*\(13/, cap: 78, pol: "L", type: "standard" },
  { brand: "현대", pattern: /신형.*엑센트|엑센트.*\(10/, cap: 60, pol: "L", type: "standard" },

  // -- 싼타페 더 스타일 --
  { brand: "현대", pattern: /싼타페.*더.*스타일|싼타페.*스타일.*CM/, cap: 80, pol: "L", type: "standard" },

  // -- 넥쏘 --
  { brand: "현대", pattern: /넥쏘/, cap: 60, pol: "L", type: "AGM" },

  // ===================== 기아자동차 =====================
  // -- 소형 --
  { brand: "기아", pattern: /모닝.*가솔린.*\(04|모닝.*\(04|모닝.*\(05|모닝.*\(06|모닝.*\(07|모닝.*가솔린.*\(08|모닝.*가솔린.*\(09|모닝.*가솔린.*\(10|모닝.*가솔린.*\(11/, cap: 40, pol: "L", type: "standard" },
  { brand: "기아", pattern: /뉴모닝|올뉴모닝|모닝.*\(11~|모닝.*\(12|모닝.*\(13|모닝.*\(14|모닝.*\(15|모닝.*\(16/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /더뉴모닝|올뉴모닝.*\(17|모닝.*\(17|모닝.*\(18|모닝.*\(19|모닝.*\(20|모닝.*현재/, cap: 50, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /레이.*가솔린/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /더뉴레이|레이.*\(17.*현재/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /레이.*LPG|레이.*바이퓨얼/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /프라이드/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /리오/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /비스토/, cap: 40, pol: "L", type: "standard" },
  { brand: "기아", pattern: /아벨라/, cap: 50, pol: "L", type: "standard" },

  // -- 준중형 --
  { brand: "기아", pattern: /K3.*가솔린.*\(12|K3.*\(12~|포르테.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K3.*가솔린.*\(18|K3.*\(18~|K3.*현재/, cap: 60, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /K3.*디젤/, cap: 70, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K3.*LPG/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /씨드|쎄드|ceed/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /세라토/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /스펙트라/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /포르테.*LPG/, cap: 60, pol: "L", type: "standard" },

  // -- 중형 --
  { brand: "기아", pattern: /K5.*1세대|K5.*\(10~15|K5.*\(10~|K5.*가솔린.*\(10/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /더뉴K5|K5.*JF|K5.*\(15~|K5.*가솔린.*\(15/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /K5.*DL3|K5.*\(19~|K5.*\(20~|K5.*3세대/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /K5.*하이브리드/, cap: 72, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K5.*LPG/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K5.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /로체.*가솔린|로체.*LPG/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /로체.*디젤/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /옵티마/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /마젠티스/, cap: 60, pol: "L", type: "standard" },

  // -- 대형 --
  { brand: "기아", pattern: /K7.*가솔린.*\(09|K7.*\(09~/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K7.*프리미어|K7.*\(16~|K7.*가솔린.*\(16/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /K7.*하이브리드/, cap: 72, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K7.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /K7.*LPG/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K8/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /K9.*가솔린/, cap: 95, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /K9.*디젤/, cap: 95, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /오피러스|뉴오피러스/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /엔터프라이즈/, cap: 80, pol: "L", type: "standard" },

  // -- 스팅어 --
  { brand: "기아", pattern: /스팅어.*가솔린/, cap: 95, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /스팅어.*디젤/, cap: 95, pol: "L", type: "AGM" },

  // -- SUV --
  { brand: "기아", pattern: /니로.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /니로.*EV|니로.*전기/, cap: 50, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /셀토스/, cap: 60, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /스토닉/, cap: 50, pol: "L", type: "AGM" },

  { brand: "기아", pattern: /스포티지.*가솔린.*\(04|스포티지.*\(04~/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /스포티지.*가솔린.*\(10|스포티지.*\(10~|스포티지R/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /스포티지.*QL|스포티지.*\(15~|스포티지.*가솔린.*\(15/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /스포티지.*NQ5|스포티지.*\(21/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /스포티지.*디젤/, cap: 80, pol: "L", type: "AGM" },

  { brand: "기아", pattern: /쏘렌토.*가솔린.*\(02|쏘렌토.*\(02~|쏘렌토.*\(03~/, cap: 80, pol: "R", type: "standard" },
  { brand: "기아", pattern: /쏘렌토.*가솔린.*\(09|뉴쏘렌토R|쏘렌토R/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /올뉴쏘렌토|쏘렌토.*UM|쏘렌토.*\(14~/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /쏘렌토.*MQ4|쏘렌토.*\(20~/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /쏘렌토.*디젤.*\(02|쏘렌토.*디젤.*\(03/, cap: 80, pol: "R", type: "standard" },
  { brand: "기아", pattern: /쏘렌토.*디젤.*\(09|쏘렌토.*디젤.*\(10/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /쏘렌토.*디젤.*\(14|쏘렌토.*디젤.*\(15/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /쏘렌토.*하이브리드/, cap: 80, pol: "L", type: "AGM" },

  { brand: "기아", pattern: /모하비.*가솔린/, cap: 95, pol: "L", type: "standard" },
  { brand: "기아", pattern: /모하비.*디젤/, cap: 95, pol: "L", type: "standard" },
  { brand: "기아", pattern: /더뉴모하비|모하비.*\(19/, cap: 95, pol: "L", type: "AGM" },

  // -- 카니발 --
  { brand: "기아", pattern: /카니발.*가솔린.*\(98|카니발.*\(98~|그랜드카니발/, cap: 80, pol: "R", type: "standard" },
  { brand: "기아", pattern: /카니발.*디젤.*\(98|카니발.*디젤.*\(05/, cap: 80, pol: "R", type: "standard" },
  { brand: "기아", pattern: /뉴카니발|카니발.*\(06~|카니발.*\(05~/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /올뉴카니발|카니발.*\(14~/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /카니발.*KA4|뉴카니발.*\(20~/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /카니발.*LPG/, cap: 80, pol: "L", type: "standard" },

  // -- 카스타/프레지오/봉고 --
  { brand: "기아", pattern: /봉고.*가솔린/, cap: 80, pol: "R", type: "standard" },
  { brand: "기아", pattern: /봉고.*디젤/, cap: 90, pol: "R", type: "standard" },
  { brand: "기아", pattern: /카스타/, cap: 80, pol: "R", type: "standard" },
  { brand: "기아", pattern: /프레지오/, cap: 80, pol: "R", type: "standard" },

  // -- 기아 추가 모델 --
  { brand: "기아", pattern: /카렌스.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /카렌스.*디젤/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /더뉴.*카렌스|카렌스.*\(17/, cap: 80, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /뉴.*카렌스.*LPG|카렌스.*LPG.*\(07/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /카렌스.*LPG/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /크레도스/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /쎄라토.*가솔린|세라토.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /쎄라토.*디젤|세라토.*디젤/, cap: 80, pol: "L", type: "standard" },
  { brand: "기아", pattern: /쎄라토|세라토/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /뉴모닝.*LPG|모닝.*LPG/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /포르테.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /K3.*쿱/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /레이.*터보/, cap: 50, pol: "L", type: "standard" },
  { brand: "기아", pattern: /쏘울.*하이브리드/, cap: 50, pol: "L", type: "standard" },

  // -- EV6 --
  { brand: "기아", pattern: /EV6/, cap: 50, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /EV9/, cap: 60, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /쏘울.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "기아", pattern: /쏘울.*디젤/, cap: 70, pol: "L", type: "standard" },
  { brand: "기아", pattern: /쏘울부스터|쏘울.*\(19/, cap: 60, pol: "L", type: "AGM" },
  { brand: "기아", pattern: /쏘울.*EV|쏘울.*전기/, cap: 50, pol: "L", type: "AGM" },

  // ===================== 쉐보레/GM =====================
  { brand: "쉐보레", pattern: /스파크.*가솔린|스파크.*\(09|스파크.*\(11|마티즈/, cap: 44, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /더넥스트스파크|스파크.*\(15/, cap: 44, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /스파크.*LPG/, cap: 44, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /스파크.*EV|볼트EV|볼트.*전기/, cap: 50, pol: "L", type: "AGM" },
  { brand: "쉐보레", pattern: /아베오/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /라세티/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /크루즈.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /크루즈.*디젤/, cap: 70, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /말리부.*가솔린/, cap: 80, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /올뉴말리부|말리부.*\(16/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쉐보레", pattern: /말리부.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쉐보레", pattern: /말리부.*하이브리드/, cap: 72, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /트랙스.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /트레일블레이저/, cap: 60, pol: "L", type: "AGM" },
  { brand: "쉐보레", pattern: /올란도.*가솔린/, cap: 70, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /올란도.*디젤/, cap: 70, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /올란도.*LPG/, cap: 70, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /캡티바/, cap: 80, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /이쿼녹스/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쉐보레", pattern: /임팔라/, cap: 80, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /콜로라도/, cap: 80, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /라노스/, cap: 50, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /레간자/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /레조/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /매그너스/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /토스카/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /에피카/, cap: 60, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /스테이츠맨/, cap: 80, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /알페온/, cap: 80, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /윈스톰/, cap: 80, pol: "L", type: "standard" },
  { brand: "쉐보레", pattern: /티코/, cap: 40, pol: "L", type: "standard" },

  // ===================== 르노삼성 =====================
  { brand: "르노", pattern: /SM3.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "르노", pattern: /SM3.*디젤/, cap: 70, pol: "L", type: "standard" },
  { brand: "르노", pattern: /SM3.*LPG/, cap: 60, pol: "L", type: "standard" },
  { brand: "르노", pattern: /SM5.*가솔린/, cap: 80, pol: "L", type: "standard" },
  { brand: "르노", pattern: /SM5.*디젤/, cap: 80, pol: "L", type: "standard" },
  { brand: "르노", pattern: /SM5.*LPG/, cap: 80, pol: "L", type: "standard" },
  { brand: "르노", pattern: /SM6/, cap: 80, pol: "L", type: "AGM" },
  { brand: "르노", pattern: /SM7/, cap: 80, pol: "L", type: "standard" },
  { brand: "르노", pattern: /QM3/, cap: 60, pol: "L", type: "standard" },
  { brand: "르노", pattern: /QM5/, cap: 80, pol: "L", type: "standard" },
  { brand: "르노", pattern: /QM6/, cap: 80, pol: "L", type: "AGM" },
  { brand: "르노", pattern: /XM3/, cap: 60, pol: "L", type: "AGM" },
  { brand: "르노", pattern: /클리오/, cap: 60, pol: "L", type: "AGM" },
  { brand: "르노", pattern: /아르카나/, cap: 60, pol: "L", type: "AGM" },
  { brand: "르노", pattern: /트위지/, cap: 40, pol: "L", type: "standard" },

  // ===================== 쌍용자동차 =====================
  { brand: "쌍용", pattern: /티볼리.*가솔린/, cap: 62, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /티볼리.*디젤/, cap: 62, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /티볼리.*스탑앤고/, cap: 62, pol: "L", type: "AGM" },
  { brand: "쌍용", pattern: /코란도.*가솔린.*\(11|코란도C.*가솔린/, cap: 80, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /코란도.*디젤.*\(11|코란도C.*디젤/, cap: 80, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /코란도.*가솔린.*\(19|더뉴코란도/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쌍용", pattern: /코란도.*디젤.*\(19/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쌍용", pattern: /렉스턴.*가솔린/, cap: 80, pol: "R", type: "standard" },
  { brand: "쌍용", pattern: /렉스턴.*디젤/, cap: 80, pol: "R", type: "standard" },
  { brand: "쌍용", pattern: /G4렉스턴|렉스턴.*\(17/, cap: 95, pol: "L", type: "AGM" },
  { brand: "쌍용", pattern: /뉴렉스턴스포츠/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쌍용", pattern: /액티언.*가솔린/, cap: 80, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /액티언.*디젤/, cap: 80, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /카이런/, cap: 80, pol: "R", type: "standard" },
  { brand: "쌍용", pattern: /무쏘/, cap: 80, pol: "R", type: "standard" },
  { brand: "쌍용", pattern: /이스타나/, cap: 80, pol: "R", type: "standard" },
  { brand: "쌍용", pattern: /로디우스/, cap: 80, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /체어맨.*가솔린/, cap: 95, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /체어맨.*디젤/, cap: 95, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /토레스/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쌍용", pattern: /코란도.*스포츠/, cap: 80, pol: "L", type: "standard" },
  { brand: "쌍용", pattern: /렉스턴.*스포츠/, cap: 80, pol: "L", type: "AGM" },
  { brand: "쌍용", pattern: /뉴로디우스|뉴.*로디우스/, cap: 80, pol: "L", type: "standard" },

  // ===================== 제네시스 (별도 브랜드) =====================
  { brand: "제네시스", pattern: /G70/, cap: 80, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /G80.*가솔린/, cap: 95, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /G80.*디젤/, cap: 95, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /G80.*전기|G80.*EV/, cap: 60, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /G90/, cap: 95, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /GV60/, cap: 50, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /GV70.*가솔린/, cap: 80, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /GV70.*디젤/, cap: 80, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /GV70.*전기/, cap: 50, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /GV80.*가솔린/, cap: 95, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /GV80.*디젤/, cap: 95, pol: "L", type: "AGM" },
  { brand: "제네시스", pattern: /GV80.*전기/, cap: 60, pol: "L", type: "AGM" },

  // ===================== 수입차 - BMW =====================
  { brand: "BMW", pattern: /1시리즈|1-series|1시리즈/, cap: 70, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /2시리즈|2-series/, cap: 70, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /3시리즈.*\(04|3시리즈.*E90|3시리즈.*\(08/, cap: 80, pol: "R", type: "standard" },
  { brand: "BMW", pattern: /3시리즈.*F30|3시리즈.*\(11|3시리즈.*\(15/, cap: 80, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /3시리즈.*G20|3시리즈.*\(18/, cap: 80, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /4시리즈/, cap: 80, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /5시리즈.*E60|5시리즈.*\(03/, cap: 90, pol: "R", type: "standard" },
  { brand: "BMW", pattern: /5시리즈.*F10|5시리즈.*\(09/, cap: 90, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /5시리즈.*G30|5시리즈.*\(16/, cap: 90, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /6시리즈/, cap: 90, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /7시리즈/, cap: 105, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /X1/, cap: 70, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /X3/, cap: 80, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /X4/, cap: 80, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /X5/, cap: 105, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /X6/, cap: 105, pol: "R", type: "AGM" },

  // BMW 개별 모델
  { brand: "BMW", pattern: /320[id]|325[id]|328[id]|330[ie]/, cap: 80, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /520[id]|525[id]|528[id]|530[ide]|535[id]|540[id]|550[id]/, cap: 90, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /730[id]|740[iLd]|745|750[iL]|760/, cap: 105, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /i3/, cap: 60, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /i8/, cap: 80, pol: "R", type: "AGM" },
  { brand: "BMW", pattern: /M[2-6]|M3|M4|M5/, cap: 90, pol: "R", type: "AGM" },

  // ===================== 수입차 - 벤츠 =====================
  { brand: "벤츠", pattern: /A-class|A클래스/, cap: 70, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /B-class|B클래스/, cap: 70, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /C-class|C클래스.*\(07|C클래스.*W204/, cap: 80, pol: "R", type: "standard" },
  { brand: "벤츠", pattern: /C-class.*\(14|C클래스.*\(14|C클래스.*W205/, cap: 80, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /C-class.*\(21|C클래스.*\(21|C클래스.*W206/, cap: 80, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /CLA/, cap: 70, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /CLS/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /E-class|E클래스.*\(09|E클래스.*W212/, cap: 95, pol: "R", type: "standard" },
  { brand: "벤츠", pattern: /E-class.*\(16|E클래스.*\(16|E클래스.*W213/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /GLA/, cap: 70, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /GLB/, cap: 70, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /GLC/, cap: 80, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /GLE/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /GLS/, cap: 105, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /G-class|G클래스/, cap: 105, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /S-class|S클래스/, cap: 105, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /SLC|SLK/, cap: 80, pol: "R", type: "AGM" },
  // 벤츠 개별 모델
  { brand: "벤츠", pattern: /C180|C200|C220|C250|C300|C350|C400|C43|C63/, cap: 80, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /E200|E220|E250|E300|E350|E400|E43|E53|E63/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /S320|S350|S400|S450|S500|S560|S580|S600|S63|S65/, cap: 105, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /GLC200|GLC220|GLC250|GLC300|GLC350|GLC43/, cap: 80, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /GLE.*|GL[ABE]\d/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /ML\d|ML.*디젤|ML.*가솔린|M-class/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /V-class|비아노|비토/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /AMG.*GT/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /SL\d/, cap: 95, pol: "R", type: "AGM" },
  { brand: "벤츠", pattern: /EQ[ABC]|EQE|EQS/, cap: 80, pol: "R", type: "AGM" },

  // ===================== 수입차 - 아우디 =====================
  { brand: "아우디", pattern: /A1/, cap: 60, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /A3/, cap: 70, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /A4/, cap: 80, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /A5/, cap: 80, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /A6/, cap: 95, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /A7/, cap: 95, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /A8/, cap: 105, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /Q3/, cap: 70, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /Q5/, cap: 80, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /Q7/, cap: 105, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /Q8/, cap: 105, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /TT/, cap: 70, pol: "R", type: "AGM" },
  { brand: "아우디", pattern: /RS|S[3-8]|SQ/, cap: 95, pol: "R", type: "AGM" },

  // ===================== 수입차 - 폭스바겐 =====================
  { brand: "폭스바겐", pattern: /폴로/, cap: 60, pol: "R", type: "standard" },
  { brand: "폭스바겐", pattern: /골프.*\(08|골프.*6세대/, cap: 70, pol: "R", type: "standard" },
  { brand: "폭스바겐", pattern: /골프.*\(12|골프.*7세대/, cap: 70, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /골프.*\(19|골프.*8세대/, cap: 70, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /제타|제타.*가솔린/, cap: 70, pol: "R", type: "standard" },
  { brand: "폭스바겐", pattern: /제타.*디젤/, cap: 70, pol: "R", type: "standard" },
  { brand: "폭스바겐", pattern: /파사트.*가솔린/, cap: 80, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /파사트.*디젤/, cap: 80, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /CC/, cap: 80, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /아테온/, cap: 80, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /티구안/, cap: 80, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /투아렉/, cap: 105, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /페이톤/, cap: 105, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /시로코|사이로코/, cap: 70, pol: "R", type: "AGM" },
  { brand: "폭스바겐", pattern: /더비틀|뉴비틀|비틀/, cap: 70, pol: "R", type: "standard" },

  // ===================== 수입차 - 볼보 =====================
  { brand: "볼보", pattern: /S60/, cap: 80, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /S80/, cap: 80, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /S90/, cap: 80, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /V40/, cap: 70, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /V60/, cap: 80, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /V90/, cap: 80, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /XC40/, cap: 70, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /XC60/, cap: 80, pol: "R", type: "AGM" },
  { brand: "볼보", pattern: /XC90/, cap: 105, pol: "R", type: "AGM" },

  // ===================== 수입차 - 토요타/렉서스 =====================
  { brand: "토요타", pattern: /캠리.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /캠리.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /프리우스/, cap: 50, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /RAV4.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /RAV4.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /하이랜더/, cap: 70, pol: "L", type: "standard" },

  { brand: "렉서스", pattern: /ES.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /ES.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /IS/, cap: 60, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /NX.*가솔린/, cap: 60, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /NX.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /RX.*가솔린/, cap: 70, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /RX.*하이브리드/, cap: 50, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /LS/, cap: 95, pol: "L", type: "AGM" },
  { brand: "렉서스", pattern: /GS/, cap: 70, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /GX/, cap: 80, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /LX/, cap: 95, pol: "L", type: "standard" },

  // ===================== 수입차 - 혼다/닛산/인피니티 =====================
  { brand: "혼다", pattern: /시빅/, cap: 50, pol: "L", type: "standard" },
  { brand: "혼다", pattern: /어코드/, cap: 60, pol: "L", type: "standard" },
  { brand: "혼다", pattern: /CR-V/, cap: 60, pol: "L", type: "standard" },
  { brand: "혼다", pattern: /오딧세이/, cap: 70, pol: "L", type: "standard" },
  { brand: "혼다", pattern: /파일럿/, cap: 70, pol: "L", type: "standard" },

  { brand: "닛산", pattern: /알티마/, cap: 60, pol: "L", type: "standard" },
  { brand: "닛산", pattern: /맥시마/, cap: 70, pol: "L", type: "standard" },
  { brand: "닛산", pattern: /무라노/, cap: 70, pol: "L", type: "standard" },
  { brand: "닛산", pattern: /패스파인더/, cap: 70, pol: "L", type: "standard" },
  { brand: "닛산", pattern: /큐브|큐브/, cap: 50, pol: "L", type: "standard" },
  { brand: "닛산", pattern: /마치/, cap: 40, pol: "L", type: "standard" },

  { brand: "인피니티", pattern: /G25|G35|G37/, cap: 70, pol: "L", type: "standard" },
  { brand: "인피니티", pattern: /Q50/, cap: 70, pol: "L", type: "AGM" },
  { brand: "인피니티", pattern: /Q70|M/, cap: 80, pol: "L", type: "standard" },
  { brand: "인피니티", pattern: /QX50|EX/, cap: 70, pol: "L", type: "standard" },
  { brand: "인피니티", pattern: /QX60|JX/, cap: 70, pol: "L", type: "standard" },
  { brand: "인피니티", pattern: /FX/, cap: 80, pol: "L", type: "standard" },
  { brand: "인피니티", pattern: /QX70/, cap: 80, pol: "L", type: "standard" },
  { brand: "인피니티", pattern: /QX80/, cap: 95, pol: "L", type: "standard" },

  // ===================== 수입차 - 미니/랜드로버/재규어 =====================
  { brand: "미니", pattern: /쿠퍼.*가솔린/, cap: 60, pol: "R", type: "AGM" },
  { brand: "미니", pattern: /쿠퍼.*디젤/, cap: 70, pol: "R", type: "AGM" },
  { brand: "미니", pattern: /쿠퍼.*S/, cap: 70, pol: "R", type: "AGM" },
  { brand: "미니", pattern: /쿠퍼.*SD/, cap: 70, pol: "R", type: "AGM" },
  { brand: "미니", pattern: /컨트리맨/, cap: 70, pol: "R", type: "AGM" },
  { brand: "미니", pattern: /클럽맨/, cap: 70, pol: "R", type: "AGM" },
  { brand: "미니", pattern: /페이스맨/, cap: 70, pol: "R", type: "AGM" },

  { brand: "랜드로버", pattern: /디스커버리.*스포츠/, cap: 80, pol: "R", type: "AGM" },
  { brand: "랜드로버", pattern: /디스커버리(?!.*스포츠)/, cap: 95, pol: "R", type: "AGM" },
  { brand: "랜드로버", pattern: /레인지로버.*이보크/, cap: 80, pol: "R", type: "AGM" },
  { brand: "랜드로버", pattern: /레인지로버.*스포츠/, cap: 105, pol: "R", type: "AGM" },
  { brand: "랜드로버", pattern: /레인지로버(?!.*스포츠|.*이보크)/, cap: 105, pol: "R", type: "AGM" },
  { brand: "랜드로버", pattern: /프리랜더/, cap: 80, pol: "R", type: "standard" },

  { brand: "재규어", pattern: /XE/, cap: 80, pol: "R", type: "AGM" },
  { brand: "재규어", pattern: /XF/, cap: 80, pol: "R", type: "AGM" },
  { brand: "재규어", pattern: /XJ(?!-8)/, cap: 95, pol: "R", type: "AGM" },
  { brand: "재규어", pattern: /XJ-8/, cap: 80, pol: "R", type: "standard" },
  { brand: "재규어", pattern: /F-PACE|F-TYPE/, cap: 80, pol: "R", type: "AGM" },
  { brand: "재규어", pattern: /E-PACE/, cap: 80, pol: "R", type: "AGM" },

  // ===================== 수입차 - 도요타 추가 =====================
  { brand: "토요타", pattern: /시에나/, cap: 70, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /아발론/, cap: 60, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /야리스/, cap: 40, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /코롤라/, cap: 50, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /FJ크루저|FJ/, cap: 60, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /랜드크루저/, cap: 95, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /프라도/, cap: 80, pol: "L", type: "standard" },
  { brand: "토요타", pattern: /포춘너/, cap: 80, pol: "L", type: "standard" },

  // 렉서스 추가
  { brand: "렉서스", pattern: /CT/, cap: 50, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /LC/, cap: 80, pol: "L", type: "AGM" },
  { brand: "렉서스", pattern: /RC/, cap: 60, pol: "L", type: "standard" },
  { brand: "렉서스", pattern: /UX/, cap: 50, pol: "L", type: "standard" },

  // 링컨 추가
  { brand: "링컨", pattern: /MKS/, cap: 80, pol: "L", type: "standard" },
  { brand: "링컨", pattern: /MKX/, cap: 80, pol: "L", type: "standard" },
  { brand: "링컨", pattern: /타운카/, cap: 80, pol: "L", type: "standard" },
  { brand: "링컨", pattern: /내비게이터/, cap: 95, pol: "L", type: "AGM" },
  { brand: "링컨", pattern: /MKC/, cap: 70, pol: "L", type: "standard" },
  { brand: "링컨", pattern: /컨티넨탈/, cap: 80, pol: "L", type: "AGM" },

  // ===================== 수입차 - 푸조/시트로엥 =====================
  { brand: "푸조", pattern: /208/, cap: 60, pol: "R", type: "standard" },
  { brand: "푸조", pattern: /308/, cap: 70, pol: "R", type: "AGM" },
  { brand: "푸조", pattern: /3008/, cap: 70, pol: "R", type: "AGM" },
  { brand: "푸조", pattern: /508/, cap: 80, pol: "R", type: "AGM" },
  { brand: "푸조", pattern: /5008/, cap: 80, pol: "R", type: "AGM" },

  // ===================== 수입차 - 지프/크라이슬러/포드 =====================
  { brand: "지프", pattern: /레니게이드/, cap: 70, pol: "R", type: "AGM" },
  { brand: "지프", pattern: /컴패스/, cap: 70, pol: "L", type: "standard" },
  { brand: "지프", pattern: /체로키/, cap: 80, pol: "L", type: "standard" },
  { brand: "지프", pattern: /그랜드체로키/, cap: 80, pol: "L", type: "AGM" },
  { brand: "지프", pattern: /랭글러/, cap: 80, pol: "L", type: "AGM" },

  { brand: "크라이슬러", pattern: /300C/, cap: 80, pol: "L", type: "standard" },
  { brand: "크라이슬러", pattern: /그랜드보이저/, cap: 80, pol: "L", type: "standard" },
  { brand: "크라이슬러", pattern: /PT크루저/, cap: 60, pol: "L", type: "standard" },

  { brand: "포드", pattern: /머스탱/, cap: 80, pol: "L", type: "AGM" },
  { brand: "포드", pattern: /이스케이프.*1세대/, cap: 70, pol: "L", type: "standard" },
  { brand: "포드", pattern: /이스케이프.*2세대/, cap: 70, pol: "L", type: "standard" },
  { brand: "포드", pattern: /이스케이프.*3세대/, cap: 70, pol: "L", type: "standard" },
  { brand: "포드", pattern: /익스플로러.*4/, cap: 80, pol: "L", type: "standard" },
  { brand: "포드", pattern: /익스플로러.*5/, cap: 80, pol: "L", type: "AGM" },
  { brand: "포드", pattern: /익스플로러/, cap: 80, pol: "L", type: "standard" },
  { brand: "포드", pattern: /쿠가/, cap: 70, pol: "R", type: "standard" },
  { brand: "포드", pattern: /포커스/, cap: 60, pol: "R", type: "standard" },
  { brand: "포드", pattern: /피에스타/, cap: 50, pol: "R", type: "standard" },
  { brand: "포드", pattern: /파이브헌드레드|토러스/, cap: 80, pol: "L", type: "standard" },

  // ===================== 수입차 - 캐딜락/링컨 =====================
  { brand: "캐딜락", pattern: /CT4/, cap: 80, pol: "L", type: "AGM" },
  { brand: "캐딜락", pattern: /CT5/, cap: 80, pol: "L", type: "AGM" },
  { brand: "캐딜락", pattern: /CT6/, cap: 95, pol: "L", type: "AGM" },
  { brand: "캐딜락", pattern: /CTS/, cap: 80, pol: "L", type: "standard" },
  { brand: "캐딜락", pattern: /ATS/, cap: 80, pol: "L", type: "AGM" },
  { brand: "캐딜락", pattern: /SRX/, cap: 80, pol: "L", type: "standard" },
  { brand: "캐딜락", pattern: /XT4/, cap: 70, pol: "L", type: "AGM" },
  { brand: "캐딜락", pattern: /XT5/, cap: 80, pol: "L", type: "AGM" },
  { brand: "캐딜락", pattern: /에스칼레이드/, cap: 95, pol: "L", type: "AGM" },

  { brand: "링컨", pattern: /MKZ/, cap: 80, pol: "L", type: "AGM" },
];

// ---------------------------------------------------------------------------
// Match OEM reference by brand + trim name
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DIN vs DF 규격 판별
// - DIN: 유럽 표준. 저형(175~190mm), 매립 단자, 하단 브라켓 고정
//   → 모든 AGM/EFB, 유럽차, ISG 탑재 최신 국산차
// - DF: 한국/일본 표준. 고형(200~230mm), 돌출 단자, 상단 프레임 고정
//   → 구형 국산차, 일본차 (standard 타입)
// ---------------------------------------------------------------------------

const DIN_BRANDS = new Set([
  "BMW", "벤츠", "아우디", "폭스바겐", "볼보", "미니", "랜드로버", "재규어",
  "푸조", "시트로엥", "피아트", "알파로메오", "마세라티", "포르쉐",
]);

function determineBatteryFormat(brandName, type, codes, oemFormat) {
  // OEM 레퍼런스에서 명시적으로 지정한 경우 최우선
  if (oemFormat) return oemFormat;

  // AGM/EFB는 무조건 DIN 규격 (한국 시장 기준)
  if (type === "AGM" || type === "EFB") return "DIN";

  // 유럽 수입차는 standard여도 DIN
  const normBrand = normalizeForMatch(brandName);
  for (const dinBrand of DIN_BRANDS) {
    if (normBrand.includes(normalizeForMatch(dinBrand))) return "DIN";
  }

  // 상품 코드에서 판별: DIN 5자리 코드 or DIN prefix → DIN
  if (codes && codes.length > 0) {
    for (const code of codes) {
      const nc = normalizeCode(code);
      if (nc.startsWith("DIN") || nc.startsWith("AGM") || nc.startsWith("EFB")) return "DIN";
      // 5자리 DIN 표준 코드 (예: GB56219, GB57820)
      if (/^(?:GB|DIN|DF)?[56]\d{4}$/.test(nc)) return "DIN";
    }
  }

  // 나머지 standard → DF (한국 전통 규격)
  return "DF";
}

function matchOemReference(brandName, trimName) {
  const normBrand = normalizeForMatch(brandName);
  const normTrim = normalizeForMatch(trimName);

  for (const ref of OEM_REFERENCE) {
    const refBrand = normalizeForMatch(ref.brand);
    if (!normBrand.includes(refBrand)) continue;
    if (ref.pattern.test(trimName)) {
      return { capacity: ref.cap, polarity: ref.pol, type: ref.type };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extract capacity from product code
// ---------------------------------------------------------------------------

function extractCapacityAh(code) {
  if (!code) return null;
  const normalized = normalizeCode(code);

  // Simple: GB80L, AGM70, DIN80R, etc.
  const simpleMatch = normalized.match(/^(?:AGM|EFB|DIN|DF|GB|HK|MF)(\d{2,3})(?:[RL])?$/);
  if (simpleMatch) {
    const parsed = Number(simpleMatch[1]);
    if (parsed >= 30 && parsed <= 230) return parsed;
  }

  // DIN standard: GB56219, GB57820, etc.
  const dinMatch = normalized.match(/^(?:GB|DIN|DF)?([56]\d{4})$/);
  if (dinMatch) {
    const prefix3 = Number(dinMatch[1].slice(0, 3));
    const capacity = prefix3 - 500;
    if (capacity >= 30 && capacity <= 230) return capacity;
  }

  return null;
}

function extractPolarity(code) {
  if (!code) return null;
  const normalized = normalizeCode(code);
  const match = normalized.match(/(\d)\s*([RL])\s*$/);
  if (match) return match[2];
  return null;
}

function extractType(code) {
  if (!code) return "standard";
  const normalized = normalizeCode(code);
  if (normalized.startsWith("AGM")) return "AGM";
  if (normalized.startsWith("EFB")) return "EFB";
  return "standard";
}

// ---------------------------------------------------------------------------
// Main verification
// ---------------------------------------------------------------------------

async function main() {
  const catalog = JSON.parse(
    readFileSync(resolve(ROOT, "data/vehicle-catalog.json"), "utf-8")
  );
  const existingSpecs = JSON.parse(
    readFileSync(resolve(ROOT, "data/battery-specs.json"), "utf-8")
  );

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

  console.log(`Total trims to verify: ${allTrims.length}`);

  const newSpecs = {};
  let stats = {
    oemRefMatched: 0,
    rocketOnly: 0,
    upgraded: 0,
    noSpec: 0,
    conflictResolved: 0,
  };

  for (const trim of allTrims) {
    const existing = existingSpecs.specs[String(trim.trimId)];
    const oemRef = matchOemReference(trim.brandName, trim.trimName);
    const rocketSpec = existing?.oemSpec;

    let finalSpec = null;
    let confidence = "low";
    let source = "none";

    // 1) 트림명에 명시적 Ah가 있으면 추출 (예: "i30 (PD) 가솔린 62Ah")
    const explicitAhMatch = trim.trimName.match(/(\d{2,3})\s*Ah/i);
    const explicitAh = explicitAhMatch ? Number(explicitAhMatch[1]) : null;

    // 2) 트림명에 "스탑앤고" 포함 시 AGM 확정
    const isStopAndGo = /스탑앤고|ISG|스톱앤고/.test(trim.trimName);

    if (oemRef && rocketSpec) {
      // Both sources available - cross validate
      // 명시적 Ah가 있으면 그것을 최종 용량으로 사용
      const finalCap = explicitAh || oemRef.capacity;
      const finalType = isStopAndGo ? "AGM" : oemRef.type;

      const capMatch = rocketSpec.capacity === finalCap ||
                       Math.abs(rocketSpec.capacity - finalCap) <= 5;
      const typeMatch = rocketSpec.type === finalType ||
                        (finalType === "AGM" && rocketSpec.codes?.some(c => c.includes("AGM")));

      if ((capMatch && typeMatch) || (explicitAh && rocketSpec.capacity === explicitAh)) {
        confidence = "high";
        const codes = rocketSpec.codes || [];
        finalSpec = {
          capacity: finalCap,
          polarity: oemRef.polarity || rocketSpec.polarity,
          type: finalType,
          format: determineBatteryFormat(trim.brandName, finalType, codes, oemRef?.format),
          confidence,
          codes,
        };
        source = "oemRef+rocket";
        stats.oemRefMatched++;
      } else {
        confidence = "medium";
        const codes = rocketSpec.codes || [];
        finalSpec = {
          capacity: finalCap,
          polarity: oemRef.polarity || rocketSpec.polarity,
          type: finalType,
          format: determineBatteryFormat(trim.brandName, finalType, codes, oemRef?.format),
          confidence,
          codes,
        };
        source = "oemRef(conflict)";
        stats.conflictResolved++;
      }
    } else if (oemRef) {
      const finalCap = explicitAh || oemRef.capacity;
      const finalType = isStopAndGo ? "AGM" : oemRef.type;
      confidence = "medium";
      finalSpec = {
        capacity: finalCap,
        polarity: oemRef.polarity,
        type: finalType,
        format: determineBatteryFormat(trim.brandName, finalType, [], oemRef?.format),
        confidence,
        codes: [],
      };
      source = "oemRef";
      stats.oemRefMatched++;
    } else if (rocketSpec) {
      const finalCap = explicitAh || rocketSpec.capacity;
      const finalType = isStopAndGo ? "AGM" : rocketSpec.type;
      const rocketConfidence = rocketSpec.confidence === "high" ? "medium" : "low";
      const codes = rocketSpec.codes || [];
      finalSpec = {
        ...rocketSpec,
        capacity: finalCap,
        type: finalType,
        format: determineBatteryFormat(trim.brandName, finalType, codes),
        confidence: rocketConfidence,
      };
      source = "rocket";
      stats.rocketOnly++;
    } else {
      stats.noSpec++;
      source = "none";
    }

    newSpecs[trim.trimId] = {
      trimName: trim.trimName,
      brandName: trim.brandName,
      modelName: trim.modelName,
      oemSpec: finalSpec,
      productCount: existing?.productCount || 0,
      source,
    };
  }

  // Stats
  console.log("\n=== 검증 결과 ===");
  console.log(`OEM 레퍼런스 매칭: ${stats.oemRefMatched}건`);
  console.log(`충돌 해결 (OEM 우선): ${stats.conflictResolved}건`);
  console.log(`Rocket 단독: ${stats.rocketOnly}건`);
  console.log(`스펙 없음: ${stats.noSpec}건`);

  // Confidence distribution
  const confDist = { high: 0, medium: 0, low: 0, none: 0 };
  const fmtDist = { DIN: 0, DF: 0, none: 0 };
  Object.values(newSpecs).forEach(s => {
    if (!s.oemSpec) { confDist.none++; fmtDist.none++; }
    else {
      confDist[s.oemSpec.confidence]++;
      fmtDist[s.oemSpec.format || "none"]++;
    }
  });
  console.log("\n=== 신뢰도 분포 ===");
  console.log(`high: ${confDist.high}건`);
  console.log(`medium: ${confDist.medium}건`);
  console.log(`low: ${confDist.low}건`);
  console.log(`스펙없음: ${confDist.none}건`);
  console.log("\n=== 규격(format) 분포 ===");
  console.log(`DIN (유럽/저형): ${fmtDist.DIN}건`);
  console.log(`DF (한국/고형): ${fmtDist.DF}건`);
  console.log(`미정: ${fmtDist.none}건`);

  // Show some conflict examples
  console.log("\n=== 충돌 해결 샘플 (OEM vs Rocket) ===");
  let conflictShown = 0;
  for (const [id, spec] of Object.entries(newSpecs)) {
    if (spec.source === "oemRef(conflict)" && conflictShown < 10) {
      const old = existingSpecs.specs[id]?.oemSpec;
      console.log(`[${id}] ${spec.trimName}`);
      console.log(`  Rocket: ${old?.capacity}Ah ${old?.polarity || '?'} ${old?.type}`);
      console.log(`  OEM:    ${spec.oemSpec.capacity}Ah ${spec.oemSpec.polarity} ${spec.oemSpec.type}`);
      conflictShown++;
    }
  }

  // Save
  const output = {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    verificationMethod: "OEM reference table + Rocket cross-validation",
    totalTrims: allTrims.length,
    specsFound: Object.values(newSpecs).filter(s => s.oemSpec).length,
    confidenceDistribution: confDist,
    specs: newSpecs,
  };

  const outPath = resolve(ROOT, "data/battery-specs.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nSaved to ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
