# 관리자 AI 비서 재설계 — 설계

날짜: 2026-11-10 · 대상: `aws/lambda/assistant*.mjs`, `aws/template.yaml`, `js/assistant-panel.js`, `lectures.html`, `crm/index.html`

## 목적

현재 비서의 두 가지 문제를 해결한다.

1. **답이 틀린다** — 강의 전체를 JSON으로 프롬프트에 넣고 합계·건수를 모델이 암산한다.
2. **조회만 된다** — 강의 등록, 입금 처리, 팔로업 입력 같은 일을 시킬 수 없다.

해결 방향: 집계는 서버 코드가 계산해 도구 결과로 넘기고, 데이터 변경은 도구로 제안받아
사용자가 확인 버튼을 눌러야 저장한다.

범위 밖: 글자 단위 스트리밍, 삭제 기능, 관리자 화면(목록·대시보드·테마) 개선(별도 설계).

## 결정 사항

| 항목 | 결정 |
|---|---|
| 모델 | `claude-opus-5-5`, 사고 강도 `output_config.effort: "medium"` |
| 호출 방식 | 공식 SDK `@anthropic-ai/sdk` (기존 raw fetch 제거) |
| 실행 구조 | 로그인 보호 HTTP API 유지 + 백그라운드 작업 + 패널 폴링 |
| 대화 저장 | 서버(DynamoDB), 7일 뒤 자동 삭제 |
| 데이터 변경 | 항상 사용자 확인 후 실행, 삭제 도구 없음 |

HTTP API는 응답 제한이 30초라, 긴 초안 한 번의 모델 호출만으로도 넘길 수 있다. 그래서
요청은 접수만 하고 실제 작업은 같은 Lambda를 비동기로 다시 호출해 처리한다.

## 동작 흐름

```
패널 ──POST /assistant {text}──▶ 접수 Lambda ── 대화 저장(status=running) ──▶ 202 {conversationId}
                                      └─ 자기 자신을 비동기 호출 {worker, conversationId}
작업 Lambda: 모델 호출 → 조회 도구 실행 → 결과 첨부 → 반복(최대 8단계)
             ├─ 최종 답      → status=idle
             └─ 변경 도구 요청 → status=needs_confirmation (실행하지 않음)
패널 ──GET /assistant/{id} (1.5초 간격)──▶ {status, view, events, pending}
패널 ──POST /assistant {conversationId, decisions}──▶ 승인된 변경만 실행 후 이어서 진행
```

## API

두 경로 모두 Cognito JWT 필요.

### `POST /assistant`

요청 본문은 둘 중 하나.

- 새 질문: `{ "conversationId": "<선택>", "text": "<질문>" }` — `conversationId`가 없으면 새 대화
- 확인 응답: `{ "conversationId": "<필수>", "decisions": [{ "toolUseId": "...", "approved": true }] }`

응답: `202 { "conversationId": "..." }`

확인 대기(`needs_confirmation`) 중에 `decisions` 대신 새 질문이 오면, 대기 중인 변경을 모두
취소한 것으로 처리하고 그 질문을 이어서 받는다. `decisions`에 빠진 `toolUseId`도 취소로 본다.

오류: `400` 본문 형식 오류·빈 질문·8,000자 초과, `404` 대화 없음, `409` 이미 처리 중이거나
확인 대기 상태가 아닌데 `decisions`를 보냄, `413` 대화가 300KB를 넘음(새 대화 안내).

### `GET /assistant/{id}`

```json
{
  "status": "running | needs_confirmation | idle | error",
  "view": [
    { "role": "user", "text": "..." },
    { "role": "assistant", "text": "..." },
    { "role": "action", "name": "create_lecture", "summary": "...", "outcome": "done | declined | failed" }
  ],
  "events": ["강의 조회 중", "집계 중"],
  "pending": [{ "toolUseId": "...", "name": "update_lecture", "title": "...", "rows": [{ "label": "입금 여부", "before": "대기", "after": "완료" }] }],
  "error": "<status=error일 때만>"
}
```

- `view`는 화면용 요약이다. 사고 블록과 도구 원본 결과는 서버 밖으로 내보내지 않는다.
- `status=running`인데 마지막 갱신이 150초보다 오래됐으면 `error`(시간 초과)로 응답한다.
  이 상태에서 같은 대화로 다시 질문하면 이어서 처리한다.

## 대화 저장

테이블 `AILab-Assistant-${Stage}` — 키 `id`(UUID), `PAY_PER_REQUEST`, TTL 속성 `ttl`.

| 속성 | 내용 |
|---|---|
| `status` | `running` / `needs_confirmation` / `idle` / `error` |
| `messagesJson` | Anthropic `messages` 배열을 JSON 문자열로 저장(사고 블록 포함, 추가만 하고 수정하지 않음) |
| `events` | 현재 질문의 진행 단계 문자열 목록 |
| `pendingJson` | 확인 대기 중인 변경 도구 호출과, 같은 턴에서 이미 실행한 조회 도구 결과 |
| `error` | 오류 메시지 |
| `updatedAt`, `ttl` | 갱신 시각, 갱신 시각 + 7일(초) |

