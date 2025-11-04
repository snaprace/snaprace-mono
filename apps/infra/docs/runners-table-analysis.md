# Runners 테이블 존재 여부에 따른 처리 흐름 분석

## 개요

현재 Photo Processing Stack에서 Runners 테이블이 있는 경우와 없는 경우 각각 어떻게 진행되는지 분석한 문서입니다.

## Runners 테이블 사용 현황

### 1. detect-text Lambda 함수

- **사용 목적**: OCR로 감지한 텍스트가 유효한 bib 번호인지 검증
- **사용 위치**: `loadValidBibsForEvent()` 함수 (118-175줄)
- **에러 처리**: Runners 테이블이 없거나 접근 불가 시 빈 Set 반환하여 처리 계속

### 2. index-faces Lambda 함수

- **사용 여부**: ❌ 사용하지 않음
- **bib 결정 방식**: 얼굴 매칭 다수결 + OCR 확정 bib

### 3. find-by-selfie Lambda 함수

- **사용 여부**: ❌ 사용하지 않음
- **bib 활용**: 요청 파라미터로 받은 bib_number를 필터링 옵션으로만 사용 (선택사항)

---

## 시나리오별 처리 흐름

### 시나리오 1: Runners 테이블이 **있는** 경우

#### 1.1 detect-text Lambda 처리

```
1. S3 업로드 이벤트 수신
   ↓
2. Rekognition OCR로 텍스트 감지
   ↓
3. Runners 테이블에서 이벤트별 유효한 bib 번호 목록 로드
   - PK: "ORG#<organizer_id>#EVT#<event_id>"
   - SK: "BIB#<zero_padded_bib>" 형식으로 저장된 모든 레코드 조회
   - 제로 패딩 제거하여 실제 bib 번호 추출
   ↓
4. 감지된 텍스트와 유효한 bib 번호 매칭
   - 워터마크 필터링 적용 (하단 좌/우측 35% 구역 제외)
   - 유효한 bib 번호와 일치하는 텍스트만 추출
   ↓
5. bib 확정 조건
   - 매칭된 bib가 정확히 1개인 경우만 확정
   - 0개 또는 2개 이상이면 미확정 (undefined)
   ↓
6. Photos 테이블에 저장
   - bib_number: 확정된 bib 또는 "NONE"
   - detected_bibs: 매칭된 모든 bib 번호 배열
   - processing_status: "TEXT_DETECTED"
   ↓
7. SQS 메시지 전송
   - hasConfirmedBib: bib 확정 여부
   - bib: 확정된 bib 번호
```

**주요 특징:**

- ✅ OCR로 감지한 텍스트의 유효성 검증 가능
- ✅ 잘못된 번호나 워터마크 필터링으로 오분류 방지
- ✅ 단일 bib 매칭만 확정하여 정확도 향상

#### 1.2 index-faces Lambda 처리

```
1. SQS 메시지 수신
   ↓
2. Photos 테이블에서 사진 정보 조회
   ↓
3. Rekognition 얼굴 인덱싱
   ↓
4. 기존 얼굴과 매칭 (SearchFaces)
   - PhotoFaces 테이블에서 매칭된 얼굴의 bib 조회
   - 각 bib에 대한 득표 수집
   ↓
5. bib 결정 우선순위
   1순위: OCR 확정 bib (hasConfirmedBib=true)
   2순위: 얼굴 매칭 다수결 (최소 득표수 이상)
   3순위: 보류 (NONE)
   ↓
6. Photos 테이블 업데이트
   - bib_number: 최종 결정된 bib
   - face_ids: 감지된 얼굴 ID 배열
   - processing_status: "FACES_INDEXED"
   ↓
7. PhotoFaces 테이블에 얼굴-사진 매핑 저장
   - 그룹 사진 + OCR 확정: 얼굴별 bib 보류 (오분류 방지)
   - 단일 얼굴 또는 OCR 미확정: 얼굴별 bib 저장
```

