# Event Leaderboard S3 데이터 구조 가이드

## 📋 필요한 환경변수

`.env` 파일에 다음 환경변수들이 **이미 설정**되어 있습니다:

```env
# AWS 설정
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# S3 버킷
BUCKET=snap-race

# DynamoDB 테이블
DYNAMO_TIMING_RESULTS_TABLE=TimingResults
DYNAMO_EVENTS_TABLE=Events
DYNAMO_GALLERIES_TABLE=Galleries
DYNAMO_PHOTOS_TABLE=Photos
DYNAMO_FEEDBACKS_TABLE=Feedbacks
DYNAMO_ORGANIZATIONS_TABLE=Organizations
```

## ✅ 추가로 설정할 환경변수 없음

모든 필요한 환경변수가 이미 `.env`에 설정되어 있습니다!

## 📁 S3 버킷 데이터 구조

Event Leaderboard가 작동하려면 S3 버킷(`snap-race`)에 다음과 같은 구조로 데이터가 있어야 합니다:

### 필수 파일 구조

```
s3://snap-race/
  {organizationId}/
    {eventId}/
      results/
        index.json            ← 이벤트 메타데이터 (필수)
        5k.json               ← 5K 결과 데이터
        10k.json              ← 10K 결과 데이터
        half-marathon.json    ← 하프 마라톤 결과
        ...
```

### 예시: everybody-5k-10k-2025 이벤트

```
s3://snap-race/
  winningeventsgroup/
    everybody-5k-10k-2025/
      results/
        index.json
        5k.json
        10k.json
```

## 📄 파일 형식

### 1. index.json (이벤트 메타데이터)

**경로**: `s3://snap-race/{organizationId}/{eventId}/results/index.json`

**형식**:
```json
{
  "event_id": "everybody-5k-10k-2025",
  "event_name": "Everybody 5k + 10k",
  "organization_id": "winningeventsgroup",
  "result_sets": [
    {
      "id": "everybody-5k-2025-5k",
      "category": "5K",
      "s3_key": "winningeventsgroup/everybody-5k-10k-2025/results/5k.json"
    },
    {
      "id": "everybody-5k-2025-10k",
      "category": "10K",
      "s3_key": "winningeventsgroup/everybody-5k-10k-2025/results/10k.json"
    }
  ],
  "updated_at": "2025-10-19T12:40:00Z"
}
```

**중요 필드**:
- `event_id`: 이벤트 고유 ID
- `event_name`: 이벤트 이름
- `organization_id`: 주최 조직 ID
- `result_sets`: 결과 데이터셋 배열
  - `id`: 결과셋 고유 ID
  - `category`: 카테고리 이름 (5K, 10K 등)
  - `s3_key`: S3에서 실제 결과 파일 경로

### 2. 결과 데이터 파일 (5k.json, 10k.json 등)

**경로**: `s3://snap-race/{organizationId}/{eventId}/results/{category}.json`

**형식**:
```json
{
  "headings": [
    { "key": "race_placement", "name": "Place" },
    { "key": "bib_num", "name": "Bib" },
    { "key": "name", "name": "Name" },
    { "key": "gender", "name": "Gender" },
    { "key": "age", "name": "Age" },
    { "key": "city", "name": "City" },
    { "key": "state", "name": "State" },
    { "key": "chip_time", "name": "Chip Time" },
    { "key": "clock_time", "name": "Clock Time" },
    { "key": "avg_pace", "name": "Pace" },
    { "key": "division_place", "name": "Division Place" },
    { "key": "division", "name": "Division" },
    { "key": "age_performance_percentage", "name": "Age Percentage" }
  ],
  "resultSet": {
    "results": [
      [1, "1703", "ABDULLAH ABBASI", "M", 25, "WEST NEW YORK", "NJ", "19:07", "19:08", "6:09", "1", "Male Overall", 92.5],
      [2, "1787", "LAWRENCE TOPOR", "M", 53, "HAWORTH", "NJ", "19:24", "19:25", "6:15", "1", "M 50-54", 95.2],
      ...
    ]
  }
}
```

**중요 사항**:
- `headings`: 컬럼 정의 배열 (순서 중요!)
- `results`: 2차원 배열 (각 row는 headings 순서와 일치)

## 🔍 현재 상태 확인

### S3에 데이터가 있는지 확인

```bash
# AWS CLI로 확인
aws s3 ls s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/

# 예상 출력:
# index.json
# results/

aws s3 ls s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/results/

# 예상 출력:
# 5k.json
# 10k.json
```

### index.json 내용 확인

```bash
aws s3 cp s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/index.json - | jq '.'
```

## 🚨 데이터가 없는 경우

### 옵션 1: Mock 데이터를 S3에 업로드

`src/mock/` 폴더의 데이터를 S3에 업로드:

