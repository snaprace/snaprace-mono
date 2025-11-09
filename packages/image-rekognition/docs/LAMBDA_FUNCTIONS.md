ㅑ# Lambda 함수 구현 스펙

## 📋 개요

본 문서는 Image Rekognition 시스템의 각 Lambda 함수에 대한 구현 스펙을 정의합니다.

## 🔄 공통 사항

### 런타임 환경

- **Runtime**: Node.js 20.x
- **Architecture**: ARM64 (Graviton2, 비용 효율적)
- **패키지 매니저**: npm

### 공통 의존성

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/client-rekognition": "^3.x",
    "@aws-sdk/client-dynamodb": "^3.x",
    "@aws-sdk/lib-dynamodb": "^3.x",
    "@aws-sdk/client-sfn": "^3.x",
    "ulid": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "typescript": "^5.x"
  }
}
```

### 공통 에러 핸들링

모든 Lambda는 다음과 같은 에러 핸들링 패턴을 따릅니다:

```typescript
export const handler = async (event: any) => {
  try {
    // 비즈니스 로직
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    }
  } catch (error) {
    console.error('Error:', error)

    // 재시도 가능한 에러 (Step Functions가 재시도)
    if (isRetryableError(error)) {
      throw error
    }

    // 재시도 불가능한 에러 (즉시 실패)
    throw new Error(`Non-retryable error: ${error.message}`)
  }
}

function isRetryableError(error: any): boolean {
  const retryableCodes = ['ThrottlingException', 'ServiceUnavailable', 'InternalServerError', 'RequestTimeout']
  return retryableCodes.includes(error.name)
}
```

---

## 1️⃣ SFN Trigger Lambda

### 목적

SQS 큐에서 S3 이벤트를 수신하고 Step Functions 워크플로우를 시작합니다.

### 위치

`src/sfn-trigger/index.ts`

### 설정

```typescript
{
  runtime: NodeJS 20.x
  memory: 256 MB
  timeout: 30초
  environment: {
    STATE_MACHINE_ARN: string
  }
}
```

### 입력 (SQS Event)

```typescript
interface SQSEvent {
  Records: Array<{
    body: string // S3 Event JSON
    messageId: string
    receiptHandle: string
  }>
}

// S3 Event 구조
interface S3EventRecord {
  eventName: string // "ObjectCreated:Put"
  s3: {
    bucket: {
      name: string // "snaprace-images-dev"
    }
    object: {
      key: string // "raw/org-123/event-456/photo.jpg"
      size: number
    }
  }
}
```

### 출력

Step Functions 실행 ARN 배열

```typescript
interface TriggerOutput {
  executions: Array<{
    executionArn: string
    s3Key: string
  }>
}
```

### 구현 로직

```typescript
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { SQSEvent, S3Event } from 'aws-lambda'

const sfnClient = new SFNClient({})
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!

