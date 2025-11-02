/**
 * RaceResult API 클라이언트
 */

export interface RaceResultRecord {
  Contest: string;
  Bib: number;
  Name: string;
  Hometown: string;
  Age: number;
  Gender: string;
  AG: string;
  "Start Time": string;
  "Finish Time": string;
  "Course Time Chip": string;
  "Course Time Gun": string;
}

/**
 * RaceResult API에서 레이스 결과 데이터를 가져옵니다.
 */
export async function fetchRaceResultData(
  eventId: string,
  apiKey: string,
  maxRetries = 3
): Promise<RaceResultRecord[]> {
  const url = `https://api.raceresult.com/${eventId}/${apiKey}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   API 호출 시도 ${attempt}/${maxRetries}: ${url}`);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `RaceResult API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid API response format: expected array");
      }

      // 빈 배열 확인
      if (data.length === 0) {
        console.warn("⚠️  API 응답이 비어있습니다.");
        return [];
      }

      console.log(`   ✅ ${data.length}개 레코드 수신 완료`);
      return data as RaceResultRecord[];
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // 지수 백오프: 1초, 2초, 4초
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`   ⏳ 재시도 전 대기 중... (${delay}ms)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
}

