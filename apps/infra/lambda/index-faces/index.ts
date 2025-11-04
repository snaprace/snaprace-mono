/**
 * index-faces Lambda Function
 *
 * SQS 메시지를 받아서 사진에서 얼굴을 인덱싱하고 bib 번호를 확정합니다.
 * - Rekognition 컬렉션 생성/확인 (이름: {organizer_id}-{event_id})
 * - Rekognition IndexFaces로 얼굴 인덱싱
 * - SearchFaces로 동일 얼굴이 있는 bib 확인
 * - Photos 테이블 업데이트 (bib_number, face_ids, processing_status)
 * - PhotoFaces 테이블에 얼굴-사진 매핑 저장
 *
 * 그룹 사진 처리 로직:
 * - 그룹 사진(얼굴 2개 이상) + OCR 확정 bib인 경우:
 *   - Photos 테이블: 사진 전체 bib은 OCR 결과 사용
 *   - PhotoFaces 테이블: 얼굴별 bib은 보류(NONE)로 저장하여 오분류 방지
 * - 단독 사진 또는 OCR 미확정: 기존 로직 적용 (얼굴별 bib 저장)
 */

import { Context, SQSEvent, SQSRecord } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  PutCommand,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand,
} from "@aws-sdk/client-rekognition";
import { validateEnv, parseFloatEnv, parseIntEnv } from "shared/env-validator";

// ============================================================================
// 타입 정의
// ============================================================================

interface IndexFacesEnvironment {
  PHOTOS_TABLE_NAME: string;
  PHOTO_FACES_TABLE_NAME: string;
  PHOTOS_BUCKET_NAME: string;
  MIN_SIMILARITY_THRESHOLD?: string; // 얼굴 매칭 최소 유사도 (기본값: 95.0)
  REQUIRED_VOTES?: string; // 얼굴 매칭 최소 득표수 (기본값: 2)
}

interface SQSMessageBody {
  organizer_id: string;
  event_id: string;
  bucket: string;
  raw_key: string;
  sanitized_key: string;
  hasConfirmedBib: boolean;
  bib?: string;
}

interface FaceMatch {
  FaceId: string;
  Similarity: number;
  ExternalImageId?: string;
}

// ============================================================================
// 상수 설정
// ============================================================================

// 환경 변수에서 읽거나 기본값 사용
const getMinSimilarityThreshold = (env: IndexFacesEnvironment): number => {
  return parseFloatEnv(env.MIN_SIMILARITY_THRESHOLD, 95.0);
};

const getRequiredVotes = (env: IndexFacesEnvironment): number => {
  return parseIntEnv(env.REQUIRED_VOTES, 2);
};

// ============================================================================
// AWS 클라이언트 초기화
// ============================================================================

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const rekognitionClient = new RekognitionClient({});

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * Rekognition 컬렉션 이름 생성
 * 형식: {organizer_id}-{event_id}
 * 영문자, 숫자, 하이픈만 허용 (특수문자는 하이픈으로 치환)
 */
function createCollectionId(organizerId: string, eventId: string): string {
  const sanitize = (str: string): string => {
    return str
      .replace(/[^a-zA-Z0-9-]/g, "-") // 특수문자를 하이픈으로 치환
      .replace(/-+/g, "-") // 연속된 하이픈을 하나로
      .replace(/^-|-$/g, ""); // 앞뒤 하이픈 제거
  };

  return `${sanitize(organizerId)}-${sanitize(eventId)}`;
}

/**
 * Rekognition 컬렉션이 존재하는지 확인하고 없으면 생성
 */
async function ensureCollectionExists(collectionId: string): Promise<void> {
  try {
    await rekognitionClient.send(
      new DescribeCollectionCommand({
        CollectionId: collectionId,
      })
    );
    console.log(`Collection exists: ${collectionId}`);
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.log(`Creating collection: ${collectionId}`);
      await rekognitionClient.send(
        new CreateCollectionCommand({
          CollectionId: collectionId,
        })
      );
      console.log(`Collection created: ${collectionId}`);
    } else {
      throw error;
    }
  }
}

