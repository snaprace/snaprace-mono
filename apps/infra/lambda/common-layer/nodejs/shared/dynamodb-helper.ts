/**
 * DynamoDB Helper 함수들
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
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
      new GetItemCommand({
        TableName: tableName,
        Key: {
          EventKey: { S: `ORG#${organizer}#EVT#${eventId}` },
          S3ObjectKey: { S: objectKey },
        },
      })
    );

    if (!response.Item) {
      return null;
    }

    // Item을 EventPhoto 타입으로 변환
    return unmarshallEventPhoto(response.Item);
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
export async function putEventPhoto(
  tableName: string,
  photo: EventPhoto
): Promise<void> {
  try {
    await docClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshallEventPhoto(photo),
        ConditionExpression: "attribute_not_exists(S3ObjectKey)",
      })
    );
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      console.warn(`Photo ${photo.S3ObjectKey} already exists`);
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

  if (updates.ProcessingStatus !== undefined) {
    updateExpressions.push(`#status = :val${valueIndex}`);
    expressionAttributeNames["#status"] = "ProcessingStatus";
    expressionAttributeValues[`:val${valueIndex}`] = { S: updates.ProcessingStatus };
    valueIndex++;
  }

  if (updates.DetectedBibs !== undefined) {
    updateExpressions.push(`#bibs = :val${valueIndex}`);
    expressionAttributeNames["#bibs"] = "DetectedBibs";
    expressionAttributeValues[`:val${valueIndex}`] = {
      L: updates.DetectedBibs.map((bib) => ({ S: bib })),
    };
    valueIndex++;
  }

  if (updates.FaceIds !== undefined) {
    updateExpressions.push(`#faceIds = :val${valueIndex}`);
    expressionAttributeNames["#faceIds"] = "FaceIds";
    expressionAttributeValues[`:val${valueIndex}`] = {
      L: updates.FaceIds.map((id) => ({ S: id })),
    };
    valueIndex++;
  }

  if (updates.isGroupPhoto !== undefined) {
    updateExpressions.push(`#isGroup = :val${valueIndex}`);
    expressionAttributeNames["#isGroup"] = "isGroupPhoto";
    expressionAttributeValues[`:val${valueIndex}`] = { BOOL: updates.isGroupPhoto };
    valueIndex++;
  }

  if (updates.ImageWidth !== undefined) {
    updateExpressions.push(`#width = :val${valueIndex}`);
    expressionAttributeNames["#width"] = "ImageWidth";
    expressionAttributeValues[`:val${valueIndex}`] = { N: String(updates.ImageWidth) };
    valueIndex++;
  }

  if (updates.ImageHeight !== undefined) {
    updateExpressions.push(`#height = :val${valueIndex}`);
    expressionAttributeNames["#height"] = "ImageHeight";
    expressionAttributeValues[`:val${valueIndex}`] = { N: String(updates.ImageHeight) };
    valueIndex++;
  }

  // updatedAt 자동 추가
  updateExpressions.push(`#updatedAt = :val${valueIndex}`);
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[`:val${valueIndex}`] = { N: String(Date.now()) };

  if (updateExpressions.length === 0) {
    return;
  }

  await docClient.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: {
        EventKey: { S: `ORG#${organizer}#EVT#${eventId}` },
        S3ObjectKey: { S: objectKey },
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
        KeyConditionExpression: "EventBibKey = :key",
        ExpressionAttributeValues: {
          ":key": { S: `ORG#${organizer}#EVT#${eventId}#BIB#${bibNumber}` },
        },
      })
    );

    if (!response.Items || response.Items.length === 0) {
      return [];
    }

    return response.Items.map((item) => item.S3ObjectKey.S!);
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
  const { BatchWriteItemCommand } = await import("@aws-sdk/client-dynamodb");

  // 25개씩 배치 처리
  const batchSize = 25;
  for (let i = 0; i < bibNumbers.length; i += batchSize) {
    const batch = bibNumbers.slice(i, i + batchSize);

    const requestItems = batch.map((bib) => ({
      PutRequest: {
        Item: {
          EventBibKey: { S: `ORG#${organizer}#EVT#${eventId}#BIB#${bib}` },
          S3ObjectKey: { S: objectKey },
          IndexedAt: { N: String(Date.now()) },
        },
      },
    }));

    await docClient.send(
      new BatchWriteItemCommand({
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
      new GetItemCommand({
        TableName: tableName,
        Key: {
          pk: { S: `ORG#${organizer}#EVT#${eventId}` },
          sk: { S: `BIB#${bibNumber}` },
        },
      })
    );

    if (!response.Item) {
      return null;
    }

    return unmarshallRunner(response.Item);
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
      new UpdateItemCommand({
        TableName: tableName,
        Key: {
          pk: { S: `ORG#${organizer}#EVT#${eventId}` },
          sk: { S: `BIB#${bibNumber}` },
        },
        UpdateExpression: "ADD PhotoKeys :keys",
        ExpressionAttributeValues: {
          ":keys": { SS: photoKeys },
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
    await docClient.send(
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
  const { BatchGetItemCommand } = await import("@aws-sdk/client-dynamodb");

  const eventKey = `ORG#${organizer}#EVT#${eventId}`;
  const results: EventPhoto[] = [];

  // 100개씩 배치 처리
  const batchSize = 100;
  for (let i = 0; i < objectKeys.length; i += batchSize) {
    const batch = objectKeys.slice(i, i + batchSize);

    const response = await docClient.send(
      new BatchGetItemCommand({
        RequestItems: {
          [tableName]: {
            Keys: batch.map((key) => ({
              EventKey: { S: eventKey },
              S3ObjectKey: { S: key },
            })),
          },
        },
      })
    );

    if (response.Responses?.[tableName]) {
      const photos = response.Responses[tableName].map(unmarshallEventPhoto);
      results.push(...photos);
    }
  }

  return results;
}

/**
 * Unmarshall helpers
 */