`messagesJson`은 추가 전용이다. Opus 5.5는 사고 블록을 그 대화에 묶어 검증하므로 과거
메시지를 자르거나 고치지 않는다(기존 `slice(-20)` 제거). 길이 제한은 300KB 상한으로 대신한다.

## 도구

모든 도구는 `strict: true`, `additionalProperties: false`, 전 필드 `required`이고 선택 값은
`null` 허용 타입으로 표현한다. 날짜는 `YYYY-MM-DD`(한국시간).

### 조회 — 서버가 즉시 실행

**`search_lectures`** — `date_from`, `date_to`, `client`(부분 일치), `text`(강의명·대상·장소·메모
부분 일치), `payment_status`(`pending|paid|partial`), `sort`(`date_desc|date_asc|fee_desc`),
`limit`(기본 30, 최대 100).
결과: `{ total_count, returned, sum_fee, sum_net, sum_hours, items[] }`. 합계는 `limit`과
무관하게 조건에 맞는 전체 기준.

**`aggregate_lectures`** — 위와 같은 필터 + `group_by`(`none|year|month|client|contractor|payment_status`).
결과: `{ groups: [{ key, count, sum_fee, sum_net, sum_hours }], total: {...} }`.

**`search_clients`** — `text`(회사명·담당자), `status`(`lead|proposal|negotiation|contract|lost`),
`followup_due_by`(이 날짜까지 팔로업 기한이 온 곳).
결과: 고객 목록 + 회사명이 일치하는 강의 건수.

실지급액은 저장된 `netPayment`가 있으면 그 값, 없으면 화면과 같은 식으로 계산한다
(`3.3` → ×0.967, `8.8` → ×0.912, `vat` → ×1.1, 그 외 → 원금, 반올림).

### 변경 — 확인 후 실행

**`create_lecture`** — `date`, `name`, `client` 필수. `duration`, `audience`, `contractor`,
`location`, `fee`, `taxDeduction`(`none|3.3|8.8|vat`), `netPayment`, `paymentStatus`, `notes`.
`netPayment`가 `null`이면 위 식으로 계산해 저장한다.

**`update_lecture`** — `id` 필수 + 위 필드 전부(`null` = 바꾸지 않음).

**`create_client`** — `companyName` 필수. `status`, `contactName`, `contactTitle`, `contactPhone`,
`contactEmail`, `memo`, `followUpDate`, `interests[]`.

**`update_client`** — `id` 필수 + 위 필드 전부(`null` = 바꾸지 않음).

실행 규칙:

- 실행 직전에 서버가 입력을 다시 검증한다(날짜 형식, 열거값, 금액 0 이상, 필수 값).
- 수정은 `attribute_exists(id)` 조건으로 저장해, 없는 id로 새 항목이 생기지 않게 한다.
- 저장 형식(`id`, `createdAt`, `updatedAt`)은 기존 `index.mjs`의 CRUD와 같게 한다.
- 필드를 빈 값으로 지우는 일과 삭제는 지원하지 않는다. 화면에서 직접 한다.

확인 카드(`pending`)는 서버가 만든다. 등록은 입력 값 표, 수정은 현재 값을 읽어 바뀌는
필드만 `이전 → 이후`로 보여준다.

## 작업 루프

1. 대화를 읽고 `messages`로 모델을 호출한다.
2. 응답 `content`를 그대로 `messages`에 추가한다.
3. `stop_reason`에 따라:
   - `end_turn` → `status=idle`.
   - `tool_use` → 조회 도구는 즉시 실행한다. 변경 도구가 하나도 없으면 결과를 한 개의
     `user` 메시지로 추가하고 1로 돌아간다. 변경 도구가 있으면 조회 결과를 `pendingJson`에
     보관하고 `status=needs_confirmation`으로 멈춘다.
   - `refusal` → `status=error`, 안내 문구.
   - `max_tokens` → 지금까지의 글을 답으로 두고 `status=idle`, 끝이 잘렸다는 안내를 덧붙인다.
4. 확인 응답이 오면 승인된 변경만 실행하고, 거절된 것은 "사용자가 취소함" 결과로 채워,
   보관해 둔 조회 결과와 함께 한 개의 `user` 메시지로 추가한 뒤 1로 돌아간다.
5. 질문 하나당 모델 호출은 최대 8회. 넘으면 안내 문구와 함께 `status=idle`.

도구 실행 오류는 `is_error: true` 결과로 모델에 돌려준다. 각 단계 뒤에 `events`와
`updatedAt`을 갱신해 패널이 진행 상황을 볼 수 있게 한다.

## 모델 호출