export const handler = async (event: SQSEvent) => {
  const executions = []

  for (const record of event.Records) {
    const s3Event: S3Event = JSON.parse(record.body)

    for (const s3Record of s3Event.Records) {
      const { bucket, object } = s3Record.s3

      // raw/ 프리픽스 검증
      if (!object.key.startsWith('raw/')) {
        console.log(`Skipping non-raw object: ${object.key}`)
        continue
      }

      // 파일 확장자 검증
      const validExtensions = ['.jpg', '.jpeg', '.png', '.heic']
      const hasValidExtension = validExtensions.some((ext) => object.key.toLowerCase().endsWith(ext))

      if (!hasValidExtension) {
        console.log(`Skipping invalid file type: ${object.key}`)
        continue
      }

      // Step Functions 입력 데이터 구성
      const input = {
        bucketName: bucket.name,
        rawKey: object.key,
        fileSize: object.size,
        timestamp: new Date().toISOString()
      }

      // Step Functions 실행
      try {
        const command = new StartExecutionCommand({
          stateMachineArn: STATE_MACHINE_ARN,
          input: JSON.stringify(input),
          name: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })

        const result = await sfnClient.send(command)

        executions.push({
          executionArn: result.executionArn,
          s3Key: object.key
        })

        console.log(`Started execution for ${object.key}: ${result.executionArn}`)
      } catch (error) {
        console.error(`Failed to start execution for ${object.key}:`, error)
        // SQS에서 재시도하도록 에러를 던짐
        throw error
      }
    }
  }

  return { executions }
}
```

---

## 2️⃣ Preprocess Lambda

### 목적

원본 이미지를 검증, 표준화, 리사이징, 포맷 변환하여 processed/ 프리픽스에 저장합니다.

### 위치

`src/preprocess/index.ts`

### 설정

```typescript
{
  runtime: NodeJS 20.x
  memory: 2048 MB  // Sharp.js는 메모리 사용량이 높음
  timeout: 300초 (5분)
  ephemeralStorage: 1024 MB  // /tmp 디렉토리
  environment: {
    BUCKET_NAME: string
    MAX_WIDTH: "4096"
    MAX_HEIGHT: "4096"
    JPEG_QUALITY: "90"
  }
  layers: [
    "arn:aws:lambda:...:layer:sharp-layer:1"
  ]
}
```

### 입력 (Step Functions)

```typescript
interface PreprocessInput {
  bucketName: string
  rawKey: string // "raw/org-123/event-456/photo.jpg"
  fileSize: number
  timestamp: string
}
```

### 출력

```typescript
interface PreprocessOutput {
  bucketName: string
  rawKey: string
  processedKey: string // "processed/org-123/event-456/{ulid}.jpg"
  ulid: string
  orgId: string
  eventId: string
  originalFilename: string
  dimensions: {
    width: number
    height: number
  }
  format: string // "jpeg"
  size: number // bytes
  s3Uri: string // "s3://bucket/processed/..."
}
```

### 구현 로직

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import sharp from 'sharp'
import { ulid } from 'ulid'

const s3Client = new S3Client({})
const BUCKET_NAME = process.env.BUCKET_NAME!
const MAX_WIDTH = parseInt(process.env.MAX_WIDTH || '4096')
const MAX_HEIGHT = parseInt(process.env.MAX_HEIGHT || '4096')
const JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || '90')

interface StepFunctionInput {
  bucketName: string
  rawKey: string
  fileSize: number
  timestamp: string
}

export const handler = async (event: StepFunctionInput) => {
  console.log('Processing image:', event.rawKey)

  // 1. 경로 파싱 (raw/org-123/event-456/photo.jpg)
  const pathParts = event.rawKey.split('/')
  if (pathParts.length < 4) {
    throw new Error('Invalid S3 key format')
  }

  const [, orgId, eventId, ...filenameParts] = pathParts
  const originalFilename = filenameParts.join('/')

  // 2. 원본 이미지 다운로드
  const getCommand = new GetObjectCommand({
    Bucket: event.bucketName,
    Key: event.rawKey
  })

  const { Body } = await s3Client.send(getCommand)
  const imageBuffer = await streamToBuffer(Body as Readable)

  // 3. 이미지 메타데이터 추출
  const metadata = await sharp(imageBuffer).metadata()
  console.log('Original metadata:', metadata)

  // 4. 이미지 검증
  if (!metadata.format || !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format)) {
    throw new Error(`Unsupported image format: ${metadata.format}`)
  }

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image dimensions')
  }

  // 최소 크기 검증 (Rekognition 요구사항)
  if (metadata.width < 80 || metadata.height < 80) {
    throw new Error('Image too small (minimum 80x80px)')
  }

  // 5. 이미지 처리
  let pipeline = sharp(imageBuffer)

  // EXIF Orientation 자동 회전
  pipeline = pipeline.rotate()

  // 리사이징 (긴 변이 MAX_WIDTH/HEIGHT 초과 시)
  const shouldResize = metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT
  if (shouldResize) {
    pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside', // 비율 유지하며 안쪽에 맞춤
      withoutEnlargement: true // 확대하지 않음
    })
  }

  // JPEG 변환 (sRGB 색공간, 최적화)
  pipeline = pipeline.jpeg({
    quality: JPEG_QUALITY,
    chromaSubsampling: '4:2:0',
    force: true // 강제로 JPEG 변환
  })

  // 처리된 이미지 버퍼
  const processedBuffer = await pipeline.toBuffer()
  const processedMetadata = await sharp(processedBuffer).metadata()

  // 6. ULID 생성 및 저장 경로 구성
  const imageUlid = ulid()
  const processedKey = `processed/${orgId}/${eventId}/${imageUlid}.jpg`

  // 7. S3에 업로드
  const putCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: processedKey,
    Body: processedBuffer,
    ContentType: 'image/jpeg',
    Metadata: {
      'original-filename': originalFilename,
      'original-key': event.rawKey,
      'processed-at': new Date().toISOString(),
      ulid: imageUlid
    }
  })

  await s3Client.send(putCommand)

  console.log(`Processed image saved to: ${processedKey}`)

  // 8. 결과 반환
  return {
    bucketName: BUCKET_NAME,
    rawKey: event.rawKey,
    processedKey,
    ulid: imageUlid,
    orgId,
    eventId,
    originalFilename,
    dimensions: {
      width: processedMetadata.width!,
      height: processedMetadata.height!
    },
    format: 'jpeg',
    size: processedBuffer.length,
    s3Uri: `s3://${BUCKET_NAME}/${processedKey}`
  }
}

