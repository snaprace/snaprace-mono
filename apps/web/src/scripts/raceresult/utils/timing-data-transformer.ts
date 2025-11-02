/**
 * RaceResult Timing 데이터 변환 로직
 */

import type { RaceResultTimingApiResponse } from "./raceresult-timing-api";

export interface TimingHeading {
  key: string;
  name: string;
  style?: string;
  hidden: boolean;
  tooltip?: string;
  nonSortable?: boolean;
  sortKey?: string;
}

export interface TimingResultSet {
  headings: TimingHeading[];
  resultSet: {
    extraFieldIds: number[];
    results: unknown[][];
  };
}

export interface IndexJson {
  event_id: string;
  event_name: string;
  organization_id: string;
  result_sets: Array<{
    id: string;
    category: string;
    s3_key: string;
  }>;
  updated_at: string;
}

/**
 * Contest 이름 추출 (groupFilters에서 추출, 실패 시 키에서 추출)
 */
function extractContestName(
  contestKey: string,
  groupFilters: RaceResultTimingApiResponse["groupFilters"],
): string {
  // groupFilters에서 Type: 1인 항목의 Values 배열에서 contest 이름 추출
  const contestFilter = groupFilters.find((filter) => filter.Type === 1);
  if (contestFilter && contestFilter.Values.length > 0) {
    // contestKey에서 인덱스 추출 (#1_5K -> 1)
    const match = contestKey.match(/^#(\d+)_/);
    if (match && match[1]) {
      const index = parseInt(match[1], 10) - 1; // 1-based to 0-based
      if (index >= 0 && index < contestFilter.Values.length) {
        const value = contestFilter.Values[index];
        if (value) return value;
      }
    }
  }

  // Fallback: 키에서 직접 추출 (#1_5K -> 5K)
  const fallbackMatch = contestKey.match(/^#\d+_(.+)$/);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1];
  }

  // 최종 fallback: 키 자체 사용
  return contestKey;
}

/**
 * Contest 이름을 파일명으로 변환 (5K -> 5k.json)
 */
function contestNameToFileName(contestName: string): string {
  return contestName.toLowerCase();
}

/**
 * Expression을 Mock Key로 매핑
 */
function expressionToMockKey(expression: string): string | null {
  const mapping: Record<string, string> = {
    "WithStatus([AutoRank.p])": "race_placement",
    Bib: "bib_num",
    DisplayName: "name",
    "Nation.Flag": "countrycode",
    Age: "age",
    "Finish.PACE": "avg_pace",
    "Finish.CHIP": "chip_time",
    "Finish.GUN": "clock_time",
  };

  return mapping[expression] || null;
}

/**
 * Expression에 대한 style 추론
 */
function inferStyle(expression: string, key: string): string | undefined {
  if (key === "race_placement" || key === "division_place") {
    return "place";
  }
  if (key === "bib_num") {
    return "bib";
  }
  if (key === "clock_time" || key === "chip_time" || key === "avg_pace") {
    return "time";
  }
  return undefined;
}

/**
 * Headings 생성
 */
function createHeadings(
  apiResponse: RaceResultTimingApiResponse,
): TimingHeading[] {
  const headings: TimingHeading[] = [];
  const Fields = apiResponse.list?.Fields;
  const { DataFields } = apiResponse;

  // Fields가 배열인지 확인
  if (!Array.isArray(Fields)) {
    console.warn("   ⚠️  Fields가 배열이 아닙니다. 기본 headings 사용");
    // Fields가 배열이 아니면 DataFields 기반으로 기본 headings 생성
    // Mock 파일 순서: race_placement, bib_num, name, profile_image_url, gender, age, city, state, countrycode, clock_time, chip_time, avg_pace, age_performance_percentage, division_place, division
    const defaultHeadings: TimingHeading[] = [
      { key: "race_placement", name: "Place", style: "place", hidden: false },
      { key: "bib_num", name: "Bib", style: "bib", hidden: false },
      { key: "name", name: "Name", hidden: false },
      { key: "profile_image_url", name: "Profile Image URL", hidden: true },
      { key: "gender", name: "Gender", hidden: false },
      { key: "age", name: "Age", hidden: false },
      { key: "city", name: "City", hidden: false },
      { key: "state", name: "State", hidden: false },
      { key: "countrycode", name: "Country", hidden: true },
      { key: "clock_time", name: "Clock\nTime", style: "time", hidden: false },
      { key: "chip_time", name: "Chip\nTime", style: "time", hidden: false },
      { key: "avg_pace", name: "Pace", style: "time", hidden: false },
      {
        key: "age_performance_percentage",
        name: "Age\nPercentage",
        tooltip:
          "This shows how well you performed based on your age.  Higher numbers are better, with 100% being the best.",
        hidden: true,
      },
      {
        key: "division_place",
        name: "Division\nPlace",
        style: "place",
        nonSortable: true,
        hidden: false,
      },
      {
        key: "division",
        name: "Division",
        nonSortable: true,
        hidden: false,
      },
    ];
    return defaultHeadings;
  }

  // 기본 필드 매핑 (표에 정의된 필드만)
  const fieldMapping: Record<string, string> = {
    "WithStatus([AutoRank.p])": "race_placement",
    Bib: "bib_num",
    DisplayName: "name",
    "Nation.Flag": "countrycode",
    Age: "age",
    "Finish.PACE": "avg_pace",
    "Finish.CHIP": "chip_time",
    "Finish.GUN": "clock_time",
  };

  // Fields 배열을 순회하며 headings 생성
  const fieldMap = new Map<string, TimingHeading>();

  for (const field of Fields) {
    const mockKey = expressionToMockKey(field.Expression);
    if (!mockKey) {
      continue; // 기본 필드가 아니면 스킵
    }

    const heading: TimingHeading = {
      key: mockKey,
      name: field.Label || field.Expression,
      style: inferStyle(field.Expression, mockKey),
      hidden: field.ResponsiveHide !== 0,
    };

    fieldMap.set(mockKey, heading);
  }

  // Mock 파일 순서대로 headings 재구성
  // 순서: race_placement, bib_num, name, profile_image_url, gender, age, city, state, countrycode, clock_time, chip_time, avg_pace, age_performance_percentage, division_place, division
  const orderedKeys = [
    "race_placement",
    "bib_num",
    "name",
    "profile_image_url",
    "gender",
    "age",
    "city",
    "state",
    "countrycode",
    "clock_time",
    "chip_time",
    "avg_pace",
    "age_performance_percentage",
    "division_place",
    "division",
  ];

  for (const key of orderedKeys) {
    if (fieldMap.has(key)) {
      headings.push(fieldMap.get(key)!);
    } else if (key === "profile_image_url") {
      headings.push({
        key: "profile_image_url",
        name: "Profile Image URL",
        hidden: true,
      });
    } else if (key === "gender") {
      headings.push({
        key: "gender",
        name: "Gender",
        hidden: false,
      });
    } else if (key === "city") {
      headings.push({
        key: "city",
        name: "City",
        hidden: false,
      });
    } else if (key === "state") {
      headings.push({
        key: "state",
        name: "State",
        hidden: false,
      });
    } else if (key === "age_performance_percentage") {
      headings.push({
        key: "age_performance_percentage",
        name: "Age\nPercentage",
        tooltip:
          "This shows how well you performed based on your age.  Higher numbers are better, with 100% being the best.",
        hidden: true,
      });
    } else if (key === "division_place") {
      headings.push({
        key: "division_place",
        name: "Division\nPlace",
        style: "place",
        nonSortable: true,
        hidden: false,
      });
    } else if (key === "division") {
      headings.push({
        key: "division",
        name: "Division",
        nonSortable: true,
        hidden: false,
      });
    }
  }

  return headings;
}

/**
 * Results 배열 생성 (그룹 병합, gender 정보 포함)
 */
function createResults(
  contestData: Record<string, unknown[][]>,
): Array<{ row: unknown[]; gender: string }> {
  const allResults: Array<{ row: unknown[]; gender: string }> = [];

  // Object.keys()는 삽입 순서를 보장하므로 API 응답 순서 유지
  for (const groupKey in contestData) {
    const groupData = contestData[groupKey];
    if (Array.isArray(groupData)) {
      // 그룹 키에서 gender 추출 (#1_Female -> Female -> F, #2_Male -> Male -> M)
      let gender = "";
      if (groupKey.includes("Female")) {
        gender = "F";
      } else if (groupKey.includes("Male")) {
        gender = "M";
      }

      // 각 그룹 내 순서 유지하며 추가
      for (const row of groupData) {
        allResults.push({ row, gender });
      }
    }
  }

  return allResults;
}

/**
 * 나이와 성별로 Division 계산
 */
function calculateDivision(
  age: unknown,
  gender: string,
  contestName: string,
): string {
  if (!age || gender === "") {
    return "";
  }

  const ageNum = typeof age === "string" ? parseInt(age, 10) : Number(age);
  if (isNaN(ageNum)) {
    return "";
  }

  const genderPrefix = gender === "F" ? "F" : gender === "M" ? "M" : "";
  if (!genderPrefix) {
    return "";
  }

  let ageGroup = "";
  if (ageNum <= 14) {
    ageGroup = "14&UND";
  } else if (ageNum <= 19) {
    ageGroup = "15-19";
  } else if (ageNum <= 29) {
    ageGroup = "20-29";
  } else if (ageNum <= 39) {
    ageGroup = "30-39";
  } else if (ageNum <= 49) {
    ageGroup = "40-49";
  } else if (ageNum <= 59) {
    ageGroup = "50-59";
  } else if (ageNum <= 69) {
    ageGroup = "60-69";
  } else {
    ageGroup = "70+";
  }

  return `${contestName}_${genderPrefix}${ageGroup}`;
}

/**
 * Contest별 데이터 변환
 */
export function transformContestData(
  contestKey: string,
  contestData: Record<string, unknown[][]>,
  apiResponse: RaceResultTimingApiResponse,
): TimingResultSet {
  const headings = createHeadings(apiResponse);
  const results = createResults(contestData);

  // Contest 이름 추출 (division 계산용)
  const contestName = extractContestName(contestKey, apiResponse.groupFilters);

  // Results 배열의 각 row를 headings 순서에 맞게 재정렬
  // Mock 파일 순서: race_placement, bib_num, name, profile_image_url, gender, age, city, state, countrycode, clock_time, chip_time, avg_pace, age_performance_percentage, division_place, division
  const { DataFields } = apiResponse;
  const reorderedResults = results.map(({ row, gender }) => {
    // DataFields 인덱스를 기준으로 필요한 필드만 추출
    const reorderedRow: unknown[] = [];

    // race_placement (DataFields[2]) - 숫자로 변환 (문자열에서 숫자만 추출)
    const placement = row[2];
    if (typeof placement === "string") {
      // "1." -> 1, "2." -> 2
      const match = placement.match(/(\d+)/);
      reorderedRow.push(match && match[1] ? parseInt(match[1], 10) : "");
    } else {
      reorderedRow.push(placement ?? "");
    }

    // bib_num (DataFields[3])
    reorderedRow.push(row[3] ?? "");

    // name (DataFields[4]) - 쉼표 제거
    const nameRaw = row[4];
    const name =
      typeof nameRaw === "string"
        ? nameRaw.replace(/,/g, "").trim()
        : (nameRaw ?? "");
    reorderedRow.push(name);

    // profile_image_url (없음)
    reorderedRow.push("");

    // gender (그룹 키에서 추출)
    reorderedRow.push(gender);

    // age (DataFields[6]) - 숫자로 변환
    const age = row[6];
    const ageNum = typeof age === "string" ? parseInt(age, 10) : Number(age);
    reorderedRow.push(isNaN(ageNum) ? "" : ageNum);

    // city (없음)
    reorderedRow.push("");

    // state (없음)
    reorderedRow.push("");

    // countrycode (DataFields[5], Nation.Flag)
    const countryFlag = row[5];
    if (typeof countryFlag === "string" && countryFlag.includes("flags/")) {
      // [img:flags/US.gif] -> US 추출
      const match = countryFlag.match(/flags\/([A-Z]{2})\./);
      reorderedRow.push(match ? match[1] : "");
    } else {
      reorderedRow.push("");
    }

    // clock_time (DataFields[10]) - Mock 파일에서는 clock_time이 먼저
    reorderedRow.push(row[10] ?? "");

    // chip_time (DataFields[9])
    const chipTime = (row[9] ?? "") as string;
    reorderedRow.push(chipTime);

    // avg_pace (DataFields[8]) - 비어있으면 chip_time과 거리로 계산 (mile 기준)
    let avgPace = (row[8] ?? "") as string;
    if (!avgPace || !avgPace.trim()) {
      const distanceMiles = extractDistanceFromContestName(contestName);
      avgPace = calculatePaceFromTimeAndDistance(chipTime, distanceMiles);
    }
    reorderedRow.push(avgPace);

    // age_performance_percentage (없음)
    reorderedRow.push("");

    // division_place (일단 빈 문자열, 나중에 계산)
    reorderedRow.push("");

    // division (나이와 성별로 계산)
    const division = calculateDivision(age, gender, contestName);
    reorderedRow.push(division);

    return reorderedRow;
  });

  // 전체 결과를 chip_time 기준으로 정렬하여 전체 순위(race_placement) 재계산
  const resultsWithIndex = reorderedResults.map((row, index) => ({
    row,
    index,
  }));

  // chip_time 기준으로 전체 정렬
  resultsWithIndex.sort((a, b) => {
    const chipTimeA = a.row[10] as string | undefined; // chip_time 인덱스
    const chipTimeB = b.row[10] as string | undefined;

    // 빈 문자열 처리
    if (!chipTimeA && !chipTimeB) return 0;
    if (!chipTimeA || typeof chipTimeA !== "string") return 1;
    if (!chipTimeB || typeof chipTimeB !== "string") return -1;

    // 시간 비교 (MM:SS 또는 HH:MM:SS 형식)
    return compareTime(chipTimeA, chipTimeB);
  });

  // 전체 순위(race_placement) 재계산
  resultsWithIndex.forEach((item, placeIndex) => {
    item.row[0] = placeIndex + 1; // race_placement는 첫 번째 요소
  });

  // Division별로 그룹화하여 division_place 계산
  const divisionGroups = new Map<
    string,
    Array<{ row: unknown[]; index: number }>
  >();

  resultsWithIndex.forEach(({ row, index }) => {
    const division = row[row.length - 1] as string; // division은 마지막 요소
    if (division) {
      if (!divisionGroups.has(division)) {
        divisionGroups.set(division, []);
      }
      divisionGroups.get(division)!.push({ row, index });
    }
  });

  // 각 division 내에서 chip_time 기준으로 정렬하여 division_place 계산
  divisionGroups.forEach((group) => {
    // chip_time 기준으로 정렬
    group.sort((a, b) => {
      const chipTimeA = a.row[10] as string | undefined; // chip_time 인덱스
      const chipTimeB = b.row[10] as string | undefined;

      // 빈 문자열 처리
      if (!chipTimeA && !chipTimeB) return 0;
      if (!chipTimeA || typeof chipTimeA !== "string") return 1;
      if (!chipTimeB || typeof chipTimeB !== "string") return -1;

      // 시간 비교 (MM:SS 또는 HH:MM:SS 형식)
      return compareTime(chipTimeA, chipTimeB);
    });

    // division_place 할당
    group.forEach((item, placeIndex) => {
      const divisionPlaceIndex = item.row.length - 2; // division_place는 division 앞
      item.row[divisionPlaceIndex] = String(placeIndex + 1);
    });
  });

  // 정렬된 결과를 다시 원래 배열로 변환
  const sortedResults = resultsWithIndex.map(({ row }) => row);

  return {
    headings,
    resultSet: {
      extraFieldIds: [],
      results: sortedResults,
    },
  };
}

/**
 * 시간 문자열을 초로 변환 (MM:SS 또는 HH:MM:SS)
 */
function parseTimeToSeconds(time: string): number {
  const parts = time.split(":");
  if (parts.length === 2) {
    // MM:SS
    const minutes = parts[0] ? parseInt(parts[0], 10) : 0;
    const seconds = parts[1] ? parseInt(parts[1], 10) : 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS
    const hours = parts[0] ? parseInt(parts[0], 10) : 0;
    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
    const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

/**
 * 시간 문자열 비교 (MM:SS 또는 HH:MM:SS)
 */
function compareTime(timeA: string, timeB: string): number {
  return parseTimeToSeconds(timeA) - parseTimeToSeconds(timeB);
}

/**
 * Contest 이름에서 거리(mile) 추출
 */
function extractDistanceFromContestName(contestName: string): number | null {
  // 5 Mile, 10 Mile 등 - 이미 mile 단위
  const mileMatch = contestName.match(/(\d+(?:\.\d+)?)\s*mile/i);
  if (mileMatch && mileMatch[1]) {
    return parseFloat(mileMatch[1]);
  }

  // 5K, 10K 등 - km를 mile로 변환
  const kmMatch = contestName.match(/(\d+(?:\.\d+)?)\s*K/i);
  if (kmMatch && kmMatch[1]) {
    const km = parseFloat(kmMatch[1]);
    return km / 1.60934; // Convert km to miles
  }

  // Half Marathon - km를 mile로 변환
  if (contestName.match(/half[\s-]?marathon/i)) {
    return 21.0975 / 1.60934; // Half marathon distance in miles (~13.1 miles)
  }

  // Marathon - km를 mile로 변환
  if (contestName.match(/^marathon$/i)) {
    return 42.195 / 1.60934; // Marathon distance in miles (~26.2 miles)
  }

  return null;
}

/**
 * chip_time과 거리로부터 pace 계산 (MM:SS/mile 형식)
 */
function calculatePaceFromTimeAndDistance(
  chipTime: string | undefined,
  distanceMiles: number | null,
): string {
  if (!chipTime || typeof chipTime !== "string" || !chipTime.trim()) {
    return "";
  }

  if (!distanceMiles || distanceMiles <= 0) {
    return "";
  }

  const totalSeconds = parseTimeToSeconds(chipTime);
  if (totalSeconds === 0) {
    return "";
  }

  // pace per mile in seconds
  const paceSecondsPerMile = totalSeconds / distanceMiles;
  const minutes = Math.floor(paceSecondsPerMile / 60);
  const seconds = Math.floor(paceSecondsPerMile % 60);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Index.json 생성
 */
export function createIndexJson(
  organizerId: string,
  eventId: string,
  eventName: string,
  contests: Array<{ contestName: string; fileName: string }>,
): IndexJson {
  const resultSets = contests.map((contest) => ({
    id: `${eventId}-${contest.fileName.replace(".json", "")}`,
    category: contest.contestName,
    s3_key: `${organizerId}/${eventId}/results/${contest.fileName}`,
  }));

  return {
    event_id: eventId,
    event_name: eventName,
    organization_id: organizerId,
    result_sets: resultSets,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Contest 이름 추출 및 파일명 변환
 */
export function extractContestNames(
  apiResponse: RaceResultTimingApiResponse,
): Array<{ contestKey: string; contestName: string; fileName: string }> {
  const contests: Array<{
    contestKey: string;
    contestName: string;
    fileName: string;
  }> = [];

  for (const contestKey in apiResponse.data) {
    const contestName = extractContestName(
      contestKey,
      apiResponse.groupFilters,
    );
    const fileName = `${contestNameToFileName(contestName)}.json`;

    contests.push({
      contestKey,
      contestName,
      fileName,
    });
  }

  return contests;
}
