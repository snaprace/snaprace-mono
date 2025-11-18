# INDEX.md

# SnapRace Documentation Index

SnapRace 이미지 처리·검색 플랫폼의 전체 문서를 빠르게 탐색할 수 있는 인덱스입니다.  
아키텍처, 스키마, Lambda, Step Functions, 배포 문서까지 모두 포함합니다.

---

# 📚 문서 구성도

```text
/docs
 ├── README.md                     # 전체 개요 및 주요 기능 요약
 ├── INDEX.md                      # (현재 문서) 전체 문서 인덱스
 ├── ARCHITECTURE.md               # 전체 시스템 아키텍처
 ├── RDB_SCHEMA.md                 # PostgreSQL(Supabase) Truth Layer 스키마
 ├── DYNAMODB_SCHEMA.md            # DynamoDB 단일 테이블 설계 (PHOTO / BIB_INDEX / GSI1 / GSI2)
 ├── LAMBDA_FUNCTIONS.md           # Lambda 함수 정의 및 책임
 ├── STEP_FUNCTIONS_WORKFLOW.md    # Step Functions 이미지 파이프라인 정의
 ├── DEPLOYMENT.md                 # 배포/환경 구성 가이드
 └── assets/                       # (선택) 이미지/도표 리소스
```

---

# 📄 1. README.md
**프로젝트 전체 요약**  
- SnapRace 플랫폼 소개  
- 주요 기능 (사진-only / bib / selfie / photographer 검색 등)  
- 전체 아키텍처 개요  
- 문서 간 링크 및 디렉토리 구조

👉 자세히 보기: `README.md`

---

# 🏗️ 2. ARCHITECTURE.md
**전체 시스템 아키텍처 정의**  
- Truth Layer (RDB) vs Read Layer (DynamoDB) 역할 분리  
- S3 → SQS → Lambda → Step Functions → DynamoDB 파이프라인  
- Photographer metadata 흐름  
- CloudFront/CDN 이미지 서빙 구조

👉 자세히 보기: `ARCHITECTURE.md`

---

# 🗄️ 3. RDB_SCHEMA.md
**관계형 데이터 스키마(Truth Layer)**  
- organizers  
- events (display_mode, results_integration, photos_meta 포함)  
- event_runners  
- photographers  
- event_photographers (이벤트 ↔ 포토그래퍼 N:N 관계)  
- 주요 조회 패턴 / RDB ↔ Dynamo 연동 정책

👉 자세히 보기: `RDB_SCHEMA.md`

---

# ⚡ 4. DYNAMODB_SCHEMA.md
**DynamoDB 단일 테이블 설계(Read Layer)**  
- PHOTO 엔티티  
- BIB_INDEX 엔티티  
- GSI1 (bib 검색)  
- GSI2 (photographer 검색)  
- PK/SK/GSI 키 구조 및 쓰기·조회 패턴  
- Truth Layer(RDB)와의 denormalize 정책

👉 자세히 보기: `DYNAMODB_SCHEMA.md`

---

# 🧩 5. LAMBDA_FUNCTIONS.md
**Lambda 기반 이미지 처리/저장 로직 정의**
- SfnTriggerFunction (S3 → SFN)  
- PreprocessFunction (Sharp 이미지 최적화)  
- DetectTextFunction (Rekognition 텍스트)  
- IndexFacesFunction (Rekognition 얼굴 인덱싱 + Collection 관리)  
- FanoutDynamoDBFunction (PHOTO/BIB_INDEX 생성 + photographer denormalize)

👉 자세히 보기: `LAMBDA_FUNCTIONS.md`

---

# 🔀 6. STEP_FUNCTIONS_WORKFLOW.md
**이미지 처리 오케스트레이션(핵심 파이프라인)**  
- Preprocess → Parallel(DetectText & IndexFaces) → Fanout  
- Retry/Catch 구조  
- Fallback 처리  
- Photographer metadata 전달 흐름  
- 전체 ASL 좌표

👉 자세히 보기: `STEP_FUNCTIONS_WORKFLOW.md`

---

# 🚀 7. DEPLOYMENT.md
**배포/환경 구성 가이드**  
- AWS CDK 스택 구성  
- 환경 변수 및 Secret 관리  
- S3 / SQS / Lambda / Step Functions / DynamoDB / CloudFront 설정  
- prod/dev 차이  
- Zero-downtime 배포 전략

👉 자세히 보기: `DEPLOYMENT.md`

---

# 📦 8. 기타(옵션)
이 폴더에는 아키텍처 다이어그램, ERD 등 추가 자료가 포함될 수 있습니다.

```
/docs/assets
 ├── architecture-diagram.png
 ├── erd.png
 └── workflow.png
```

---

# 🧭 전체 설계 흐름 요약
```
1. README → 전체 개요 파악
2. ARCHITECTURE → 시스템 전체 흐름 이해
3. RDB_SCHEMA → Truth Layer 이해
4. DYNAMODB_SCHEMA → Read Layer 및 검색 구조 확인
5. LAMBDA_FUNCTIONS → 이미지 처리 로직 이해
6. STEP_FUNCTIONS_WORKFLOW → 전체 파이프라인 실행 로직 확인
7. DEPLOYMENT → 실제 AWS 배포 구성
```

---

# 🎯 이 문서의 목적
INDEX.md는 SnapRace 프로젝트 문서를 **빠르게 탐색하기 위한 목차**이며,  
개발자/기획자/운영자가 필요한 문서를 즉시 찾을 수 있도록 구조화되어 있습니다.

문서는 서로 연결되어 있으므로, 특정 기능을 작업하거나 리뷰할 때는  
`ARCHITECTURE → (RDB or Dynamo) → Lambda → StepFunctions` 순서로 읽는 것을 권장합니다.