// Stream을 Buffer로 변환하는 헬퍼 함수
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
```

### Sharp Layer 생성

```bash
# ARM64용 Sharp layer 생성
mkdir -p layer/nodejs
cd layer/nodejs
npm init -y
npm install sharp --arch=arm64 --platform=linux
cd ..
zip -r sharp-layer.zip nodejs

# Lambda Layer 생성
aws lambda publish-layer-version \
  --layer-name sharp-layer \
  --zip-file fileb://sharp-layer.zip \
  --compatible-runtimes nodejs20.x \
  --compatible-architectures arm64
```

---

## 3️⃣ Detect Text Lambda

### 목적

AWS Rekognition DetectText API를 사용하여 이미지에서 BIB 번호를 검출합니다.

### 위치

`src/detect-text/index.ts`

### 설정

```typescript
{
  runtime: NodeJS 20.x
  memory: 512 MB
  timeout: 30초
  environment: {
    BUCKET_NAME: string
    MIN_CONFIDENCE: "80"
  }
}
```

### 입력

```typescript
// Preprocess Lambda의 출력
interface DetectTextInput {
  bucketName: string
  processedKey: string
  ulid: string
  // ... 기타 필드
}
```

### 출력

```typescript
interface DetectTextOutput {
  bibs: string[] // ["123", "456"]
  textDetections: Array<{
    text: string
    confidence: number
    geometry: {
      boundingBox: {
        width: number
        height: number
        left: number
        top: number
      }
    }
  }>
}
```

### 구현 로직

```typescript
import { RekognitionClient, DetectTextCommand } from '@aws-sdk/client-rekognition'

const rekognitionClient = new RekognitionClient({})
const MIN_CONFIDENCE = parseFloat(process.env.MIN_CONFIDENCE || '80')

interface PreprocessOutput {
  bucketName: string
  processedKey: string
  ulid: string
}

export const handler = async (event: PreprocessOutput) => {
  console.log('Detecting text in:', event.processedKey)

  // 1. Rekognition DetectText 호출
  const command = new DetectTextCommand({
    Image: {
      S3Object: {
        Bucket: event.bucketName,
        Name: event.processedKey
      }
    },
    Filters: {
      WordFilter: {
        MinConfidence: MIN_CONFIDENCE
      }
    }
  })

  const response = await rekognitionClient.send(command)

  // 2. 텍스트 검출 결과 필터링
  const textDetections = response.TextDetections || []
  const words = textDetections
    .filter((detection) => detection.Type === 'WORD')
    .filter((detection) => (detection.Confidence || 0) >= MIN_CONFIDENCE)
    .map((detection) => ({
      text: detection.DetectedText || '',
      confidence: detection.Confidence || 0,
      geometry: {
        boundingBox: detection.Geometry?.BoundingBox || {
          Width: 0,
          Height: 0,
          Left: 0,
          Top: 0
        }
      }
    }))

  console.log(`Detected ${words.length} words`)

  // 3. BIB 번호 추출 (숫자만 포함된 텍스트)
  const bibs = extractBibNumbers(words)

  console.log(`Extracted BIBs: ${bibs.join(', ')}`)

  return {
    bibs,
    textDetections: words
  }
}

/**
 * BIB 번호 추출 로직
 * - 순수 숫자 (1-5자리)
 * - 신뢰도 높은 순으로 정렬
 * - 중복 제거
 */
