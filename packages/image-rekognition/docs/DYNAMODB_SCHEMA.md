# DynamoDB 스키마 설계

## 📊 개요

본 문서는 Image Rekognition 시스템의 DynamoDB 단일 테이블 설계를 정의합니다.

### 테이블 정보

- **테이블명**: `PhotoService-{stage}`
- **파티션 키**: `PK` (String)
- **정렬 키**: `SK` (String)
- **GSI**: `GSI1` (GSI1PK, GSI1SK)
- **빌링 모드**: On-Demand (PAY_PER_REQUEST)

## 🗂️ 엔티티 타입

이 테이블은 두 가지 엔티티 타입을 저장합니다:

1. **PHOTO**: 원본 사진 메타데이터
2. **BIB_INDEX**: BIB 번호별 색인 (검색용)

## 📋 PHOTO 엔티티

### 목적

업로드된 사진의 원본 메타데이터와 분석 결과를 저장합니다.

### 키 구조

```
PK: ORG#{orgId}#EVT#{eventId}
SK: PHOTO#{ulid}
```

### 예시

```json
{
  "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
  "SK": "PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "EntityType": "PHOTO",

  // 기본 정보
  "ulid": "01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "orgId": "snaprace-kr",
  "eventId": "seoul-marathon-2024",
  "originalFilename": "DSC_1234.jpg",

  // S3 경로
  "rawKey": "raw/snaprace-kr/seoul-marathon-2024/DSC_1234.jpg",
  "processedKey": "processed/snaprace-kr/seoul-marathon-2024/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg",
  "s3Uri": "s3://snaprace-images-prod/processed/snaprace-kr/seoul-marathon-2024/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg",

  // 이미지 메타데이터
  "dimensions": {
    "width": 3840,
    "height": 2160
  },
  "format": "jpeg",
  "size": 2048576,

  // 분석 결과
  "bibs": ["1234", "5678"],
  "bibCount": 2,
  "faceIds": ["abcd1234-5678-90ab-cdef-1234567890ab", "efgh5678-90ab-cdef-1234-567890abcdef"],
  "faceCount": 2,

  // 타임스탬프
  "createdAt": "2024-11-09T10:30:00.000Z",
  "updatedAt": "2024-11-09T10:30:05.123Z"
}
```

### 속성 정의

