import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

export const R2_ALLOWED_FOLDERS = ["attachments", "avatars", "receipts", "documents"] as const;
export type R2Folder = (typeof R2_ALLOWED_FOLDERS)[number];

export const R2_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const R2_ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
] as const;

export type R2AllowedContentType = (typeof R2_ALLOWED_CONTENT_TYPES)[number];

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string | null;
}

function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || null;
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBaseUrl };
}

/** Returns true when all required Cloudflare R2 S3-compatible credentials are set. */
export function isR2Configured(): boolean {
  return readR2Config() !== null;
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sanitizeFilename(filename: string): string {
  const baseName = filename.split(/[/\\]/).pop() ?? "file";
  const cleaned = baseName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 96);
  return cleaned || "file";
}

function formatAmzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  const dateStamp = iso.slice(0, 10).replace(/-/g, "");
  const timeStamp = iso.slice(11, 19).replace(/:/g, "");
  return { amzDate: `${dateStamp}T${timeStamp}Z`, dateStamp };
}

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string | null;
  key: string;
  expiresInSeconds: number;
}

/**
 * Generates an AWS SigV4 presigned PUT URL so browsers upload directly to
 * Cloudflare R2 without passing file bytes through the Render server.
 */
export function createR2PresignedPutUrl(input: {
  organizationId: string;
  folder: R2Folder;
  filename: string;
  expiresInSeconds?: number;
}): PresignedUploadResult {
  const config = readR2Config();
  if (!config) {
    throw new Error("Cloudflare R2 storage is not configured.");
  }

  const expiresInSeconds = Math.min(Math.max(input.expiresInSeconds ?? 300, 60), 3600);
  const safeName = sanitizeFilename(input.filename);
  const key = `${input.organizationId}/${input.folder}/${Date.now()}-${randomUUID()}-${safeName}`;

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const { amzDate, dateStamp } = formatAmzDates(new Date());
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const encodedBucket = encodeRfc3986(config.bucketName);
  const encodedKey = key.split("/").map(encodeRfc3986).join("/");
  const canonicalUri = `/${encodedBucket}/${encodedKey}`;

  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];

  const canonicalQueryString = queryEntries
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const uploadUrl = `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  let publicUrl: string | null = null;
  if (config.publicBaseUrl) {
    const base = config.publicBaseUrl.endsWith("/files")
      ? config.publicBaseUrl
      : `${config.publicBaseUrl}/files`;
    publicUrl = `${base}/${encodedKey}`;
  }

  return {
    uploadUrl,
    publicUrl,
    key,
    expiresInSeconds,
  };
}
