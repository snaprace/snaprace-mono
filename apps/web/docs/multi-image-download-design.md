# Multi-Image Download Feature Design

## 1. Overview
The goal is to implement a bulk download feature for the Photo Gallery, allowing users to select multiple images and download them efficiently. The UI/UX will emulate **Google Photos**, providing a seamless and intuitive selection experience.

**Key Constraints:**
- **Desktop Only**: Bulk selection and download features will be disabled on mobile devices.
- **Download Logic**:
    - **Level 1 (Continuous)**: For small batches, images are downloaded individually in sequence.
    - **Level 2 (Zip)**: For larger batches, images are bundled into a single ZIP file.

## 2. User Experience (UX) & UI

### 2.1 Interaction Model (Google Photos Style)
1.  **Hover State**: On desktop, hovering over an image reveals a circular "checkmark" button in the top-left (or top-right) corner of the thumbnail.
2.  **Selection**: Clicking the checkmark selects the image and enters **"Selection Mode"**.
3.  **Active Selection**:
    - When at least one image is selected, the "checkmark" persists on all selected images.
    - Unselected images show the checkmark on hover (or always visible in a "dimmed" state to encourage addition).
    - **Shift + Click**: (Nice to have) Allows selecting a range of photos.
4.  **Floating Action Bar**:
    - A floating bar (or sticky header) appears when items are selected.
    - **Left**: "X Selected" count and a "Close/Deselect All" button.
    - **Right**: Action buttons, specifically **"Download"**.

### 2.2 Mobile Behavior
- The bulk download features will be completely hidden.
- `useIsMobile()` hook will be used to conditionally render the selection UI.

## 3. Technical Policy: Download Levels

The download strategy is determined dynamically based on the number of selected items.

### Level 1: Continuous Download
- **Condition**: `Selected Count <= 5`
- **Behavior**:
    - The client iterates through the selected URLs.
    - Triggers a browser download for each file individually.
    - A small delay (e.g., 500ms) might be added between requests to ensure browser stability.
- **Pros**: Instant start, no client-side processing overhead.
- **Cons**: User might receive multiple "Allow downloads" prompts depending on browser settings (though typically allowed after the first interaction).

### Level 2: ZIP Archive
- **Condition**: `Selected Count > 5`
- **Behavior**:
    - A progress indicator (Toast or Modal) appears: "Preparing download... (X/Y)".
    - Images are fetched as Blobs in parallel (with concurrency limit).
    - Blobs are added to a JSZip instance.
    - A single `.zip` file is generated and downloaded.
- **Naming**: `snaprace-photos-[date].zip` (or similar event-based name).
- **Libraries**: `jszip` (already installed), `file-saver` (already installed).

## 4. Architecture & Implementation Plan

### 4.1 Data Structures
State management will reside in `PhotoGallery.tsx` or a new hook `usePhotoSelection`.

```typescript
// State in PhotoGallery.tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const isSelectionMode = selectedIds.size > 0;

// Handlers
const toggleSelection = (id: string) => {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  setSelectedIds(next);
};
```

### 4.2 Component Updates

#### `PhotoGallery.tsx` (Container)
- **Role**: Manages selection state.
- **Changes**:
    - Add `selectedIds` state.
    - Render the **Selection Action Bar** (conditional on `selectedIds.size > 0`).
    - Pass selection props to `GalleryGrid`.

#### `GalleryGrid.tsx`
- **Role**: Prop drill selection props to existing Masonry logic.
- **Changes**:
    - Accept `selectedIds`, `onToggleSelection`, `isSelectionMode`.
    - Pass these to `MasonryImage` via the `render.image` prop or `render.extras` (if supported by library) or context. *Note: `react-photo-album` renders custom components, so we can pass extra props explicitly if we wrap the render function.*

#### `MasonryImage.tsx`
- **Role**: Render the visual checkmark.
- **Changes**:
    - Access `selectedIds` (or receive `isSelected` prop).
    - Render a customized **Checkbox** component overlay.
    - **Visuals**:
        - Default: Hidden.
        - Hover: Visible (Grey outlining).
        - Selected: Visible (filled Blue with Check).
    - Handle `onClick` on the checkbox to prevent opening the lightbox.

### 4.3 New Hook: `useBulkDownloader`
Located in `@/hooks/useBulkDownloader.ts`.

```typescript
export function useBulkDownloader() {
  const downloadLevel1 = async (photos: Photo[]) => { ... }
  const downloadLevel2 = async (photos: Photo[]) => {
     // Uses JSZip
     // Tracks progress
  }

  const downloadSelected = async (photos: Photo[]) => {
    if (photos.length <= 5) return downloadLevel1(photos);
    return downloadLevel2(photos);
  }

  return { downloadSelected, isDownloading, progress };
}
```

## 5. Implementation Steps

1.  **Scaffold Hook**: Create `useBulkDownloader` with Level 1 and Level 2 logic.
2.  **State Management**: Update `PhotoGallery` to track selections.
3.  **UI Components**:
    - Create `SelectionBar` (or inline component).
    - Update `MasonryImage` to support selection mode.
4.  **Integration**: Connect the download button in `SelectionBar` to `useBulkDownloader`.
5.  **Desktop Gate**: Ensure `!isMobile` check wraps all entry points.

## 6. Edge Cases
- **Failed Downloads**: If one image fails in Level 2, continue and report/log error? (Implementation: Try-catch inside the fetch loop, maybe add a text file in zip listing failed URLs).
- **Large Files**: Level 2 might be memory intensive. `JSZip` mostly handles this, but we should ensure we don't crash the tab for 100+ items. *Limit*: Maybe max 50 items for now? Or just rely on user machine.