| 속성             | 타입     | 필수 | 설명                        |
| ---------------- | -------- | ---- | --------------------------- |
| PK               | String   | ✅   | `ORG#{orgId}#EVT#{eventId}` |
| SK               | String   | ✅   | `PHOTO#{ulid}`              |
| EntityType       | String   | ✅   | `PHOTO` (고정값)            |
| ulid             | String   | ✅   | ULID (시간순 정렬 가능)     |
| orgId            | String   | ✅   | 조직 ID                     |
| eventId          | String   | ✅   | 이벤트 ID                   |
| originalFilename | String   | ✅   | 원본 파일명                 |
| rawKey           | String   | ✅   | S3 raw/ 경로                |
| processedKey     | String   | ✅   | S3 processed/ 경로          |
| s3Uri            | String   | ✅   | S3 URI (s3://...)           |
| dimensions       | Object   | ✅   | `{ width, height }`         |
| format           | String   | ✅   | 이미지 포맷 (jpeg)          |
| size             | Number   | ✅   | 파일 크기 (bytes)           |
| bibs             | String[] | ✅   | 검출된 BIB 번호 배열        |
| bibCount         | Number   | ✅   | BIB 개수                    |
| faceIds          | String[] | ✅   | Rekognition Face ID 배열    |
| faceCount        | Number   | ✅   | 얼굴 개수                   |
| createdAt        | String   | ✅   | ISO 8601 타임스탬프         |
| updatedAt        | String   | ✅   | ISO 8601 타임스탬프         |

## 📋 BIB_INDEX 엔티티

### 목적

BIB 번호별로 사진을 검색할 수 있도록 색인을 제공합니다.

### 키 구조

**Base Table**:

```
PK: ORG#{orgId}#EVT#{eventId}
SK: BIB#{bib}#PHOTO#{ulid}
```

**GSI1** (BIB 검색용):

```
GSI1PK: EVT#{eventId}#BIB#{bib}
GSI1SK: PHOTO#{ulid}
```

### 예시

```json
{
  "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
  "SK": "BIB#1234#PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "EntityType": "BIB_INDEX",

  // GSI1
  "GSI1PK": "EVT#seoul-marathon-2024#BIB#1234",
  "GSI1SK": "PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",

  // 기본 정보
  "ulid": "01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "orgId": "snaprace-kr",
  "eventId": "seoul-marathon-2024",
  "bib": "1234",

  // 사진 참조
  "photoS3Uri": "s3://snaprace-images-prod/processed/snaprace-kr/seoul-marathon-2024/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg",
  "processedKey": "processed/snaprace-kr/seoul-marathon-2024/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg",

  // 메타데이터
  "faceCount": 2,

  // 타임스탬프
  "createdAt": "2024-11-09T10:30:05.123Z"
}
```

### 속성 정의

| 속성         | 타입   | 필수 | 설명                        |
| ------------ | ------ | ---- | --------------------------- |
| PK           | String | ✅   | `ORG#{orgId}#EVT#{eventId}` |
| SK           | String | ✅   | `BIB#{bib}#PHOTO#{ulid}`    |
| GSI1PK       | String | ✅   | `EVT#{eventId}#BIB#{bib}`   |
| GSI1SK       | String | ✅   | `PHOTO#{ulid}`              |
| EntityType   | String | ✅   | `BIB_INDEX` (고정값)        |
| ulid         | String | ✅   | 사진 ULID                   |
| orgId        | String | ✅   | 조직 ID                     |
| eventId      | String | ✅   | 이벤트 ID                   |
| bib          | String | ✅   | BIB 번호                    |
| photoS3Uri   | String | ✅   | 사진 S3 URI                 |
| processedKey | String | ✅   | S3 processed/ 경로          |
| faceCount    | Number | ✅   | 해당 사진의 얼굴 개수       |
| createdAt    | String | ✅   | ISO 8601 타임스탬프         |

### 저장 예시 (한 사진에 여러 BIB)

사진 한 장에 BIB #1234, #5678 두 명이 있는 경우:

```json
// PHOTO 아이템 1개
{
  "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
  "SK": "PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "bibs": ["1234", "5678"],
  ...
}

// BIB_INDEX 아이템 2개
{
  "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
  "SK": "BIB#1234#PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "GSI1PK": "EVT#seoul-marathon-2024#BIB#1234",
  ...
}

{
  "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
  "SK": "BIB#5678#PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "GSI1PK": "EVT#seoul-marathon-2024#BIB#5678",
  ...
}
```

## 🔍 쿼리 패턴

### 1. 이벤트의 모든 사진 조회

**Use Case**: 관리자가 특정 이벤트의 모든 사진을 확인

```typescript
const params = {
  TableName: 'PhotoService-prod',
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': 'ORG#snaprace-kr#EVT#seoul-marathon-2024',
    ':sk': 'PHOTO#'
  }
}

const result = await docClient.query(params)
// 최신순으로 정렬하려면: ScanIndexForward: false
```

### 2. 특정 사진 조회 (ULID로)

**Use Case**: 사진 상세 정보 조회

```typescript
const params = {
  TableName: 'PhotoService-prod',
  Key: {
    PK: 'ORG#snaprace-kr#EVT#seoul-marathon-2024',
    SK: 'PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP'
  }
}

const result = await docClient.get(params)
```

### 3. BIB 번호로 사진 검색

**Use Case**: 참가자가 자신의 BIB 번호로 사진 검색

```typescript
// GSI1 사용
const params = {
  TableName: 'PhotoService-prod',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :gsi1pk',
  ExpressionAttributeValues: {
    ':gsi1pk': 'EVT#seoul-marathon-2024#BIB#1234'
  },
  ScanIndexForward: false // 최신순
}

const result = await docClient.query(params)

// 결과: BIB #1234가 포함된 모든 사진의 BIB_INDEX 아이템
// photoS3Uri를 사용하여 사진 표시
```

### 4. 특정 사진의 모든 BIB 색인 조회

**Use Case**: 한 사진에 포함된 모든 BIB 정보

```typescript
const params = {
  TableName: 'PhotoService-prod',
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': 'ORG#snaprace-kr#EVT#seoul-marathon-2024',
    ':sk': 'BIB#'
  },
  FilterExpression: 'ulid = :ulid',
  ExpressionAttributeValues: {
    ':ulid': '01HXY8FWZM5KJQD9K3Y6R8NZTP'
  }
}

const result = await docClient.query(params)
```

### 5. 시간 범위로 사진 조회 (ULID 활용)

**Use Case**: 특정 시간대에 촬영된 사진 조회

```typescript
import { ulid } from 'ulid'

// 2024-11-09 10:00:00 ~ 11:00:00 범위
const startTime = new Date('2024-11-09T10:00:00Z').getTime()
const endTime = new Date('2024-11-09T11:00:00Z').getTime()

const startUlid = ulid(startTime)
const endUlid = ulid(endTime)

const params = {
  TableName: 'PhotoService-prod',
  KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':pk': 'ORG#snaprace-kr#EVT#seoul-marathon-2024',
    ':start': `PHOTO#${startUlid}`,
    ':end': `PHOTO#${endUlid}`
  }
}

