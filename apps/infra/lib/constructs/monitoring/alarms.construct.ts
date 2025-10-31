import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Duration } from 'aws-cdk-lib';
import { Constants } from '../../config/constants';

export interface AlarmsConstructProps {
  stage: string;
  functions: lambda.IFunction[];
  dlq: sqs.IQueue;
}

export class AlarmsConstruct extends Construct {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlarmsConstructProps) {
    super(scope, id);

    const isProd = props.stage === 'prod';

    // SNS 토픽 생성
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `${Constants.PROJECT_NAME}-alarms-${props.stage}`,
      displayName: 'SnapRace Alarms'
    });

    // Lambda 에러 알람
    props.functions.forEach(func => {
      new cloudwatch.Alarm(this, `${func.node.id}ErrorAlarm`, {
        alarmName: `${func.functionName}-errors`,
        metric: func.metricErrors({
          period: Duration.minutes(5),
          statistic: 'Sum'
        }),
        threshold: 5,
        evaluationPeriods: 1,
        alarmDescription: `${func.functionName} has too many errors`,
        actionsEnabled: isProd
      }).addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Lambda 타임아웃 알람
      new cloudwatch.Alarm(this, `${func.node.id}DurationAlarm`, {
        alarmName: `${func.functionName}-duration`,
        metric: func.metricDuration({
          period: Duration.minutes(5),
          statistic: 'Average'
        }),
        threshold: func.timeout!.toMilliseconds() * 0.9,  // 90% 임계값
        evaluationPeriods: 2,
        alarmDescription: `${func.functionName} is approaching timeout`,
        actionsEnabled: isProd
      }).addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    });

    // DLQ 알람
    new cloudwatch.Alarm(this, 'DLQAlarm', {
      alarmName: `${Constants.PROJECT_NAME}-dlq-messages-${props.stage}`,
      metric: props.dlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(1),
        statistic: 'Sum'
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Messages in DLQ - immediate attention required',
      actionsEnabled: true
    }).addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }
}

