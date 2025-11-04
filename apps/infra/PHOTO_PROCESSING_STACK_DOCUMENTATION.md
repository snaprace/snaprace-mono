# SnapRace Photo Processing Stack 문서

## 개요

SnapRace Photo Processing Stack은 레이스 사진의 자동 처리 및 검색을 위한 AWS 인프라입니다. OCR을 통한 bib 번호 인식, 얼굴 인식 기반의 사진 검색, 그리고 확장 가능한 데이터 모델을 제공합니다.

## 아키텍처 개요

### 주요 구성 요소

- **S3 Bucket**: 원본 사진 저장소 (`snparace`)
- **DynamoDB Tables**: 사진, 얼굴, 참가자 정보 저장
- **Lambda Functions**: 사진 처리 파이프라인
- **SQS Queue**: 비동기 처리 큐
- **API Gateway**: 사진 검색 API
- **EventBridge**: S3 이벤트 트리거

## 데이터 모델

### 1. Photos 테이블 (`PhotosV2`)

사진 메타데이터와 처리 상태를 저장하는 메인 테이블입니다.

**기본 키:**
- `pk`: `ORG#<organizer_id>#EVT#<event_id>`
- `sk`: `PHOTO#<photo_id>`

**GSI 1 (GSI_ByBib):**
- `gsi1pk`: `EVT#<organizer_id>#<event_id>#BIB#<bib_number>`
- `gsi1sk`: `TS#<uploaded_at>#PHOTO#<photo_id>`
- 용도: 특정 bib 번호를 가진 사진 목록 조회 (갤러리)

**GSI 2 (GSI_ByStatus):**
- `gsi2pk`: `EVT#<organizer_id>#<event_id>#STATUS#<processing_status>`
- `gsi2sk`: `TS#<uploaded_at>#PHOTO#<photo_id>`
- 용도: 처리 상태별 모니터링 및 재처리

### 2. PhotoFaces 테이블 (`PhotoFaces`)

얼굴과 사진의 관계를 저장하는 테이블입니다.

**기본 키:**
- `pk`: `ORG#<organizer_id>#EVT#<event_id>#FACE#<face_id>`
- `sk`: `TS#<uploaded_at>#PHOTO#<photo_id>`

**GSI 1 (GSI_BibFaces):**
- `gsi1pk`: `EVT#<organizer_id>#<event_id>#BIB#<bib_number>`
- `gsi1sk`: `FACE#<face_id>`
- 용도: bib 번호로 얼굴 목록 조회 (대표 얼굴 선정)

**GSI 2 (GSI_PhotoFaces):**
- `gsi2pk`: `PHOTO#<photo_id>`
- `gsi2sk`: `FACE#<face_id>`
- 용도: 사진에 포함된 얼굴 목록 조회

### 3. Runners 테이블 (`RunnersV2`)

참가자 정보를 저장하는 테이블입니다.

**기본 키:**
- `pk`: `ORG#<organizer_id>#EVT#<event_id>`
- `sk`: `BIB#<zero_padded_bib>`

## 처리 파이프라인

### 1. 사진 업로드 단계

```
S3 Upload (*/photos/raw/*)
    ↓
EventBridge Rule Trigger
    ↓
detect-text Lambda
```

### 2. 텍스트 감지 (detect-text Lambda)

**역할:**
- S3에 업로드된 사진에서 bib 번호 OCR 인식
- 워터마크 필터링
- 유효한 bib 번호 매칭
- DynamoDB에 사진 정보 저장
- SQS 메시지 전송

**처리 로직:**
1. Rekognition DetectText로 텍스트 감지
2. 워터마크 필터링 (바운딩 박스 기반)
3. Runners 테이블의 유효 bib 번호와 매칭
4. 단일 매칭만 확정 bib으로 인정
5. Photos 테이블에 저장
6. SQS로 얼굴 인식 요청 전송

**환경 변수:**
- `PHOTOS_TABLE_NAME`: Photos 테이블 이름
- `RUNNERS_TABLE_NAME`: Runners 테이블 이름
- `QUEUE_URL`: SQS 큐 URL
- `MIN_TEXT_CONFIDENCE`: 최소 텍스트 신뢰도 (기본값: 90.0)
- `CLOUDFRONT_DOMAIN_NAME`: CloudFront 도메인

### 3. 얼굴 인덱싱 (index-faces Lambda)

**역할:**
- 사진에서 얼굴 인식 및 인덱싱
- 동일 얼굴 검색 및 bib 번호 매칭
- 그룹 사진 처리 로직
- PhotoFaces 테이블에 얼굴-사진 관계 저장

**처리 로직:**
1. Rekognition 컬렉션 생성/확인
2. IndexFaces로 얼굴 인덱싱
3. SearchFaces로 동일 얼굴 검색
4. 얼굴별 bib 득표 집계
5. bib 번호 결정 (우선순위: OCR > 얼굴 매칭 다수결 > NONE)
6. 그룹 사진별 특별 처리
7. Photos 및 PhotoFaces 테이블 업데이트

**그룹 사진 처리 로직:**
- 그룹 사진(얼굴 2개 이상) + OCR 확정 bib:
  - 사진 전체 bib: OCR 결과 사용
  - 얼굴별 bib: 보류(NONE)로 저장 (오분류 방지)