**주요 특징:**

- Runners 테이블을 직접 사용하지 않지만, OCR 단계에서 확정된 bib를 활용
- 얼굴 매칭과 OCR 결과를 결합하여 정확도 향상

---

### 시나리오 2: Runners 테이블이 **없는** 경우

#### 2.1 detect-text Lambda 처리

```
1. S3 업로드 이벤트 수신
   ↓
2. Rekognition OCR로 텍스트 감지
   ↓
3. Runners 테이블 조회 시도
   - loadValidBibsForEvent() 호출
   - ResourceNotFoundException 발생
   ↓
4. 에러 처리 (catch 블록)
   - 경고 로그 출력: "Runners table not found or empty"
   - 빈 Set 반환하여 처리 계속
   ↓
5. bib 매칭 시도
   - validBibs가 빈 Set이므로 매칭 불가
   - bibMatches: 빈 Set
   ↓
6. bib 확정
   - confirmedBibNumber: undefined (항상 미확정)
   ↓
7. Photos 테이블에 저장
   - bib_number: "NONE" (항상)
   - detected_bibs: [] (빈 배열)
   - processing_status: "TEXT_DETECTED"
   ↓
8. SQS 메시지 전송
   - hasConfirmedBib: false
   - bib: undefined
```

**주요 특징:**

- ⚠️ OCR로 텍스트는 감지하지만 유효성 검증 불가
- ⚠️ bib 매칭이 불가능하여 항상 "NONE"으로 저장
- ✅ 사진 처리는 정상적으로 계속 진행됨 (실패하지 않음)

**코드 참조:**

```118:175:apps/infra/lambda/detect-text/index.ts
async function loadValidBibsForEvent(
  runnersTableName: string,
  organizerId: string,
  eventId: string
): Promise<Set<string>> {
  const bibs = new Set<string>();
  const pk = `ORG#${organizerId}#EVT#${eventId}`;

  try {
    // ... Runners 테이블 조회 로직 ...
  } catch (error: any) {
    // Runners 테이블이 없거나 접근할 수 없는 경우 빈 Set 반환
    // 이렇게 하면 bib 매칭은 안 되지만 사진 처리는 계속 진행됨
    if (error.name === "ResourceNotFoundException") {
      console.warn(
        `Runners table not found or empty for ${organizerId}/${eventId}. Continuing without bib validation.`
      );
    } else {
      console.error(
        `Error loading valid bibs for ${organizerId}/${eventId}:`,
        error
      );
      // 다른 에러도 빈 Set 반환하여 처리 계속
    }
  }

  return bibs;
}
```

#### 2.2 index-faces Lambda 처리

```
1. SQS 메시지 수신
   ↓
2. Photos 테이블에서 사진 정보 조회
   - bib_number: "NONE" (OCR 단계에서 확정되지 않음)
   ↓
3. Rekognition 얼굴 인덱싱
   ↓
4. 기존 얼굴과 매칭 (SearchFaces)
   - PhotoFaces 테이블에서 매칭된 얼굴의 bib 조회
   - 이전에 얼굴 매칭으로 확정된 bib가 있으면 득표로 집계
   ↓
5. bib 결정 우선순위
   1순위: OCR 확정 bib → ❌ 없음 (항상 false)
   2순위: 얼굴 매칭 다수결 → ✅ 사용 가능
      - 최소 득표수(기본 2표) 이상이면 확정
      - 최소 유사도(기본 90%) 이상이면 확정
   3순위: 보류 (NONE)
   ↓
6. Photos 테이블 업데이트
   - bib_number: 얼굴 매칭으로 확정된 bib 또는 "NONE"
   - face_ids: 감지된 얼굴 ID 배열
   - processing_status: "FACES_INDEXED"
   ↓
