/**
 * DynamoDB 헬퍼 함수
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  type BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

import type { RunnerItem } from "./runners-transformer";

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
 * 배치로 DynamoDB에 Runner 항목들을 저장합니다.
 */
export async function batchSaveRunners(
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
