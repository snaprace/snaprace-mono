import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Constants } from '../../config/constants';

export interface PhotosBucketConstructProps {
  stage: string;
}

export class PhotosBucketConstruct extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: PhotosBucketConstructProps) {
    super(scope, id);

    const isProd = props.stage === 'prod';

    this.bucket = new s3.Bucket(this, 'PhotosBucket', {
      bucketName: `${Constants.PROJECT_NAME}-photos-${props.stage}`,
      
      // 보안 설정
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      
      // 버전 관리 (운영 환경만)
      versioned: isProd,
      
      // 수명 주기 정책
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: Duration.days(30)
        },
        {
          id: 'IntelligentTiering',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(90)
            }
          ]
        }
      ],
      
      // CORS 설정 (웹 업로드용)
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST
          ],
          allowedOrigins: isProd 
            ? ['https://snaprace.com']  // 실제 운영 도메인으로 교체 필요
            : ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ],
      
      // EventBridge 알림 활성화
      eventBridgeEnabled: true,
      
      // 삭제 정책
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd
    });
  }
}

