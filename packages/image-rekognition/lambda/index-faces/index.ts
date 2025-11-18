import {
  RekognitionClient,
  DescribeCollectionCommand,
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

async function ensureCollectionExists(collectionId: string): Promise<void> {
  try {
    await rekognition.send(
      new DescribeCollectionCommand({ CollectionId: collectionId })
    );
  } catch (err: any) {
    if (err?.name === "ResourceNotFoundException") {
      await rekognition.send(
        new CreateCollectionCommand({ CollectionId: collectionId })
      );
    } else {
      throw err;
    }
  }
}

export const handler = async (
  event: IndexFacesInput
): Promise<IndexFacesOutput> => {
  const { orgId, eventId, bucketName, processedKey, ulid } = event;

  const collectionId = `${orgId}-${eventId}`;

  await ensureCollectionExists(collectionId);

  const res = await rekognition.send(
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

  const faceIds =
    res.FaceRecords?.map((r) => r.Face?.FaceId).filter(
      (id): id is string => !!id
    ) ?? [];

  return {
    faceIds,
    faceCount: faceIds.length,
  };
};