const result = await docClient.query(params)
```

## 🔧 CDK 테이블 정의

```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as cdk from 'aws-cdk-lib'

const table = new dynamodb.Table(this, 'PhotoServiceTable', {
  tableName: `PhotoService-${stage}`,

  // 키 정의
  partitionKey: {
    name: 'PK',
    type: dynamodb.AttributeType.STRING
  },
  sortKey: {
    name: 'SK',
    type: dynamodb.AttributeType.STRING
  },

  // 빌링
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

  // 스트림 (선택사항, 나중에 분석/알림 용도)
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,

  // 백업
  pointInTimeRecovery: true,

  // 암호화
  encryption: dynamodb.TableEncryption.AWS_MANAGED,

  // 삭제 방지 (프로덕션)
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
})

// GSI1: BIB 검색용
table.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: {
    name: 'GSI1PK',
    type: dynamodb.AttributeType.STRING
  },
  sortKey: {
    name: 'GSI1SK',
    type: dynamodb.AttributeType.STRING
  },
  projectionType: dynamodb.ProjectionType.ALL
})
```

## 📈 용량 계산

### 항목 크기 예상

#### PHOTO 아이템

```
- PK: 50 bytes
- SK: 40 bytes
- EntityType: 10 bytes
- ulid: 30 bytes
- orgId: 20 bytes
- eventId: 30 bytes
- originalFilename: 50 bytes
- rawKey: 100 bytes
- processedKey: 100 bytes
- s3Uri: 120 bytes
- dimensions: 30 bytes
- format: 10 bytes
- size: 10 bytes
- bibs: 50 bytes (평균 2개)
- bibCount: 5 bytes
- faceIds: 150 bytes (평균 2개)
- faceCount: 5 bytes
- createdAt: 30 bytes
- updatedAt: 30 bytes
-----------------------
합계: ~870 bytes ≈ 1 KB
```

#### BIB_INDEX 아이템

```
- PK: 50 bytes
- SK: 60 bytes
- GSI1PK: 60 bytes
- GSI1SK: 40 bytes
- EntityType: 15 bytes
- ulid: 30 bytes
- orgId: 20 bytes
- eventId: 30 bytes
- bib: 10 bytes
- photoS3Uri: 120 bytes
- processedKey: 100 bytes
- faceCount: 5 bytes
- createdAt: 30 bytes
-----------------------
합계: ~570 bytes ≈ 1 KB
```

### 저장 용량 (월 10,000장 기준)

```
PHOTO: 10,000 items × 1 KB = 10 MB
BIB_INDEX: 10,000 items × 2 bibs × 1 KB = 20 MB
총 저장: 30 MB

