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


## 대표 소식 건강 상태

배치 응답은 대표 소식의 상태를 `healthStatus`로 구분합니다.

- `healthy`: 검증된 대표 소식이 선택됨
- `no_news`: 정상 조회됐고 원본 후보도 없어 실제 소식 없음으로 판단
- `suspicious_empty`: 원본 게시글은 있으나 엄격 필터 뒤 대표 후보가 없음. 기존 정상값 보존 권장
- `degraded`: 조회 실패, stale, 보조 검색 실패 또는 메타데이터 저하. 기존 정상값 보존

`preservePrevious=true`이면 시트 자동화는 기존 정상 대표 소식을 삭제하거나 빈 값으로 덮어쓰지 않아야 합니다.
`selectedFingerprint`가 이전 저장값과 같으면 제목/날짜/이미지 셀 재쓰기를 생략할 수 있습니다.


### 시트 쓰기 최소화

Apps Script는 마지막으로 저장한 fingerprint를 `previous_fingerprint` query parameter로 전달할 수 있습니다.
배치 API는 다음 계약을 반환합니다.

- `updateAction=write`, `shouldWrite=true`: 대표 소식이 새로 생겼거나 변경됨
- `updateAction=skip_unchanged`, `shouldWrite=false`: fingerprint가 동일하므로 Sheets 쓰기 생략
- `updateAction=preserve_previous`, `shouldWrite=false`: suspicious/degraded 상태이므로 기존 정상값 유지

최초 호출처럼 이전 fingerprint가 없으면 정상 대표 소식은 `write`로 처리합니다.


<!-- Deployment trigger note: refresh Production after v1.6 fingerprint write-decision merge. -->
