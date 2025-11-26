import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// HTTP Keep-Alive 및 연결 재사용을 위한 설정 (Node.js 런타임에 따라 기본 활성화될 수도 있음)
const rekognition = new RekognitionClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CLOUDFRONT_DOMAIN = "https://images.snap-race.com";
const TABLE_NAME = process.env.DDB_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // 본문 파싱 실패 방어 로직
    if (!event.body) throw new Error("No body provided");
    const body = JSON.parse(event.body);
    const { image, orgId, eventId, bib } = body;

    if (!image || !orgId || !eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing required fields: image, orgId, eventId",
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    // image preprocessing
    const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Image, "base64");
    const collectionId = `${orgId}-${eventId}`;

    // ---------------------------------------------------------
    // [Optimization 1] 병렬 실행 준비
    // Rekognition 검색과 (필요시) Bib 조회를 동시에 시작합니다.
    // ---------------------------------------------------------

    // 1. Rekognition Task
    const rekognitionTask = rekognition
      .send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: { Bytes: imageBuffer },
          FaceMatchThreshold: 85,
          MaxFaces: 50,
        })
      )
      .catch((err) => {
        // Collection이 없을 때만 예외 처리하고 나머지는 throw
        if (err.name === "ResourceNotFoundException") return null;
        throw err;
      });

    // 2. Bib Query Task (bib가 있을 때만)
    const bibQueryTask = bib
      ? ddb.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :pk",
            ExpressionAttributeValues: { ":pk": `EVT#${eventId}#BIB#${bib}` },
            ProjectionExpression: "ulid", // ULID만 필요
          })
        )
      : Promise.resolve(null);

    // 3. 병렬 실행 대기 (Promise.all)
    const [searchRes, bibRes] = await Promise.all([
      rekognitionTask,
      bibQueryTask,
    ]);

    // ---------------------------------------------------------
    // 결과 처리
    // ---------------------------------------------------------

    // Rekognition 결과가 없거나(ResourceNotFound) 매칭이 없으면 조기 종료
    if (
      !searchRes ||
      !searchRes.FaceMatches ||
      searchRes.FaceMatches.length === 0
    ) {
      const message = !searchRes ? "Collection not found" : undefined;
      return {
        statusCode: 200,
        body: JSON.stringify({ photos: [], matches: 0, message }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    const matches = searchRes.FaceMatches;

    // 중복 제거 및 유사도 매핑
    const uniqueMatches = new Map<string, number>();
    for (const match of matches) {
      const ulid = match.Face?.ExternalImageId;
      if (ulid) {
        const currentSim = uniqueMatches.get(ulid) || 0;
        if ((match.Similarity || 0) > currentSim) {
          uniqueMatches.set(ulid, match.Similarity || 0);
        }
      }
    }

    // Bib 필터링 적용
    if (bibRes && bibRes.Items && bibRes.Items.length > 0) {
      const existingUlids = new Set(bibRes.Items.map((item) => item.ulid));
      for (const ulid of existingUlids) {
        uniqueMatches.delete(ulid); // 이미 맵에 있으면 삭제
      }
    }

    // 필터링 후 남은게 없으면 종료
    if (uniqueMatches.size === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ photos: [], matches: 0 }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    // ---------------------------------------------------------
    // [Optimization 2] BatchGetItem
    // ---------------------------------------------------------
    const keys = Array.from(uniqueMatches.keys()).map((ulid) => ({
      PK: `ORG#${orgId}#EVT#${eventId}`,
      SK: `PHOTO#${ulid}`,
    }));

    const ddbRes = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLE_NAME]: {
            Keys: keys,
            // 필요한 속성만 가져와서 데이터 전송량 감소
            ProjectionExpression:
              "ulid, processedKey, instagramHandle, dimensions, thumbHash",
          },
        },
      })
    );

    const items = ddbRes.Responses?.[TABLE_NAME] || [];

    const photos = items
      .map((item) => {
        const ulid = item.ulid;
        const similarity = uniqueMatches.get(ulid);
        const key = item.processedKey;

        return {
          pid: ulid,
          s3Key: key,
          url: `${CLOUDFRONT_DOMAIN}/${key}`,
          width: item.dimensions?.width || 0,
          height: item.dimensions?.height || 0,
          eventId,
          orgId,
          thumbHash: item.thumbHash,
          instagramHandle: item.instagramHandle,
          similarity,
        };
      })
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return {
      statusCode: 200,
      body: JSON.stringify({
        photos: photos,
        matches: photos.length,
      }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  } catch (error: any) {
    console.error("Error in search-by-selfie:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  }
};
