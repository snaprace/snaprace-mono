import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
} from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({});

export interface IndexFacesInput {
  orgId: string;
  eventId: string;
  bucketName: string;
  processedKey: string;
  ulid: string;
  s3Uri: string;
}

export interface IndexFacesOutput {
  faceIds: string[];
  faceCount: number;
}

export const handler = async (
  event: IndexFacesInput
): Promise<IndexFacesOutput> => {
  const { orgId, eventId, bucketName, processedKey, ulid } = event;

  const collectionId = `${orgId}-${eventId}`;

  const runIndexFaces = () =>
    rekognition.send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: {
          S3Object: {
            Bucket: bucketName,
            Name: processedKey,
          },
        },
        ExternalImageId: ulid,
        MaxFaces: 15,
        QualityFilter: "AUTO",
      })
    );

  let res;
  try {
    // 1. 우선 인덱싱 시도 (Optimistic)
    res = await runIndexFaces();
  } catch (err: any) {
    // 2. 컬렉션이 없어서 실패한 경우에만 생성 로직 진입
    if (err.name === "ResourceNotFoundException") {
      try {
        await rekognition.send(
          new CreateCollectionCommand({ CollectionId: collectionId })
        );
      } catch (createErr: any) {
        // 동시에 다른 프로세스가 생성했을 수 있으므로 이미 존재한다는 에러는 무시
        if (createErr.name !== "ResourceAlreadyExistsException") {
          throw createErr;
        }
      }
      // 3. 컬렉션 생성(또는 확인) 후 다시 인덱싱 시도
      res = await runIndexFaces();
    } else {
      throw err;
    }
  }

  const faceIds =
    res.FaceRecords?.map((r) => r.Face?.FaceId).filter(
      (id): id is string => !!id
    ) ?? [];

  return {
    faceIds,
    faceCount: faceIds.length,
  };
};