```bash
# 1. index.json 업로드
aws s3 cp src/mock/index.json \
  s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/index.json

# 2. results 폴더 생성 및 데이터 업로드
aws s3 cp src/mock/5k.json \
  s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/results/5k.json

aws s3 cp src/mock/10k.json \
  s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/results/10k.json
```

### 옵션 2: 실제 이벤트 데이터 업로드

실제 타이밍 결과 데이터를 준비하여 업로드합니다.

## 📊 DynamoDB 구조 (참고)

Event Leaderboard는 주로 S3 데이터를 사용하지만, 개별 Bib 검색은 DynamoDB를 사용합니다.

### TimingResults 테이블

**구조**:
```
Partition Key: event_id (String)
Sort Key: sort_key (String) - "BIB#{bibNumber}" 형식

Attributes:
- event_id: "everybody-5k-10k-2025"
- sort_key: "BIB#1703"
- bib: "1703"
- name: "ABDULLAH ABBASI"
- row_index: 0  (결과 파일의 행 번호)
- result_set_id: "everybody-5k-2025-5k"
- s3_key: "winningeventsgroup/everybody-5k-10k-2025/results/5k.json"
```

**용도**:
- RunnerSpotlight: 특정 Bib의 결과 조회
- EventLeaderboard는 DynamoDB 사용 안 함 (S3에서 전체 데이터 로드)

## 🔐 권한 설정

AWS 사용자에게 다음 권한이 필요합니다:

### S3 권한
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::snap-race",
    "arn:aws:s3:::snap-race/*"
  ]
}
```

### DynamoDB 권한
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Query",
    "dynamodb:GetItem",
    "dynamodb:Scan"
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:*:table/TimingResults",
    "arn:aws:dynamodb:us-east-1:*:table/Events",
    "arn:aws:dynamodb:us-east-1:*:table/Galleries",
    "arn:aws:dynamodb:us-east-1:*:table/Photos",
    "arn:aws:dynamodb:us-east-1:*:table/Organizations"
  ]
}
```

## ✅ 체크리스트

EventLeaderboard가 작동하려면:

### 환경변수
- [x] `AWS_REGION` 설정됨
- [x] `AWS_ACCESS_KEY_ID` 설정됨
- [x] `AWS_SECRET_ACCESS_KEY` 설정됨
- [x] `BUCKET` 설정됨
- [x] `DYNAMO_TIMING_RESULTS_TABLE` 설정됨

### S3 데이터
- [ ] `s3://snap-race/{org}/{event}/results/index.json` 존재
- [ ] `index.json`에 `result_sets` 배열 포함
- [ ] 각 result_set의 `s3_key`가 유효한 S3 경로
- [ ] 결과 파일 (`5k.json` 등)이 S3의 results/ 폴더에 존재
- [ ] 결과 파일에 `headings`와 `resultSet.results` 포함

### AWS 권한
- [ ] S3 GetObject 권한
- [ ] S3 ListBucket 권한
- [ ] DynamoDB Query 권한 (개별 Bib용)

## 🧪 테스트

### 1. S3 연결 테스트

브라우저 콘솔에서 확인:
```
[TRPC] results.getAllResults took XXXms to execute
✓ 성공 (에러 없음)
```

### 2. 데이터 로드 확인

Network 탭에서 응답 확인:
```json
{
  "resultSets": [
    {
      "id": "...",
      "category": "5K",
      "results": [...],
      "totalResults": 142
    }
  ],
  "meta": {
    "eventId": "everybody-5k-10k-2025",
    "totalResults": 284
  }
}
```

## 🆘 문제 해결

### "No timing results were found for this event"

**원인**:
1. S3에 `index.json` 파일이 없음
2. S3 경로가 잘못됨
3. AWS 자격 증명 문제
4. 권한 문제

**해결**:
```bash
# 1. S3 경로 확인
aws s3 ls s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/results/

# 2. 파일 존재 확인
aws s3 cp s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/results/index.json -

# 3. Mock 데이터 업로드 (없으면)
aws s3 cp src/mock/index.json \
  s3://snap-race/winningeventsgroup/everybody-5k-10k-2025/results/index.json
```

### "Dataset is malformed"

**원인**: 결과 파일의 JSON 형식 오류

**해결**:
```bash
# JSON 형식 검증
aws s3 cp s3://snap-race/.../5k.json - | jq '.'

# headings와 results 확인
aws s3 cp s3://snap-race/.../5k.json - | jq '.headings, .resultSet.results[0]'
```

## 📞 추가 도움

S3 데이터 구조나 업로드에 문제가 있으면:
1. `src/mock/` 폴더의 파일들을 참고
2. AWS CLI로 S3 경로 확인
3. IAM 권한 확인
4. CloudWatch 로그 확인

---

**작성일**: 2025-10-23
**버전**: 1.0
**상태**: ✅ 환경변수 설정 완료
