import { useState, useCallback, useMemo } from "react";

export function usePhotoSelection(photos: string[]) {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const togglePhotoSelection = useCallback((index: number) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIndices = new Set(photos.map((_, index) => index));
    setSelectedPhotos(allIndices);
  }, [photos]);

  const clearSelection = useCallback(() => {
    setSelectedPhotos(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => !prev);
    if (isSelectionMode) {
      // Clear selection when exiting selection mode
      clearSelection();
    }
  }, [isSelectionMode, clearSelection]);

  const getSelectedPhotoUrls = useMemo(() => {
    return Array.from(selectedPhotos)
      .sort((a, b) => a - b)
      .map((index) => photos[index])
      .filter((url): url is string => Boolean(url));
  }, [selectedPhotos, photos]);

  const isPhotoSelected = useCallback(
    (index: number) => {
      return selectedPhotos.has(index);
    },
    [selectedPhotos]
  );

  return {
    selectedPhotos,
    selectedCount: selectedPhotos.size,
    isSelectionMode,
    togglePhotoSelection,
    selectAll,
    clearSelection,
    toggleSelectionMode,
    getSelectedPhotoUrls,
    isPhotoSelected,
  };
}