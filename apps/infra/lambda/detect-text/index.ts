import { Context, EventBridgeEvent } from 'aws-lambda';

interface S3ObjectCreatedDetail {
  version: string;
  bucket: {
    name: string;
  };
  object: {
    key: string;
    size: number;
    etag: string;
    sequencer: string;
  };
  'request-id': string;
  requester: string;
  'source-ip-address': string;
  reason: string;
}

export const handler = async (
  event: EventBridgeEvent<'Object Created', S3ObjectCreatedDetail>,
  context: Context
): Promise<{ statusCode: number; body: string }> => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    const bucketName = event.detail.bucket.name;
    const objectKey = event.detail.object.key;

    console.log(`Processing image: s3://${bucketName}/${objectKey}`);

    // TODO: Implement detect text logic
    // 1. S3에서 이미지 가져오기
    // 2. Rekognition DetectText 호출
    // 3. 워터마크 필터링
    // 4. 유효한 Bib 매칭
    // 5. DynamoDB에 저장
    // 6. SQS에 메시지 전송

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Image processed successfully',
        bucket: bucketName,
        key: objectKey
      })
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

