# 그룹 사진 처리 로직 개선: 얼굴별 bib 할당 문제

## 문제 요약

**현상**: bib A인 그룹 사진(사진1: A+B)에서 얼굴 B도 bib A로 저장되어, 이후 얼굴 B만 있는 사진(사진3: B)이 bib A 갤러리에 포함되는 문제

**핵심 이슈**: 그룹 사진에서 OCR로 확정된 bib을 모든 얼굴에 일괄 적용하는 현재 로직의 한계

## 상세 시나리오 분석

### 시나리오: bib A의 그룹 사진 및 개별 사진

```
사진1: bib A (OCR 확정), 얼굴 A + B (그룹 사진)
사진2: bib A (OCR 확정), 얼굴 A만
사진3: bib 없음 (OCR 미확정), 얼굴 B만
```

### 현재 로직의 처리 순서

#### 1단계: 사진1 처리 (bib A, 얼굴 A+B)

```typescript
// 입력
hasConfirmedBib = true
bib = 'A'
faceIds = [faceA, faceB]

// 처리
finalBibNumber = 'A'  // OCR 확정 우선

// 저장
Photos: { photo_id: 'photo1', bib_number: 'A', face_ids: [faceA, faceB] }
PhotoFaces: [
  { face_id: faceA, photo_id: 'photo1', bib_number: 'A' },
  { face_id: faceB, photo_id: 'photo1', bib_number: 'A' }  // ⚠️ 문제: faceB도 bib A로 저장
]
```

**문제점**: 얼굴 B가 실제로는 bib A가 아닐 수 있지만, 그룹 사진의 OCR 결과를 모두에게 적용함

#### 2단계: 사진2 처리 (bib A, 얼굴 A만)

```typescript
// 입력
hasConfirmedBib = true
bib = 'A'
faceIds = [faceA]

// 처리
finalBibNumber = 'A'  // OCR 확정 우선

// 저장
Photos: { photo_id: 'photo2', bib_number: 'A', face_ids: [faceA] }
PhotoFaces: [
  { face_id: faceA, photo_id: 'photo2', bib_number: 'A' }
]
```

정상 동작: 얼굴 A는 bib A로 올바르게 처리됨

#### 3단계: 사진3 처리 (bib 없음, 얼굴 B만)

```typescript
// 입력
hasConfirmedBib = false
bib = undefined
faceIds = [faceB]

// 얼굴 인덱싱 및 검색
SearchFaces(faceB) → 사진1의 faceB 매칭 (bib A로 저장됨)
votesByBib = { 'A': { votes: 1, topSim: 98.5 } }

// bib 결정
if (hasConfirmedBib && bib) {  // false
  // 실행 안됨
} else if (votesByBib.size > 0) {
  const [bestBib, meta] = sorted[0]  // ['A', { votes: 1, topSim: 98.5 }]

  if (meta.votes >= requiredVotes && ...) {  // 1 >= 2? NO
    finalBibNumber = bestBib  // 실행 안됨
  }
}
finalBibNumber = 'NONE'  // ✅ 방어 로직 작동
```

**현재 방어 로직**: `REQUIRED_VOTES=2`로 인해 사진3은 NONE으로 설정되어 bib A 갤러리에 포함되지 않음

**하지만**: 근본 원인(사진1에서 faceB가 bib A로 저장됨)은 해결되지 않음

## 근본 원인 분석

### 1. 그룹 사진 처리의 한계

**현재 로직**:

- OCR로 bib 확정 → 모든 얼굴에 동일 bib 적용
- 그룹 사진에서 얼굴별 bib 구분 불가

**문제점**:

- 그룹 사진의 bib은 일반적으로 한 명의 bib만 표시
- 다른 사람의 얼굴이 함께 찍혀도 그들의 bib 정보는 없음
- 모든 얼굴에 동일 bib을 부여하면 오분류 발생

### 2. 얼굴 매칭 전파 오류

**현재 로직**:

- `PhotoFaces` 테이블에 얼굴-bib 매핑 저장
- 이후 같은 얼굴이 나오면 기존 bib을 참조

**문제점**:

- 사진1에서 얼굴 B가 bib A로 잘못 저장됨
- 사진3에서 얼굴 B 검색 시 bib A로 잘못 분류될 수 있음
- 현재는 `REQUIRED_VOTES`로 방어하지만, 더 많은 얼굴이 매칭되면 오분류 가능

### 3. 데이터 무결성 문제

**현재 상태**:

- `PhotoFaces` 테이블에 잘못된 얼굴-bib 매핑 저장
- 후속 처리에 오염된 데이터 영향

**영향**:

- 얼굴 검색 정확도 저하
- 갤러리 오염 가능성
- 재처리 시 오류 전파

## 해결 방안

