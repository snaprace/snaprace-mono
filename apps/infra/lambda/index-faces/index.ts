import { Context, SQSEvent, SQSBatchResponse } from 'aws-lambda';

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      console.log('Processing message:', message);

      // TODO: Implement index faces logic
      // 1. Rekognition Collection 확인/생성
      // 2. Rekognition IndexFaces 호출
      // 3. Rekognition SearchFaces 호출
      // 4. Bib 결정 로직
      // 5. Photos 테이블 업데이트
      // 6. PhotoFaces 테이블 저장

    } catch (error) {
      console.error('Error processing record:', error);
      // 실패한 메시지는 재처리를 위해 추가
      batchItemFailures.push({
        itemIdentifier: record.messageId
      });
    }
  }

  return { batchItemFailures };
};

