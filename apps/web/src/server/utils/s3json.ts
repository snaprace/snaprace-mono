import { GetObjectCommand } from "@aws-sdk/client-s3";
import type {
  GetObjectCommandInput,
  GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

import { s3, BUCKET } from "@/server/aws/clients";

async function streamToString(
  body: GetObjectCommandOutput["Body"],
): Promise<string> {
  if (!body) {
    throw new Error("S3 object body is empty");
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf-8");
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(bufferFromChunk(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  const maybeTransform = body as {
    transformToString?: (encoding: string) => Promise<string>;
  };
  if (typeof maybeTransform.transformToString === "function") {
    return maybeTransform.transformToString("utf-8");
  }

  const hasAsyncIterator =
    typeof (body as { [Symbol.asyncIterator]?: unknown })[
      Symbol.asyncIterator
    ] === "function";
  if (hasAsyncIterator) {
    const asyncIterable = body as unknown as AsyncIterable<unknown>;
    const chunks: Buffer[] = [];
    for await (const chunk of asyncIterable) {
      chunks.push(bufferFromChunk(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  const maybeArrayBuffer = body as {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  if (typeof maybeArrayBuffer.arrayBuffer === "function") {
    const arrayBuffer = await maybeArrayBuffer.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("utf-8");
  }

  throw new Error("지원하지 않는 S3 Body 타입입니다.");
}

export async function getJsonFromS3<T = unknown>(key: string): Promise<T> {
  const input: GetObjectCommandInput = {
    Bucket: BUCKET,
    Key: key,
  };

  const command = new GetObjectCommand(input);
  const response: GetObjectCommandOutput = await s3.send(command);
  const text = await streamToString(response.Body);

  return JSON.parse(text) as T;
}

function bufferFromChunk(chunk: unknown): Buffer {
  if (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) {
    return Buffer.from(chunk);
  }

  if (typeof chunk === "string") {
    return Buffer.from(chunk);
  }

  if (typeof chunk === "number" || typeof chunk === "boolean") {
    return Buffer.from(String(chunk));
  }

  throw new Error("지원하지 않는 스트림 청크 타입입니다.");
}
