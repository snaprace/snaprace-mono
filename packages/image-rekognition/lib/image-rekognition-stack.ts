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
  public readonly searchBySelfieFn: NodejsFunction;

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

      // Lifecycle: raw는 짧게 보관 후 만료(원하면 숫자 조정)
      lifecycleRules: [
        // processed는 업로드 즉시 Intelligent-Tiering 스토리지 클래스로 전환
        {
          id: "ProcessedToIntelligentTiering",
          enabled: true,
          tagFilters: { folder: "processed" },
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(0),
            },
          ],
        },
        // raw는 업로드 즉시 Deep Archive로 전환 (장기보관, 복구 지연/최소요금 주의)
        {
          id: "RawToDeepArchive",
          enabled: true,
          tagFilters: { folder: "raw" },
          transitions: [
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(0),
            },
          ],
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

    // CloudFront OAC Policy 추가
    this.imageBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject"],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        resources: [this.imageBucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/E34Y5NMKCC4FLC`,
          },
        },
      })
    );

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

    // Grant least-privilege S3 permissions to Preprocess Lambda
    this.preprocessFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject", "s3:PutObjectTagging"],
        resources: [`${this.imageBucket.bucketArn}/*`],
      })
    );

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
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".heic",
      ".JPG",
      ".JPEG",
      ".PNG",
      ".HEIC",
    ].forEach((suffix) => {
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
    preprocessTask.addRetry({
      maxAttempts: 3,
      backoffRate: 2.0,
      interval: cdk.Duration.seconds(2),
    });
    preprocessTask.addCatch(processingFailed, { resultPath: "$" });

    // DetectText: 실패 시 빈 결과로 대체
    const detectFallback = new sfn.Pass(this, "DetectTextFallback", {
      result: sfn.Result.fromObject({
        bibs: [],
        rawText: [],
        confidence: 0,
      }),
    });
    // Rekognition 처리량 초과 에러에 대한 강화된 재시도 설정
    detectTextTask.addRetry({
      maxAttempts: 3,
      backoffRate: 2.5,
      interval: cdk.Duration.seconds(3),
      maxDelay: cdk.Duration.seconds(60),
      jitterStrategy: sfn.JitterType.FULL, // 랜덤 지터로 동시 재시도 분산
      errors: ["ProvisionedThroughputExceededException", "ThrottlingException"],
    });
    // 기타 에러에 대한 일반 재시도
    detectTextTask.addRetry({
      maxAttempts: 2,
      backoffRate: 2.0,
      interval: cdk.Duration.seconds(1),
    });
    detectTextTask.addCatch(detectFallback, { resultPath: "$" });

    // IndexFaces: 실패 시 빈 결과로 대체
    const indexFallback = new sfn.Pass(this, "IndexFacesFallback", {
      result: sfn.Result.fromObject({
        faceIds: [],
        faceCount: 0,
      }),
    });
    // Rekognition 처리량 초과 에러에 대한 강화된 재시도 설정
    indexFacesTask.addRetry({
      maxAttempts: 3,
      backoffRate: 2.5,
      interval: cdk.Duration.seconds(3),
      maxDelay: cdk.Duration.seconds(60),
      jitterStrategy: sfn.JitterType.FULL, // 랜덤 지터로 동시 재시도 분산
      errors: ["ProvisionedThroughputExceededException", "ThrottlingException"],
    });
    // 기타 에러에 대한 일반 재시도
    indexFacesTask.addRetry({
      maxAttempts: 3,
      backoffRate: 2.0,
      interval: cdk.Duration.seconds(1),
    });
    indexFacesTask.addCatch(indexFallback, { resultPath: "$" });

    // Fanout: 재시도 후 실패 시 전체 실패 처리
    fanoutTask.addRetry({
      maxAttempts: 3,
      backoffRate: 2.0,
      interval: cdk.Duration.seconds(2),
    });
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
        "thumbHash.$": "$.thumbHash",
        "instagramHandle.$": "$.instagramHandle",
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
    // Rekognition API 기본 한도: DetectText 5 TPS, IndexFaces 5-25 TPS
    // Step Functions에서 병렬 호출하므로 병목은 DetectText 5 TPS
    // 이미지 1장 처리 ~3-5초 가정 → 동시 10개면 초당 ~2-3개 완료
    // 안전 마진 포함하여 maxConcurrency: 10 설정 (피크 시 재시도로 커버)
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
      // reservedConcurrentExecutions 제거: SQS maxConcurrency로 제어
      // reserved는 계정 전체 동시성 풀에서 차감되므로 비효율적
    });

    // SQS -> SfnTrigger Lambda 이벤트 소스
    // 속도 vs 안정성 최적화 설정
    this.sfnTriggerFn.addEventSource(
      new SqsEventSource(imageUploadQueue, {
        batchSize: 1, // 1개씩 처리 (Step Functions 실행 정밀 제어)
        maxBatchingWindow: cdk.Duration.seconds(1), // 빠른 시작을 위해 1초로 단축
        maxConcurrency: 10, // 동시 10개 Step Functions (Rekognition 5 TPS 고려, 재시도 버퍼 포함)
      })
    );

    // 권한: Step Functions 실행 + 필요한 S3 메타데이터/태그 접근
    this.stateMachine.grantStartExecution(this.sfnTriggerFn);
    this.sfnTriggerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:HeadObject",
          "s3:GetObjectTagging",
          "s3:PutObjectTagging",
        ],
        resources: [`${this.imageBucket.bucketArn}/*`],
      })
    );

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
    // Lambda: SearchBySelfie
    // ===================================
    this.searchBySelfieFn = new NodejsFunction(this, "SearchBySelfieFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/search-by-selfie/index.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        IMAGE_BUCKET: this.imageBucket.bucketName,
        DDB_TABLE: this.photoServiceTable.tableName,
      },
    });

    this.searchBySelfieFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:SearchFacesByImage"],
        resources: ["*"],
      })
    );

    // Grant DynamoDB read permissions
    this.photoServiceTable.grantReadData(this.searchBySelfieFn);

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

    new cdk.CfnOutput(this, "SearchBySelfieFunctionName", {
      value: this.searchBySelfieFn.functionName,
      description: "SearchBySelfie Lambda function name",
    });
  }
}
