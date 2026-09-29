# Crew News Automation

신생 종겜 크루 현황 Google Sheet용 독립 자동화 API입니다.

춘봉 팬사이트와 **배포·캐시·서버리스 실행을 분리**해, 팬사이트 변경이나 장애가 크루 소식 자동 갱신에 영향을 주지 않도록 구성했습니다.

## API

- `/api/status` — 서비스/정책 버전 확인
- `/api/crew-news` — SOOP 게시글 및 VOD 수집
- `/api/crew-news-batch` — 크루별 대표 소식 최종 판정
- `/api/image` — 검증된 SOOP 이미지/VOD 썸네일 프록시

현재 서버 정책: `crew-automation-v1.6-server`

버전 정보는 `lib/version.js`를 단일 기준으로 사용합니다. API 상태/배치 응답과 회귀 테스트가 같은 정책 버전을 참조합니다.

## 운영 원칙

- 대표 소식 판정은 서버가 단일 source of truth입니다.
- 게시글 이미지가 없을 때만 관련 VOD 썸네일을 보조 탐색합니다.
- VOD는 활동 날짜와 크루/활동 의미가 함께 맞을 때만 사용합니다.
- 부분 조회 실패나 일시적 SOOP 오류로 기존 정상 소식을 지우지 않습니다.
- Google Sheet Apps Script는 최종 결과를 받아 서식과 링크만 적용합니다.

## Vercel

이 저장소를 별도 Vercel Project로 연결하고 Root Directory는 저장소 루트(`./`)를 사용합니다.
