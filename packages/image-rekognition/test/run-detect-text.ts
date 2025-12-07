#!/usr/bin/env ts-node
/**
 * AWS Rekognition DetectText API 테스트 스크립트
 *
 * 사용법:
 *   npx ts-node test/run-detect-text.ts
 *   또는
 *   npx ts-node test/run-detect-text.ts path/to/specific-image.jpg
 */

import {
  RekognitionClient,
  DetectTextCommand,
} from "@aws-sdk/client-rekognition";
import * as fs from "fs";
import * as path from "path";
import {
  extractBibsFromDetections,
  BIB_PATTERNS,
  EXCLUDED_PATTERNS,
  MIN_CONFIDENCE,
} from "../lambda/detect-text/bib-detector";

// AWS 리전 설정
const rekognition = new RekognitionClient({ region: "ap-northeast-2" });

async function detectTextFromImage(imagePath: string) {
  const imageBytes = fs.readFileSync(imagePath);

  const response = await rekognition.send(
    new DetectTextCommand({
      Image: { Bytes: imageBytes },
    })
  );

  return response.TextDetections ?? [];
}

async function testImage(imagePath: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📷 테스트 이미지: ${path.basename(imagePath)}`);
  console.log("=".repeat(60));

  try {
    const detections = await detectTextFromImage(imagePath);

    // Raw 텍스트 출력
    console.log("\n📝 감지된 텍스트:");
    console.log("-".repeat(50));
    for (const detection of detections) {
      if (detection.DetectedText) {
        const confidence = detection.Confidence?.toFixed(1) ?? "N/A";
        console.log(
          `  [${detection.Type?.padEnd(5)}] "${detection.DetectedText}" (신뢰도: ${confidence}%)`
        );
      }
    }

    // 공통 로직으로 Bib 추출
    const { bibs } = extractBibsFromDetections(detections);

    console.log("\n🔍 Bib Detection 결과:");
    console.log("-".repeat(50));
    console.log(`  패턴: ${BIB_PATTERNS.map((p) => p.toString()).join(", ")}`);
    console.log(`  제외: ${[...EXCLUDED_PATTERNS].join(", ")}`);
    console.log(`  최소 신뢰도: ${MIN_CONFIDENCE}%`);
    console.log("-".repeat(50));

    if (bibs.length > 0) {
      for (const bib of bibs) {
        console.log(`  ✅ "${bib}"`);
      }
      console.log("-".repeat(50));
      console.log(`  📦 최종 저장될 bib: [${bibs.join(", ")}]`);
    } else {
      console.log("  ❌ 감지된 bib 없음");
    }

    return { bibs, detections };
  } catch (error) {
    console.error(`  ❌ 오류 발생:`, error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let imagePaths: string[] = [];

  if (args.length > 0) {
    imagePaths = args.map((arg) => path.resolve(arg));
  } else {
    const imagesDir = path.join(__dirname, "images");
    if (fs.existsSync(imagesDir)) {
      const files = fs
        .readdirSync(imagesDir)
        .filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
      imagePaths = files.map((f) => path.join(imagesDir, f));
    }
  }

  if (imagePaths.length === 0) {
    console.log("⚠️  테스트할 이미지가 없습니다.");
    console.log("\n사용법:");
    console.log("  1. test/images/ 폴더에 이미지 추가 후 실행");
    console.log("     npx ts-node test/run-detect-text.ts");
    console.log("\n  2. 특정 이미지 경로 지정");
    console.log("     npx ts-node test/run-detect-text.ts /path/to/image.jpg");
    process.exit(1);
  }

  console.log(`\n🚀 ${imagePaths.length}개 이미지 테스트 시작...\n`);

  for (const imagePath of imagePaths) {
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ 파일을 찾을 수 없습니다: ${imagePath}`);
      continue;
    }
    await testImage(imagePath);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ 테스트 완료");
  console.log("=".repeat(60));
}

main().catch(console.error);
