# 배터리핏 (BatteryFit)

Next.js(App Router) 기반의 차량 배터리 검색/추천/장착점 지도 단일 페이지 앱입니다.

## 1) 설치 및 실행

```bash
npm install
npm run db:generate
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 2) 환경 변수 설정

`.env.local.example`를 복사해서 `.env.local`을 만들고 값을 채우세요.

```bash
cp .env.local.example .env.local
```

필수 값:

- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`: 카카오 JavaScript 키
- `TURSO_DATABASE_URL`: Turso DB URL (`libsql://...`)
- `TURSO_AUTH_TOKEN`: Turso 인증 토큰
- `GEMINI_API_KEY`: Gemini API 키
- `GEMINI_MODEL`: 예) `gemini-2.5-flash`
- `AUTH_SECRET`: 인증 세션 서명 키(랜덤 긴 문자열)
- `ADMIN_EMAILS`: 관리자 이메일(쉼표 구분), 예) `nov9306@gmail.com`

## 3) 핵심 파일

- `app/page.tsx`: 단일 앱웹 화면 뼈대
- `app/components/KakaoMapSection.tsx`: 카카오맵 로딩 및 마커 표시
- `data/vehicle-catalog.json`: 차종 데이터(국산/수입 전체)
- `scripts/fetch-rocket-catalog.mjs`: 레퍼런스 사이트 카테고리 동기화 스크립트
- `.env.local.example`: 환경 변수 템플릿

## 4) 차량 데이터 동기화

```bash
npm run catalog:sync
```

동기화 소스:

- `https://rocketbattery.kr/rocket/btr.html`
- `https://rocketbattery.kr/exec/front/Product/SubCategory?parent_cate_no=...`

## 5) Turso + Prisma 연동

DB 스키마를 Turso에 반영:

```bash
npm run db:push
```

카탈로그(`data/vehicle-catalog.json`)를 Turso로 적재:

```bash
npm run db:seed:catalog
```

Prisma 클라이언트 유틸:

- `lib/prisma.ts`
- `prisma/schema.prisma`

## 6) GitHub로 올리기

```bash
git add .
git commit -m "feat: battery wholesale single-page skeleton with kakao map and turso env"
git branch -M main
git remote add origin https://github.com/<your-id>/<repo>.git
git push -u origin main
```

## 7) Cloudflare Pages 배포

1. Cloudflare Pages에서 `Create a project` > GitHub 저장소 연결
2. Framework preset: `Next.js`
3. Build command: `npm run build`
4. 환경 변수(Production/Preview 둘 다) 등록:
   - `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (`gemini-2.5-flash`)
   - `AUTH_SECRET`
   - `ADMIN_EMAILS`
5. 배포 후 카카오 개발자 콘솔에서 `Web 플랫폼` 도메인 등록:
   - `https://<project>.pages.dev`
   - 커스텀 도메인 사용 시 해당 도메인도 추가

## 8) 배포 점검 체크리스트

- `내차관리` 회원가입/로그인 동작 확인
- 관리자 계정(`ADMIN_EMAILS`)으로 `/admin` 접근 확인
- 관리자 페이지에서 `Gemini 초안 1개 생성` 동작 확인
- `배터리지도` 탭에서 지도 로딩/검색/매장 결과 확인
- 배터리 호환 조회(`/api/compatible-batteries`) 동작 확인
