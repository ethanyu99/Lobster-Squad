import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';

export interface UploadResult {
  url: string;
  key: string;
}

export interface UploadProvider {
  upload(file: Buffer, filename: string, contentType: string): Promise<UploadResult>;
}

/**
 * S3-compatible upload provider — works with both AWS S3 and Cloudflare R2.
 *
 * For R2, set S3_ENDPOINT to https://<account-id>.r2.cloudflarestorage.com
 * and S3_REGION to "auto".
 */
class S3UploadProvider implements UploadProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      ...(endpoint && { endpoint }),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!endpoint,
    });
    this.bucket = process.env.S3_BUCKET!;
    this.publicUrl = process.env.UPLOAD_PUBLIC_URL;
  }

  async upload(file: Buffer, filename: string, contentType: string): Promise<UploadResult> {
    const ext = path.extname(filename) || '.png';
    const key = `uploads/${uuid()}${ext}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    }));

    const url = this.publicUrl
      ? `${this.publicUrl.replace(/\/$/, '')}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { url, key };
  }
}

class LocalUploadProvider implements UploadProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async upload(file: Buffer, filename: string): Promise<UploadResult> {
    const ext = path.extname(filename) || '.png';
    const key = `${uuid()}${ext}`;
    fs.writeFileSync(path.join(this.uploadDir, key), file);
    return { url: `/api/uploads/${key}`, key };
  }
}

let provider: UploadProvider | null = null;

export function getUploadProvider(): UploadProvider {
  if (provider) return provider;

  const type = process.env.UPLOAD_PROVIDER || 'local';

  if (
    (type === 's3' || type === 'r2') &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET
  ) {
    provider = new S3UploadProvider();
    console.log(`Upload provider: ${type.toUpperCase()}`);
  } else {
    if (type !== 'local') {
      console.warn('S3/R2 credentials missing, falling back to local upload');
    }
    provider = new LocalUploadProvider();
    console.log('Upload provider: local');
  }

  return provider;
}
