/**
 * URL에서 사진 작가의 Instagram 아이디를 추출합니다.
 *
 * URL 형식: https://images.snap-race.com/.../photos/raw/@{instagram_id}-{additional_info}.jpg
 *
 * Instagram 아이디 규칙:
 * - "@"부터 시작해서 첫 번째 "-" 전까지가 Instagram ID
 *
 * @param photoUrl - 사진 URL
 * @returns Instagram 아이디 또는 null
 *
 * @example
 * extractInstagramId(".../@gconnelie_69-12345.jpg") // "gconnelie_69"
 * extractInstagramId(".../@j.valin-nyc-marathon.jpg") // "j.valin"
 * extractInstagramId(".../@agulosso_OMRC NYCM25-04659.jpg") // "agulosso_OMRC NYCM25"
 * extractInstagramId(".../@soyeon_is_so_young-DSCF3336.jpg") // "soyeon_is_so_young"
 */
export function extractInstagramId(photoUrl: string): string | null {
  try {
    // URL 디코딩 (특수문자 처리)
    const decodedUrl = decodeURIComponent(photoUrl);

    // 파일명 추출 (마지막 / 이후 부분)
    const filename = decodedUrl.split("/").pop();
    if (!filename) return null;

    // @ 찾기
    const atIndex = filename.indexOf("@");
    if (atIndex === -1) return null;

    // @ 이후 문자열
    const afterAt = filename.substring(atIndex + 1);

    // 첫 번째 하이픈(-) 찾기
    const hyphenIndex = afterAt.indexOf("-");
    if (hyphenIndex === -1) return null;

    // @부터 - 전까지 추출
    const instagramId = afterAt.substring(0, hyphenIndex);

    // 유효성 검사 (너무 짧거나 비어있는 경우 제외)
    if (!instagramId || instagramId.length < 2) return null;

    return instagramId;
  } catch (error) {
    console.error("Error extracting Instagram ID:", error);
    return null;
  }
}

/**
 * Instagram 프로필 URL을 생성합니다.
 *
 * @param instagramId - Instagram 아이디
 * @returns Instagram 프로필 URL
 */
export function getInstagramProfileUrl(instagramId: string): string {
  return `https://www.instagram.com/${instagramId}`;
}
