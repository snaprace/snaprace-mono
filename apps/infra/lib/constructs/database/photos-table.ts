import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface PhotosTableProps {
  lambdaFunctions: lambda.Function[];
  tableName?: string;
}

export class PhotosTable extends Construct {
  public readonly table: dynamodb.Table;
  public readonly lambdaToDynamoDBs: LambdaToDynamoDB[];

  constructor(scope: Construct, id: string, props: PhotosTableProps) {
    super(scope, id);

    // DynamoDB 테이블 먼저 생성
    this.table = new dynamodb.Table(this, 'PhotosTable', {
      tableName: props.tableName || 'snaprace-photos',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // GSI 추가
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // 각 Lambda 함수에 권한 부여
    this.lambdaToDynamoDBs = props.lambdaFunctions.map((fn, index) => {
      return new LambdaToDynamoDB(this, `LambdaToDynamoDB${index}`, {
        existingLambdaObj: fn,
        existingTableObj: this.table,
        tablePermissions: 'ReadWrite',
      });
    });
  }
}

