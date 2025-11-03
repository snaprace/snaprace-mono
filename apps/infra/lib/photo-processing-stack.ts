import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy } from "aws-cdk-lib";

export class PhotoProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // const removalPolicy = props?.stage === 'production' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    const removalPolicy = RemovalPolicy.DESTROY; // dev

    const photosBucket = new s3.Bucket(this, "SnapRaceBucket", {
      bucketName: "snparace",
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: true, // dev
    });

    const photosTable = new dynamodb.TableV2(this, "PhotosTable", {
      tableName: "PhotosV2",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING }, // "ORG#<org>#EVT#<event>"
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING }, // "PHOTO#<photo_id>" or "TS#...#PHOTO#..."
      billing: dynamodb.Billing.onDemand(),
      removalPolicy,
    });

    // GSI 1: ByBib (갤러리 조회)
    photosTable.addGlobalSecondaryIndex({
      indexName: "GSI_ByBib",
      partitionKey: {
        name: "gsi1pk", // "EVT#<org>#<event>#BIB#<bib>"
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "gsi1sk", // "TS#<uploaded_at>#PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ["photo_id", "cloudfront_url", "uploaded_at"],
    });

    // GSI 2: ByStatus (재처리/모니터링)
    photosTable.addGlobalSecondaryIndex({
      indexName: "GSI_ByStatus",
      partitionKey: {
        name: "gsi2pk", // "EVT#<org>#<event>#STATUS#<processing_status>"
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "gsi2sk", // "TS#<uploaded_at>#PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // PhotoFaces table (옵션: 얼굴↔사진 역색인)
    const photoFacesTable = new dynamodb.TableV2(this, "PhotoFacesTable", {
      tableName: "PhotoFaces",
      partitionKey: {
        name: "pk", // "ORG#<org>#EVT#<event>#FACE#<face_id>"
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk", // "TS#<uploaded_at>#PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy,
    });

    // GSI 1: BibFaces (bib → face 목록; 대표 얼굴 선출/정정용)
    photoFacesTable.addGlobalSecondaryIndex({
      indexName: "GSI_BibFaces",
      partitionKey: {
        name: "gsi1pk", // "EVT#<org>#<event>#BIB#<bib>"
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "gsi1sk", // "FACE#<face_id>"
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ["photo_id", "similarity", "evidence_score"],
    });

    // GSI 2: PhotoFaces (사진 → face 목록; 국소 정정/삭제에 유용)
    photoFacesTable.addGlobalSecondaryIndex({
      indexName: "GSI_PhotoFaces",
      partitionKey: {
        name: "gsi2pk", // "PHOTO#<photo_id>"
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "gsi2sk", // "FACE#<face_id>"
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ["similarity", "evidence_score"],
    });

    const runnersTable = new dynamodb.TableV2(this, "RunnersTable", {
      tableName: "RunnersV2",
      partitionKey: {
        name: "pk", // ORG#<org>#EVT#<event>
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk", // BIB#<zero_padded_bib>
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy,
    });

    // GSI 1: ByRunnerId (Runner 조회)
    runnersTable.addGlobalSecondaryIndex({
      indexName: "GSI_ByRunnerId",
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING }, // RUNNER#<runner_id>
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING }, // EVT#<organizer_id>#<event_id>
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: [
        "bib_number",
        "name",
        "finish_time_sec",
        "event_id",
        "event_date",
        "event_name",
      ],
    });

    // GSI 2: ByEmailPerEvent (이벤트별 이메일 조회)
    // runnersTable.addGlobalSecondaryIndex({
    //   indexName: "GSI_ByEmailPerEvent",
    //   partitionKey: { name: "gsi2pk", type: dynamodb.AttributeType.STRING }, // EVT#<org>#<event>#EMAIL#<email_lower>
    //   sortKey: { name: "gsi2sk", type: dynamodb.AttributeType.STRING }, // BIB#<zero_padded_bib>
    //   projectionType: dynamodb.ProjectionType.INCLUDE,
    //   nonKeyAttributes: ["runner_id", "name"],
    // });

    new cdk.CfnOutput(this, "PhotosBucketName", {
      value: photosBucket.bucketName,
    });
    new cdk.CfnOutput(this, "PhotosTableName", {
      value: photosTable.tableName,
    });
    new cdk.CfnOutput(this, "PhotoFacesTableName", {
      value: photoFacesTable.tableName,
    });
    new cdk.CfnOutput(this, "RunnersTableName", {
      value: runnersTable.tableName,
    });
  }
}
