# 사진 갤러리 구현 계획 (Photo Gallery Implementation Plan)

## 개요 (Overview)
이 문서는 `apps/web`에서 Google Photos와 유사한 고성능 사진 갤러리를 구축하기 위한 구현 계획을 설명합니다. 이 갤러리는 Masonry 레이아웃, 네이티브 무한 스크롤, URL 동기화 라이트박스(Lightbox), 그리고 Framer Motion을 활용한 공유 요소 전환(Shared Element Transitions) 기능을 포함합니다.

## 기술 스택 및 라이브러리 (Tech Stack & Libraries)
- **프레임워크:** Next.js 15+ (App Router)
- **스타일링:** Tailwind CSS
- **핵심 라이브러리:**
  - `react-photo-album` (Masonry 레이아웃)
  - `yet-another-react-lightbox` (이미지 뷰어)
  - `framer-motion` (애니메이션)

## 1. 데이터 구조 (Data Structure)
실제 백엔드 데이터(`PhotoService`)를 우선적으로 사용합니다.
테스트를 위해 `organizerId: winningeventsgroup`, `eventId: run-for-liberty-5k-2025`를 사용할 수 있습니다.
다양한 종횡비 테스트가 필요한 경우에만 Mock 데이터를 보조적으로 사용합니다.

**Photo 타입 정의:**
```typescript
export type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
};
```

## 2. 백엔드 통합 요구사항 (Backend Integration)
CLS 방지를 위해 `PhotoService`가 이미지의 `width`와 `height`를 반환하도록 수정해야 합니다.
`PhotoService.getPhotosByEvent` 및 `getPhotosByBib` 메서드에서 `dimensions` 필드를 매핑에 추가합니다.

```typescript
// apps/web/src/server/services/photo-service.ts 수정 예정
{
  // ...
  width: item.dimensions.width,
  height: item.dimensions.height,
  // blurDataURL은 현재 없으므로 클라이언트에서 생성하거나 기본값 사용
}
```

## 3. 컴포넌트 아키텍처 (Component Architecture)

### `PhotoGallery.tsx`
상태 관리, 데이터 페칭(Mock), 그리드와 라이트박스 간의 조정을 담당하는 메인 컨테이너 컴포넌트입니다.

**위치:** `apps/web/src/app/events/[event]/_components/PhotoGallery.tsx`

**주요 역할:**
- `photos` 상태 관리 (누적된 리스트).
- 라이트박스 `index` 상태 관리 (URL에서 파생됨).
- 무한 스크롤을 위한 `loadMore` 처리.
- URL과 라이트박스 상태(`photoId`) 동기화.

### `PhotoGrid.tsx` (내부 또는 인라인)
`InfiniteScroll`로 감싸진 `MasonryPhotoAlbum`을 렌더링합니다.

**주요 Props:**
- `photos`: `Photo[]`
- `onPhotoClick`: `(index: number) => void`
- `loadMore`: `() => void`

### `PhotoLightbox.tsx` (내부 또는 인라인)
`Lightbox` 컴포넌트를 렌더링합니다.

**주요 Props:**
- `index`: `number` (현재 사진 인덱스)
- `open`: `boolean`
- `close`: `() => void`
- `slides`: `Photo[]`

## 4. 기능 구현 상세 (Feature Implementation Details)

### A. 레이아웃 및 네이티브 무한 스크롤
`InfiniteScroll` 내부에서 `react-photo-album`의 **싱글톤 패턴(Singleton Pattern)**을 사용합니다.

```tsx
import { MasonryPhotoAlbum } from "react-photo-album";
import InfiniteScroll from "react-photo-album/scroll";

// ...
<InfiniteScroll
  photos={photos}
  loadMore={loadMore}
  hasMore={hasMore}
  // ... 기타 props
>
  <MasonryPhotoAlbum
    photos={[]} // 싱글톤 패턴에 따라 빈 배열 전달
    // ... 레이아웃 props
    render={{ image: renderNextImage }}
  />
</InfiniteScroll>
```

**반응형 (Responsiveness):**
컨테이너 너비에 따라 `columns` 수를 다음과 같이 동적으로 계산합니다:
- **~ 834px**: 2 컬럼
- **~ 1034px**: 3 컬럼
- **~ 1534px**: 4 컬럼
- **1535px ~**: 5 컬럼

