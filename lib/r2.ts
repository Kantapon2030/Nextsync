// lib/r2.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "nextsync-thumbnails";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

const isMock = !R2_ACCOUNT_ID || R2_ACCOUNT_ID === "dummy-cloudflare-account-id";

const s3 = isMock
  ? null
  : new S3Client({
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || "",
        secretAccessKey: R2_SECRET_ACCESS_KEY || "",
      },
      region: "auto",
    });

/**
 * Uploads a buffer to Cloudflare R2 and returns its public URL
 */
export async function uploadToR2(key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  if (isMock || !s3) {
    console.log(`[R2 MOCK] Uploading file to ${key} (size: ${body.byteLength || (body as any).length} bytes)`);
    // Return a mock url using public storage path
    return `${R2_PUBLIC_URL}/${key}`;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    });

    await s3.send(command);
    return `${R2_PUBLIC_URL}/${key}`;
  } catch (error) {
    console.error(`Error uploading to R2 for key ${key}:`, error);
    throw error;
  }
}

/**
 * Deletes a file from Cloudflare R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (isMock || !s3) {
    console.log(`[R2 MOCK] Deleting file from ${key}`);
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await s3.send(command);
  } catch (error) {
    console.error(`Error deleting from R2 for key ${key}:`, error);
    throw error;
  }
}
