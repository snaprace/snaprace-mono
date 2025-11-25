---
description: 사진 갤러리 구현 작업 목록
---

# 사진 갤러리 구현 작업 목록 (Photo Gallery Implementation Tasks)

`apps/web/docs/PHOTO_GALLERY_IMPLEMENTATION.md`의 계획을 기반으로 합니다.

- [ ] **Task 1: 백엔드 통합 (Backend Integration)** <!-- id: 1 -->
  - `apps/web/src/server/services/photo-service.ts`의 `PhotoService.getPhotosByEvent` 및 `getPhotosByBib` 메서드를 업데이트하여 `dimensions` 필드의 `width`와 `height`를 반환하도록 수정합니다.
  - 반환 타입에 이 필드들이 포함되도록 확인합니다.

- [ ] **Task 2: 컴포넌트 스캐폴딩 (Component Scaffolding)** <!-- id: 2 -->
  - `apps/web/src/app/events/[event]/_components/PhotoGallery.tsx` 생성/업데이트.
  - `Photo` 타입 인터페이스 정의.
  - `photos` 상태와 `loadMore` 플레이스홀더를 포함한 기본 컴포넌트 구조 설정.

- [ ] **Task 3: Masonry 그리드 구현 (Masonry Grid Implementation)** <!-- id: 3 -->
  - `InfiniteScroll` 내부에 `MasonryPhotoAlbum` 구현 (싱글톤 패턴).
  - `next/image`와 구체적인 `sizes` prop을 사용하여 `renderNextImage` 구현:
    - `(max-width: 480px) 240px`
    - `(max-width: 768px) 360px`
    - `(max-width: 1280px) 640px`
    - `1024px`
  - 반응형 컬럼 로직 구현:
    - < 834px: 2 컬럼
    - < 1034px: 3 컬럼
    - < 1534px: 4 컬럼
    - >= 1535px: 5 컬럼
  - `trpc.photosV2.getByEvent` (또는 `getByBib`)를 통해 실제 데이터 연결.

- [ ] **Task 4: 라이트박스 구현 (Lightbox Implementation)** <!-- id: 4 -->
  - `yet-another-react-lightbox` 통합.
  - `photoId`에 대한 URL 상태 관리 구현 (열기/닫기/슬라이드).
  - 브라우저 뒤로 가기 동작 처리.

- [ ] **Task 5: 공유 요소 전환 (Shared Element Transitions)** <!-- id: 5 -->
  - 그리드 이미지에 `framer-motion`의 `layoutId` 추가.
  - `layoutId` 전환을 지원하도록 라이트박스 슬라이드 커스터마이징.

- [ ] **Task 6: 다듬기 (Refinement)** <!-- id: 6 -->
  - 스크롤 동기화 구현 (라이트박스 인덱스에 맞춰 백그라운드 그리드 스크롤).
  - 스타일 및 애니메이션 최종 수정.
