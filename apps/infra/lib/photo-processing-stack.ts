import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as logs from "aws-cdk-lib/aws-logs";
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
    // Lambda Functions (Processing)
    // ============================================================================

    // 1. Detect Text Lambda (Bib Number Extraction)
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

    // 2. Index Faces Lambda (Face Detection & Indexing)
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

    // 3. DB Update Lambda (Runners PhotoKeys Update)
    const dbUpdateLambda = new lambda.Function(this, "DbUpdateLambda", {
      functionName: "photo-processing-db-update",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/photo-process/db-update")),
      layers: [commonLayer],
      environment: {
        ...commonEnv,
      },
      timeout: Duration.seconds(30),
      memorySize: 256,
      description: "Updates Runners table PhotoKeys with detected photos",
    });

    // DB Update Lambda 권한 부여
    eventPhotosTable.grantReadWriteData(dbUpdateLambda);
    runnersTable.grantReadWriteData(dbUpdateLambda); // PhotoKeys 업데이트용

    // DynamoDB DescribeTable 권한 (테이블 존재 여부 확인)
    dbUpdateLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:DescribeTable"],
        resources: [runnersTable.tableArn],
      })
    );

    // ============================================================================
    // Step Functions State Machine
    // ============================================================================

    // Step Functions Tasks 정의
    const detectTextTask = new tasks.LambdaInvoke(this, "DetectTextTask", {
      lambdaFunction: detectTextLambda,
      outputPath: "$.Payload",
      retryOnServiceExceptions: true,
      resultPath: "$",
    });

    const indexFacesTask = new tasks.LambdaInvoke(this, "IndexFacesTask", {
      lambdaFunction: indexFacesLambda,
      outputPath: "$.Payload",
      retryOnServiceExceptions: true,
      resultPath: "$",
    });

    const dbUpdateTask = new tasks.LambdaInvoke(this, "DbUpdateTask", {
      lambdaFunction: dbUpdateLambda,
      outputPath: "$.Payload",
      retryOnServiceExceptions: true,
      resultPath: "$",
    });

    // State Machine 정의 (체인 구성)
    const definition = detectTextTask.next(indexFacesTask).next(dbUpdateTask);

    // CloudWatch Log Group
    const stateMachineLogGroup = new logs.LogGroup(this, "StateMachineLogGroup", {
      logGroupName: "/aws/stepfunctions/photo-processing",
      removalPolicy,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // State Machine 생성
    const stateMachine = new sfn.StateMachine(this, "PhotoProcessingStateMachine", {
      stateMachineName: "photo-processing-workflow",
      definition,
      timeout: Duration.minutes(5),
      tracingEnabled: true,
      logs: {
        destination: stateMachineLogGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
    });

    // ============================================================================
    // Starter Lambda (S3 Event Handler)
    // ============================================================================

    const starterLambda = new lambda.Function(this, "StarterLambda", {
      functionName: "photo-processing-starter",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/photo-process/starter-lambda")),
      layers: [commonLayer],
      environment: {
        ...commonEnv,
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
      timeout: Duration.seconds(30),
      memorySize: 256,
      description: "Handles S3 upload events and initiates photo processing workflow",
    });

    // Starter Lambda 권한 부여
    photosBucket.grantRead(starterLambda);
    eventPhotosTable.grantReadWriteData(starterLambda);
    stateMachine.grantStartExecution(starterLambda);

    // ============================================================================
    // Outputs
    // ============================================================================

    new cdk.CfnOutput(this, "StateMachineArn", {
      value: stateMachine.stateMachineArn,
      description: "Photo Processing State Machine ARN",
      exportName: "PhotoProcessingStateMachineArn",
    });

    new cdk.CfnOutput(this, "PhotosBucketName", {
      value: photosBucket.bucketName,
      description: "Photos S3 Bucket Name",
      exportName: "PhotosBucketName",
    });

    new cdk.CfnOutput(this, "StarterLambdaName", {
      value: starterLambda.functionName,
      description: "Starter Lambda Function Name",
      exportName: "StarterLambdaName",
    });

    // ============================================================================
    // S3 Event Notification (Starter Lambda 자동 실행)
    // ============================================================================

    // S3 객체 생성 이벤트를 Starter Lambda에 연결
    // photos/raw/ 경로에 업로드되는 이미지 파일만 처리
    photosBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(starterLambda), {
      prefix: "", // 모든 조직자/이벤트
      suffix: "", // 모든 파일 (Starter Lambda에서 경로 검증)
    });

    new cdk.CfnOutput(this, "EventNotificationStatus", {
      value: "Configured for s3:ObjectCreated:* events",
      description: "S3 Event Notification Status",
    });

    // ============================================================================
    // Search API Lambda Functions
    // ============================================================================

    // 1. Search by Bib Lambda
    const searchByBibLambda = new lambda.Function(this, "SearchByBibLambda", {
      functionName: "photo-search-by-bib",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/search-api/search-by-bib")),
      layers: [commonLayer],
      environment: {
        ...commonEnv,
      },
      timeout: Duration.seconds(30),
      memorySize: 256,
      description: "Search photos by Bib number",
    });

    // Search by Bib Lambda 권한
    photoBibIndexTable.grantReadData(searchByBibLambda);
    runnersTable.grantReadData(searchByBibLambda);

    // 2. Search by Selfie Lambda
    const searchBySelfieLambda = new lambda.Function(this, "SearchBySelfieLambda", {
      functionName: "photo-search-by-selfie",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/search-api/search-by-selfie")),
      layers: [commonLayer],
      environment: {
        ...commonEnv,
      },
      timeout: Duration.seconds(30),
      memorySize: 512,
      description: "Search photos by selfie using facial recognition",
    });

    // Search by Selfie Lambda 권한
    runnersTable.grantReadWriteData(searchBySelfieLambda); // 선택적으로 PhotoKeys 업데이트

    // Rekognition 권한
    searchBySelfieLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:SearchFacesByImage"],
        resources: ["*"],
      })
    );

    // ============================================================================
    // API Gateway
    // ============================================================================

    const api = new apigateway.RestApi(this, "PhotoSearchAPI", {
      restApiName: "SnapRace Photo Search API",
      description: "API for searching photos by Bib number or selfie",
      deployOptions: {
        stageName: "prod",
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ["http://localhost:3000", "https://snap-race.com"],
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "X-Amz-Security-Token"],
        allowCredentials: false,
      },
    });

    // API 리소스 구조
    const searchResource = api.root.addResource("search");
    const bibResource = searchResource.addResource("bib");
    const selfieResource = searchResource.addResource("selfie");

    // GET /search/bib
    bibResource.addMethod("GET", new apigateway.LambdaIntegration(searchByBibLambda), {
      apiKeyRequired: false,
    });

    // POST /search/selfie
    selfieResource.addMethod("POST", new apigateway.LambdaIntegration(searchBySelfieLambda), {
      apiKeyRequired: false,
    });

    // ============================================================================
    // API Gateway Outputs
    // ============================================================================

    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: api.url,
      description: "Photo Search API URL",
      exportName: "PhotoSearchApiUrl",
    });

    new cdk.CfnOutput(this, "ApiGatewayId", {
      value: api.restApiId,
      description: "Photo Search API ID",
      exportName: "PhotoSearchApiId",
    });

    new cdk.CfnOutput(this, "SearchByBibEndpoint", {
      value: `${api.url}search/bib?organizer={org}&eventId={event}&bibNumber={bib}`,
      description: "Search by Bib Number Endpoint",
    });

    new cdk.CfnOutput(this, "SearchBySelfieEndpoint", {
      value: `${api.url}search/selfie`,
      description: "Search by Selfie Endpoint (POST)",
    });
  }
}
