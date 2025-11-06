/**
 * JSON 데이터를 DynamoDB RunnersV2 테이블에 저장하는 스크립트
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  type BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
/**
 * RunnerItem 타입 정의 (RunnersV2 테이블용)
 * apps/infra/lambda/shared/types.ts와 동일
 */
interface RunnerItem {
  // === 기본 키 (필수) ===
  pk: string; // "ORG#org123#EVT#event456"
  sk: string; // "BIB#0001" (제로 패딩)

  // === GSI 키 (GSI 사용 시 필수) ===
  gsi1pk?: string; // "RUNNER#runner789"
  gsi1sk?: string; // "EVT#org123#event456"

  // === 프로젝션된 속성 (GSI에서 사용) ===
  bib_number: string; // "1" (제로 패딩 제거된 실제 번호)
  name: string; // "John Doe"
  finish_time_sec?: number; // 3600 (1시간 = 3600초)
  event_id: string; // "event456"
  event_date: string; // "8/28/25"
  event_name: string; // "Happy Hour Hustle Week4 2025"

  // === 선택적 편의 필드 ===
  organizer_id?: string; // "org123" (pk에서 파싱 가능하지만 편의를 위해)
  runner_id?: string; // "runner789" (gsi1pk에서 파싱 가능하지만 편의를 위해)
}

interface RaceResultRecord {
  Contest: string;
  Bib: number;
  Name: string;
  Hometown?: string;
  Age?: number;
  Gender?: string;
  AG?: string;
  "Start Time"?: string;
  "Finish Time"?: string;
  "Course Time Chip"?: string;
  "Course Time Gun"?: string;
}

interface CliArgs {
  organizerId: string;
  eventId: string;
  eventDate: string;
  eventName: string;
  dataFile: string;
  tableName?: string;
}

const BATCH_SIZE = 25; // DynamoDB BatchWriteItem 최대 크기
const MAX_RETRIES = 3;

/**
 * DynamoDB 클라이언트 생성
 */
function createDynamoDBClient(): DynamoDBDocumentClient {
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  const client = new DynamoDBClient({
    region,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }
      : {}),
  });

  return DynamoDBDocumentClient.from(client);
}

/**
 * 시간 문자열을 초 단위로 변환
 * "MM:SS" 또는 "H:MM:SS" 또는 "HH:MM:SS" 형식 지원
 */
function parseTimeToSeconds(timeStr?: string): number | undefined {
  if (!timeStr || timeStr.trim() === "") {
    return undefined;
  }

  // 빈 문자열이나 "-" 같은 경우 처리
  if (timeStr === "-" || timeStr === "") {
    return undefined;
  }

  const parts = timeStr.split(":").map((p) => {
    const parsed = parseInt(p, 10);
    return isNaN(parsed) ? undefined : parsed;
  });

  // undefined가 포함되어 있으면 파싱 실패
  if (parts.some((p) => p === undefined)) {
    return undefined;
  }

  if (parts.length === 2) {
    // MM:SS 형식
    const minutes = parts[0]!;
    const seconds = parts[1]!;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // H:MM:SS 또는 HH:MM:SS 형식
    const hours = parts[0]!;
    const minutes = parts[1]!;
    const seconds = parts[2]!;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return undefined;
}

/**
 * Bib 번호를 제로 패딩 (최소 4자리)
 */
function zeroPadBib(bib: number | string): string {
  const bibStr = String(bib);
  return bibStr.padStart(4, "0");
}

/**
 * RaceResult 레코드를 RunnerItem으로 변환
 */
function transformToRunnerItem(
  record: RaceResultRecord,
  eventInfo: {
    organizerId: string;
    eventId: string;
    eventDate: string;
    eventName: string;
  },
): RunnerItem {
  // 필수 필드 검증
  if (!record.Bib) {
    throw new Error(`Bib 번호가 없습니다: ${JSON.stringify(record)}`);
  }

  if (!record.Name) {
    throw new Error(`Name이 없습니다: ${JSON.stringify(record)}`);
  }

  const bibNumber = String(record.Bib);
  const zeroPaddedBib = zeroPadBib(record.Bib);
  const finishTimeSec = parseTimeToSeconds(record["Course Time Chip"]);

  // pk: "ORG#org123#EVT#event456"
  const pk = `ORG#${eventInfo.organizerId}#EVT#${eventInfo.eventId}`;

  // sk: "BIB#0001" (제로 패딩)
  const sk = `BIB#${zeroPaddedBib}`;

  // ULID 생성 (각 러너마다 고유한 ID)
  const runnerId = ulid();

  // gsi1pk: "RUNNER#<ulid>"
  const gsi1pk = `RUNNER#${runnerId}`;

  // gsi1sk: "EVT#<organizer_id>#<event_id>"
  const gsi1sk = `EVT#${eventInfo.organizerId}#${eventInfo.eventId}`;

  const runnerItem: RunnerItem = {
    pk,
    sk,
    gsi1pk,
    gsi1sk,
    bib_number: bibNumber,
    name: record.Name,
    event_id: eventInfo.eventId,
    event_date: eventInfo.eventDate,
    event_name: eventInfo.eventName,
    organizer_id: eventInfo.organizerId,
    runner_id: runnerId,
  };

  // finish_time_sec이 있으면 추가
  if (finishTimeSec !== undefined) {
    runnerItem.finish_time_sec = finishTimeSec;
  }

  return runnerItem;
}

/**
 * 배치로 DynamoDB에 Runner 항목들을 저장합니다.
 */
async function batchSaveRunners(
  items: RunnerItem[],
  tableName: string,
): Promise<{ success: number; failed: number }> {
  const docClient = createDynamoDBClient();
  let success = 0;
  let failed = 0;

  // 25개씩 배치 처리
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(items.length / BATCH_SIZE);

    console.log(
      `   배치 ${batchNumber}/${totalBatches} 처리 중... (${batch.length}개 항목)`,
    );

    const requests = batch.map((item) => ({
      PutRequest: {
        Item: item,
      },
    }));

    const commandInput: BatchWriteCommandInput = {
      RequestItems: {
        [tableName]: requests,
      },
    };

    try {
      await docClient.send(new BatchWriteCommand(commandInput));
      success += batch.length;
      console.log(`   ✅ 배치 ${batchNumber} 완료`);
    } catch (error) {
      console.error(`   ❌ 배치 ${batchNumber} 실패:`, error);

      // 개별 항목으로 재시도
      const individualResults = await saveItemsIndividually(
        docClient,
        batch,
        tableName,
      );
      success += individualResults.success;
      failed += individualResults.failed;
    }
  }

  return { success, failed };
}

