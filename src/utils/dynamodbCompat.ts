import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

export const saveMetadataCompat = async (record: {
  id: string;
  filename: string;
  uploadTime: string;
  metadata: Record<string, any>;
}): Promise<void> => {
  const awsConfig = getAWSConfig();
  const session = await fetchAuthSession();
  const credentials = session.credentials;
  const userId = (session as any).userSub || (session as any)?.tokens?.idToken?.payload?.sub || 'unknown-user';

  if (!credentials) {
    throw new Error('Not authenticated');
  }

  const dynamoClient = new DynamoDBClient({
    region: awsConfig.region,
    credentials: {
      accessKeyId: credentials.accessKeyId!,
      secretAccessKey: credentials.secretAccessKey!,
      sessionToken: credentials.sessionToken,
    },
  });

  // Ensure metadata includes a valid S3 object key for downstream deletes
  const normalizedMeta = (() => {
    const m = { ...(record.metadata || {}) } as Record<string, any>;
    // Prefer existing s3Key; fallback to 'key'; finally use record.id
    if (!m.s3Key && typeof m.key === 'string' && m.key.trim()) m.s3Key = m.key.trim();
    if (!m.s3Key && typeof record.id === 'string' && record.id.trim()) m.s3Key = record.id.trim();
    // Provide 'key' alias too for broader compatibility
    if (!m.key && typeof m.s3Key === 'string') m.key = m.s3Key;
    return m;
  })();

  const item: any = {
    // Primary key required by table (compat with legacy schema)
    RecordID: { S: record.id },

    // Additional capitalized attributes for alternate schema compatibility
    FileName: { S: record.filename },
    UploadTime: { S: record.uploadTime },
    Id: { S: record.id },
    UserId: { S: userId },
    Metadata: { S: JSON.stringify(normalizedMeta) },

    // Lowercase attributes for app compatibility
    id: { S: record.id },
    filename: { S: record.filename },
    uploadTime: { S: record.uploadTime },
    userId: { S: userId },
    metadata: { S: JSON.stringify(normalizedMeta) },
  };

  // Optionally include top-level KeyPhrases list for efficient querying
  const kp = Array.isArray((normalizedMeta as any).keyPhrases)
    ? (normalizedMeta as any).keyPhrases
        .filter((s: any) => typeof s === 'string' && s.trim())
        .slice(0, 50)
    : [];
  if (kp.length) {
    item.KeyPhrases = { L: kp.map((s: string) => ({ S: s })) };
  }

  const cmd = new PutItemCommand({
    TableName: awsConfig.dynamoTableName,
    Item: item,
  });

  try {
    await dynamoClient.send(cmd);
  } catch (error) {
    console.error('DynamoDB put error (compat):', error);
    throw new Error(error instanceof Error ? `Failed to save metadata: ${error.message}` : 'Failed to save metadata');
  }
};