```js
client.beta.messages.create({
  model: process.env.MODEL_ID,           // claude-opus-5-5
  max_tokens: 8000,
  output_config: { effort: 'medium' },
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',                  // 안전 정책 거절 시 자동 대체
  cache_control: { type: 'ephemeral' },  // 단계 사이 대화 앞부분 캐시
  system: SYSTEM_PROMPT,
  tools: TOOLS,
  messages,
})
```

- `thinking` 파라미터는 보내지 않는다(Opus 5.5는 항상 적응형 사고, `disabled`는 400).
- `tool_choice`는 기본값(`auto`)만 쓴다(강제 지정은 400).
- 시스템 프롬프트: 역할, 오늘 날짜(한국시간), 데이터 필드 설명(`paymentStatus`의
  `pending/paid/partial` 포함), 규칙(숫자는 반드시 집계 도구로 구할 것, 데이터에 없으면 없다고
  할 것, 변경은 도구로 제안할 것, 초안은 소장의 강의 분야를 반영할 것). 강의·고객 데이터는
  넣지 않는다.
- 단계마다 `usage`를 로그에 남긴다.
- API 키는 지금처럼 SSM `/ailab/anthropic-api-key`에서 읽어 `new Anthropic({ apiKey })`로 넘긴다.

## 패널 (`js/assistant-panel.js`)

- 질문 전송 → `conversationId`를 `sessionStorage`에 저장 → `status`가 `running`인 동안
  1.5초 간격으로 조회. 페이지를 옮기거나 새로고침해도 저장된 id로 대화를 다시 그린다.
- 진행 단계(`events`)를 답변 자리에 표시한다.
- `pending`이 오면 확인 카드와 [실행]/[취소] 버튼을 그린다. 여러 건이면 각각 선택한다.
- 서식: 제목, 번호 목록, 표, 굵게, 코드. 원문은 이스케이프한 뒤 변환한다.
- 답변마다 복사 버튼, 머리글에 "새 대화"와 "넓게 보기" 버튼.
- 변경이 실행되면 `window`에 `ailab:data-changed` 이벤트(`detail.table`)를 보낸다.
  `lectures.html`은 강의 목록을, `crm/index.html`은 고객 목록을 다시 불러온다.
- 오류는 메시지와 "다시 시도" 버튼으로 보여준다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `aws/lambda/assistant.mjs` | 핸들러: 접수(POST), 조회(GET), 작업(비동기 호출) 분기 |
| `aws/lambda/assistant-loop.mjs` | 작업 루프. 모델 클라이언트와 저장소를 인자로 받아 테스트에서 대체 가능 |
| `aws/lambda/assistant-tools.mjs` | 도구 스키마, 필터·집계·검증·확인 카드 생성. AWS 의존 없음 |
| `aws/lambda/assistant-store.mjs` | DynamoDB 접근: 강의·고객 읽기/쓰기, 대화 읽기/쓰기 |
| `aws/lambda/package.json` | `@anthropic-ai/sdk` 의존성 |
| `aws/lambda/test/*.test.mjs` | `node --test` 단위 테스트 |
| `aws/template.yaml` | 테이블, `GET /assistant/{id}` 경로, 환경 변수, 권한, 타임아웃 |
| `aws/DEPLOY.md` | 패키징 전 `npm install --omit=dev` 단계 추가 |

`template.yaml` 변경: 대화 테이블 추가, 비서 함수 타임아웃 120초, `MODEL_ID: claude-opus-5-5`,
`ASSISTANT_TABLE` 환경 변수, 강의·고객 테이블 쓰기 권한(기존 읽기 → CRUD), 대화 테이블 CRUD,
자기 자신에 대한 `lambda:InvokeFunction`(순환 참조를 피하려고 함수 이름으로 ARN을 조립).
`node_modules`는 커밋하지 않는다(`aws/.gitignore`).

## 테스트

- `assistant-tools`: 필터(기간·부분 일치·상태), 집계(묶음별 합계, 빈 결과), 실지급액 계산,
  입력 검증(잘못된 날짜·열거값·음수), 확인 카드의 `이전 → 이후`.
- `assistant-loop`: 가짜 모델 클라이언트와 메모리 저장소로 — 조회만 하는 흐름, 변경 확인 후
  승인/거절, 조회와 변경이 한 턴에 섞인 경우, 8단계 상한, 도구 오류 전달, 거절 응답.
- 패널: 로컬에서 API를 가로채 진행 표시·확인 카드·서식·새로고침 이벤트를 화면으로 확인.
- 실제 모델 호출 확인은 배포 후 실제 로그인이 필요하다. 방법은 그 단계에서 정한다.

## 한계

- 답이 한 번에 나타난다(스트리밍 없음).
- 대화가 300KB를 넘으면 새 대화를 시작해야 한다.
- 계정의 Lambda 동시 실행 한도(현재 10)는 작업 Lambda도 함께 쓴다. 긴 작업 중에는 한 자리를
  최대 120초 차지한다.
