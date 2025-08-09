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

  const cmd = new PutItemCommand({
    TableName: awsConfig.dynamoTableName,
    Item: {
      // Primary key required by table (compat with legacy schema)
      RecordID: { S: record.id },

      // Additional capitalized attributes for alternate schema compatibility
      FileName: { S: record.filename },
      UploadTime: { S: record.uploadTime },
      Id: { S: record.id },
      UserId: { S: userId },
      Metadata: { S: JSON.stringify(record.metadata || {}) },

      // Lowercase attributes for app compatibility
      id: { S: record.id },
      filename: { S: record.filename },
      uploadTime: { S: record.uploadTime },
      userId: { S: userId },
      metadata: { S: JSON.stringify(record.metadata || {}) },
    },
  });

  try {
    await dynamoClient.send(cmd);
  } catch (error) {
    console.error('DynamoDB put error (compat):', error);
    throw new Error(error instanceof Error ? `Failed to save metadata: ${error.message}` : 'Failed to save metadata');
  }
};