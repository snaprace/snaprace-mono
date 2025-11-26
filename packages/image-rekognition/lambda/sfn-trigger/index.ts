import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
} from "@aws-sdk/client-s3";

const sfn = new SFNClient({});
const s3 = new S3Client({});

const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;

interface S3EventRecord {
  s3: {
    bucket: { name: string };
    object: { key: string };
  };
}

interface S3EventBody {
  Records?: S3EventRecord[];
}

interface SqsRecord {
  body: string;
}

interface SqsEvent {
  Records?: SqsRecord[];
}

export const handler = async (event: SqsEvent): Promise<void> => {
  for (const record of event.Records ?? []) {
    const body = JSON.parse(record.body) as S3EventBody;
    const s3Record = body.Records?.[0]?.s3;
    if (!s3Record) continue;

    const bucket = s3Record.bucket.name;
    const key = decodeURIComponent(
      (s3Record.object.key as string).replace(/\+/g, " ")
    );

    // key 예시: {orgId}/{eventId}/raw/{filename}
    const parts = (key as string).split("/");
    if (parts.length < 4) {
      console.log("Skipping object with unexpected key format:", key);
      continue;
    }

    const [orgId, eventId, folder] = parts;

    // raw 폴더가 아닌 경우(예: processed/, 기타 경로)는 무시
    if (folder !== "raw") {
      console.log("Skipping non-raw object key:", key);
      continue;
    }

    // raw 객체에 태그 보정: folder=raw 태그 보장
    try {
      const currentTags = await s3.send(
        new GetObjectTaggingCommand({ Bucket: bucket, Key: key })
      );
      const tagSet = currentTags.TagSet ?? [];
      const hasFolderTag = tagSet.some(
        (t) => t.Key === "folder" && t.Value === "raw"
      );
      if (!hasFolderTag) {
        const merged = [
          ...tagSet.filter((t) => t.Key !== "folder"),
          { Key: "folder", Value: "raw" },
        ];
        await s3.send(
          new PutObjectTaggingCommand({
            Bucket: bucket,
            Key: key,
            Tagging: { TagSet: merged },
          })
        );
      }
    } catch (e) {
      console.warn("Failed to ensure raw tag for object:", key, e);
    }

    // instagram-handle 메타데이터 조회
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    const instagramHandle = head.Metadata?.["instagram-handle"];

    const input = {
      orgId,
      eventId,
      bucketName: bucket,
      rawKey: key,
      instagramHandle: instagramHandle ?? null,
    };
    const filename = parts.slice(3).join("-");
    const safeFilename = filename.replace(/[^a-zA-Z0-9-_]/g, "-");

    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: safeFilename,
        input: JSON.stringify(input),
      })
    );
  }
};
