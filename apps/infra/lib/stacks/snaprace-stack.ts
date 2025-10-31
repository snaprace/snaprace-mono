import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { TablesConstruct } from '../constructs/storage/tables.construct';
import { PhotosBucketConstruct } from '../constructs/storage/photos-bucket.construct';
import { PhotoQueueConstruct } from '../constructs/messaging/photo-queue.construct';
import { DetectTextConstruct } from '../constructs/compute/detect-text.construct';
import { IndexFacesConstruct } from '../constructs/compute/index-faces.construct';
import { FindBySelfieConstruct } from '../constructs/compute/find-by-selfie.construct';
import { RestApiConstruct } from '../constructs/api/rest-api.construct';
import { AlarmsConstruct } from '../constructs/monitoring/alarms.construct';
import { getConfig } from '../config/environment';
import { Constants } from '../config/constants';

export interface SnapRaceStackProps extends cdk.StackProps {
  stage: string;
}

export class SnapRaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SnapRaceStackProps) {
    super(scope, id, props);

    const config = getConfig(props.stage);

    // 1. Storage Layer
    const tables = new TablesConstruct(this, 'Tables', {
      stage: props.stage
    });

    const photosBucket = new PhotosBucketConstruct(this, 'PhotosBucket', {
      stage: props.stage
    });

    // 2. Messaging Layer
    const photoQueue = new PhotoQueueConstruct(this, 'PhotoQueue', {
      stage: props.stage
    });

    // 3. Compute Layer
    const detectText = new DetectTextConstruct(this, 'DetectText', {
      stage: props.stage,
      photosBucket: photosBucket.bucket,
      photosTable: tables.photosTable,
      runnersTable: tables.runnersTable,
      queue: photoQueue.queue
    });

    const indexFaces = new IndexFacesConstruct(this, 'IndexFaces', {
      stage: props.stage,
      photosTable: tables.photosTable,
      photoFacesTable: tables.photoFacesTable,
      queue: photoQueue.queue
    });

    const findBySelfie = new FindBySelfieConstruct(this, 'FindBySelfie', {
      stage: props.stage,
      photosTable: tables.photosTable,
      photoFacesTable: tables.photoFacesTable,
      runnersTable: tables.runnersTable,
      eventsTable: tables.eventsTable
    });

    // 4. API Layer
    const api = new RestApiConstruct(this, 'RestApi', {
      stage: props.stage,
      findBySelfieFunction: findBySelfie.function
    });

    // 5. Monitoring Layer
    const alarms = new AlarmsConstruct(this, 'Alarms', {
      stage: props.stage,
      functions: [
        detectText.function,
        indexFaces.function,
        findBySelfie.function
      ],
      dlq: photoQueue.dlq
    });

    // 6. Event Routing
    // S3 Upload → EventBridge → detect_text Lambda
    const photoUploadRule = new events.Rule(this, 'PhotoUploadRule', {
      ruleName: `${Constants.PROJECT_NAME}-photo-upload-${props.stage}`,
      description: 'Trigger Lambda when photo is uploaded to S3',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [photosBucket.bucket.bucketName]
          },
          object: {
            key: [
              { 'wildcard': Constants.S3_PATHS.RAW_PHOTOS }
            ]
          }
        }
      }
    });

    photoUploadRule.addTarget(
      new targets.LambdaFunction(detectText.function, {
        maxEventAge: cdk.Duration.hours(2),
        retryAttempts: 2
      })
    );

    // 7. CloudFormation Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${Constants.PROJECT_NAME}-api-url-${props.stage}`
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: api.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${Constants.PROJECT_NAME}-api-id-${props.stage}`
    });

    new cdk.CfnOutput(this, 'PhotosBucketName', {
      value: photosBucket.bucket.bucketName,
      description: 'Photos S3 bucket name',
      exportName: `${Constants.PROJECT_NAME}-photos-bucket-${props.stage}`
    });

    new cdk.CfnOutput(this, 'PhotosBucketArn', {
      value: photosBucket.bucket.bucketArn,
      description: 'Photos S3 bucket ARN',
      exportName: `${Constants.PROJECT_NAME}-photos-bucket-arn-${props.stage}`
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: photoQueue.queue.queueUrl,
      description: 'Photo processing queue URL',
      exportName: `${Constants.PROJECT_NAME}-queue-url-${props.stage}`
    });

    new cdk.CfnOutput(this, 'DLQUrl', {
      value: photoQueue.dlq.queueUrl,
      description: 'Dead letter queue URL',
      exportName: `${Constants.PROJECT_NAME}-dlq-url-${props.stage}`
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarms.alarmTopic.topicArn,
      description: 'SNS topic ARN for alarms',
      exportName: `${Constants.PROJECT_NAME}-alarm-topic-${props.stage}`
    });

    new cdk.CfnOutput(this, 'PhotosTableName', {
      value: tables.photosTable.tableName,
      description: 'Photos DynamoDB table name',
      exportName: `${Constants.PROJECT_NAME}-photos-table-${props.stage}`
    });

    new cdk.CfnOutput(this, 'PhotoFacesTableName', {
      value: tables.photoFacesTable.tableName,
      description: 'PhotoFaces DynamoDB table name',
      exportName: `${Constants.PROJECT_NAME}-photo-faces-table-${props.stage}`
    });

    new cdk.CfnOutput(this, 'RunnersTableName', {
      value: tables.runnersTable.tableName,
      description: 'Runners DynamoDB table name',
      exportName: `${Constants.PROJECT_NAME}-runners-table-${props.stage}`
    });

    new cdk.CfnOutput(this, 'EventsTableName', {
      value: tables.eventsTable.tableName,
      description: 'Events DynamoDB table name',
      exportName: `${Constants.PROJECT_NAME}-events-table-${props.stage}`
    });
  }
}

