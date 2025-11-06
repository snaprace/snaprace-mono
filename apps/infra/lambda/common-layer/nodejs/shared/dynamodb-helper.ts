/**
 * DynamoDB Helper 함수들
 */

import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  BatchWriteCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  EventPhoto,
  PhotoBibIndex,
  Runner,
  ProcessingStatus,
  DynamoDBGetItemResponse,
  DynamoDBQueryResponse,
} from "./types";

// DynamoDB 클라이언트 초기화
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

/**
 * EventPhotos 테이블에서 사진 조회
 */
export async function getEventPhoto(
  tableName: string,
  organizer: string,
  eventId: string,
  objectKey: string
): Promise<EventPhoto | null> {
  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          event_key: `ORG#${organizer}#EVT#${eventId}`,
          s3_path: objectKey,
        },
      })
    );

    if (!response.Item) {
      return null;
    }

    return response.Item as EventPhoto;
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.warn(`Table ${tableName} not found`);
      return null;
    }
    throw error;
  }
}

/**
 * EventPhotos 테이블에 사진 저장 (멱등성 보장)
 */
export async function putEventPhoto(tableName: string, photo: EventPhoto): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: photo,
        ConditionExpression: "attribute_not_exists(s3_path)",
      })
    );
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      console.warn(`Photo ${photo.s3_path} already exists`);
      return;
    }
    throw error;
  }
}

/**
 * EventPhotos 테이블 업데이트
 */
export async function updateEventPhoto(
  tableName: string,
  organizer: string,
  eventId: string,
  objectKey: string,
  updates: Partial<EventPhoto>
): Promise<void> {
  // UpdateExpression 동적 생성
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  let valueIndex = 0;

  if (updates.processing_status !== undefined) {
    updateExpressions.push(`#status = :val${valueIndex}`);
    expressionAttributeNames["#status"] = "processing_status";
    expressionAttributeValues[`:val${valueIndex}`] = updates.processing_status;
    valueIndex++;
  }

  if (updates.detected_bibs !== undefined) {
    updateExpressions.push(`#bibs = :val${valueIndex}`);
    expressionAttributeNames["#bibs"] = "detected_bibs";
    expressionAttributeValues[`:val${valueIndex}`] = updates.detected_bibs;
    valueIndex++;
  }

  if (updates.face_ids !== undefined) {
    updateExpressions.push(`#faceIds = :val${valueIndex}`);
    expressionAttributeNames["#faceIds"] = "face_ids";
    expressionAttributeValues[`:val${valueIndex}`] = updates.face_ids;
    valueIndex++;
  }

  if (updates.is_group_photo !== undefined) {
    updateExpressions.push(`#isGroup = :val${valueIndex}`);
    expressionAttributeNames["#isGroup"] = "is_group_photo";
    expressionAttributeValues[`:val${valueIndex}`] = updates.is_group_photo;
    valueIndex++;
  }

  if (updates.image_width !== undefined) {
    updateExpressions.push(`#width = :val${valueIndex}`);
    expressionAttributeNames["#width"] = "image_width";
    expressionAttributeValues[`:val${valueIndex}`] = updates.image_width;
    valueIndex++;
  }

  if (updates.image_height !== undefined) {
    updateExpressions.push(`#height = :val${valueIndex}`);
    expressionAttributeNames["#height"] = "image_height";
    expressionAttributeValues[`:val${valueIndex}`] = updates.image_height;
    valueIndex++;
  }

  // updated_at 자동 추가
  updateExpressions.push(`#updatedAt = :val${valueIndex}`);
  expressionAttributeNames["#updatedAt"] = "updated_at";
  expressionAttributeValues[`:val${valueIndex}`] = new Date().toISOString();

  if (updateExpressions.length === 0) {
    return;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        event_key: `ORG#${organizer}#EVT#${eventId}`,
        s3_path: objectKey,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

/**
 * PhotoBibIndex 테이블 쿼리
 */
export async function queryPhotoBibIndex(
  tableName: string,
  organizer: string,
  eventId: string,
  bibNumber: string
): Promise<string[]> {
  try {
    const response = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "event_bib_key = :key",
        ExpressionAttributeValues: {
          ":key": `ORG#${organizer}#EVT#${eventId}#BIB#${bibNumber}`,
        },
      })
    );

    if (!response.Items || response.Items.length === 0) {
      return [];
    }

    return response.Items.map((item) => item.s3_path as string);
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.warn(`Table ${tableName} not found`);
      return [];
    }
    throw error;
  }
}

