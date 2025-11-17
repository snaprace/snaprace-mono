import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";

export class ImageRekognitionStack extends cdk.Stack {
  public readonly imageBucket: s3.Bucket;
  public readonly photoServiceTable: dynamodb.TableV2;
  public readonly preprocessFn: NodejsFunction;
  public readonly detectTextFn: NodejsFunction;
  public readonly indexFacesFn: NodejsFunction;
  public readonly fanoutDdbFn: NodejsFunction;
  public readonly stateMachine: sfn.StateMachine;
  public readonly sfnTriggerFn: NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===================================
    // S3 Bucket for Image Storage
    // ===================================
    this.imageBucket = new s3.Bucket(this, "ImageBucket", {
      bucketName: "snaprace-images",

      // CORS for direct upload from frontend
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"], // TODO: Restrict to actual domains in production
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],

      // Intelligent-Tiering configuration
      intelligentTieringConfigurations: [
        {
          name: "ArchiveConfiguration",
          archiveAccessTierTime: cdk.Duration.days(90),
          deepArchiveAccessTierTime: cdk.Duration.days(180),
        },
      ],

      // Block public access by default (CloudFront will serve)
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // Encryption
      encryption: s3.BucketEncryption.S3_MANAGED,

      // Lifecycle
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ===================================
    // DynamoDB Table: PhotoService
    // ===================================
    this.photoServiceTable = new dynamodb.TableV2(this, "PhotoServiceTable", {
      tableName: "PhotoService",
      // Primary Key
      partitionKey: {
        name: "PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: dynamodb.AttributeType.STRING,
      },

      // Billing (on-demand)
      billing: dynamodb.Billing.onDemand(),

      // Stream for CDC (Change Data Capture)
      // stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,

      // Point-in-Time Recovery
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },

      // Lifecycle
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI1: BIB 검색용 (BIB_INDEX 전용)
    this.photoServiceTable.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: {
        name: "GSI1PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "GSI1SK",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Photographer 검색용 (PHOTO 전용)
    this.photoServiceTable.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: {
        name: "GSI2PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "GSI2SK",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ===================================
    // Lambda: Preprocess
    // ===================================
    this.preprocessFn = new NodejsFunction(this, "PreprocessFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/preprocess/index.ts"),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        IMAGE_BUCKET: this.imageBucket.bucketName,
      },
      bundling: {
        externalModules: ["sharp"],
        nodeModules: ["sharp"],
        commandHooks: {
          beforeBundling(): string[] {
            return [];
          },
          beforeInstall(): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              `cd ${outputDir}`,
              "rm -rf node_modules/sharp && npm install --cpu=x64 --os=linux --libc=glibc sharp",
            ];
          },
        },
      },
    });

    // Grant S3 permissions to Preprocess Lambda
    this.imageBucket.grantReadWrite(this.preprocessFn);

    // ===================================
    // Lambda: DetectText
    // ===================================
    this.detectTextFn = new NodejsFunction(this, "DetectTextFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/detect-text/index.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        IMAGE_BUCKET: this.imageBucket.bucketName,
      },
    });

    // Grant S3 read permissions to DetectText Lambda (Rekognition S3Object access)
    this.imageBucket.grantRead(this.detectTextFn);

    // ===================================
    // Lambda: IndexFaces
    // ===================================
    this.indexFacesFn = new NodejsFunction(this, "IndexFacesFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/index-faces/index.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        IMAGE_BUCKET: this.imageBucket.bucketName,
      },
    });

    // Grant S3 read permissions to IndexFaces Lambda (Rekognition S3Object access)
    this.imageBucket.grantRead(this.indexFacesFn);

    // ===================================
    // Lambda: Fanout DynamoDB
    // ===================================
    this.fanoutDdbFn = new NodejsFunction(this, "FanoutDynamoDBFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/fanout-dynamodb/index.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        DDB_TABLE: this.photoServiceTable.tableName,
        // Supabase RDB Truth Layer 조회용 (photographers 등)
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      },
    });

    this.photoServiceTable.grantWriteData(this.fanoutDdbFn);

    // ===================================
    // SQS Queue: ImageUpload
    // ===================================
    const imageUploadDlq = new sqs.Queue(this, "ImageUploadDLQ", {
      retentionPeriod: cdk.Duration.days(14),
    });

    const imageUploadQueue = new sqs.Queue(this, "ImageUploadQueue", {
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: imageUploadDlq,
        maxReceiveCount: 5,
      },
    });

    // S3 ObjectCreated -> SQS 알림
    [".jpg", ".jpeg", ".png", ".heic"].forEach((suffix) => {
      this.imageBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new s3n.SqsDestination(imageUploadQueue),
        { suffix }
      );
    });

    // ===================================
    // Step Functions: ImageProcessingWorkflow
    // ===================================

    // Preprocess → Parallel(DetectText & IndexFaces) → Merge → Fanout

    const preprocessTask = new sfnTasks.LambdaInvoke(
      this,
      "PreprocessImageTask",
      {
        lambdaFunction: this.preprocessFn,
        outputPath: "$.Payload",
      }
    );

    // 개별 분석 람다들은 결과 페이로드만 반환하도록 설정
    const detectTextTask = new sfnTasks.LambdaInvoke(this, "DetectTextTask", {
      lambdaFunction: this.detectTextFn,
      payloadResponseOnly: true,
    });

    const indexFacesTask = new sfnTasks.LambdaInvoke(this, "IndexFacesTask", {
      lambdaFunction: this.indexFacesFn,
      payloadResponseOnly: true,
    });

    const fanoutTask = new sfnTasks.LambdaInvoke(this, "FanoutDynamoDBTask", {
      lambdaFunction: this.fanoutDdbFn,
      outputPath: "$.Payload",
    });

    // Retry/Catch/Fallback 정의
    const processingFailed = new sfn.Fail(this, "ProcessingFailed", {
      error: "ImageProcessingError",
      cause: "Failed to process image",
    });

    // Preprocess: 재시도 후 실패 시 전체 실패 처리
    // preprocessTask.addRetry({
    //   maxAttempts: 3,
    //   backoffRate: 2.0,
    //   interval: cdk.Duration.seconds(2),
    // });
    preprocessTask.addCatch(processingFailed, { resultPath: "$" });

    // DetectText: 실패 시 빈 결과로 대체
    const detectFallback = new sfn.Pass(this, "DetectTextFallback", {
      result: sfn.Result.fromObject({
        bibs: [],
        rawText: [],
        confidence: 0,
      }),
    });
    // detectTextTask.addRetry({
    //   maxAttempts: 2,
    //   backoffRate: 2.0,
    //   interval: cdk.Duration.seconds(1),
    // });
    detectTextTask.addCatch(detectFallback, { resultPath: "$" });

    // IndexFaces: 실패 시 빈 결과로 대체
    const indexFallback = new sfn.Pass(this, "IndexFacesFallback", {
      result: sfn.Result.fromObject({
        faceIds: [],
        faceCount: 0,
      }),
    });
    // indexFacesTask.addRetry({
    //   maxAttempts: 2,
    //   backoffRate: 2.0,
    //   interval: cdk.Duration.seconds(1),
    // });
    indexFacesTask.addCatch(indexFallback, { resultPath: "$" });

    // Fanout: 재시도 후 실패 시 전체 실패 처리
    // fanoutTask.addRetry({
    //   maxAttempts: 3,
    //   backoffRate: 2.0,
    //   interval: cdk.Duration.seconds(2),
    // });
    fanoutTask.addCatch(processingFailed, { resultPath: "$" });

    // 병렬 분석: DetectText와 IndexFaces를 동시에 실행
    const parallelAnalysis = new sfn.Parallel(this, "AnalyzeImage", {
      // 두 브랜치의 결과 배열([detect, index])을 객체로 변환하여 $.analysis에 저장
      resultSelector: {
        "detectTextResult.$": "$[0]",
        "indexFacesResult.$": "$[1]",
      },
      resultPath: "$.analysis",
    });

    parallelAnalysis.branch(detectTextTask).branch(indexFacesTask);

    // Preprocess 결과 + 병렬 분석 결과를 Fanout 입력 스키마로 병합
    const mergeResults = new sfn.Pass(this, "MergeResults", {
      parameters: {
        "orgId.$": "$.orgId",
        "eventId.$": "$.eventId",
        "bucketName.$": "$.bucketName",
        "rawKey.$": "$.rawKey",
        "processedKey.$": "$.processedKey",
        "s3Uri.$": "$.s3Uri",
        "dimensions.$": "$.dimensions",
        "format.$": "$.format",
        "size.$": "$.size",
        "ulid.$": "$.ulid",
        "photographerId.$": "$.photographerId",
        "detectTextResult.$": "$.analysis.detectTextResult",
        "indexFacesResult.$": "$.analysis.indexFacesResult",
      },
    });

    const definition = preprocessTask
      .next(parallelAnalysis)
      .next(mergeResults)
      .next(fanoutTask);

    // 최소 비용 로그 설정: ERROR 레벨, 실행 데이터 미포함
    const sfnLogGroup = new logs.LogGroup(this, "ImageProcessingLogs", {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.stateMachine = new sfn.StateMachine(this, "ImageProcessingWorkflow", {
      definition,
      timeout: cdk.Duration.minutes(15),
      stateMachineName: "ImageProcessingWorkflow",
      logs: {
        destination: sfnLogGroup,
        level: sfn.LogLevel.ERROR,
        includeExecutionData: false,
      },
    });

    // ===================================
    // Lambda: SfnTrigger
    // ===================================
    this.sfnTriggerFn = new NodejsFunction(this, "SfnTriggerFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/sfn-trigger/index.ts"),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
        IMAGE_BUCKET: this.imageBucket.bucketName,
      },
    });

    // SQS -> SfnTrigger Lambda 이벤트 소스
    this.sfnTriggerFn.addEventSource(new SqsEventSource(imageUploadQueue));

    // 권한: Step Functions 실행 + S3 HeadObject
    this.stateMachine.grantStartExecution(this.sfnTriggerFn);
    this.imageBucket.grantRead(this.sfnTriggerFn);

    // ===================================
    // IAM: Rekognition permissions for Detect/Index lambdas
    // ===================================
    this.detectTextFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectText"],
        resources: ["*"],
      })
    );

    this.indexFacesFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "rekognition:CreateCollection",
          "rekognition:DescribeCollection",
          "rekognition:IndexFaces",
        ],
        resources: ["*"],
      })
    );
    // ===================================
    // Outputs
    // ===================================
    new cdk.CfnOutput(this, "ImageBucketName", {
      value: this.imageBucket.bucketName,
      description: "S3 Bucket for image storage",
    });

    new cdk.CfnOutput(this, "PhotoServiceTableName", {
      value: this.photoServiceTable.tableName,
      description: "DynamoDB table for photo metadata",
    });

    new cdk.CfnOutput(this, "PhotoServiceTableArn", {
      value: this.photoServiceTable.tableArn,
      description: "DynamoDB table ARN",
    });

    new cdk.CfnOutput(this, "PreprocessFunctionName", {
      value: this.preprocessFn.functionName,
      description: "Preprocess Lambda function name",
    });

    new cdk.CfnOutput(this, "PreprocessFunctionArn", {
      value: this.preprocessFn.functionArn,
      description: "Preprocess Lambda function ARN",
    });
  }
}
