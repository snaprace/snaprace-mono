import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { S3ToLambda } from '@aws-solutions-constructs/aws-s3-lambda';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface PhotoBucketProps {
  detectTextFunction: lambda.Function;
  bucketName?: string;
}

export class PhotoBucket extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly s3ToLambda: S3ToLambda;

  constructor(scope: Construct, id: string, props: PhotoBucketProps) {
    super(scope, id);

    // Solutions Construct 사용
    this.s3ToLambda = new S3ToLambda(this, 'PhotoUploadTrigger', {
      existingLambdaObj: props.detectTextFunction,
      bucketProps: {
        bucketName: props.bucketName,
        versioned: false,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
      },
      eventSourceProps: {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ prefix: '*/raw/' }],
      },
    });

    this.bucket = this.s3ToLambda.s3Bucket;
  }
}

