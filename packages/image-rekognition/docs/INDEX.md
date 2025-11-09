# Image Rekognition 문서 인덱스

## 📚 문서 구조

이 문서들은 Image Rekognition CDK 프로젝트의 설계부터 배포, 운영까지 전체 라이프사이클을 다룹니다.

## 🗂️ 문서 목록

### 1. [README.md](./README.md) ⭐ 시작하기

**대상**: 모든 개발자

**내용**:

- 프로젝트 개요 및 목적
- 핵심 기능 소개
- 전체 워크플로우 다이어그램
- 폴더 구조
- 빠른 시작 가이드
- 핵심 설계 원칙

**언제 읽어야 하나요?**

- 프로젝트를 처음 접하는 경우
- 전체 시스템 구조를 빠르게 파악하고 싶을 때
- 로컬 개발 환경을 설정하려는 경우

---

### 2. [ARCHITECTURE.md](./ARCHITECTURE.md) 🏗️ 아키텍처 설계

**대상**: 시스템 설계자, 백엔드 개발자

**내용**:

- 상세 시스템 아키텍처 다이어그램
- 모든 AWS 리소스 정의
  - S3 Bucket (구조, 이벤트 알림)
  - SQS Queue (디커플링 전략)
  - Lambda Functions (5개 함수 상세)
  - Step Functions State Machine
  - DynamoDB Table
  - Rekognition Collection
- IAM 권한 정리
- 비용 추정
- 모니터링 및 알람 설정

**언제 읽어야 하나요?**

- 인프라 리소스를 추가/수정해야 할 때
- AWS 서비스 간 통합을 이해하고 싶을 때
- 비용을 분석하거나 최적화하려는 경우
- 보안 정책을 검토하려는 경우

---

### 3. [LAMBDA_FUNCTIONS.md](./LAMBDA_FUNCTIONS.md) ⚙️ Lambda 구현 스펙

**대상**: 백엔드 개발자

**내용**:

- 각 Lambda 함수의 상세 구현 스펙
  1. **SFN Trigger Lambda**: SQS → Step Functions 트리거
  2. **Preprocess Lambda**: 이미지 검증, 리사이징, 포맷 변환
  3. **Detect Text Lambda**: BIB 번호 검출
  4. **Index Faces Lambda**: 얼굴 인덱싱
  5. **Fanout DynamoDB Lambda**: 결과 저장
- 입력/출력 데이터 구조
- 완전한 코드 예시
- 에러 핸들링 패턴
- 테스트 가이드

**언제 읽어야 하나요?**

- Lambda 함수를 구현하거나 수정할 때
- 각 단계의 입출력 형식을 확인하고 싶을 때
- 에러 핸들링 방법을 참고하고 싶을 때
- 유닛 테스트를 작성하려는 경우

---

### 4. [STEP_FUNCTIONS_WORKFLOW.md](./STEP_FUNCTIONS_WORKFLOW.md) 🔄 워크플로우 상세

**대상**: 백엔드 개발자, DevOps 엔지니어

**내용**:

- Step Functions 워크플로우 완전 분석
- ASL (Amazon States Language) 정의
- CDK 구현 코드
- 단계별 데이터 흐름 추적
- 실행 시간 분석
- 에러 처리 전략
- 모니터링 및 디버깅 방법
- 성능 벤치마크

**언제 읽어야 하나요?**

- Step Functions 로직을 수정하거나 확장할 때
- 워크플로우 단계를 추가하려는 경우
- 재시도 정책을 조정하고 싶을 때
- 워크플로우 실행 실패를 디버깅하려는 경우

---

### 5. [DYNAMODB_SCHEMA.md](./DYNAMODB_SCHEMA.md) 🗄️ 데이터베이스 설계

**대상**: 백엔드 개발자, 데이터 엔지니어

**내용**:

- DynamoDB 단일 테이블 설계
- 엔티티 타입 (PHOTO, BIB_INDEX)
- 키 구조 및 GSI 설계
- 모든 속성 정의
- 쿼리 패턴 예시
  - 이벤트별 사진 조회
  - BIB 번호로 사진 검색
  - 시간 범위로 조회 (ULID 활용)
- CDK 테이블 정의
- 용량 계산
- 데이터 관리 전략

**언제 읽어야 하나요?**

- DynamoDB 쿼리를 작성할 때
- 새로운 속성을 추가하거나 스키마를 변경하려는 경우
- GSI를 추가하거나 수정하고 싶을 때
- 데이터 마이그레이션을 계획하는 경우

---

### 6. [DEPLOYMENT.md](./DEPLOYMENT.md) 🚀 배포 및 운영

**대상**: DevOps 엔지니어, 백엔드 개발자

**내용**:

