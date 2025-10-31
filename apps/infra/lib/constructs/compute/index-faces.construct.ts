import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import { BaseFunctionConstruct } from './base-function.construct';
import { Constants } from '../../config/constants';

export interface IndexFacesConstructProps {
  stage: string;
  photosTable: dynamodb.ITable;
  photoFacesTable: dynamodb.ITable;
  queue: sqs.IQueue;
}

export class IndexFacesConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: IndexFacesConstructProps) {
    super(scope, id);

    const baseFunction = new BaseFunctionConstruct(this, 'IndexFacesFunction', {
      functionName: Constants.FUNCTIONS.INDEX_FACES,
      handler: 'index.handler',
      codePath: 'index-faces',
      timeout: Duration.seconds(60),
      memorySize: 1024,
      stage: props.stage,
      environment: {
        PHOTOS_TABLE_NAME: props.photosTable.tableName,
        PHOTO_FACES_TABLE_NAME: props.photoFacesTable.tableName
      }
    });

    this.function = baseFunction.function;

    // SQS 이벤트 소스 연결
    this.function.addEventSource(new lambdaEventSources.SqsEventSource(props.queue, {
      batchSize: 5,
      maxBatchingWindow: Duration.seconds(10),
      reportBatchItemFailures: true
    }));

    // 권한 부여
    props.photosTable.grantReadWriteData(this.function);
    props.photoFacesTable.grantWriteData(this.function);

    // Rekognition 권한
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rekognition:IndexFaces',
        'rekognition:SearchFaces',
        'rekognition:CreateCollection',
        'rekognition:DescribeCollection'
      ],
      resources: ['*']
    }));
  }
}

