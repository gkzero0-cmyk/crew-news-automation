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



### 통합 조회 비용 절감

Apps Script의 정상 갱신 경로는 `/api/crew-news-all`을 한 번 호출해 최대 8개 크루의
기존 `crew-news-batch` 판정 결과를 묶어서 받습니다.

- 정상 시 Apps Script → Vercel 외부 호출: 크루별 8회가 아니라 주기당 1회
- 대표 소식 판정 로직은 기존 `crew-news-batch`를 그대로 재사용
- 통합 endpoint 장애 시에만 기존 크루별 호출로 자동 폴백
- 각 크루의 fingerprint / `skip_unchanged` / `preserve_previous` 계약은 그대로 유지
- 상태 시트의 `FetchMode=single-batch-v1`로 적용 여부 확인 가능

### 실제 Apps Script 실행본 확인

`apps-script/Code.gs`의 `ScriptVersion=crew-apps-script-v1.7.0`은 실행 진단 버전입니다.
Vercel 서버 정책 `crew-automation-v1.6-server`와는 별도로 관리합니다.
GitHub/Vercel 배포는 Google Apps Script 편집기의 코드를 자동으로 갱신하지 않습니다.

이미 10분 트리거가 설치되어 있다면 원본 시트의 **확장 프로그램 → Apps Script**에서
기존 `Code.gs` 전체를 이 파일로 교체하고 저장한 뒤 `refreshCrewNews`를 한 번 실행합니다.
기존 트리거를 다시 설치하거나 fingerprint를 초기화할 필요는 없습니다.

완료된 실행은 `자동화 상태`의 A16:B22에 다음 진단값을 기록합니다.

| 항목 | 정상 통합 조회 값 / 의미 |
| --- | --- |
| FetchMode | `single-batch-v1` |
| ScriptVersion | `crew-apps-script-v1.7.0` |
| APIBase | `https://crew-news-automation.vercel.app` |
| FetchRequestCount | `1` (실제 URL Fetch 시도 수, 실패 포함) |
| FallbackRequestCount | `0` |
| RunCompletedAt | 같은 실행의 AppsScriptLastRun과 동일 |
| RunOutcome | `completed` 또는 `completed_with_errors` |

일부 크루만 개별 조회했으면 `single-batch-v1+per-crew-fallback`, 통합 요청 자체가
실패하여 개별 조회로 전환했으면 `per-crew-fallback`입니다. 단순 설치로는 실행 증거를
만들지 않습니다. FetchMode만으로 소식의 건강 상태를 판단하지 말고 각 크루의
HealthStatus와 RunOutcome도 확인하세요. ScriptVersion은 실행본 식별자이며 전체 파일의
암호학적 checksum은 아닙니다. 전체 코드 일치 여부는 편집기 소스와 이 파일을 비교합니다.

### 2026-10-02 분리 점검

- 독립 저장소 `gkzero0-cmyk/crew-news-automation`의 main `2c650fc5`가 전용 Vercel
  프로젝트 `prj_LZqgnYUHbCc6tsVVMZykkGMvgc0m`의 Production READY로 확인되었습니다.
- 팬사이트는 별도 저장소 `gkzero0-cmyk/chunbong-fansite` 및 프로젝트
  `prj_eBMnjlkmGd6QDEFTG16x5F1KQyol`입니다.
- 독립 API는 로컬 모듈을 직접 호출하며 팬사이트 HTTP API나 Redis/Upstash에 의존하지 않습니다.
- 두 프로젝트의 Vercel team은 동일합니다. 이 분리는 별도 계정/팀의 사용량 한도 분리를 뜻하지 않습니다.
- 팬사이트 저장소에는 이전 `api/crew-news*.js`와 `crew-automation/` 복사본이 남아 있습니다.
  전용 저장소가 이 복사본을 import하지는 않습니다. 사용 여부 감사 없이 삭제하지 않았습니다.
- 실제 시트의 17:59:43 KST 실행은 이전 PolicyVersion이며 FetchMode가 없어,
  Apps Script 최신 코드 교체 및 다음 실행 검증은 아직 완료되지 않았습니다.

검증: 새 실행 진단 테스트 4개 시나리오 통과. 기존 `tests/reliability.test.js:182`의
imageSourceFor 테스트는 이번 수정 전후 모두 `post !== vod`로 실패합니다.
이번 변경은 서버 이미지 판정 코드를 수정하지 않습니다.

SOOP 원본 조회 자체는 각 크루 검증을 위해 계속 필요하므로, 이 변경의 주 목적은
Vercel 함수 호출 오버헤드와 Apps Script URL Fetch 호출 수를 줄이는 것입니다.

### 시트 쓰기 최소화

Apps Script는 마지막으로 저장한 fingerprint를 `previous_fingerprint` query parameter로 전달할 수 있습니다.
배치 API는 다음 계약을 반환합니다.

- `updateAction=write`, `shouldWrite=true`: 대표 소식이 새로 생겼거나 변경됨
- `updateAction=skip_unchanged`, `shouldWrite=false`: fingerprint가 동일하므로 Sheets 쓰기 생략
- `updateAction=preserve_previous`, `shouldWrite=false`: suspicious/degraded 상태이므로 기존 정상값 유지

최초 호출처럼 이전 fingerprint가 없으면 정상 대표 소식은 `write`로 처리합니다.


<!-- Deployment trigger note: refresh Production after v1.6 fingerprint write-decision merge. -->


## Apps Script 백업

실제 Google Sheet 자동화 소스는 `apps-script/Code.gs`에 백업합니다.

- `previous_fingerprint`를 배치 API에 전달
- `skip_unchanged`이면 뉴스/이미지 셀 쓰기 생략
- `preserve_previous`이면 기존 정상값 유지
- 정상적인 `no_news`에서만 기존 소식/이미지 제거
- 숨김 `자동화 상태` 시트에 `Fingerprint / UpdateAction / HealthStatus` 진단값 기록

Google Apps Script 프로젝트가 GitHub와 자동 동기화되는 구조는 아니므로, 실제 Code.gs를 변경한 경우 이 백업도 함께 갱신해야 합니다.
- 상태 시트의 `원문게시일`은 실제 게시글 업로드 시각(`sourcePublishedAt`)을 기록하고, 메인 소식의 `(M/D)` 표시는 활동일(`activityDate`)을 사용합니다.

