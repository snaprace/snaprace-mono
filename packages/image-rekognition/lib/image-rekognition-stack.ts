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

export class ImageRekognitionStack extends cdk.Stack {
  public readonly imageBucket: s3.Bucket;
  public readonly photoServiceTable: dynamodb.Table;
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
    this.photoServiceTable = new dynamodb.Table(this, "PhotoServiceTable", {
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

      // Billing
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      // Stream for CDC (Change Data Capture)
      // stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,

      // Point-in-Time Recovery
      pointInTimeRecovery: true,

      // Encryption
      encryption: dynamodb.TableEncryption.AWS_MANAGED,

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
      environment: {
        IMAGE_BUCKET: this.imageBucket.bucketName,
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
      environment: {
        IMAGE_BUCKET: this.imageBucket.bucketName,
      },
    });

    // ===================================
    // Lambda: IndexFaces
    // ===================================
    this.indexFacesFn = new NodejsFunction(this, "IndexFacesFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/index-faces/index.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        IMAGE_BUCKET: this.imageBucket.bucketName,
      },
    });

    // ===================================
    // Lambda: Fanout DynamoDB
    // ===================================
    this.fanoutDdbFn = new NodejsFunction(this, "FanoutDynamoDBFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/fanout-dynamodb/index.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DDB_TABLE: this.photoServiceTable.tableName,
      },
    });

    this.photoServiceTable.grantWriteData(this.fanoutDdbFn);

    // ===================================
    // SQS Queue: ImageUpload
    // ===================================
    const imageUploadQueue = new sqs.Queue(this, "ImageUploadQueue", {
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
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
    // Lambda: SfnTrigger
    // ===================================
    this.sfnTriggerFn = new NodejsFunction(this, "SfnTriggerFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../lambda/sfn-trigger/index.ts"),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
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
    // Step Functions: ImageProcessingWorkflow
    // ===================================

    // Preprocess → DetectText → IndexFaces → Fanout 순차 실행

    const preprocessTask = new sfnTasks.LambdaInvoke(
      this,
      "PreprocessImageTask",
      {
        lambdaFunction: this.preprocessFn,
        outputPath: "$.Payload",
      }
    );

    const detectTextTask = new sfnTasks.LambdaInvoke(this, "DetectTextTask", {
      lambdaFunction: this.detectTextFn,
      // DetectText는 Preprocess 출력 전체를 입력으로 받고,
      // 결과를 상태의 detectTextResult 아래에 병합
      resultPath: "$.detectTextResult",
      outputPath: "$.Payload",
    });

    const indexFacesTask = new sfnTasks.LambdaInvoke(this, "IndexFacesTask", {
      lambdaFunction: this.indexFacesFn,
      resultPath: "$.indexFacesResult",
      outputPath: "$.Payload",
    });

    const fanoutTask = new sfnTasks.LambdaInvoke(this, "FanoutDynamoDBTask", {
      lambdaFunction: this.fanoutDdbFn,
      outputPath: "$.Payload",
    });

    const definition = preprocessTask
      .next(detectTextTask)
      .next(indexFacesTask)
      .next(fanoutTask);

    this.stateMachine = new sfn.StateMachine(this, "ImageProcessingWorkflow", {
      definition,
      timeout: cdk.Duration.minutes(15),
      stateMachineName: "ImageProcessingWorkflow",
    });

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