/**
 * PhotoBibIndex 테이블에 배치 저장
 */
export async function batchPutPhotoBibIndex(
  tableName: string,
  organizer: string,
  eventId: string,
  objectKey: string,
  bibNumbers: string[]
): Promise<void> {
  // 25개씩 배치 처리
  const batchSize = 25;
  for (let i = 0; i < bibNumbers.length; i += batchSize) {
    const batch = bibNumbers.slice(i, i + batchSize);

    const requestItems = batch.map((bib) => ({
      PutRequest: {
        Item: {
          event_bib_key: `ORG#${organizer}#EVT#${eventId}#BIB#${bib}`,
          s3_path: objectKey,
          indexed_at: new Date().toISOString(),
        },
      },
    }));

    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: requestItems,
        },
      })
    );
  }
}

/**
 * Runners 테이블에서 Runner 조회
 */
export async function getRunner(
  tableName: string,
  organizer: string,
  eventId: string,
  bibNumber: string
): Promise<Runner | null> {
  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          pk: `ORG#${organizer}#EVT#${eventId}`,
          sk: `BIB#${bibNumber}`,
        },
      })
    );

    if (!response.Item) {
      return null;
    }

    const runner = response.Item as Runner;

    // PhotoKeys가 Set<string>인 경우 배열로 변환 (호환성)
    if (runner.PhotoKeys && runner.PhotoKeys instanceof Set) {
      runner.PhotoKeys = Array.from(runner.PhotoKeys);
    }

    return runner;
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.warn(`Table ${tableName} not found`);
      return null;
    }
    throw error;
  }
}

/**
 * Runners 테이블의 PhotoKeys 업데이트 (StringSet ADD)
 */
export async function updateRunnerPhotoKeys(
  tableName: string,
  organizer: string,
  eventId: string,
  bibNumber: string,
  photoKeys: string[]
): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: `ORG#${organizer}#EVT#${eventId}`,
          sk: `BIB#${bibNumber}`,
        },
        UpdateExpression: "ADD PhotoKeys :keys",
        ExpressionAttributeValues: {
          ":keys": new Set(photoKeys),
        },
      })
    );
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.warn(`Table ${tableName} not found`);
      return;
    }
    // Runner가 존재하지 않아도 무시 (경고만 출력)
    if (error.name === "ValidationException") {
      console.warn(`Runner BIB#${bibNumber} not found in table ${tableName}`);
      return;
    }
    throw error;
  }
}

/**
 * Runners 테이블 존재 여부 확인
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    await client.send(
      new DescribeTableCommand({
        TableName: tableName,
      })
    );
    return true;
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      return false;
    }
    throw error;
  }
}

/**
 * EventPhotos 테이블에서 여러 사진 조회 (배치)
 */
export async function batchGetEventPhotos(
  tableName: string,
  organizer: string,
  eventId: string,
  objectKeys: string[]
): Promise<EventPhoto[]> {
  const eventKey = `ORG#${organizer}#EVT#${eventId}`;
  const results: EventPhoto[] = [];

  // 100개씩 배치 처리
  const batchSize = 100;
  for (let i = 0; i < objectKeys.length; i += batchSize) {
    const batch = objectKeys.slice(i, i + batchSize);

    const response = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [tableName]: {
            Keys: batch.map((key) => ({
              event_key: eventKey,
              s3_path: key,
            })),
          },
        },
      })
    );

    if (response.Responses?.[tableName]) {
      const photos = response.Responses[tableName] as EventPhoto[];
      results.push(...photos);
    }
  }

  return results;
}