function extractBibNumbers(words: any[]): string[] {
  const bibCandidates = words
    .filter((word) => {
      const text = word.text.trim()
      // 숫자만 포함, 1-5자리
      return /^\d{1,5}$/.test(text)
    })
    .sort((a, b) => b.confidence - a.confidence) // 신뢰도 높은 순
    .map((word) => word.text)

  // 중복 제거
  return Array.from(new Set(bibCandidates))
}
```

### BIB 번호 검출 로직 개선 (선택사항)

더 정확한 BIB 번호 검출을 위한 휴리스틱:

```typescript
function extractBibNumbers(words: any[], imageHeight: number): string[] {
  const candidates = words
    .filter((word) => {
      const text = word.text.trim()

      // 1. 숫자만 포함, 1-5자리
      if (!/^\d{1,5}$/.test(text)) return false

      // 2. 너무 작은 텍스트 제외 (BIB는 일반적으로 크게 표시됨)
      const bbox = word.geometry.boundingBox
      const textHeight = bbox.height * imageHeight
      if (textHeight < 30) return false // 픽셀 기준 최소 높이

      // 3. 신뢰도 체크
      if (word.confidence < 85) return false

      return true
    })
    .map((word) => ({
      text: word.text,
      confidence: word.confidence,
      size: word.geometry.boundingBox.height // 상대 크기
    }))
    .sort((a, b) => {
      // 크기와 신뢰도를 모두 고려
      const scoreA = a.size * 0.5 + (a.confidence / 100) * 0.5
      const scoreB = b.size * 0.5 + (b.confidence / 100) * 0.5
      return scoreB - scoreA
    })
    .map((c) => c.text)

  return Array.from(new Set(candidates))
}
```

---

## 4️⃣ Index Faces Lambda

### 목적

AWS Rekognition IndexFaces API를 사용하여 얼굴을 Collection에 인덱싱합니다.  
**Collection은 실행 시 자동으로 생성**됩니다 (멱등성 보장).

### 위치

`src/index-faces/index.ts`

### 설정

```typescript
{
  runtime: NodeJS 20.x
  memory: 512 MB
  timeout: 30초
  environment: {
    BUCKET_NAME: string
    MAX_FACES: "15"
    QUALITY_FILTER: "AUTO"
    // COLLECTION_ID는 동적 생성 (orgId-eventId)
  }
}
```

### 입력

```typescript
// Preprocess Lambda의 출력
interface IndexFacesInput {
  bucketName: string
  processedKey: string
  ulid: string
  orgId: string // Collection ID 생성에 사용
  eventId: string // Collection ID 생성에 사용
  s3Uri: string // "s3://bucket/processed/..."
}
```

### 출력

```typescript
interface IndexFacesOutput {
  collectionId: string // 사용된 Collection ID
  faceIds: string[] // Rekognition Face ID 배열
  faceRecords: Array<{
    faceId: string
    confidence: number
    boundingBox: {
      width: number
      height: number
      left: number
      top: number
    }
  }>
  unindexedFaces: number // 인덱싱되지 않은 얼굴 수
}
```

### 구현 로직

```typescript
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand
} from '@aws-sdk/client-rekognition'

const rekognitionClient = new RekognitionClient({})
const MAX_FACES = parseInt(process.env.MAX_FACES || '15')
const QUALITY_FILTER = (process.env.QUALITY_FILTER as 'NONE' | 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH') || 'AUTO'

// Lambda 컨테이너 재사용 시 캐시 (Warm Lambda 최적화)
const existingCollections = new Set<string>()

interface PreprocessOutput {
  bucketName: string
  processedKey: string
  ulid: string
  orgId: string
  eventId: string
  s3Uri: string
}

/**
 * Collection 존재 확인 및 생성 (멱등성 보장)
 */
async function ensureCollectionExists(collectionId: string): Promise<void> {
  // 캐시 확인 (Warm Lambda는 API 호출 생략)
  if (existingCollections.has(collectionId)) {
    console.log(`Collection already verified: ${collectionId}`)
    return
  }

  try {
    // Collection 존재 확인
    await rekognitionClient.send(new DescribeCollectionCommand({ CollectionId: collectionId }))
    console.log(`Collection exists: ${collectionId}`)
    existingCollections.add(collectionId)
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      // Collection 생성
      console.log(`Creating new collection: ${collectionId}`)
      await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }))
      existingCollections.add(collectionId)
      console.log(`Collection created: ${collectionId}`)
    } else {
      // 다른 에러는 재시도 가능하도록 throw
      throw error
    }
  }
}

