import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";

// DynamoDB 클라이언트 초기화
const dynamodb = new DynamoDBClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

// DynamoDB 아이템 타입 정의
interface FeedbackItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  userId: string;
  eventId: string;
  bibNumber: string;
  rating: number;
  comment?: string;
  timestamp: string;
  createdAt: string;
  userAgent?: string;
}

// 요청 바디 타입 정의
interface FeedbackRequestBody {
  eventId: string;
  bibNumber: string;
  rating: number;
  comment?: string;
}

// AWS SDK 에러 타입 정의
interface AWSError extends Error {
  name: string;
  message: string;
  $metadata?: {
    httpStatusCode?: number;
    requestId?: string;
  };
}

// 에러 타입 가드 함수
function isAWSError(error: unknown): error is AWSError {
  return (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    typeof (error as { name: unknown }).name === "string"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FeedbackRequestBody;
    const { eventId, bibNumber, rating, comment } = body;

    // 입력 검증
    if (!eventId || !bibNumber || !rating) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (
      typeof rating !== "number" ||
      rating < 1 ||
      rating > 5 ||
      !Number.isInteger(rating)
    ) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 },
      );
    }

    if (comment && typeof comment === "string" && comment.length > 500) {
      return NextResponse.json(
        { error: "Comment must be 500 characters or less" },
        { status: 400 },
      );
    }

    // 사용자 식별 (IP + User Agent 조합)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "";
    const userId = `${ip}_${Buffer.from(userAgent).toString("base64").substring(0, 10)}`;

    const now = new Date();
    const timestamp = now.toISOString();

    // DynamoDB 아이템 구성
    const feedbackItem: FeedbackItem = {
      PK: `EVENT#${eventId}`,
      SK: `FEEDBACK#${timestamp}#${bibNumber}`,
      GSI1PK: `BIB#${eventId}#${bibNumber}`,
      GSI1SK: `#${timestamp}`,
      userId,
      eventId,
      bibNumber,
      rating,
      comment:
        typeof comment === "string" ? comment.trim() || undefined : undefined,
      timestamp,
      createdAt: timestamp,
      userAgent: userAgent.substring(0, 200),
    };

    // DynamoDB에 피드백 저장
    const command = new PutItemCommand({
      TableName: env.DYNAMO_FEEDBACKS_TABLE,
      Item: marshall(feedbackItem),
      ConditionExpression:
        "attribute_not_exists(PK) AND attribute_not_exists(SK)", // 중복 방지
    });
    await dynamodb.send(command);

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error: unknown) {
    console.error("Error submitting feedback:", error);

    if (isAWSError(error)) {
      // 중복 제출 에러 처리
      if (error.name === "ConditionalCheckFailedException") {
        return NextResponse.json(
          { error: "Feedback already submitted for this session" },
          { status: 409 },
        );
      }

      // AWS 관련 에러 처리
      if (
        error.name === "ResourceNotFoundException" ||
        error.name === "ValidationException"
      ) {
        console.error("AWS DynamoDB error:", error);
        return NextResponse.json(
          { error: "Database configuration error" },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 },
    );
  }
}

// 피드백 조회 API (관리자용)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const bibNumber = searchParams.get("bibNumber");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 },
      );
    }

    // DynamoDB에서 피드백 조회
    let queryParams;

    if (bibNumber) {
      // 특정 참가자 피드백 조회
      queryParams = {
        TableName: env.DYNAMO_FEEDBACKS_TABLE,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": { S: `BIB#${eventId}#${bibNumber}` },
        },
        ScanIndexForward: false, // 최신순
      };
    } else {
      // 전체 이벤트 피드백 조회
      queryParams = {
        TableName: env.DYNAMO_FEEDBACKS_TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": { S: `EVENT#${eventId}` },
        },
        ScanIndexForward: false, // 최신순
      };
    }

    const command = new QueryCommand(queryParams);
    const result = await dynamodb.send(command);
    const feedbacks = result.Items?.map((item) => unmarshall(item)) || [];

    return NextResponse.json({
      feedbacks,
      count: feedbacks.length,
    });
  } catch (error: unknown) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 },
    );
  }
}
