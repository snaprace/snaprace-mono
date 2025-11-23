# Selfie Search Implementation Plan

## 1. Overview
This document outlines the implementation of the Selfie Search feature in the frontend. Users can upload a selfie to find photos via AWS Rekognition. The feature integrates with the existing `PhotoGallery` component and uses the `useSelfieSearch` custom hook for state management.

## 2. User Flow

### 2.1 Entry Point
- **Component**: `SearchSelfieSection.tsx`
- **Locations**:
  - `[event]/page.tsx` (Full Gallery): Filter mode (Show only matched photos)
  - `[event]/[bib]/page.tsx` (Bib Gallery): Merge mode (Bib photos + Selfie matched photos)

### 2.2 Search Process
1. **Upload Trigger**: User clicks the upload area in `SearchSelfieSection`.
2. **Consent Modal**:
   - `FacialRecognitionConsentModal` appears (if not previously consented).
   - Consent status stored in `localStorage`.
3. **Image Processing & Search**:
   - Client-side resizing (optimization).
   - Call `searchBySelfie` tRPC mutation.
   - State: `isSearching: true`.
4. **Result Handling**:
   - **Success**:
     - Toast: "Found N photos!"
     - Gallery updates (Merge/Filter logic).
     - Matched photos get a **"Selfie" badge** on the top-left corner.
     - UI: Show success state + "Upload another" button.
   - **No Matches**:
     - Toast: "No matching photos found."
     - UI: Show no match warning + Retry button.
   - **Error**:
     - Toast: "An error occurred. Please try again."

## 3. State Management (`useSelfieSearch` Hook)

### 3.1 State Interface
```typescript
interface SelfieSearchState {
  isSearching: boolean;
  foundPhotos: Photo[]; // List of matched photos
  searchCount: number;
  lastSearchedImage: string | null; // Base64 or object URL
  isConsentGiven: boolean;
}
```

### 3.2 Actions
- `search(file: File)`: Resize -> tRPC call -> Update state
- `reset()`: Clear search results
- `checkConsent()`: Check/Update localStorage

## 4. Gallery Integration (`PhotoGallery.tsx`)

### 4.1 Data Merging Strategy
- **Photo Object Extension**: Add `isSelfieMatch?: boolean` to the `Photo` interface/type locally or extend it.
- **Display Logic**:
  - `[event]/page.tsx`:
    - If search active: Show `foundPhotos` only.
    - Default: Show `allPhotos`.
  - `[event]/[bib]/page.tsx`:
    - Merge `bibPhotos` + `foundPhotos`.
    - Deduplication key: `id`.
    - Sort by `createdAt` (descending).

## 5. Components

### 5.1 `SearchSelfieSection`
- Handles file input and drag-and-drop.
- Displays loading, success, and error states.
- Triggers `FacialRecognitionConsentModal` before search.

### 5.2 `GalleryImage` (Update)
- Add "Selfie" badge overlay if `photo.isSelfieMatch` is true.

## 6. Implementation Steps
1. **`useSelfieSearch` Hook**: Implement core logic (resizing, API call).
2. **`PhotoGallery` Integration**: Connect hook, implement merge logic.
3. **`SearchSelfieSection` Update**: Connect to hook state.
4. **UI Updates**: Add "Selfie" badge to gallery items.
