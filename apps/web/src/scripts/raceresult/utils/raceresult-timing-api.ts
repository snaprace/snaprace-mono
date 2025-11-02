/**
 * RaceResult Timing API 클라이언트
 */

export interface RaceResultTimingApiResponse {
  list: {
    ListName: string;
    Fields: Array<{
      Expression: string;
      Label: string;
      Label2: string;
      Alignment: number;
      FontBold: boolean;
      FontItalic: boolean;
      FontUnderlined: boolean;
      Line: number;
      Color: string;
      Link: string;
      ColSpan: number;
      ColOffset: number;
      Position: number;
      DynamicFormat: string;
      PreviewOnly: boolean;
      ResponsiveHide: number;
    }>;
    Orders: unknown[];
    Filters: unknown[];
  };
  data: Record<string, Record<string, unknown[][]>>;
  DataFields: string[];
  mid: number;
  groupFilters: Array<{
    Type: number;
    Value: string;
    Values: string[];
  }>;
  comments: Record<string, unknown>;
  LiveUpdateInterval: number;
}

/**
 * RaceResult Timing API에서 타임링 데이터를 가져옵니다.
 */
export async function fetchRaceResultTimingData(
  eventId: string,
  apiKey: string,
  listname: string,
  options: {
    contest?: number;
    r?: string;
    l?: number;
  } = {},
  maxRetries = 3,
): Promise<RaceResultTimingApiResponse> {
  const { contest = 0, r = "leaders", l = 1000 } = options;

  // listname URL 인코딩
  const encodedListname = encodeURIComponent(listname);
  const url = `https://my1.raceresult.com/${eventId}/RRPublish/data/list?key=${apiKey}&listname=${encodedListname}&page=results&contest=${contest}&r=${r}&l=${l}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   API 호출 시도 ${attempt}/${maxRetries}`);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `RaceResult API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as RaceResultTimingApiResponse;

      // 응답 검증
      if (!data.data || !data.DataFields || !data.groupFilters) {
        throw new Error("Invalid API response format: missing required fields");
      }

      // 디버깅: 응답 구조 확인
      if (process.env.DEBUG) {
        console.log("   🔍 API 응답 구조 확인:");
        console.log(
          `      - list.Fields 타입: ${Array.isArray(data.list?.Fields) ? "배열" : typeof data.list?.Fields}`,
        );
        console.log(`      - DataFields 개수: ${data.DataFields?.length || 0}`);
        console.log(
          `      - Contest 개수: ${Object.keys(data.data || {}).length}`,
        );
      }

      console.log(`   ✅ API 응답 수신 완료`);
      return data;
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
