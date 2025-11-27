export interface Photo {
  pid: string;
  src: string;
  width: number;
  height: number;
  eventId: string;
  orgId: string;
  thumbHash?: string | null;
  instagramHandle?: string | null;
  similarity?: number;
}
