import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Duration } from 'aws-cdk-lib';
import { Constants } from '../../config/constants';

export interface PhotoQueueConstructProps {
  stage: string;
}

export class PhotoQueueConstruct extends Construct {
  public readonly queue: sqs.Queue;
  public readonly dlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: PhotoQueueConstructProps) {
    super(scope, id);

    // Dead Letter Queue
    this.dlq = new sqs.Queue(this, 'PhotoDLQ', {
      queueName: `${Constants.PROJECT_NAME}-${Constants.QUEUES.PHOTO_DLQ}-${props.stage}`,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED
    });

    // Main Queue
    this.queue = new sqs.Queue(this, 'PhotoQueue', {
      queueName: `${Constants.PROJECT_NAME}-${Constants.QUEUES.PHOTO_PROCESSING}-${props.stage}`,
      
      // 타임아웃 설정 (Lambda timeout보다 6배 길게)
      visibilityTimeout: Duration.seconds(180),
      
      // 배치 처리 설정
      receiveMessageWaitTime: Duration.seconds(20),  // Long polling
      
      // DLQ 설정
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 5  // 5번 실패 시 DLQ로 이동
      },
      
      // 보안
      encryption: sqs.QueueEncryption.SQS_MANAGED
    });
  }
}

