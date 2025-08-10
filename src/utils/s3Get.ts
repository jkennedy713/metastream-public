import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const normalizeS3Key = (input: string): string => {
  if (!input) return '';
  let k = input.trim();
  const s3Match = k.match(/^s3:\/\/([^/]+)\/(.+)$/i);
  if (s3Match) return s3Match[2];
  try {
    const url = new URL(k);
    if (/^s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(url.host)) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return parts.slice(1).join('/');
    }
    if (/\.s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(url.host)) {
      return url.pathname.replace(/^\//, '');
    }
  } catch {}
  if (k.startsWith('/')) k = k.slice(1);
  return k;
};

export const getObjectTextFromS3 = async (
  key: string
): Promise<{ text: string; contentType?: string } | null> => {
  const aws = getAWSConfig();
  const session = await fetchAuthSession();
  const creds = session.credentials;
  if (!creds) throw new Error('Not authenticated');

  const s3 = new S3Client({
    region: aws.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  const normalizedKey = normalizeS3Key(key);
  if (!normalizedKey) throw new Error('Missing S3 key');

  const getCmd = new GetObjectCommand({ Bucket: aws.s3BucketName, Key: normalizedKey });
  const url = await getSignedUrl(s3, getCmd, { expiresIn: 3600 });

  const res = await fetch(url, { method: 'GET', mode: 'cors' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`S3 GET failed with status ${res.status}. ${body.slice(0, 300)}`);
  }

  const contentType = res.headers.get('content-type') || undefined;

  // Only attempt to render text-like content
  const isTexty = contentType
    ? /(text\/|application\/json|application\/csv|application\/xml)/i.test(contentType)
    : true;

  if (!isTexty) {
    return null;
  }

  const text = await res.text();
  return { text, contentType };
};
