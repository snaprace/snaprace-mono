import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseLambda } from '../constructs/compute/base-lambda';
import { PhotoBucket } from '../constructs/storage/photo-bucket';
import { PhotosTable } from '../constructs/database/photos-table';
import { PhotoFacesTable } from '../constructs/database/photo-faces-table';
import { RunnersTable } from '../constructs/database/runners-table';
import { EventsTable } from '../constructs/database/events-table';
import { PhotoQueue } from '../constructs/messaging/photo-queue';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class SnapRaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Lambda 함수들 생성
    const detectTextFunction = new BaseLambda(this, 'DetectTextLambda', {
      functionName: 'snaprace-detect-text',
      code: lambda.Code.fromAsset('lambda/detect-text'),
      handler: 'index.handler',
      environment: {
        PHOTOS_TABLE_NAME: 'snaprace-photos',
        RUNNERS_TABLE_NAME: 'snaprace-runners',
        QUEUE_URL: 'PLACEHOLDER', // 나중에 업데이트
      },
    }).function;

    const indexFacesFunction = new BaseLambda(this, 'IndexFacesLambda', {
      functionName: 'snaprace-index-faces',
      code: lambda.Code.fromAsset('lambda/index-faces'),
      handler: 'index.handler',
      environment: {
        PHOTOS_TABLE_NAME: 'snaprace-photos',
        PHOTO_FACES_TABLE_NAME: 'snaprace-photo-faces',
      },
    }).function;

    const findBySelfieFunction = new BaseLambda(this, 'FindBySelfieLambda', {
      functionName: 'snaprace-find-by-selfie',
      code: lambda.Code.fromAsset('lambda/find-by-selfie'),
      handler: 'index.handler',
      environment: {
        PHOTOS_TABLE_NAME: 'snaprace-photos',
        PHOTO_FACES_TABLE_NAME: 'snaprace-photo-faces',
        RUNNERS_TABLE_NAME: 'snaprace-runners',
        EVENTS_TABLE_NAME: 'snaprace-events',
      },
    }).function;

    // 2. DynamoDB 테이블 생성 및 Lambda 연결
    const photosTable = new PhotosTable(this, 'PhotosTable', {
      lambdaFunctions: [detectTextFunction, indexFacesFunction, findBySelfieFunction],
      tableName: 'snaprace-photos',
    });

    const photoFacesTable = new PhotoFacesTable(this, 'PhotoFacesTable', {
      lambdaFunctions: [indexFacesFunction, findBySelfieFunction],
      tableName: 'snaprace-photo-faces',
    });

    const runnersTable = new RunnersTable(this, 'RunnersTable', {
      lambdaFunctions: [detectTextFunction, findBySelfieFunction],
      tableName: 'snaprace-runners',
    });

    const eventsTable = new EventsTable(this, 'EventsTable', {
      lambdaFunctions: [findBySelfieFunction],
      tableName: 'snaprace-events',
    });

    // 3. SQS 큐 생성 및 Lambda 연결
    const photoQueue = new PhotoQueue(this, 'PhotoQueue', {
      consumerFunction: indexFacesFunction,
      producerFunctions: [detectTextFunction],
      queueName: 'snaprace-photo-processing',
    });

    // 환경 변수 업데이트
    detectTextFunction.addEnvironment('QUEUE_URL', photoQueue.queue.queueUrl);

    // 4. S3 버킷 생성 및 Lambda 연결
    const photoBucket = new PhotoBucket(this, 'PhotoBucket', {
      detectTextFunction,
      bucketName: `snaprace-photos-${this.account}-${this.region}`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'PhotoBucketName', {
      value: photoBucket.bucket.bucketName,
      description: 'S3 Photo Bucket Name',
    });

    new cdk.CfnOutput(this, 'PhotoQueueUrl', {
      value: photoQueue.queue.queueUrl,
      description: 'SQS Photo Processing Queue URL',
    });

    new cdk.CfnOutput(this, 'PhotosTableName', {
      value: photosTable.table.tableName,
      description: 'DynamoDB Photos Table Name',
    });
  }
}