- 완전한 배포 프로세스 (Bootstrap → Deploy)
- 환경 설정 (dev, staging, prod)
- 배포 검증 방법
- 업데이트 및 롤백 전략
- CloudWatch 모니터링 설정
- 알람 구성
- 트러블슈팅 가이드
  - 일반적인 문제 및 해결 방법
  - 디버깅 팁
- 보안 설정
- 비용 최적화
- 리소스 정리

**언제 읽어야 하나요?**

- 처음으로 시스템을 배포할 때
- 프로덕션 배포를 준비하는 경우
- 시스템 장애를 디버깅하고 싶을 때
- 모니터링 및 알람을 설정하려는 경우
- 비용을 최적화하고 싶을 때

---

## 🎯 사용 시나리오별 가이드

### 시나리오 1: 처음 프로젝트에 참여하는 개발자

```
1. README.md           → 프로젝트 전체 이해
2. ARCHITECTURE.md     → 시스템 구조 파악
3. DEPLOYMENT.md       → 로컬 환경 설정 및 배포
```

### 시나리오 2: Lambda 함수 개발/수정

```
1. LAMBDA_FUNCTIONS.md → 함수 스펙 확인
2. ARCHITECTURE.md     → IAM 권한 및 리소스 확인
3. DEPLOYMENT.md       → 배포 및 테스트
```

### 시나리오 3: 워크플로우 최적화

```
1. STEP_FUNCTIONS_WORKFLOW.md → 현재 워크플로우 분석
2. LAMBDA_FUNCTIONS.md        → 각 단계 최적화
3. DEPLOYMENT.md              → 성능 모니터링
```

### 시나리오 4: 쿼리 API 개발

```
1. DYNAMODB_SCHEMA.md  → 스키마 및 쿼리 패턴 확인
2. LAMBDA_FUNCTIONS.md → Lambda 구현
3. DEPLOYMENT.md       → 배포 및 테스트
```

### 시나리오 5: 장애 대응

```
1. DEPLOYMENT.md              → 트러블슈팅 섹션
2. STEP_FUNCTIONS_WORKFLOW.md → 실행 히스토리 확인
3. LAMBDA_FUNCTIONS.md        → 에러 핸들링 확인
```

## 📖 읽는 순서 추천

### 초급 개발자

1. **README.md** - 전체 그림 이해
2. **LAMBDA_FUNCTIONS.md** - 코드 구현 학습
3. **DEPLOYMENT.md** - 배포 실습

### 중급 개발자

1. **ARCHITECTURE.md** - 시스템 설계 이해
2. **STEP_FUNCTIONS_WORKFLOW.md** - 워크플로우 분석
3. **DYNAMODB_SCHEMA.md** - 데이터 모델링 학습
4. **DEPLOYMENT.md** - 운영 노하우 습득

### 시니어 개발자 / 아키텍트

1. **ARCHITECTURE.md** - 전체 아키텍처 검토
2. **DYNAMODB_SCHEMA.md** - 스키마 설계 검토
3. **STEP_FUNCTIONS_WORKFLOW.md** - 워크플로우 최적화
4. **DEPLOYMENT.md** - 운영 전략 수립

## 🔍 키워드별 문서 찾기

| 키워드                    | 관련 문서                      |
| ------------------------- | ------------------------------ |
| S3 이벤트, SQS            | ARCHITECTURE.md                |
| 이미지 리사이징, Sharp.js | LAMBDA_FUNCTIONS.md            |
| BIB 검출, 얼굴 인덱싱     | LAMBDA_FUNCTIONS.md            |
| 재시도, 에러 핸들링       | STEP_FUNCTIONS_WORKFLOW.md     |
| PK, SK, GSI               | DYNAMODB_SCHEMA.md             |
| CDK 배포, 모니터링        | DEPLOYMENT.md                  |
| IAM 권한                  | ARCHITECTURE.md, DEPLOYMENT.md |
| 비용 최적화               | ARCHITECTURE.md, DEPLOYMENT.md |
| 트러블슈팅                | DEPLOYMENT.md                  |
| 성능 벤치마크             | STEP_FUNCTIONS_WORKFLOW.md     |

## 📝 문서 기여 가이드

문서를 수정하거나 추가하려는 경우:

1. **문서 템플릿**: README.md를 참고
2. **마크다운 스타일**:
   - 제목: `#`, `##`, `###` 사용
   - 코드 블록: 언어 지정 (`typescript, `json, ```bash)
   - 다이어그램: ASCII 아트 또는 Mermaid
3. **업데이트 시**: INDEX.md도 함께 업데이트

## 🆘 도움이 필요한 경우

- **기술 질문**: 팀 슬랙 채널 #image-rekognition
- **버그 리포트**: GitHub Issues
- **긴급 문제**: DevOps 팀에 직접 연락

## 📅 마지막 업데이트

- **날짜**: 2024-11-09
- **버전**: 1.0.0
- **작성자**: Development Team