7. PhotoFaces 테이블에 얼굴-사진 매핑 저장
   - 단일 얼굴 또는 OCR 미확정: 얼굴별 bib 저장
   - 그룹 사진 조건 불충족 (OCR 확정 없음)
```

**주요 특징:**

- ⚠️ OCR bib 확정이 불가능하므로 얼굴 매칭에만 의존
- ✅ 이전에 얼굴 매칭으로 확정된 bib가 있으면 재사용 가능
- ✅ 얼굴 매칭 다수결로 bib 확정 가능 (최소 득표수 충족 시)

---

## 비교표

| 항목                   | Runners 테이블 있음         | Runners 테이블 없음             |
| ---------------------- | --------------------------- | ------------------------------- |
| **OCR bib 검증**       | ✅ 가능 (유효한 bib만 매칭) | ❌ 불가능 (검증 없이 모두 NONE) |
| **OCR bib 확정**       | ✅ 가능 (단일 매칭 시)      | ❌ 불가능 (항상 NONE)           |
| **얼굴 매칭 bib 확정** | ✅ 가능 (OCR 실패 시 대안)  | ✅ 가능 (유일한 방법)           |
| **처리 실패 여부**     | ❌ 실패하지 않음            | ❌ 실패하지 않음                |
| **사진 저장**          | ✅ 정상 저장                | ✅ 정상 저장                    |
| **워터마크 필터링**    | ✅ 적용 (bib 검증과 함께)   | ✅ 적용 (단, 검증 없음)         |

---

## 실제 사용 예시

### Runners 테이블이 있는 경우

**사진 업로드 시나리오:**

1. 사진에 "123" 번호가 감지됨
2. Runners 테이블에서 이벤트의 유효한 bib 목록 확인
3. "123"이 유효한 bib인지 검증
4. 유효하면 bib_number="123"으로 확정
5. 유효하지 않으면 bib_number="NONE" (워터마크일 가능성)

**결과:**

- OCR 단계에서 bib 확정 가능
- 얼굴 매칭은 추가 검증 또는 대안으로 활용

### Runners 테이블이 없는 경우

**사진 업로드 시나리오:**

1. 사진에 "123" 번호가 감지됨
2. Runners 테이블이 없어 유효성 검증 불가
3. bib_number="NONE"으로 저장
4. 얼굴 매칭 단계에서 bib 확정 시도

**결과:**

- OCR 단계에서는 bib 확정 불가
- 얼굴 매칭으로만 bib 확정 가능
- 첫 번째 사진은 얼굴 매칭이 어려움 (기준 얼굴 없음)

---

## 권장사항

### Runners 테이블이 있는 경우 (권장)

- ✅ OCR 단계에서 빠른 bib 확정 가능
- ✅ 워터마크와 실제 bib 번호 구분 가능
- ✅ 얼굴 매칭 실패 시에도 OCR로 대체 가능
- ✅ 초기 사진 업로드 시에도 bib 확정 가능

### Runners 테이블이 없는 경우

- ⚠️ 얼굴 매칭에만 의존
- ⚠️ 첫 번째 사진은 bib 확정이 어려움
- ⚠️ OCR 결과를 활용할 수 없음
- ✅ 사진 처리는 정상적으로 진행됨

---

## 결론

1. **Runners 테이블은 선택사항**이지만, 있으면 OCR 단계에서 bib 확정이 가능하여 전체 정확도가 향상됩니다.

2. **Runners 테이블이 없어도** 시스템은 정상 작동하며, 얼굴 매칭으로만 bib를 확정합니다.

3. **현재 구조는 graceful degradation**을 지원합니다:
   - Runners 테이블이 없으면 에러가 발생하지 않고
   - 빈 Set을 반환하여 bib 검증 없이 처리 계속

4. **프로덕션 환경에서는 Runners 테이블 사용을 권장**합니다:
   - OCR 정확도 향상
   - 워터마크 필터링 효과
   - 초기 사진 업로드 시에도 bib 확정 가능