### 방안 1: 그룹 사진 얼굴별 bib 할당 로직 (권장)

#### 핵심 아이디어

그룹 사진의 경우:

1. OCR로 확정된 bib은 **주인공 얼굴**에만 할당
2. 다른 얼굴들은 **보류(NONE)** 또는 **얼굴 매칭으로 결정**

#### 구현 로직

```typescript
// 그룹 사진 처리 로직
async function processGroupPhoto(
  photo: PhotoItem,
  faceIds: string[],
  hasConfirmedBib: boolean,
  bib: string | undefined,
  votesByBib: Map<string, { votes: number; topSim: number }>
): Promise<Map<string, string>> {
  // 얼굴별 bib 할당 맵
  const faceBibMap = new Map<string, string>()

  if (hasConfirmedBib && bib && faceIds.length > 1) {
    // 그룹 사진 + OCR 확정 bib

    // 1. 얼굴별 얼굴 매칭 득표 수집
    const faceVotesMap = new Map<string, Map<string, { votes: number; topSim: number }>>()

    for (const faceId of faceIds) {
      const faceVotes = await collectFaceVotes(faceId, photoFacesTableName)
      faceVotesMap.set(faceId, faceVotes)
    }

    // 2. OCR bib과 가장 강하게 매칭되는 얼굴 찾기 (주인공)
    let protagonistFaceId: string | null = null
    let maxConfidence = 0

    for (const [faceId, votes] of faceVotesMap.entries()) {
      const bibVote = votes.get(bib)
      if (bibVote && bibVote.votes > maxConfidence) {
        protagonistFaceId = faceId
        maxConfidence = bibVote.votes
      }
    }

    // 3. 얼굴별 bib 할당
    for (const faceId of faceIds) {
      if (faceId === protagonistFaceId) {
        // 주인공 얼굴: OCR bib 할당
        faceBibMap.set(faceId, bib)
      } else {
        // 다른 얼굴: 얼굴 매칭 결과로 결정
        const faceVotes = faceVotesMap.get(faceId)!
        const bestBib = getBestBibFromVotes(faceVotes)
        faceBibMap.set(faceId, bestBib || 'NONE')
      }
    }
  } else {
    // 단일 얼굴 또는 OCR 미확정
    // 기존 로직 적용
    const finalBib = hasConfirmedBib && bib ? bib : getBestBibFromVotes(votesByBib) || 'NONE'
    for (const faceId of faceIds) {
      faceBibMap.set(faceId, finalBib)
    }
  }

  return faceBibMap
}
```

#### 장점

- 그룹 사진에서 얼굴별 bib 정확도 향상
- 오분류 방지
- 데이터 무결성 보장

#### 단점

- 구현 복잡도 증가
- 얼굴별 검색 및 득표 계산 필요 (성능 고려)

### 방안 2: 그룹 사진 얼굴 보류 정책 (간단한 방안)

#### 핵심 아이디어

그룹 사진의 경우:

1. OCR로 확정된 bib은 **사진 전체**에만 할당
2. 얼굴별 `PhotoFaces` 항목에는 **bib을 저장하지 않음 (NONE)**
3. 이후 단독 사진에서 얼굴 매칭으로 bib 결정

#### 구현 로직

```typescript
// 그룹 사진 처리 (간단한 방안)
if (hasConfirmedBib && bib && faceIds.length > 1) {
  // 그룹 사진: 얼굴별 bib은 보류
  await updatePhoto(photosTableName, organizerId, eventId, sanitizedKey, {
    bib_number: bib, // 사진 전체 bib은 OCR 결과 사용
    face_ids: faceIds,
    processing_status: 'FACES_INDEXED'
  })

  // PhotoFaces에 얼굴-bib 매핑 저장 시 bib을 NONE으로
  for (const faceId of faceIds) {
    await savePhotoFace(
      photoFacesTableName,
      organizerId,
      eventId,
      faceId,
      sanitizedKey,
      uploadedAt,
      undefined // bib 보류
    )
  }
} else {
  // 단일 얼굴 또는 OCR 미확정: 기존 로직
  // ...
}
```

#### 장점

- 구현 간단
- 오분류 방지
- 단독 사진에서 얼굴 매칭으로 정확한 bib 결정 가능

#### 단점

- 그룹 사진의 얼굴별 bib 정보 손실
- 얼굴 검색 정확도는 방안1보다 낮을 수 있음

### 방안 3: 얼굴 매칭 신뢰도 기반 필터링 (현재 방안 보완)

#### 핵심 아이디어

현재 방어 로직을 강화:

1. 얼굴 매칭 득표수뿐만 아니라 **얼굴 출현 빈도** 고려
2. 그룹 사진에서 매칭된 얼굴의 bib 신뢰도 낮춤
3. 단독 사진에서 매칭된 얼굴의 bib 신뢰도 높임