**환경 변수:**
- `PHOTOS_TABLE_NAME`: Photos 테이블 이름
- `PHOTO_FACES_TABLE_NAME`: PhotoFaces 테이블 이름
- `PHOTOS_BUCKET_NAME`: S3 버킷 이름
- `MIN_SIMILARITY_THRESHOLD`: 최소 얼굴 유사도 (기본값: 95.0)
- `REQUIRED_VOTES`: 최소 득표수 (기본값: 2)

### 4. 얼굴 검색 API (find-by-selfie Lambda)

**역할:**
- 사용자 셀카로 관련 사진 검색
- 얼굴 매칭 기반 사진 조회
- bib 번호 필터링 옵션

**API 엔드포인트:** `POST /v1/selfie`

**요청 형식:**
```json
{
  "image": "base64_encoded_image",
  "organizer_id": "organizer123",
  "event_id": "event456",
  "bib_number": "123"  // 선택사항
}
```

**처리 로직:**
1. Base64 이미지 파싱
2. Rekognition SearchFacesByImage로 얼굴 매칭
3. PhotoFaces 테이블에서 관련 사진 조회
4. Photos 테이블에서 상세 정보 조회
5. bib 번호 필터링 (선택사항)
6. 최신 순 정렬 및 반환

**환경 변수:**
- `PHOTOS_TABLE_NAME`: Photos 테이블 이름
- `PHOTO_FACES_TABLE_NAME`: PhotoFaces 테이블 이름
- `PHOTOS_BUCKET_NAME`: S3 버킷 이름
- `MIN_SIMILARITY_THRESHOLD`: 최소 얼굴 유사도 (기본값: 95.0)

## 주요 특징

### 1. 워터마크 필터링

OCR 과정에서 워터마크 텍스트를 필터링합니다:
- 바운딩 박스 위치 기반 필터링 (하단 35% 구역)
- 텍스트 크기 기반 필터링 (최소 너비/높이)
- 좌/우하단 구역 특별 필터링

### 2. 그룹 사진 처리

그룹 사진과 단독 사진을 구분하여 다르게 처리:
- **그룹 사진 + OCR 확정**: 사진 전체 bib은 OCR 사용, 얼굴별 bib은 보류
- **단독 사진 또는 OCR 미확정**: 얼굴 매칭 결과를 bib으로 사용

### 3. 얼굴 매칭 알고리즘

득표 시스템을 통한 얼굴-bib 매칭:
- 동일 얼굴 검색으로 기존 매칭된 bib 조회
- bib별 득표수 집계 (유사도 고려)
- 최소 득표수 및 유사도 임계값 적용

### 4. 멱등성 보장

모든 쓰기 작업에서 멱등성을 보장:
- DynamoDB ConditionalCheckFailedException 처리
- 중복 처리 방지
- 일관된 상태 유지

## 설정 및 배포

### 개발 환경 설정
- RemovalPolicy: `DESTROY` (개발용)
- 모든 리소스 자동 삭제 활성화

### Lambda 공통 레이어
- AWS SDK 공통 의존성
- Node.js 20.x 런타임
- npm 캐시 최적화

### 모니터링 및 로깅
- CloudWatch Logs (1주일 보관)
- AWS X-Ray 트레이싱 활성화
- SQS DLQ (14일 보관)

## 보안 고려사항

### IAM 권한
- 최소 권한 원칙 적용
- 리소스별 접근 제어
- Rekognition 권한은 필요한 작업으로 제한

### 데이터 보호
- S3 버킷 SSL 강제
- API Gateway CORS 설정
- CloudFront를 통한 이미지 전송

## 확장성 고려사항

### 처리량 확장
- SQS 배치 처리 (5개 메시지, 10초 윈도우)
- Lambda 메모리 최적화 (얼굴 인식: 1024MB)
- DynamoDB On-Demand 요금제

### 데이터 모델 확장
- GSI를 통한 다양한 조회 패턴 지원
- Time-based 파티셔닝으로 효율적 데이터 관리
- Include projection으로 저장소 최적화

## 성능 최적화

### DynamoDB 최적화
- GSI별 Projection 최적화
- BatchGet으로 다수 아이템 조회
- Query 패턴 최적화

### Lambda 최적화
- 레이어를 통한 의존성 공유
- 적절한 타임아웃 설정 (5분)
- 메모리 사이즈 튜닝

### S3 최적화
- EventBridge를 통한 이벤트 기반 처리
- CloudFront CDN 통합
- 이미지 경로 표준화

## 모니터링 및 디버깅

### CloudWatch 메트릭
- Lambda 함수 실행 시간 및 오류율
- SQS 큐 깊이
- DynamoDB 읽기/쓰기 용량

### 로깅 전략
- 구조화된 로그 형식
- 처리 상태 추적
- 오류 상세 정보 기록

### 트러블슈팅
- DLQ를 통한 실패 메시지 분석
- X-Ray 트레이스로 성능 병목 파악
- GSI를 통한 데이터 상태 확인

---

## 배포 명령어

```bash
# CDK 배포
cd apps/infra
pnpm cdk deploy PhotoProcessingStack

# 테스트 실행
pnpm test

# 타입 검사
pnpm check-types
```

이 스택은 SnapRace 서비스의 핵심적인 사진 처리 기능을 제공하며, 확장 가능하고 안정적인 아키텍처로 설계되었습니다.