export const handler = async (event: PreprocessOutput) => {
  console.log('Indexing faces in:', event.processedKey)

  // 1. Collection ID 생성
  const collectionId = `${event.orgId}-${event.eventId}`

  // 2. Collection 확인/생성
  await ensureCollectionExists(collectionId)

  // 3. Rekognition IndexFaces 호출
  const command = new IndexFacesCommand({
    CollectionId: collectionId, // 동적 Collection ID
    Image: {
      S3Object: {
        Bucket: event.bucketName,
        Name: event.processedKey
      }
    },
    ExternalImageId: event.s3Uri, // ⭐ S3 URI를 ExternalImageId로 사용
    MaxFaces: MAX_FACES,
    QualityFilter: QUALITY_FILTER,
    DetectionAttributes: ['DEFAULT']
  })

  const response = await rekognitionClient.send(command)

  const faceRecords = response.FaceRecords || []
  const faceIds = faceRecords.map((record) => record.Face?.FaceId || '').filter(Boolean)

  console.log(`Indexed ${faceIds.length} faces in collection ${collectionId}`)

  const unindexedFaces = response.UnindexedFaces?.length || 0
  if (unindexedFaces > 0) {
    console.warn(`${unindexedFaces} faces were not indexed`)
    response.UnindexedFaces?.forEach((face) => {
      console.warn(`Reason: ${face.Reasons?.join(', ')}`)
    })
  }

  return {
    collectionId, // 사용된 Collection ID 반환
    faceIds,
    faceRecords: faceRecords.map((record) => ({
      faceId: record.Face?.FaceId || '',
      confidence: record.Face?.Confidence || 0,
      boundingBox: {
        width: record.Face?.BoundingBox?.Width || 0,
        height: record.Face?.BoundingBox?.Height || 0,
        left: record.Face?.BoundingBox?.Left || 0,
        top: record.Face?.BoundingBox?.Top || 0
      }
    })),
    unindexedFaces
  }
}
```

### 성능 최적화

**Lambda 캐싱 전략**:

```
Cold Start (첫 실행):
- DescribeCollection API 호출 (1회)
- 없으면 CreateCollection API 호출 (1회)
- 캐시에 저장

Warm Lambda (후속 실행):
- 캐시 확인 (0 API 호출)
- 즉시 IndexFaces 실행

결과:
- 10,000장 업로드 시 API 호출: ~100-200회 (Cold Start만)
- 비용 및 성능 최적화
```

### ExternalImageId 설계

> ⭐ **중요**: `ExternalImageId`에 S3 URI를 사용하는 이유

```typescript
// ✅ 올바른 방식: S3 URI 사용
ExternalImageId: 's3://snaprace-images-dev/processed/org-123/event-456/01HXY...'

