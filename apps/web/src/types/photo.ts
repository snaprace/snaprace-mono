export interface Photo {
  pid: string;
  s3Key: string;
  url: string;
  width: number;
  height: number;
  eventId: string;
  orgId: string;
  thumbHash?: string | null;
  instagramHandle?: string | null;
  similarity?: number;
}
