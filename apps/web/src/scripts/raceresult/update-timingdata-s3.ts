/**
 * RaceResult API에서 타임링 데이터를 가져와 S3에 업로드하는 스크립트
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { fetchRaceResultTimingData } from "./utils/raceresult-timing-api";
import {
  extractContestNames,
  transformContestData,
  createIndexJson,
} from "./utils/timing-data-transformer";
import { uploadMultipleFilesToS3 } from "./utils/s3-helpers";

interface CliArgs {
  eventId: string;
  apiKey: string;
  listname: string;
  organizerId: string;
  eventIdDb: string;
  eventName: string;
  contest?: number;
  limit?: number;
  r?: string;
  bucketName?: string;
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
    .option("listname", {
      type: "string",
      description: "List Name (예: Online|Final)",
      demandOption: true,
    })
    .option("organizer-id", {
      type: "string",
      description: "Organizer ID (S3 경로용)",
      demandOption: true,
    })
    .option("event-id-db", {
      type: "string",
      description: "Event ID (S3 경로용)",
      demandOption: true,
    })
    .option("event-name", {
      type: "string",
      description: "Event Name",
      demandOption: true,
    })
    .option("contest", {
      type: "number",
      description: "Contest 필터 (기본값: 0 = 모든 contest)",
      default: 0,
    })
    .option("limit", {
      type: "number",
      description: "결과 제한 (기본값: 1000)",
      default: 1000,
    })
    .option("r", {
      type: "string",
      description: "정렬 방식 (기본값: leaders)",
      default: "leaders",
    })
    .option("bucket-name", {
      type: "string",
      description: "S3 버킷 이름",
      default: process.env.BUCKET || "snap-race",
    })
    .parse();

  const args: CliArgs = {
    eventId: argv["event-id"] ?? "",
    apiKey: argv["api-key"] ?? "",
    listname: argv.listname ?? "",
    organizerId: argv["organizer-id"] ?? "",
    eventIdDb: argv["event-id-db"] ?? "",
    eventName: argv["event-name"] ?? "",
    contest: argv.contest ?? 0,
    limit: argv.limit ?? 1000,
    r: argv.r ?? "leaders",
    bucketName: argv["bucket-name"] ?? (process.env.BUCKET || "snap-race"),
  };

  console.log("🚀 RaceResult Timing 데이터 S3 업로드 시작");
  console.log(`   Event ID: ${args.eventId}`);
  console.log(`   List Name: ${args.listname}`);
  console.log(`   Organizer ID: ${args.organizerId}`);
  console.log(`   Event ID (DB): ${args.eventIdDb}`);
  console.log(`   Event Name: ${args.eventName}`);
  console.log(`   Bucket: ${args.bucketName}`);
  console.log("");

  try {
    // 1. RaceResult API에서 데이터 가져오기
    console.log("📡 RaceResult API에서 데이터 가져오는 중...");
    const apiResponse = await fetchRaceResultTimingData(
      args.eventId,
      args.apiKey,
      args.listname,
      {
        contest: args.contest,
        r: args.r,
        l: args.limit,
      },
    );
    console.log("");

    // 2. Contest별로 데이터 추출
    console.log("🔄 Contest별 데이터 추출 중...");
    const contests = extractContestNames(apiResponse);
    console.log(
      `   ✅ ${contests.length}개의 contest 발견: ${contests.map((c) => c.contestName).join(", ")}`,
    );
    console.log("");

    // 3. 각 contest별로 데이터 변환 및 S3 업로드
    const filesToUpload: Array<{ key: string; data: unknown }> = [];
    const uploadStats: Array<{ contest: string; success: boolean }> = [];

    for (const contest of contests) {
      try {
        console.log(
          `📦 Contest 처리 중: ${contest.contestName} (${contest.fileName})`,
        );

        const contestData = apiResponse.data[contest.contestKey];
        if (!contestData) {
          console.warn(`   ⚠️  Contest 데이터 없음: ${contest.contestKey}`);
          uploadStats.push({ contest: contest.contestName, success: false });
          continue;
        }

        // 데이터 변환
        const transformedData = transformContestData(
          contest.contestKey,
          contestData,
          apiResponse,
        );

        // S3 키 생성
        const s3Key = `${args.organizerId}/${args.eventIdDb}/results/${contest.fileName}`;

        filesToUpload.push({
          key: s3Key,
          data: transformedData,
        });

        console.log(
          `   ✅ 변환 완료: ${transformedData.resultSet.results.length}개 레코드`,
        );
        uploadStats.push({ contest: contest.contestName, success: true });
      } catch (error) {
        console.error(`   ❌ Contest 처리 실패: ${contest.contestName}`, error);
        uploadStats.push({ contest: contest.contestName, success: false });
      }
    }

    console.log("");

    // 4. Index.json 생성
    console.log("📝 Index.json 생성 중...");
    const indexJson = createIndexJson(
      args.organizerId,
      args.eventIdDb,
      args.eventName,
      contests.map((c) => ({
        contestName: c.contestName,
        fileName: c.fileName,
      })),
    );

    const indexS3Key = `${args.organizerId}/${args.eventIdDb}/results/index.json`;
    filesToUpload.push({
      key: indexS3Key,
      data: indexJson,
    });

    console.log(
      `   ✅ Index.json 생성 완료: ${indexJson.result_sets.length}개 result_set`,
    );
    console.log("");

    // 5. S3에 업로드
    console.log("💾 S3에 업로드 중...");
    if (!args.bucketName) {
      console.error("❌ 버킷 이름이 없습니다.");
      process.exit(1);
    }

    const uploadResult = await uploadMultipleFilesToS3(
      args.bucketName,
      filesToUpload,
    );

    console.log("");
    console.log("✨ 완료!");
    console.log(`   업로드 성공: ${uploadResult.success}개 파일`);
    console.log(`   업로드 실패: ${uploadResult.failed}개 파일`);

    // Contest별 처리 결과 출력
    console.log("");
    console.log("📊 Contest별 처리 결과:");
    for (const stat of uploadStats) {
      console.log(`   ${stat.success ? "✅" : "❌"} ${stat.contest}`);
    }

    if (uploadResult.failed > 0) {
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