/**
 * 개별 항목으로 저장 (배치 실패 시 사용)
 */
async function saveItemsIndividually(
  docClient: DynamoDBDocumentClient,
  items: RunnerItem[],
  tableName: string,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const item of items) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: [
                {
                  PutRequest: {
                    Item: item,
                  },
                },
              ],
            },
          }),
        );
        success++;
        break;
      } catch (error: unknown) {
        if (attempt === MAX_RETRIES) {
          console.error(
            `   ❌ 항목 저장 실패 (bib: ${item.bib_number}):`,
            error,
          );
          failed++;
        } else {
          // Throttling 에러인 경우 지수 백오프
          if (
            error &&
            typeof error === "object" &&
            "name" in error &&
            error.name === "ProvisionedThroughputExceededException"
          ) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }
  }

  return { success, failed };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("organizer-id", {
      type: "string",
      description: "조직 ID (organizer_id)",
      demandOption: true,
    })
    .option("event-id", {
      type: "string",
      description: "이벤트 ID (event_id)",
      demandOption: true,
    })
    .option("event-date", {
      type: "string",
      description: "이벤트 날짜 (예: 8/28/25)",
      demandOption: true,
    })
    .option("event-name", {
      type: "string",
      description: "이벤트 이름",
      demandOption: true,
    })
    .option("data-file", {
      type: "string",
      description: "JSON 데이터 파일 경로",
      demandOption: true,
    })
    .option("table-name", {
      type: "string",
      description: "DynamoDB 테이블 이름",
      default: process.env.DYNAMO_RUNNERS_TABLE || "RunnersV2",
    })
    .parse();

  const args: CliArgs = {
    organizerId: argv["organizer-id"] ?? "",
    eventId: argv["event-id"] ?? "",
    eventDate: argv["event-date"] ?? "",
    eventName: argv["event-name"] ?? "",
    dataFile: argv["data-file"] ?? "",
    tableName: argv["table-name"] ?? "RunnersV2",
  };

  console.log("🚀 RunnersV2 임포트 시작");
  console.log(`   Organizer ID: ${args.organizerId}`);
  console.log(`   Event ID: ${args.eventId}`);
  console.log(`   Event Date: ${args.eventDate}`);
  console.log(`   Event Name: ${args.eventName}`);
  console.log(`   Data File: ${args.dataFile}`);
  console.log(`   Table: ${args.tableName}`);
  console.log("");

  try {
    // 1. JSON 파일 읽기
    console.log("📖 JSON 파일 읽는 중...");
    const fs = await import("fs/promises");
    const fileContent = await fs.readFile(args.dataFile, "utf-8");
    const parsedData = JSON.parse(fileContent) as unknown;
    // 타입 검증: 배열인지 확인
    if (!Array.isArray(parsedData)) {
      throw new Error("JSON 데이터는 배열 형식이어야 합니다.");
    }
    const records = parsedData as RaceResultRecord[];
    console.log(`✅ ${records.length}개의 레코드 로드 완료`);
    console.log("");

    // 2. 데이터 변환
    console.log("🔄 데이터 변환 중...");
    const runnerItems = records.map((record) =>
      transformToRunnerItem(record, {
        organizerId: args.organizerId,
        eventId: args.eventId,
        eventDate: args.eventDate,
        eventName: args.eventName,
      }),
    );
    console.log(`✅ ${runnerItems.length}개 항목 변환 완료`);
    console.log("");

    // 샘플 데이터 출력
    if (runnerItems.length > 0) {
      console.log("📋 샘플 데이터 (첫 번째 항목):");
      console.log(JSON.stringify(runnerItems[0], null, 2));
      console.log("");
    }

    // 3. DynamoDB에 저장
    console.log("💾 DynamoDB에 저장 중...");
    if (!args.tableName) {
      console.error("❌ 테이블 이름이 없습니다.");
      process.exit(1);
    }
    const result = await batchSaveRunners(runnerItems, args.tableName);
    console.log("");
    console.log("✨ 완료!");
    console.log(`   성공: ${result.success}개`);
    console.log(`   실패: ${result.failed}개`);

    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    if (error instanceof Error) {
      console.error("   메시지:", error.message);
      if (error.stack) {
        console.error("   스택:", error.stack);
      }
    }
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
