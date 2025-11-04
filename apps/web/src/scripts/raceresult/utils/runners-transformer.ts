/**
 * 데이터 변환 유틸리티
 */

import type { RaceResultRecord } from "./raceresult-api";

export interface RunnerItem {
  bib_number: string; // Partition Key
  event_id: string; // Sort Key
  event_date: string;
  event_name: string;
  finish_time: string;
  name: string;
}

/**
 * RaceResult API 레코드를 DynamoDB RunnerItem으로 변환합니다.
 */
export function transformToRunnerItem(
  record: RaceResultRecord,
  eventInfo: {
    eventId: string;
    eventDate: string;
    eventName: string;
  }
): RunnerItem {
  // 필수 필드 검증
  if (!record.Bib) {
    throw new Error(`Bib 번호가 없습니다: ${JSON.stringify(record)}`);
  }

  if (!record["Finish Time"]) {
    throw new Error(`Finish Time이 없습니다: ${JSON.stringify(record)}`);
  }

  if (!record.Name) {
    throw new Error(`Name이 없습니다: ${JSON.stringify(record)}`);
  }

  return {
    bib_number: String(record.Bib),
    event_id: eventInfo.eventId,
    event_date: eventInfo.eventDate,
    event_name: eventInfo.eventName,
    finish_time: record["Finish Time"],
    name: record.Name,
  };
}

