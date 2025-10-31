import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { Constants } from '../../config/constants';

export interface RestApiConstructProps {
  stage: string;
  findBySelfieFunction: lambda.IFunction;
}

export class RestApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: RestApiConstructProps) {
    super(scope, id);

    const isProd = props.stage === 'prod';

    this.api = new apigateway.RestApi(this, 'SnapRaceApi', {
      restApiName: `${Constants.PROJECT_NAME}-${Constants.API.NAME}-${props.stage}`,
      description: 'SnapRace Photo Search API',
      
      // 배포 설정
      deployOptions: {
        stageName: props.stage,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: !isProd,
        metricsEnabled: true
      },
      
      // CORS 설정
      defaultCorsPreflightOptions: {
        allowOrigins: isProd
          ? ['https://snaprace.com']  // 실제 도메인으로 교체 필요
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        maxAge: Duration.hours(1)
      },
      
      // API 키 설정 (선택)
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER
    });

    // /selfie 엔드포인트
    const selfieResource = this.api.root.addResource('selfie');
    selfieResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(props.findBySelfieFunction, {
        proxy: true,
        timeout: Duration.seconds(29)
      }),
      {
        apiKeyRequired: isProd
      }
    );

    // API 키 생성 (운영 환경)
    if (isProd) {
      const apiKey = this.api.addApiKey('SnapRaceApiKey', {
        apiKeyName: `${Constants.PROJECT_NAME}-api-key-${props.stage}`
      });

      const plan = this.api.addUsagePlan('UsagePlan', {
        name: `${Constants.PROJECT_NAME}-usage-plan-${props.stage}`,
        throttle: {
          rateLimit: 100,
          burstLimit: 200
        },
        quota: {
          limit: 10000,
          period: apigateway.Period.DAY
        }
      });

      plan.addApiKey(apiKey);
      plan.addApiStage({
        stage: this.api.deploymentStage
      });
    }
  }
}

