# Battery Wholesale Web App

Next.js(App Router) 기반의 차량 배터리 검색/추천/장착점 지도 단일 페이지 앱입니다.

## 1) 설치 및 실행

```bash
npm install
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

## 3) 핵심 파일

- `app/page.tsx`: 단일 앱웹 화면 뼈대
- `app/components/KakaoMapSection.tsx`: 카카오맵 로딩 및 마커 표시
- `.env.local.example`: 환경 변수 템플릿

## 4) GitHub로 올리기

```bash
git add .
git commit -m "feat: battery wholesale single-page skeleton with kakao map and turso env"
git branch -M main
git remote add origin https://github.com/<your-id>/<repo>.git
git push -u origin main
```