// ❌ 잘못된 방식: ULID만 사용
ExternalImageId: '01HXY...'
```

**이유:**

- `searchBySelfie` API에서 FaceId로 원본 이미지를 찾을 때 S3에서 직접 가져올 수 있음
- DynamoDB를 거치지 않고도 이미지 URL 생성 가능
- 추적성 (Traceability) 향상

---

## 5️⃣ Fanout DynamoDB Lambda

### 목적

분석 결과를 취합하여 DynamoDB에 저장합니다.

### 위치

`src/fanout-dynamodb/index.ts`

### 설정

```typescript
{
  runtime: NodeJS 20.x
  memory: 512 MB
  timeout: 60초
  environment: {
    TABLE_NAME: string
  }
}
```

### 입력 (Step Functions Parallel 결과)

```typescript
interface FanoutInput {
  preprocessResult: PreprocessOutput
  analysisResult: [
    DetectTextOutput, // Parallel Branch 1
    IndexFacesOutput // Parallel Branch 2
  ]
}
```

### 출력

```typescript
interface FanoutOutput {
  photoItem: {
    PK: string
    SK: string
  }
  bibIndexItems: Array<{
    PK: string
    SK: string
  }>
  itemsWritten: number
}
```

### 구현 로직

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)
const TABLE_NAME = process.env.TABLE_NAME!

interface StepFunctionInput {
  preprocessResult: {
    bucketName: string
    rawKey: string
    processedKey: string
    ulid: string
    orgId: string
    eventId: string
    originalFilename: string
    dimensions: { width: number; height: number }
    format: string
    size: number
    s3Uri: string
  }
  analysisResult: [
    { bibs: string[]; textDetections: any[] },
    { faceIds: string[]; faceRecords: any[]; unindexedFaces: number }
  ]
}

export const handler = async (event: StepFunctionInput) => {
  console.log('Fanning out to DynamoDB')

  const { preprocessResult, analysisResult } = event
  const [detectTextResult, indexFacesResult] = analysisResult

  const { ulid, orgId, eventId, originalFilename, processedKey, s3Uri, dimensions } = preprocessResult
  const { bibs } = detectTextResult
  const { faceIds } = indexFacesResult

  // 1. PHOTO 아이템 생성
  const photoItem = {
    PK: `ORG#${orgId}#EVT#${eventId}`,
    SK: `PHOTO#${ulid}`,
    EntityType: 'PHOTO',

    // 기본 정보
    ulid,
    orgId,
    eventId,
    originalFilename,

    // S3 경로
    rawKey: preprocessResult.rawKey,
    processedKey,
    s3Uri,

    // 이미지 메타데이터
    dimensions,
    format: preprocessResult.format,
    size: preprocessResult.size,

    // 분석 결과
    bibs,
    bibCount: bibs.length,
    faceIds,
    faceCount: faceIds.length,

    // 타임스탬프
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // 2. PHOTO 아이템 저장
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: photoItem
    })
  )

  console.log(`Saved PHOTO item: ${photoItem.SK}`)

  // 3. BIB_INDEX 아이템 생성 및 저장
  const bibIndexItems = []

  for (const bib of bibs) {
    const bibIndexItem = {
      PK: `ORG#${orgId}#EVT#${eventId}`,
      SK: `BIB#${bib}#PHOTO#${ulid}`,
      EntityType: 'BIB_INDEX',

      // GSI1 (BIB 기반 검색)
      GSI1PK: `EVT#${eventId}#BIB#${bib}`,
      GSI1SK: `PHOTO#${ulid}`,

      // 기본 정보
      ulid,
      orgId,
      eventId,
      bib,

      // 사진 참조
      photoS3Uri: s3Uri,
      processedKey,

      // 메타데이터
      faceCount: faceIds.length,

      // 타임스탬프
      createdAt: new Date().toISOString()
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: bibIndexItem
      })
    )

    bibIndexItems.push({
      PK: bibIndexItem.PK,
      SK: bibIndexItem.SK
    })

    console.log(`Saved BIB_INDEX item: ${bibIndexItem.SK}`)
  }

  return {
    photoItem: {
      PK: photoItem.PK,
      SK: photoItem.SK
    },
    bibIndexItems,
    itemsWritten: 1 + bibIndexItems.length
  }
}
```

---

## 🧪 테스트

### 유닛 테스트

각 Lambda 함수는 독립적으로 테스트 가능해야 합니다.

```typescript
// src/preprocess/index.test.ts
import { handler } from './index'

describe('Preprocess Lambda', () => {
  it('should process valid image', async () => {
    const event = {
      bucketName: 'test-bucket',
      rawKey: 'raw/org-123/event-456/test.jpg',
      fileSize: 1024000,
      timestamp: new Date().toISOString()
    }

    const result = await handler(event)

    expect(result.processedKey).toMatch(/^processed\/org-123\/event-456\//)
    expect(result.ulid).toBeDefined()
    expect(result.format).toBe('jpeg')
  })
})
```

### 통합 테스트

Step Functions 워크플로우 전체를 테스트합니다.

```bash
# 테스트 이미지 업로드
aws s3 cp test-image.jpg s3://snaprace-images-dev/raw/org-test/event-test/test.jpg

# Step Functions 실행 모니터링
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:...:stateMachine:image-processing-dev \
  --max-results 1

# DynamoDB 결과 확인
aws dynamodb query \
  --table-name PhotoService-dev \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{":pk":{"S":"ORG#org-test#EVT#event-test"}, ":sk":{"S":"PHOTO#"}}'
```

---

## 📝 체크리스트

각 Lambda 구현 시 다음 사항을 확인하세요:

- [ ] TypeScript 타입 정의 완료
- [ ] 환경 변수 검증 (process.env.XXX!)
- [ ] 에러 핸들링 (재시도 가능/불가능 구분)
- [ ] 로깅 (console.log, console.error)
- [ ] AWS SDK v3 사용 (client + command 패턴)
- [ ] IAM 권한 최소화 (Principle of Least Privilege)
- [ ] 타임아웃 설정 적절성
- [ ] 메모리 크기 최적화
- [ ] 유닛 테스트 작성