```tsx
const columns = (containerWidth: number) => {
  if (containerWidth < 834) return 2;
  if (containerWidth < 1034) return 3;
  if (containerWidth < 1534) return 4;
  return 5;
};
```

### B. 이미지 최적화 (Image Optimization)
`next/image`의 `sizes` prop을 다음과 같이 구성하여 뷰포트에 따라 적절한 크기의 이미지를 로드하도록 합니다.
목표 해상도: **Small (240px), Medium (360px), Large (640px), XLarge (1024px)**

```tsx
// 예시 sizes 설정 (컬럼 수와 뷰포트 너비에 맞춰 조정)
const sizes = `
  (max-width: 480px) 240px,   // 모바일 (2컬럼 가정 시 small)
  (max-width: 768px) 360px,   // 태블릿 (2-3컬럼 가정 시 medium)
  (max-width: 1280px) 640px,  // 데스크탑 (3-4컬럼 가정 시 large)
  1024px                      // 대형 화면 (xlarge)
`;

function renderNextImage({ alt = "", title, sizes: _sizes, className, onClick }: RenderImageProps, { photo, width, height }: RenderImageContext) {
  return (
    <div
      style={{ width: "100%", position: "relative", aspectRatio: `${width} / ${height}` }}
      className={className}
    >
      <Image
        fill
        src={photo.src}
        alt={alt}
        title={title}
        sizes={sizes} // 위에서 정의한 커스텀 sizes 적용
        placeholder="blur"
        blurDataURL={photo.blurDataURL}
        onClick={onClick}
      />
    </div>
  );
}
```

### C. 라이트박스 및 URL 상태 (Lightbox & URL State)
- **상태의 단일 진실 공급원 (Source of Truth):** URL 쿼리 파라미터 `?photoId={id}`.
- **네비게이션:**
  - 열기 (Open): `router.push(..., { scroll: false })`
  - 닫기 (Close): `router.push(originalPath, { scroll: false })`
  - 슬라이드 (Slide): `router.replace(..., { scroll: false })` (히스토리 오염 방지)
- **뒤로 가기 버튼:** `push`로 열기 때문에 브라우저 히스토리에 의해 자동으로 처리됩니다.

### D. 공유 요소 전환 (Shared Element Transition)
`framer-motion`의 `layoutId`를 사용합니다.

**그리드 아이템:**
`Image`를 `motion.div`로 감싸고 `layoutId={`photo-${photo.id}`}`를 부여합니다.

**라이트박스:**
라이트박스 슬라이드에 매칭되는 `motion.img` 또는 `motion.div`를 포함하도록 커스터마이징합니다.
*참고: `yet-another-react-lightbox`는 슬라이드를 특정 방식으로 렌더링합니다. 기본 페이드 효과를 비활성화하고 커스텀 렌더 함수나 오버레이를 사용하여 공유 요소 효과를 완벽하게 구현하거나, 커스텀 슬라이드 렌더러 내의 이미지에 `layoutId`를 적용해야 할 수 있습니다.*

### E. 스크롤 동기화 (Scroll Synchronization)
라이트박스 인덱스가 변경되면(사용자가 슬라이드하면), 해당 그리드 아이템을 ID로 찾아 백그라운드 컨테이너에서 `scrollIntoView({ behavior: "auto", block: "center" })`를 호출합니다. 이를 통해 사용자가 라이트박스를 닫았을 때 올바른 위치에 있도록 보장합니다.

## 5. 구현 단계 (Implementation Steps)

1.  **Mock 데이터 설정:** `mock-photos.ts`에 `generatePhotos` 함수 생성.
2.  **컴포넌트 스캐폴딩:** `PhotoGallery.tsx`의 기본 구조 생성.
3.  **그리드 구현:** `MasonryPhotoAlbum`, `InfiniteScroll`, `next/image` 렌더링 구현.
4.  **라이트박스 구현:** `Lightbox` 추가 및 URL 상태(`useSearchParams`, `useRouter`) 연결.
5.  **전환 효과 추가:** 열기/닫기 애니메이션을 위한 `framer-motion` 통합.
6.  **다듬기:** 스크롤 동기화 추가 및 스타일 개선.

## 6. 코드 구조 (검토용 단일 파일)
최종 구현은 검토의 편의를 위해 `apps/web/src/app/events/[event]/_components/PhotoGallery.tsx` (및 별도의 mock 파일)로 통합하되, 내부적으로는 모듈화된 구조를 가집니다.
