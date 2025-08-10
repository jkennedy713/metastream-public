import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED_FILE_TYPES = ['.csv', '.tsv', '.xlsx', '.txt', '.json'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const validateFile = (file: File): string | null => {
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_FILE_TYPES.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return `File type not supported. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`;
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return 'File size must be less than 100MB';
  }
  
  return null;
};

export const uploadToS3 = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ success: boolean; key?: string; error?: string }> => {
  try {
    const awsConfig = getAWSConfig();
    // Get AWS credentials from Amplify session
    let session = await fetchAuthSession();
    let credentials = session.credentials;

    console.log('[S3] credentials present?', Boolean(credentials));

    if (!credentials) {
      // Force a refresh once (after a fresh sign-in, identity creds may not be materialized yet)
      try {
        session = await fetchAuthSession({ forceRefresh: true });
        credentials = session.credentials;
        console.log('[S3] credentials after forceRefresh?', Boolean(credentials));
      } catch (e) {
        console.warn('[S3] fetchAuthSession forceRefresh failed', e);
      }
    }

    if (!credentials) {
      throw new Error('Not authenticated');
    }

    // Create an S3 client only for signing
    const s3Client = new S3Client({
      region: awsConfig.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    const key = `uploads/${Date.now()}-${file.name}`;

    // Use a presigned PUT URL to avoid streaming issues across browsers.
    // Note: We intentionally omit Metadata here to prevent signature/header mismatches.
    const putCmd = new PutObjectCommand({
      Bucket: awsConfig.s3BucketName,
      Key: key,
      ContentType: file.type || 'application/octet-stream',
    });

    const signedUrl = await getSignedUrl(s3Client, putCmd, { expiresIn: 3600 });

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl);
      xhr.withCredentials = false;
      xhr.timeout = 5 * 60 * 1000; // 5 min
      // Content-Type must match what we signed
      if (file.type) {
        xhr.setRequestHeader('Content-Type', file.type);
      } else {
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      }

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress({
              loaded: e.loaded,
              total: e.total,
              percentage: Math.round((e.loaded / e.total) * 100),
            });
          }
        };
      }

      xhr.onerror = () => {
        const hint = 'Likely CORS preflight blocked. Ensure your S3 bucket CORS allows PUT/HEAD/GET/OPTIONS from this origin and AllowedHeaders:*';
        reject(new Error(`Network error during upload. ${hint}`));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timed out. Please try again or check network connectivity.'));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Ensure 100% progress if supported
          onProgress?.({ loaded: file.size, total: file.size, percentage: 100 });
          resolve();
        } else {
          const body = (xhr.responseText || '').slice(0, 300);
          reject(new Error(`Upload failed with status ${xhr.status}. ${body}`));
        }
      };

      xhr.send(file);
    });

    return { success: true, key };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  const awsConfig = getAWSConfig();
  const session = await fetchAuthSession();
  const credentials = session.credentials;
  if (!credentials) throw new Error('Not authenticated');

  const s3Client = new S3Client({
    region: awsConfig.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  try {
    // Prefer presigned DELETE URL to minimize CORS header issues
    const delCmd = new DeleteObjectCommand({ Bucket: awsConfig.s3BucketName, Key: key });
    const signedUrl = await getSignedUrl(s3Client, delCmd, { expiresIn: 3600 });

    const res = await fetch(signedUrl, { method: 'DELETE', mode: 'cors' });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Delete failed with status ${res.status}. ${body.slice(0, 300)}`);
    }
  } catch (error: any) {
    console.error('S3 delete error:', error);
    // Helpful hints for common issues
    const msg = error?.message || String(error);
    if (/CORS|preflight|Access-Control|TypeError: Failed to fetch/i.test(msg)) {
      throw new Error('Delete blocked by CORS. Ensure your S3 bucket CORS allows DELETE/HEAD/GET/OPTIONS from this origin and AllowedHeaders:*');
    }
    if (/AccessDenied|Forbidden|SignatureDoesNotMatch|InvalidAccessKeyId/i.test(msg)) {
      throw new Error('Access denied deleting object. Verify Cognito IAM role includes s3:DeleteObject on your bucket/prefix.');
    }
    throw new Error(`Failed to delete from S3: ${msg}`);
  }
};