import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import { RemovalPolicy, Duration } from 'aws-cdk-lib'
import * as path from 'path'

export class PhotoProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // const removalPolicy = props?.stage === 'production' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    const removalPolicy = RemovalPolicy.DESTROY // dev

    const photosBucket = new s3.Bucket(this, 'SnapRaceBucket', {
      bucketName: 'snparace',
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: true // dev
    })

    const photosTable = new dynamodb.TableV2(this, 'PhotosTable', {
      tableName: 'PhotosV2',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING }, // "ORG#<org>#EVT#<event>"
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // "PHOTO#<photo_id>" or "TS#...#PHOTO#..."
      billing: dynamodb.Billing.onDemand(),
      removalPolicy
    })

    // GSI 1: ByBib (갤러리 조회)
    photosTable.addGlobalSecondaryIndex({
      indexName: 'GSI_ByBib',
      partitionKey: {
        name: 'gsi1pk', // "EVT#<org>#<event>#BIB#<bib>"
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'gsi1sk', // "TS#<uploaded_at>#PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['photo_id', 'cloudfront_url', 'uploaded_at']
    })

    // GSI 2: ByStatus (재처리/모니터링)
    photosTable.addGlobalSecondaryIndex({
      indexName: 'GSI_ByStatus',
      partitionKey: {
        name: 'gsi2pk', // "EVT#<org>#<event>#STATUS#<processing_status>"
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'gsi2sk', // "TS#<uploaded_at>#PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY
    })

    // PhotoFaces table (옵션: 얼굴↔사진 역색인)
    const photoFacesTable = new dynamodb.TableV2(this, 'PhotoFacesTable', {
      tableName: 'PhotoFaces',
      partitionKey: {
        name: 'pk', // "ORG#<org>#EVT#<event>#FACE#<face_id>"
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'sk', // "TS#<uploaded_at>#PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy
    })

    // GSI 1: BibFaces (bib → face 목록; 대표 얼굴 선출/정정용)
    photoFacesTable.addGlobalSecondaryIndex({
      indexName: 'GSI_BibFaces',
      partitionKey: {
        name: 'gsi1pk', // "EVT#<org>#<event>#BIB#<bib>"
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'gsi1sk', // "FACE#<face_id>"
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['photo_id', 'similarity', 'evidence_score']
    })

    // GSI 2: PhotoFaces (사진 → face 목록; 국소 정정/삭제에 유용)
    photoFacesTable.addGlobalSecondaryIndex({
      indexName: 'GSI_PhotoFaces',
      partitionKey: {
        name: 'gsi2pk', // "PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'gsi2sk', // "FACE#<face_id>"
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['similarity', 'evidence_score']
    })

    const runnersTable = new dynamodb.TableV2(this, 'RunnersTable', {
      tableName: 'RunnersV2',
      partitionKey: {
        name: 'pk', // ORG#<org>#EVT#<event>
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'sk', // BIB#<zero_padded_bib>
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy
    })

    // GSI 1: ByRunnerId (Runner 조회)
    runnersTable.addGlobalSecondaryIndex({
      indexName: 'GSI_ByRunnerId',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING }, // RUNNER#<runner_id>
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING }, // EVT#<organizer_id>#<event_id>
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['bib_number', 'name', 'finish_time_sec', 'event_id', 'event_date', 'event_name']
    })

    // GSI 2: ByEmailPerEvent (이벤트별 이메일 조회)
    // runnersTable.addGlobalSecondaryIndex({
    //   indexName: "GSI_ByEmailPerEvent",
    //   partitionKey: { name: "gsi2pk", type: dynamodb.AttributeType.STRING }, // EVT#<org>#<event>#EMAIL#<email_lower>
    //   sortKey: { name: "gsi2sk", type: dynamodb.AttributeType.STRING }, // BIB#<zero_padded_bib>
    //   projectionType: dynamodb.ProjectionType.INCLUDE,
    //   nonKeyAttributes: ["runner_id", "name"],
    // });

    // SQS 큐 생성 (단일 큐 + DLQ)
    const photoDLQ = new sqs.Queue(this, 'PhotoDLQ', {
      retentionPeriod: Duration.days(14),
      queueName: 'photo-processing-dlq'
    })

    const photoQueue = new sqs.Queue(this, 'PhotoQueue', {
      visibilityTimeout: Duration.seconds(120),
      deadLetterQueue: {
        queue: photoDLQ,
        maxReceiveCount: 5
      },
      queueName: 'photo-processing-queue'
    })

    // Lambda Layer 생성 (공통 의존성)
    // CDK가 자동으로 npm install을 실행하도록 bundling 설정
    // npm 캐시 권한 문제 해결을 위해 환경 변수로 /tmp에 캐시 설정
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/common-layer'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash',
            '-c',
            [
              'cp -r /asset-input/* /asset-output/',
              'cd /asset-output/nodejs',
              'NPM_CONFIG_CACHE=/tmp/.npm npm install --production'
            ].join(' && ')
          ]
        }
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Common AWS SDK dependencies for Lambda functions'
    })

    // detect-text Lambda 함수 생성
    const detectTextFunction = new lambda.Function(this, 'DetectTextFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/detect-text')),
      layers: [commonLayer],
      timeout: Duration.minutes(5),
      memorySize: 512,
      environment: {
        PHOTOS_TABLE_NAME: photosTable.tableName,
        RUNNERS_TABLE_NAME: runnersTable.tableName,
        QUEUE_URL: photoQueue.queueUrl,
        MIN_TEXT_CONFIDENCE: '90.0',
        CLOUDFRONT_DOMAIN_NAME: 'images.snap-race.com'
      },
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE
    })

    // DynamoDB 테이블 읽기/쓰기 권한
    photosTable.grantReadWriteData(detectTextFunction)
    runnersTable.grantReadData(detectTextFunction)

    // SQS 전송 권한
    photoQueue.grantSendMessages(detectTextFunction)

    // Rekognition 권한
    detectTextFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rekognition:DetectText'],
        resources: ['*']
      })
    )

    // S3 읽기 권한 (버킷 내 객체)
    photosBucket.grantRead(detectTextFunction)

    // EventBridge Rule 생성: S3 객체 생성 이벤트 → Lambda
    // photos/raw 경로만 처리
    const photoUploadRule = new events.Rule(this, 'PhotoUploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [photosBucket.bucketName]
          },
          object: {
            key: [
              {
                wildcard: '*/photos/raw/*'
              }
            ]
          }
        }
      }
    })

    photoUploadRule.addTarget(
      new targets.LambdaFunction(detectTextFunction, {
        retryAttempts: 3
      })
    )

    // index-faces Lambda 함수 생성
    const indexFacesFunction = new lambda.Function(this, 'IndexFacesFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/index-faces')),
      layers: [commonLayer],
      timeout: Duration.minutes(5),
      memorySize: 1024, // 얼굴 인식은 더 많은 메모리 필요
      environment: {
        PHOTOS_TABLE_NAME: photosTable.tableName,
        PHOTO_FACES_TABLE_NAME: photoFacesTable.tableName,
        PHOTOS_BUCKET_NAME: photosBucket.bucketName,
        MIN_SIMILARITY_THRESHOLD: '95.0', // 얼굴 매칭 최소 유사도 (%)
        REQUIRED_VOTES: '2' // 얼굴 매칭 최소 득표수
      },
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE
    })

    // DynamoDB 테이블 읽기/쓰기 권한
    photosTable.grantReadWriteData(indexFacesFunction)
    photoFacesTable.grantReadWriteData(indexFacesFunction)

    // Rekognition 권한
    indexFacesFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'rekognition:IndexFaces',
          'rekognition:SearchFaces',
          'rekognition:CreateCollection',
          'rekognition:DescribeCollection'
        ],
        resources: ['*']
      })
    )

    // S3 읽기 권한 (버킷 내 객체)
    photosBucket.grantRead(indexFacesFunction)

    // SQS 이벤트 소스 연결: photoQueue → index-faces Lambda
    indexFacesFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(photoQueue, {
        batchSize: 5,
        maxBatchingWindow: Duration.seconds(10)
      })
    )

    // Outputs
    new cdk.CfnOutput(this, 'PhotosBucketName', {
      value: photosBucket.bucketName
    })
    new cdk.CfnOutput(this, 'PhotosTableName', {
      value: photosTable.tableName
    })
    new cdk.CfnOutput(this, 'PhotoFacesTableName', {
      value: photoFacesTable.tableName
    })
    new cdk.CfnOutput(this, 'RunnersTableName', {
      value: runnersTable.tableName
    })
    new cdk.CfnOutput(this, 'PhotoQueueUrl', {
      value: photoQueue.queueUrl
    })
    new cdk.CfnOutput(this, 'DetectTextFunctionName', {
      value: detectTextFunction.functionName
    })
    new cdk.CfnOutput(this, 'IndexFacesFunctionName', {
      value: indexFacesFunction.functionName
    })
  }
}
