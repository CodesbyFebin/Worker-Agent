import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { env } from "../../_core/env";

export type StorageBackend = "s3" | "local";

export type PutObjectResult = {
  backend: StorageBackend;
  key: string;
  sizeBytes: number;
  checksumSha256: string;
};

function localRoot(): string {
  return (
    env.ARTIFACTS_LOCAL_DIR ??
    path.join(process.cwd(), ".artifacts", "object-store")
  );
}

function s3Configured(): boolean {
  return Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

let s3Client: S3Client | null = null;
let bucketReady = false;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE !== false,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

async function ensureBucket(): Promise<void> {
  if (bucketReady || !s3Configured()) return;
  const client = getS3();
  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch (err) {
      // Bucket may already exist / race — ignore if subsequent puts work
      console.warn("[artifacts] create bucket:", (err as Error).message);
    }
  }
  bucketReady = true;
}

export function storageStatus(): {
  backend: StorageBackend;
  configured: boolean;
  endpoint: string | null;
  bucket: string | null;
  localDir: string | null;
} {
  if (s3Configured()) {
    return {
      backend: "s3",
      configured: true,
      endpoint: env.S3_ENDPOINT ?? null,
      bucket: env.S3_BUCKET,
      localDir: null,
    };
  }
  return {
    backend: "local",
    configured: true,
    endpoint: null,
    bucket: null,
    localDir: localRoot(),
  };
}

export async function putObject(params: {
  organizationId: string;
  keySuffix: string;
  body: Buffer | string;
  contentType: string;
}): Promise<PutObjectResult> {
  const body = typeof params.body === "string" ? Buffer.from(params.body, "utf8") : params.body;
  const checksumSha256 = createHash("sha256").update(body as any).digest("hex");
  const key = `${params.organizationId}/${params.keySuffix}`.replace(/\\/g, "/");

  if (s3Configured()) {
    await ensureBucket();
    await getS3().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body as any,
        ContentType: params.contentType,
        Metadata: { sha256: checksumSha256 },
      }),
    );
    return { backend: "s3", key, sizeBytes: body.length, checksumSha256 };
  }

  const abs = path.join(localRoot(), key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body as any);
  return { backend: "local", key, sizeBytes: body.length, checksumSha256 };
}

export async function getObject(params: {
  backend: StorageBackend;
  key: string;
}): Promise<{ body: Buffer; contentType?: string }> {
  if (params.backend === "s3") {
    if (!s3Configured()) throw new Error("S3 not configured but object backend is s3");
    const res = await getS3().send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: params.key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty S3 object body");
    return { body: Buffer.from(bytes), contentType: res.ContentType };
  }

  const abs = path.join(localRoot(), params.key);
  const body = await fs.readFile(abs);
  return { body };
}

export function newStorageKey(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safe}`;
}
