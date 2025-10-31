import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import { BaseFunctionConstruct } from './base-function.construct';
import { Constants } from '../../config/constants';

export interface FindBySelfieConstructProps {
  stage: string;
  photosTable: dynamodb.ITable;
  photoFacesTable: dynamodb.ITable;
  runnersTable: dynamodb.ITable;
  eventsTable: dynamodb.ITable;
}

export class FindBySelfieConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: FindBySelfieConstructProps) {
    super(scope, id);

    const baseFunction = new BaseFunctionConstruct(this, 'FindBySelfieFunction', {
      functionName: Constants.FUNCTIONS.FIND_BY_SELFIE,
      handler: 'index.handler',
      codePath: 'find-by-selfie',
      timeout: Duration.seconds(30),
      memorySize: 1024,
      stage: props.stage,
      environment: {
        PHOTOS_TABLE_NAME: props.photosTable.tableName,
        PHOTO_FACES_TABLE_NAME: props.photoFacesTable.tableName,
        RUNNERS_TABLE_NAME: props.runnersTable.tableName,
        EVENTS_TABLE_NAME: props.eventsTable.tableName
      }
    });

    this.function = baseFunction.function;

    // 권한 부여
    props.photosTable.grantReadData(this.function);
    props.photoFacesTable.grantReadData(this.function);
    props.runnersTable.grantReadData(this.function);
    props.eventsTable.grantReadData(this.function);

    // Rekognition 권한
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rekognition:SearchFacesByImage'],
      resources: ['*']
    }));
  }
}

