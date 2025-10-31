import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import { BaseFunctionConstruct } from './base-function.construct';
import { Constants } from '../../config/constants';

export interface DetectTextConstructProps {
  stage: string;
  photosBucket: s3.IBucket;
  photosTable: dynamodb.ITable;
  runnersTable: dynamodb.ITable;
  queue: sqs.IQueue;
}

export class DetectTextConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: DetectTextConstructProps) {
    super(scope, id);

    const baseFunction = new BaseFunctionConstruct(this, 'DetectTextFunction', {
      functionName: Constants.FUNCTIONS.DETECT_TEXT,
      handler: 'index.handler',
      codePath: 'detect-text',
      timeout: Duration.seconds(30),
      memorySize: 512,
      stage: props.stage,
      environment: {
        PHOTOS_TABLE_NAME: props.photosTable.tableName,
        RUNNERS_TABLE_NAME: props.runnersTable.tableName,
        QUEUE_URL: props.queue.queueUrl,
        PHOTOS_BUCKET_NAME: props.photosBucket.bucketName,
        MIN_TEXT_CONFIDENCE: '80'
      }
    });

    this.function = baseFunction.function;

    // 권한 부여
    props.photosBucket.grantRead(this.function);
    props.photosTable.grantWriteData(this.function);
    props.runnersTable.grantReadData(this.function);
    props.queue.grantSendMessages(this.function);

    // Rekognition 권한
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rekognition:DetectText'],
      resources: ['*']
    }));
  }
}

