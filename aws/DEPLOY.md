# AWS 배포 가이드 — Phase 1 (데이터 기반)

leadership.ai.kr의 강의·고객 데이터를 Firebase → AWS(DynamoDB)로 이전하고,
인증(Cognito) + CRUD API(Lambda)를 구축한다. 리전: **ap-northeast-2 (서울)**

## 구성

```
lectures.html / crm/ / 홈페이지
        │ HTTPS (Cognito JWT)
[ API Gateway (HTTP API) ]
        │
[ Lambda: AILab-Api ]
        │
[ DynamoDB: AILab-Lectures / AILab-Clients ]
```

- `GET /public/lectures` — 인증 없음, 홈페이지 강의실적용. **강의료 등 민감 필드 제거 후 응답**
- 그 외 CRUD — Cognito 로그인 토큰 필요 (관리자 1인 전용, 자가 가입 차단)

## 1. 인프라 배포

```bash
# 아티팩트 버킷 (최초 1회)
aws s3 mb s3://ailab-cfn-artifacts-534347546901 --region ap-northeast-2

# 패키징 & 배포
cd aws
aws cloudformation package \
  --template-file template.yaml \
  --s3-bucket ailab-cfn-artifacts-534347546901 \
  --output-template-file packaged.yaml

aws cloudformation deploy \
  --template-file packaged.yaml \
  --stack-name ailab-api-prod \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --region ap-northeast-2

# 출력값 확인 (ApiUrl, UserPoolId, UserPoolClientId)
aws cloudformation describe-stacks --stack-name ailab-api-prod \
  --query "Stacks[0].Outputs" --output table
```

## 2. 관리자 계정 생성 (1회)

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username hyunnet@gmail.com \
  --user-attributes Name=email,Value=hyunnet@gmail.com Name=email_verified,Value=true
```
→ 임시 비밀번호가 이메일로 발송됨. 첫 로그인 시 새 비밀번호 설정.

## 3. 데이터 이전

```bash
cd aws/migrate
npm install

# lectures (공개 읽기 가능 — 바로 실행)
node export-lectures.mjs            # → lectures.json

# clients (인증 필요 — 브라우저에서)
#   leadership.ai.kr/crm/ 로그인 → F12 콘솔에 export-clients-browser.js 내용 붙여넣기
#   → clients.json 다운로드 → 이 폴더로 이동

# DynamoDB 적재
node import-dynamo.mjs lectures.json AILab-Lectures-prod
node import-dynamo.mjs clients.json  AILab-Clients-prod
```

## 4. 검증

```bash
# 공개 API — 민감 필드(fee 등)가 없어야 함
curl https://<ApiUrl>/public/lectures | head

# 건수 확인
aws dynamodb scan --table-name AILab-Lectures-prod --select COUNT
```

## 이후 단계

- **Phase 2**: lectures.html·crm/·홈페이지 강의실적 섹션을 이 API로 전환 → Firebase 제거
- **Phase 3**: AI 비서 Lambda(Claude API) 추가 — 같은 DynamoDB를 읽고 씀
- **Phase 4**: 정적 사이트 S3+CloudFront 이전 + 저장소 private 전환

## 참고

- 테이블은 `DeletionPolicy: Retain` — 스택을 지워도 데이터는 남는다
- PITR(시점 복구) 활성화됨
- 예상 비용: 이 규모(수백 건, 개인 사용)에서 월 $1 미만
