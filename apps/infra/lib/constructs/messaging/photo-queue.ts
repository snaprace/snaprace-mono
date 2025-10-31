import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsToLambda } from '@aws-solutions-constructs/aws-sqs-lambda';
import { LambdaToSqs } from '@aws-solutions-constructs/aws-lambda-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface PhotoQueueProps {
  consumerFunction: lambda.Function;
  producerFunctions?: lambda.Function[];
  queueName?: string;
}

export class PhotoQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly sqsToLambda: SqsToLambda;
  public readonly lambdaToSqsList: LambdaToSqs[];

  constructor(scope: Construct, id: string, props: PhotoQueueProps) {
    super(scope, id);

    // DLQ 생성
    this.deadLetterQueue = new sqs.Queue(this, 'PhotoDLQ', {
      retentionPeriod: cdk.Duration.days(14),
      queueName: `${props.queueName || 'snaprace-photo-processing'}-dlq`,
    });

    // Solutions Construct로 SQS + Lambda 통합
    this.sqsToLambda = new SqsToLambda(this, 'PhotoProcessingQueue', {
      existingLambdaObj: props.consumerFunction,
      queueProps: {
        queueName: props.queueName || 'snaprace-photo-processing-queue',
        visibilityTimeout: cdk.Duration.seconds(120),
        deadLetterQueue: {
          queue: this.deadLetterQueue,
          maxReceiveCount: 5,
        },
      },
      sqsEventSourceProps: {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(10),
      },
    });

    this.queue = this.sqsToLambda.sqsQueue;

    // Producer Lambda 함수들에 메시지 전송 권한 부여
    this.lambdaToSqsList = [];
    if (props.producerFunctions) {
      props.producerFunctions.forEach((fn, index) => {
        this.lambdaToSqsList.push(
          new LambdaToSqs(this, `LambdaToSqs${index}`, {
            existingLambdaObj: fn,
            existingQueueObj: this.queue,
            queuePermissions: ['Send'],
          })
        );
      });
    }
  }
}

