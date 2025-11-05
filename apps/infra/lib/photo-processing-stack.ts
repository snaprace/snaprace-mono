import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import * as rekognition from "aws-cdk-lib/aws-rekognition";
import * as path from "path";

export class PhotoProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const removalPolicy = RemovalPolicy.DESTROY;

    // ============================================================================
    // S3 Bucket
    // ============================================================================
    // photos bucket: snaprace/<org>/<event>/photos/raw/
    const photosBucket = new s3.Bucket(this, "SnapRaceBucket", {
      bucketName: "snaprace",
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: true,
    });

    // ============================================================================
    // DynamoDB Tables
    // ============================================================================
    // 1. EventPhotos table
    const eventPhotosTable = new dynamodb.TableV2(this, "EventPhotosTable", {
      tableName: "EventPhotos",
      partitionKey: { name: "EventKey", type: dynamodb.AttributeType.STRING }, // "ORG#<org>#EVT#<event>"
      sortKey: { name: "S3ObjectKey", type: dynamodb.AttributeType.STRING }, // S3 객체 경로
      removalPolicy,
    });

    // 2. PhotoBibIndex table
    const photoBibIndexTable = new dynamodb.TableV2(this, "PhotoBibIndexTable", {
      tableName: "PhotoBibIndex",
      partitionKey: {
        name: "EventBibKey", // "ORG#<org>#EVT#<event>#BIB#<bib>"
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "S3ObjectKey", // "S3ObjectKey"
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy,
    });

    // 3. RunnersV2 table
    const runnersTable = new dynamodb.TableV2(this, "RunnersTable", {
      tableName: "RunnersV2",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING }, // "ORG#<org>#EVT#<event>#RUNNER#<runner_id>"
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING }, // "BIB#<bib>"
      removalPolicy,
    });

    // TODO: GSI 1: ByRunnerId
    // runnersTable.addGlobalSecondaryIndex({
    //   indexName: 'RunnerIdIndex',
    //   partitionKey: {
    //     name: 'RunnerId',
    //     type: dynamodb.AttributeType.STRING
    //   },
    //   projectionType: dynamodb.ProjectionType.ALL,
    // });

    // ============================================================================
    // Lambda Layer (Common Layer)
    // ============================================================================
    const commonLayer = new lambda.LayerVersion(this, "CommonLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/common-layer/nodejs"), {
        bundling: {
          image: lambda.Runtime.NODEJS_18_X.bundlingImage,
          command: [
            "bash",
            "-c",
            [
              "mkdir -p /asset-output/nodejs",
              "cp -r /asset-input/* /asset-output/nodejs/",
              "cd /asset-output/nodejs",
              "npm install --production",
            ].join(" && "),
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X, lambda.Runtime.NODEJS_20_X],
      description: "Common dependencies and utilities for Photo Processing Lambdas",
      removalPolicy,
    });

    // ============================================================================
    // 환경 변수 (모든 Lambda에서 공유)
    // ============================================================================
    const commonEnv: Record<string, string> = {
      // 공통
      AWS_REGION: this.region,
      STAGE: "dev",
      LOG_LEVEL: "INFO",

      // S3
      PHOTOS_BUCKET: photosBucket.bucketName,

      // DynamoDB
      EVENT_PHOTOS_TABLE: eventPhotosTable.tableName,
      PHOTO_BIB_INDEX_TABLE: photoBibIndexTable.tableName,
      RUNNERS_TABLE: runnersTable.tableName,

      // Rekognition
      REKOGNITION_COLLECTION_PREFIX: "snaprace",

      // Bib Number 설정
      BIB_NUMBER_MIN: "1",
      BIB_NUMBER_MAX: "99999",

      // 필터링 설정
      WATERMARK_FILTER_ENABLED: "true",
      WATERMARK_AREA_THRESHOLD: "0.35",
      MIN_TEXT_HEIGHT_PX: "50",
      MIN_TEXT_CONFIDENCE: "90",

      // Rekognition 설정
      MIN_FACE_CONFIDENCE: "90",
      MAX_FACES_PER_PHOTO: "10",
    };

    // ============================================================================
    // Lambda Functions
    // ============================================================================

    // 1. Starter Lambda (S3 Event Handler)
    const starterLambda = new lambda.Function(this, "StarterLambda", {
      functionName: "photo-processing-starter",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/photo-process/starter-lambda")),
      layers: [commonLayer],
      environment: {
        ...commonEnv,
        STATE_MACHINE_ARN: "", // Step Functions 생성 후 업데이트 필요
      },
      timeout: Duration.seconds(30),
      memorySize: 256,
      description: "Handles S3 upload events and initiates photo processing workflow",
    });

    // Starter Lambda 권한 부여
    photosBucket.grantRead(starterLambda);
    eventPhotosTable.grantReadWriteData(starterLambda);
    // Step Functions 실행 권한은 State Machine 생성 후 추가

    // 2. Detect Text Lambda (Bib Number Extraction)
    const detectTextLambda = new lambda.Function(this, "DetectTextLambda", {
      functionName: "photo-processing-detect-text",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/photo-process/detect-text")),
      layers: [commonLayer],
      environment: {
        ...commonEnv,
      },
      timeout: Duration.seconds(60),
      memorySize: 512,
      description: "Detects text and extracts Bib numbers from race photos using Rekognition",
    });

    // Detect Text Lambda 권한 부여
    photosBucket.grantRead(detectTextLambda);
    eventPhotosTable.grantReadWriteData(detectTextLambda);
    photoBibIndexTable.grantReadWriteData(detectTextLambda);
    runnersTable.grantReadData(detectTextLambda); // Bib 검증용 (선택적)

    // Rekognition 권한
    detectTextLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectText"],
        resources: ["*"],
      })
    );

    // 3. Index Faces Lambda (Face Detection & Indexing)
    const indexFacesLambda = new lambda.Function(this, "IndexFacesLambda", {
      functionName: "photo-processing-index-faces",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/photo-process/index-faces")),
      layers: [commonLayer],
      environment: {
        ...commonEnv,
      },
      timeout: Duration.seconds(60),
      memorySize: 512,
      description: "Indexes faces from race photos to Rekognition Collection",
    });

    // Index Faces Lambda 권한 부여
    photosBucket.grantRead(indexFacesLambda);
    eventPhotosTable.grantReadWriteData(indexFacesLambda);

    // Rekognition 권한 (DetectFaces, IndexFaces, Collection 관리)
    indexFacesLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "rekognition:DetectFaces",
          "rekognition:IndexFaces",
          "rekognition:CreateCollection",
          "rekognition:DescribeCollection",
        ],
        resources: ["*"],
      })
    );

    // TODO: DB Update Lambda
    // TODO: Step Functions State Machine
    // TODO: S3 Event Notification (Starter Lambda 연결)
  }
}
