/**
 * URL에서 사진 작가의 Instagram 아이디를 추출합니다.
 *
 * URL 형식: https://images.snap-race.com/.../photos/raw/@{instagram_id}_{additional_info}.jpg
 *
 * Instagram 아이디 규칙:
 * - 영문자(a-z, A-Z), 숫자(0-9), 점(.), 언더스코어(_)만 포함 가능
 * - 하이픈(-), 공백 등이 나오면 아이디 끝으로 간주
 * - 언더스코어/점 다음에 대문자 2개 이상 연속이면 추가 정보로 간주하여 제외
 *
 * @param photoUrl - 사진 URL
 * @returns Instagram 아이디 또는 null
 *
 * @example
 * extractInstagramId(".../@gconnelie_69-12345.jpg") // "gconnelie_69"
 * extractInstagramId(".../@j.valin-nyc-marathon.jpg") // "j.valin"
 * extractInstagramId(".../@agulosso_OMRC NYCM25-04659.jpg") // "agulosso"
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

    // Instagram 아이디 추출 (영문자, 숫자, 점, 언더스코어만)
    // 하이픈(-), 공백, 기타 특수문자가 나오면 중단
    const match = /^[a-zA-Z0-9._]+/.exec(afterAt);

    if (!match) return null;

    let instagramId = match[0];

    // 언더스코어나 점 다음에 대문자 2개 이상 연속이 나오면 거기서 끊기
    // 예: agulosso_OMRC → agulosso
    const uppercaseAcronymMatch = /^(.+?)[._]([A-Z]{2,}.*)/.exec(instagramId);
    if (uppercaseAcronymMatch) {
      instagramId = uppercaseAcronymMatch[1] || instagramId;
    }

    // 유효성 검사 (너무 짧거나 점/언더스코어만 있는 경우 제외)
    if (instagramId.length < 2) return null;
    if (/^[._]+$/.test(instagramId)) return null;

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