저장 비용: 30 MB × $0.25/GB = $0.0075/월 (무시 가능)
```

### 쓰기 용량 (월 10,000장 기준)

```
사진당 아이템:
- PHOTO: 1개
- BIB_INDEX: 평균 2개
총: 3 PutItem

월 10,000장: 30,000 쓰기
비용: 30,000 × $1.25/1M = $0.0375/월
```

### 읽기 용량 (예상)

```
BIB 검색 (일 1,000회):
- Query 1회 = 1 RCU (평균)
- 월 30,000 읽기
비용: 30,000 × $0.25/1M = $0.0075/월
```

## 🔐 보안

### IAM 정책 예시

#### Lambda Write 권한 (Fanout Lambda용)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem"],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-2:123456789012:table/PhotoService-prod",
        "arn:aws:dynamodb:ap-northeast-2:123456789012:table/PhotoService-prod/index/GSI1"
      ]
    }
  ]
}
```

#### API Read 권한 (조회 API용)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:Query"],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-2:123456789012:table/PhotoService-prod",
        "arn:aws:dynamodb:ap-northeast-2:123456789012:table/PhotoService-prod/index/GSI1"
      ]
    }
  ]
}
```

## 🧹 데이터 관리

### TTL 설정 (선택사항)

이벤트 종료 후 일정 기간 후 자동 삭제:

```typescript
table.addTimeToLiveAttribute({
  attributeName: 'ttl'
})

// Lambda에서 TTL 값 설정 (이벤트 종료 90일 후)
const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
photoItem.ttl = ttl
```

### 백업 전략

1. **Point-in-Time Recovery**: 35일간 자동 백업
2. **On-Demand Backup**: 중요 이벤트 전 수동 백업
3. **DynamoDB Streams**: 데이터 변경 이벤트를 S3로 아카이빙

## 📊 모니터링

### CloudWatch Metrics

```typescript
// 쓰기 용량 알람
const writeThrottleAlarm = new cloudwatch.Alarm(this, 'WriteThrottleAlarm', {
  metric: table.metricUserErrors({
    statistic: 'Sum'
  }),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'DynamoDB 쓰기 제한 발생'
})

// 항목 수 모니터링
const itemCountMetric = new cloudwatch.Metric({
  namespace: 'AWS/DynamoDB',
  metricName: 'ItemCount',
  dimensionsMap: {
    TableName: table.tableName
  },
  statistic: 'Average'
})
```

## 🔄 마이그레이션

### 스키마 변경 시 고려사항

1. **새로운 속성 추가**: 호환 가능, 문제 없음
2. **키 구조 변경**: 새 테이블 생성 + 데이터 마이그레이션 필요
3. **GSI 추가**: 기존 데이터에 자동으로 인덱싱됨 (시간 소요)

### 데이터 마이그레이션 스크립트 예시

```typescript
// 스캔 후 업데이트
const scanParams = {
  TableName: 'PhotoService-prod',
  FilterExpression: 'EntityType = :type',
  ExpressionAttributeValues: {
    ':type': 'PHOTO'
  }
}

let items
do {
  items = await docClient.scan(scanParams)

  for (const item of items.Items || []) {
    // 새로운 속성 추가 또는 변경
    await docClient.update({
      TableName: 'PhotoService-prod',
      Key: { PK: item.PK, SK: item.SK },
      UpdateExpression: 'SET newAttribute = :val',
      ExpressionAttributeValues: {
        ':val': 'newValue'
      }
    })
  }

  scanParams.ExclusiveStartKey = items.LastEvaluatedKey
} while (items.LastEvaluatedKey)
```

## 🎯 최적화 팁

1. **Batch 작업**: BatchWriteItem 사용 시 최대 25개까지 한 번에 쓰기 가능
2. **Projection**: 필요한 속성만 조회하여 비용 절감
3. **Consistent Read**: 특별한 경우가 아니면 Eventually Consistent Read 사용
4. **파티션 핫스팟 방지**: PK에 orgId + eventId를 함께 사용하여 분산

## 📚 참고 자료

- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Single Table Design](https://www.alexdebrie.com/posts/dynamodb-single-table/)
- [ULID Specification](https://github.com/ulid/spec)
