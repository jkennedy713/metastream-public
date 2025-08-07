import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

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
    const session = await fetchAuthSession();
    const credentials = session.credentials;
    
    if (!credentials) {
      throw new Error('Not authenticated');
    }

    const s3Client = new S3Client({
      region: awsConfig.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    const key = `uploads/${Date.now()}-${file.name}`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: awsConfig.s3BucketName,
      Key: key,
      Body: file,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        originalName: file.name,
        uploadTime: new Date().toISOString(),
      },
    });

    // For progress tracking, we'll simulate it since AWS SDK v3 doesn't provide built-in progress
    if (onProgress) {
      const progressInterval = setInterval(() => {
        // Simulate progress
        const randomProgress = Math.min(90, Math.random() * 100);
        onProgress({
          loaded: (file.size * randomProgress) / 100,
          total: file.size,
          percentage: randomProgress,
        });
      }, 100);

      try {
        await s3Client.send(uploadCommand);
        clearInterval(progressInterval);
        onProgress({ loaded: file.size, total: file.size, percentage: 100 });
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    } else {
      await s3Client.send(uploadCommand);
    }

    return { success: true, key };
  } catch (error) {
    console.error('S3 upload error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
};