#### 구현 로직

```typescript
// 얼굴 매칭 신뢰도 계산
function calculateBibConfidence(
  bib: string,
  votes: { votes: number; topSim: number },
  matchedPhotos: PhotoFaceItem[]
): number {
  // 기본 득표수
  let confidence = votes.votes

  // 얼굴이 출현한 사진들의 특성 고려
  for (const photoFace of matchedPhotos) {
    const photo = await getPhoto(photoFace.photo_id)

    // 그룹 사진에서 나온 얼굴 매칭은 신뢰도 낮춤
    if (photo.face_ids.length > 1) {
      confidence *= 0.5 // 그룹 사진 가중치
    } else {
      confidence *= 1.2 // 단독 사진 가중치
    }
  }

  return confidence
}
```

#### 장점

- 기존 로직 유지하면서 개선
- 구현 복잡도 중간

#### 단점

- 근본 원인 해결은 아님
- 신뢰도 계산 로직 추가 필요

## 권장 구현 방안

### 단계적 접근

**1단계 (즉시 적용)**: 방안 2 (그룹 사진 얼굴 보류 정책)

- 구현 간단
- 빠른 오분류 방지
- 데이터 무결성 보장

**2단계 (향후 개선)**: 방안 1 (얼굴별 bib 할당 로직)

- 더 정확한 얼굴별 bib 결정
- 그룹 사진에서도 얼굴 검색 활용

### 구현 우선순위

1. **높음**: 그룹 사진 얼굴 보류 정책 (방안 2)
2. **중간**: 얼굴 매칭 신뢰도 기반 필터링 (방안 3)
3. **낮음**: 얼굴별 bib 할당 로직 (방안 1)

## 테스트 시나리오

### 시나리오 1: 그룹 사진 → 단독 사진

```
사진1: bib A (OCR 확정), 얼굴 A+B
사진2: bib A (OCR 확정), 얼굴 A만
사진3: bib 없음, 얼굴 B만

기대 결과:
- 사진1: bib A, 얼굴 A+B (얼굴별 bib 보류)
- 사진2: bib A, 얼굴 A
- 사진3: bib NONE (얼굴 매칭으로 결정 불가 → 보류)
```

### 시나리오 2: 단독 사진 → 그룹 사진

```
사진1: bib A (OCR 확정), 얼굴 A만
사진2: bib B (OCR 확정), 얼굴 B만
사진3: bib A (OCR 확정), 얼굴 A+B

기대 결과:
- 사진1: bib A, 얼굴 A
- 사진2: bib B, 얼굴 B
- 사진3: bib A, 얼굴 A+B (얼굴 A는 bib A, 얼굴 B는 보류 또는 얼굴 매칭으로 bib B)
```

### 시나리오 3: 얼굴 매칭 연쇄

```
사진1: bib A (OCR 확정), 얼굴 A만
사진2: bib 없음, 얼굴 A (얼굴 매칭으로 bib A 결정)
사진3: bib 없음, 얼굴 A+B (얼굴 A는 bib A, 얼굴 B는 보류)

기대 결과:
- 사진1: bib A, 얼굴 A
- 사진2: bib A (얼굴 매칭), 얼굴 A
- 사진3: bib A (얼굴 A 기준), 얼굴 A+B (얼굴 B는 보류)
```

## 구현 체크리스트

### 방안 2 구현 (그룹 사진 얼굴 보류 정책)

- [ ] 그룹 사진 감지 로직 (`faceIds.length > 1`)
- [ ] 그룹 사진 처리 분기 추가
- [ ] `PhotoFaces` 저장 시 bib 보류 로직 (`bib = undefined`)
- [ ] 단독 사진 처리 로직 유지
- [ ] 테스트 케이스 작성
- [ ] 문서 업데이트

### 방안 1 구현 (얼굴별 bib 할당 로직)

- [ ] 얼굴별 얼굴 매칭 득표 수집 함수
- [ ] 주인공 얼굴 선정 로직
- [ ] 얼굴별 bib 할당 로직
- [ ] `PhotoFaces` 얼굴별 저장 로직
- [ ] 성능 최적화 (배치 처리)
- [ ] 테스트 케이스 작성
- [ ] 문서 업데이트

## 관련 이슈

- [GSI_ByBib 업데이트 버그 수정](../spec/lambda-refactoring-analysis.md#63-index-faces-lambda-버그-수정-및-개선-사항)
- [SearchFaces 매칭 로직 개선](../spec/lambda-refactoring-analysis.md#63-index-faces-lambda-버그-수정-및-개선-사항)

## 참고 자료

- [lambda-refactoring-analysis.md](../spec/lambda-refactoring-analysis.md)
- [index-faces Lambda 구현](../../apps/infra/lambda/index-faces/index.ts)