function unmarshallEventPhoto(item: Record<string, any>): EventPhoto {
  return {
    EventKey: item.EventKey.S!,
    S3ObjectKey: item.S3ObjectKey.S!,
    UploadTimestamp: Number(item.UploadTimestamp?.N || 0),
    ImageWidth: item.ImageWidth?.N ? Number(item.ImageWidth.N) : undefined,
    ImageHeight: item.ImageHeight?.N ? Number(item.ImageHeight.N) : undefined,
    RekognitionImageId: item.RekognitionImageId?.S,
    ProcessingStatus: item.ProcessingStatus?.S as ProcessingStatus,
    DetectedBibs: item.DetectedBibs?.L?.map((v: any) => v.S!) || [],
    FaceIds: item.FaceIds?.L?.map((v: any) => v.S!) || [],
    isGroupPhoto: item.isGroupPhoto?.BOOL,
    createdAt: item.createdAt?.N ? Number(item.createdAt.N) : undefined,
    updatedAt: item.updatedAt?.N ? Number(item.updatedAt.N) : undefined,
  };
}

function unmarshallRunner(item: Record<string, any>): Runner {
  return {
    pk: item.pk.S!,
    sk: item.sk.S!,
    name: item.name?.S,
    finish_time_sec: item.finish_time_sec?.N ? Number(item.finish_time_sec.N) : undefined,
    PhotoKeys: item.PhotoKeys?.SS || [],
  };
}

/**
 * Marshall helpers
 */
function marshallEventPhoto(photo: EventPhoto): Record<string, any> {
  const item: Record<string, any> = {
    EventKey: { S: photo.EventKey },
    S3ObjectKey: { S: photo.S3ObjectKey },
    UploadTimestamp: { N: String(photo.UploadTimestamp) },
    ProcessingStatus: { S: photo.ProcessingStatus },
  };

  if (photo.ImageWidth !== undefined) {
    item.ImageWidth = { N: String(photo.ImageWidth) };
  }
  if (photo.ImageHeight !== undefined) {
    item.ImageHeight = { N: String(photo.ImageHeight) };
  }
  if (photo.RekognitionImageId) {
    item.RekognitionImageId = { S: photo.RekognitionImageId };
  }
  if (photo.DetectedBibs && photo.DetectedBibs.length > 0) {
    item.DetectedBibs = { L: photo.DetectedBibs.map((bib) => ({ S: bib })) };
  }
  if (photo.FaceIds && photo.FaceIds.length > 0) {
    item.FaceIds = { L: photo.FaceIds.map((id) => ({ S: id })) };
  }
  if (photo.isGroupPhoto !== undefined) {
    item.isGroupPhoto = { BOOL: photo.isGroupPhoto };
  }
  if (photo.createdAt !== undefined) {
    item.createdAt = { N: String(photo.createdAt) };
  }
  if (photo.updatedAt !== undefined) {
    item.updatedAt = { N: String(photo.updatedAt) };
  }

  return item;
}

