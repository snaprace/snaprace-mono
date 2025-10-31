import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface FindBySelfieRequest {
  image_b64: string;
  bib: string;
  organizer_id: string;
  event_id: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const request: FindBySelfieRequest = JSON.parse(event.body);
    console.log('Request:', { ...request, image_b64: '[REDACTED]' });

    // TODO: Implement find by selfie logic
    // 1. Base64 이미지 디코딩
    // 2. Rekognition SearchFacesByImage 호출
    // 3. face_id로 PhotoFaces 테이블 쿼리
    // 4. 중복 제거
    // 5. 응답 반환

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Selfie search completed',
        new_photos: []
      })
    };
  } catch (error) {
    console.error('Error processing selfie search:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

