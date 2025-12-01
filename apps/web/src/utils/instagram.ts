/**
 * Instagram handle을 표시용 포맷과 URL로 변환합니다.
 * @param handle - Instagram handle (@ 포함 또는 미포함)
 * @returns displayHandle (@가 붙은 표시용)과 instagramUrl (프로필 링크)
 */
export function formatInstagramHandle(handle: string | null | undefined): {
  displayHandle: string | null;
  instagramUrl: string | null;
} {
  if (!handle) {
    return { displayHandle: null, instagramUrl: null };
  }

  const displayHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const instagramUrl = `https://www.instagram.com/${handle.replace("@", "")}/`;

  return { displayHandle, instagramUrl };
}
