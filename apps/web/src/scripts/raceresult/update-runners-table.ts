/**
 * RaceResult API에서 데이터를 가져와 DynamoDB Runners 테이블에 저장하는 스크립트
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { fetchRaceResultData } from "./utils/raceresult-api";
import { transformToRunnerItem } from "./utils/runners-transformer";
import { batchSaveRunners } from "./utils/dynamodb-helpers";

interface CliArgs {
  eventId: string;
  apiKey: string;
  eventIdDb: string;
  eventDate: string;
  eventName: string;
  tableName?: string;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("event-id", {
      type: "string",
      description: "RaceResult API Event ID",
      demandOption: true,
    })
    .option("api-key", {
      type: "string",
      description: "RaceResult API Key",
      demandOption: true,
    })
    .option("event-id-db", {
      type: "string",
      description: "DynamoDB에 저장할 event_id",
      demandOption: true,
    })
    .option("event-date", {
      type: "string",
      description: "이벤트 날짜",
      demandOption: true,
    })
    .option("event-name", {
      type: "string",
      description: "이벤트 이름",
      demandOption: true,
    })
    .option("table-name", {
      type: "string",
      description: "DynamoDB 테이블 이름",
      default: process.env.DYNAMO_RUNNERS_TABLE || "Runners",
    })
    .parse();

  const args: CliArgs = {
    eventId: argv["event-id"] ?? "",
    apiKey: argv["api-key"] ?? "",
    eventIdDb: argv["event-id-db"] ?? "",
    eventDate: argv["event-date"] ?? "",
    eventName: argv["event-name"] ?? "",
    tableName: argv["table-name"] ?? "Runners",
  };

  console.log("🚀 RaceResult Runners 임포트 시작");
  console.log(`   Event ID: ${args.eventId}`);
  console.log(`   Event ID (DB): ${args.eventIdDb}`);
  console.log(`   Event Name: ${args.eventName}`);
  console.log(`   Table: ${args.tableName}`);
  console.log("");

  try {
    // 1. RaceResult API에서 데이터 가져오기
    console.log("📡 RaceResult API에서 데이터 가져오는 중...");
    const records = await fetchRaceResultData(args.eventId, args.apiKey);
    console.log(`✅ ${records.length}개의 레코드 조회 완료`);
    console.log("");

    // 2. 데이터 변환
    console.log("🔄 데이터 변환 중...");
    const runnerItems = records.map((record) =>
      transformToRunnerItem(record, {
        eventId: args.eventIdDb,
        eventDate: args.eventDate,
        eventName: args.eventName,
      }),
    );
    console.log(`✅ ${runnerItems.length}개 항목 변환 완료`);
    console.log("");

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
