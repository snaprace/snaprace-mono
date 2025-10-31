import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface BaseLambdaProps {
  functionName: string;
  code: lambda.Code;
  handler: string;
  timeout?: cdk.Duration;
  memorySize?: number;
  environment?: { [key: string]: string };
  runtime?: lambda.Runtime;
}

export class BaseLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: BaseLambdaProps) {
    super(scope, id);

    this.function = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      runtime: props.runtime || lambda.Runtime.NODEJS_20_X,
      handler: props.handler,
      code: props.code,
      timeout: props.timeout || cdk.Duration.minutes(5),
      memorySize: props.memorySize || 512,
      environment: props.environment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      // VPC 미사용 (기본 정책)
    });
  }
}