// ============================================================================
// DynamoDB 작업
// ============================================================================

/**
 * Photos 테이블에서 사진 정보 조회
 */
async function getPhoto(
  photosTableName: string,
  organizerId: string,
  eventId: string,
  sanitizedKey: string
): Promise<any | null> {
  const pk = `ORG#${organizerId}#EVT#${eventId}`;
  const sk = `PHOTO#${sanitizedKey}`;

  const command = new GetCommand({
    TableName: photosTableName,
    Key: { pk, sk },
  });

  const result = await dynamoClient.send(command);
  return result.Item || null;
}

/**
 * Photos 테이블 업데이트
 * bib_number가 변경될 때만 GSI_ByBib를 업데이트하여 의도치 않은 NONE 덮어쓰기 방지
 */
async function updatePhoto(
  photosTableName: string,
  organizerId: string,
  eventId: string,
  sanitizedKey: string,
  updates: {
    bib_number?: string;
    face_ids?: string[];
    processing_status: string;
  }
): Promise<void> {
  const pk = `ORG#${organizerId}#EVT#${eventId}`;
  const sk = `PHOTO#${sanitizedKey}`;
  const now = new Date().toISOString();

  const updateExpressionParts: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // bib_number가 변경될 때만 GSI_ByBib 업데이트
  if (updates.bib_number !== undefined) {
    updateExpressionParts.push("#bib_number = :bib_number");
    expressionAttributeNames["#bib_number"] = "bib_number";
    expressionAttributeValues[":bib_number"] = updates.bib_number;

    const gsi1pk = `EVT#${organizerId}#${eventId}#BIB#${updates.bib_number}`;
    const gsi1sk = `TS#${now}#PHOTO#${sanitizedKey}`;
    updateExpressionParts.push("#gsi1pk = :gsi1pk", "#gsi1sk = :gsi1sk");
    expressionAttributeNames["#gsi1pk"] = "gsi1pk";
    expressionAttributeNames["#gsi1sk"] = "gsi1sk";
    expressionAttributeValues[":gsi1pk"] = gsi1pk;
    expressionAttributeValues[":gsi1sk"] = gsi1sk;
  }

  if (updates.face_ids !== undefined) {
    updateExpressionParts.push("#face_ids = :face_ids");
    expressionAttributeNames["#face_ids"] = "face_ids";
    expressionAttributeValues[":face_ids"] = updates.face_ids;
  }

  // processing_status는 항상 업데이트 (GSI_ByStatus도 함께 업데이트)
  if (updates.processing_status) {
    updateExpressionParts.push("#processing_status = :processing_status");
    expressionAttributeNames["#processing_status"] = "processing_status";
    expressionAttributeValues[":processing_status"] = updates.processing_status;

    const gsi2pk = `EVT#${organizerId}#${eventId}#STATUS#${updates.processing_status}`;
    const gsi2sk = `TS#${now}#PHOTO#${sanitizedKey}`;
    updateExpressionParts.push("#gsi2pk = :gsi2pk", "#gsi2sk = :gsi2sk");
    expressionAttributeNames["#gsi2pk"] = "gsi2pk";
    expressionAttributeNames["#gsi2sk"] = "gsi2sk";
    expressionAttributeValues[":gsi2pk"] = gsi2pk;
    expressionAttributeValues[":gsi2sk"] = gsi2sk;
  }

  const command = new UpdateCommand({
    TableName: photosTableName,
    Key: { pk, sk },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await dynamoClient.send(command);
}

/**
 * PhotoFaces 테이블에 얼굴-사진 매핑 저장
 */
async function savePhotoFace(
  photoFacesTableName: string,
  organizerId: string,
  eventId: string,
  faceId: string,
  sanitizedKey: string,
  uploadedAt: string,
  bibNumber?: string,
  similarity?: number
): Promise<void> {
  const pk = `ORG#${organizerId}#EVT#${eventId}#FACE#${faceId}`;
  const sk = `TS#${uploadedAt}#PHOTO#${sanitizedKey}`;
  const gsi1pk = bibNumber
    ? `EVT#${organizerId}#${eventId}#BIB#${bibNumber}`
    : `EVT#${organizerId}#${eventId}#BIB#NONE`;
  const gsi1sk = `FACE#${faceId}`;
  const gsi2pk = `PHOTO#${sanitizedKey}`;
  const gsi2sk = `FACE#${faceId}`;

  const item: any = {
    pk,
    sk,
    gsi1pk,
    gsi1sk,
    gsi2pk,
    gsi2sk,
    organizer_id: organizerId,
    event_id: eventId,
    face_id: faceId,
    photo_id: sanitizedKey,
    uploaded_at: uploadedAt,
    created_at: uploadedAt,
  };

  if (bibNumber) {
    item.bib_number = bibNumber;
  }

  if (similarity !== undefined) {
    item.similarity = similarity;
  }

  // 멱등성 보장: 동일 PK/SK가 이미 존재하면 건너뛰기
  try {
    await dynamoClient.send(
      new PutCommand({
        TableName: photoFacesTableName,
        Item: item,
        ConditionExpression:
          "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      })
    );
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      console.log(`PhotoFace already exists: ${pk}/${sk}, skipping duplicate`);
    } else {
      throw error;
    }
  }
}

/**
 * 기존 얼굴의 bib 번호 조회 (PhotoFaces 테이블에서)
 */
async function findExistingBibForFace(
  photoFacesTableName: string,
  organizerId: string,
  eventId: string,
  faceId: string
): Promise<string | null> {
  const pk = `ORG#${organizerId}#EVT#${eventId}#FACE#${faceId}`;

  const command = new QueryCommand({
    TableName: photoFacesTableName,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": pk,
    },
    Limit: 1,
    ScanIndexForward: false, // 최신 순으로 정렬
  });

  const result = await dynamoClient.send(command);
  const items = result.Items || [];

  if (
    items.length > 0 &&
    items[0].bib_number &&
    items[0].bib_number !== "NONE"
  ) {
    return items[0].bib_number;
  }

  return null;
}

// ============================================================================
// Rekognition 작업
// ============================================================================

/**
 * 얼굴 인덱싱 및 동일 얼굴 검색
 * SearchFaces 결과의 매칭된 기존 얼굴들의 bib을 득표로 모아 결정
 */
async function indexFacesAndMatch(
  collectionId: string,
  bucket: string,
  imageKey: string,
  externalImageId: string,
  organizerId: string,
  eventId: string,
  photoFacesTableName: string,
  minSimilarityThreshold: number
): Promise<{
  faceIds: string[];
  votesByBib: Map<string, { votes: number; topSim: number }>;
}> {
  // 1. 얼굴 인덱싱
  const indexCommand = new IndexFacesCommand({
    CollectionId: collectionId,
    Image: {
      S3Object: {
        Bucket: bucket,
        Name: imageKey,
      },
    },
    ExternalImageId: externalImageId,
    MaxFaces: 50, // 최대 얼굴 수
    QualityFilter: "AUTO", // 자동 품질 필터링
  });

  const indexResponse = await rekognitionClient.send(indexCommand);
  const indexedFaces = indexResponse.FaceRecords || [];

  if (indexedFaces.length === 0) {
    return { faceIds: [], votesByBib: new Map() };
  }

  const faceIds = indexedFaces
    .map((face) => face.Face?.FaceId)
    .filter((id): id is string => !!id);
  const votesByBib = new Map<string, { votes: number; topSim: number }>();

  // 2. 각 얼굴에 대해 동일 얼굴 검색하여 기존 얼굴들의 bib을 득표로 수집
  for (const faceRecord of indexedFaces) {
    const faceId = faceRecord.Face?.FaceId;
    if (!faceId) continue;

    try {
      const searchCommand = new SearchFacesCommand({
        CollectionId: collectionId,
        FaceId: faceId,
        FaceMatchThreshold: minSimilarityThreshold,
        MaxFaces: 10,
      });

      const searchResponse = await rekognitionClient.send(searchCommand);
      const faceMatches = searchResponse.FaceMatches || [];

      // 자기 자신 외에 다른 얼굴이 있으면 매칭된 것으로 간주
      const otherMatches = faceMatches.filter(
        (match) => match.Face?.FaceId !== faceId
      );

      // 병렬 처리: 모든 매칭된 얼굴의 bib 조회를 동시에 수행
      const bibVotePromises = otherMatches.map(async (match) => {
        const matchedFaceId = match.Face?.FaceId;
        if (!matchedFaceId) return null;

        const existingBib = await findExistingBibForFace(
          photoFacesTableName,
          organizerId,
          eventId,
          matchedFaceId
        );

        if (existingBib && existingBib !== "NONE") {
          return { bib: existingBib, similarity: match.Similarity ?? 0 };
        }

        return null;
      });

      const bibVotes = (await Promise.all(bibVotePromises)).filter(
        (v) => v !== null
      ) as { bib: string; similarity: number }[];

      // 득표 집계
      for (const { bib, similarity } of bibVotes) {
        const vote = votesByBib.get(bib) ?? { votes: 0, topSim: 0 };
        vote.votes += 1;
        vote.topSim = Math.max(vote.topSim, similarity);
        votesByBib.set(bib, vote);
      }
    } catch (error: any) {
      console.error(`Error searching faces for ${faceId}:`, error);
      // 검색 실패해도 계속 진행
    }
  }

  return { faceIds, votesByBib };
}

// ============================================================================
// 메인 핸들러
// ============================================================================

/**
 * SQS 메시지 처리
 */
async function processMessage(
  message: SQSRecord,
  env: IndexFacesEnvironment
): Promise<void> {
  let messageBody: SQSMessageBody;

  try {
    messageBody = JSON.parse(message.body);
  } catch (error) {
    console.error("Failed to parse message body:", error);
    throw error;
  }

  const {
    organizer_id,
    event_id,
    bucket,
    raw_key,
    sanitized_key,
    hasConfirmedBib,
    bib,
  } = messageBody;

  console.log(
    `Processing photo: ${sanitized_key} (bib: ${bib || "NONE"}, hasConfirmedBib: ${hasConfirmedBib})`
  );

  // 1. Photos 테이블에서 사진 정보 조회
  const photo = await getPhoto(
    env.PHOTOS_TABLE_NAME,
    organizer_id,
    event_id,
    sanitized_key
  );

  if (!photo) {
    console.error(`Photo not found: ${sanitized_key}`);
    throw new Error(`Photo not found: ${sanitized_key}`);
  }

  const uploadedAt =
    photo.uploaded_at || photo.created_at || new Date().toISOString();

  // 2. Rekognition 컬렉션 확인/생성
  const collectionId = createCollectionId(organizer_id, event_id);
  await ensureCollectionExists(collectionId);

  // 3. 얼굴 인덱싱 및 동일 얼굴 검색 (득표 수집)
  const externalImageId = sanitized_key;
  const minSimilarityThreshold = getMinSimilarityThreshold(env);
  const { faceIds, votesByBib } = await indexFacesAndMatch(
    collectionId,
    bucket,
    raw_key,
    externalImageId,
    organizer_id,
    event_id,
    env.PHOTO_FACES_TABLE_NAME,
    minSimilarityThreshold
  );

  // 4. 얼굴이 없는 경우
  if (faceIds.length === 0) {
    console.log(`No faces detected in ${sanitized_key}`);
    await updatePhoto(
      env.PHOTOS_TABLE_NAME,
      organizer_id,
      event_id,
      sanitized_key,
      {
        processing_status: "NO_FACES",
      }
    );
    return;
  }

  // 5. bib 번호 결정 로직 (우선순위: OCR 단독 확정 > 얼굴 매칭 다수결 > 보류)
  let finalBibNumber: string = "NONE";

  // 1) OCR가 유일 확정이면 최우선
  if (hasConfirmedBib && bib) {
    finalBibNumber = bib;
    console.log(`Using OCR confirmed bib: ${bib}`);
  } else if (votesByBib.size > 0) {
    // 2) 얼굴 매칭 다수결 결과 사용
    const sorted = [...votesByBib.entries()].sort((a, b) => {
      // 득표수 우선, 동률이면 topSim 큰 쪽
      return b[1].votes - a[1].votes || b[1].topSim - a[1].topSim;
    });

    const [bestBib, meta] = sorted[0];
    const requiredVotes = getRequiredVotes(env);

    if (meta.votes >= requiredVotes && meta.topSim >= minSimilarityThreshold) {
      finalBibNumber = bestBib;
      console.log(
        `Using face matching bib: ${bestBib} (votes: ${meta.votes}, topSim: ${meta.topSim})`
      );
    } else {
      console.log(
        `Face matching insufficient: bib=${bestBib}, votes=${meta.votes}, topSim=${meta.topSim} (required: ${requiredVotes} votes, ${minSimilarityThreshold}% similarity)`
      );
    }
  }

  // 6. 그룹 사진 여부 확인
  const isGroupPhoto = faceIds.length > 1;

  // 7. Photos 테이블 업데이트
  await updatePhoto(
    env.PHOTOS_TABLE_NAME,
    organizer_id,
    event_id,
    sanitized_key,
    {
      bib_number: finalBibNumber,
      face_ids: faceIds,
      processing_status: "FACES_INDEXED",
    }
  );

  // 8. PhotoFaces 테이블에 얼굴-사진 매핑 저장
  // 그룹 사진 + OCR 확정인 경우 얼굴별 bib은 보류 (오분류 방지)
  for (const faceId of faceIds) {
    let faceBibNumber: string | undefined;

    if (isGroupPhoto && hasConfirmedBib && bib) {
      // 그룹 사진 + OCR 확정: 얼굴별 bib 보류
      // 사진 전체 bib은 OCR 결과를 사용하지만, 얼굴별 bib은 보류하여 오분류 방지
      faceBibNumber = undefined;
      console.log(
        `Group photo detected: withholding individual face bib for face ${faceId} (photo bib: ${finalBibNumber})`
      );
    } else {
      // 단일 얼굴 또는 OCR 미확정: 기존 로직 (얼굴별 bib 저장)
      faceBibNumber = finalBibNumber !== "NONE" ? finalBibNumber : undefined;
    }

    await savePhotoFace(
      env.PHOTO_FACES_TABLE_NAME,
      organizer_id,
      event_id,
      faceId,
      sanitized_key,
      uploadedAt,
      faceBibNumber
    );
  }

  console.log(
    `Successfully indexed faces for ${sanitized_key}. Faces: ${faceIds.length}, Bib: ${finalBibNumber}, IsGroupPhoto: ${isGroupPhoto}`
  );
}

/**
 * Lambda 핸들러
 */
export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  const rawEnv = process.env as Record<string, string | undefined>;

  // 환경 변수 검증
  const envValidation = validateEnv<IndexFacesEnvironment>(rawEnv, [
    "PHOTOS_TABLE_NAME",
    "PHOTO_FACES_TABLE_NAME",
    "PHOTOS_BUCKET_NAME",
  ]);

  if (!envValidation.success || !envValidation.env) {
    throw new Error(
      envValidation.error || "Missing required environment variables"
    );
  }

  const env = envValidation.env;

  // SQS 메시지 일괄 처리
  const promises = event.Records.map((record) => processMessage(record, env));

  // 실패한 메시지 확인 (실패하면 DLQ로 이동)
  const results = await Promise.allSettled(promises);
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    console.error(`Failed to process ${failures.length} messages`);
    failures.forEach((failure, index) => {
      if (failure.status === "rejected") {
        console.error(`Message ${index} failed:`, failure.reason);
      }
    });
    throw new Error(`Failed to process ${failures.length} messages`);
  }
};
