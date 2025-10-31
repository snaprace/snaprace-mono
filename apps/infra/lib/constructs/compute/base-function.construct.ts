import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Duration } from 'aws-cdk-lib';
import * as path from 'path';

export interface BaseFunctionProps {
  functionName: string;
  handler: string;
  codePath: string;
  environment?: Record<string, string>;
  timeout?: Duration;
  memorySize?: number;
  stage: string;
}

export class BaseFunctionConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: BaseFunctionProps) {
    super(scope, id);

    const isProd = props.stage === 'prod';

    this.function = new lambda.Function(this, id, {
      functionName: `snaprace-${props.functionName}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: props.handler,
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../../lambda', props.codePath)
      ),
      
      // 성능 설정
      timeout: props.timeout || Duration.seconds(30),
      memorySize: props.memorySize || 512,
      
      // 환경 변수
      environment: {
        STAGE: props.stage,
        NODE_ENV: 'production',
        LOG_LEVEL: isProd ? 'info' : 'debug',
        ...props.environment
      },
      
      // 로깅 설정
      logRetention: isProd
        ? logs.RetentionDays.ONE_MONTH
        : logs.RetentionDays.ONE_WEEK,
      
      // X-Ray 추적
      tracing: lambda.Tracing.ACTIVE,
      
      // 동시 실행 제한 (비용 관리)
      reservedConcurrentExecutions: isProd ? 100 : 10,
      
      // 재시도 설정
      retryAttempts: 2
    });
  }
}

