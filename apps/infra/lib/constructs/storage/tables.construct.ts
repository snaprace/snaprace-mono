import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Constants } from '../../config/constants';

export interface TablesConstructProps {
  stage: string;
}

export class TablesConstruct extends Construct {
  public readonly photosTable: dynamodb.Table;
  public readonly photoFacesTable: dynamodb.Table;
  public readonly runnersTable: dynamodb.Table;
  public readonly eventsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TablesConstructProps) {
    super(scope, id);

    const isProd = props.stage === 'prod';

    // Photos 테이블: 사진 메타데이터
    this.photosTable = new dynamodb.Table(this, 'PhotosTable', {
      tableName: `${Constants.PROJECT_NAME}-${Constants.TABLES.PHOTOS}-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      pointInTimeRecovery: isProd,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // GSI1: Bib별 사진 조회
    this.photosTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // PhotoFaces 테이블: 얼굴-사진 매핑
    this.photoFacesTable = new dynamodb.Table(this, 'PhotoFacesTable', {
      tableName: `${Constants.PROJECT_NAME}-${Constants.TABLES.PHOTO_FACES}-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // Runners 테이블: 참가자 정보
    this.runnersTable = new dynamodb.Table(this, 'RunnersTable', {
      tableName: `${Constants.PROJECT_NAME}-${Constants.TABLES.RUNNERS}-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // Events 테이블: 이벤트 정보
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: `${Constants.PROJECT_NAME}-${Constants.TABLES.EVENTS}-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });
  }
}

