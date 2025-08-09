import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

export interface MetadataRecord {
  id: string;
  filename: string;
  uploadTime: string;
  metadata: Record<string, any>;
  userId: string;
}

export const queryMetadataById = async (id: string): Promise<MetadataRecord | null> => {
  const awsConfig = getAWSConfig();
  const session = await fetchAuthSession();
  const credentials = session.credentials;
  if (!credentials) throw new Error('Not authenticated');

  const dynamoClient = new DynamoDBClient({
    region: awsConfig.region,
    credentials: {
      accessKeyId: credentials.accessKeyId!,
      secretAccessKey: credentials.secretAccessKey!,
      sessionToken: credentials.sessionToken,
    },
  });

  const cmd = new ScanCommand({
    TableName: awsConfig.dynamoTableName,
    FilterExpression: '#id = :v OR #Id = :v OR #RecordID = :v',
    ExpressionAttributeNames: {
      '#id': 'id',
      '#Id': 'Id',
      '#RecordID': 'RecordID',
    },
    ExpressionAttributeValues: {
      ':v': { S: id },
    },
    Limit: 1,
  });

  const res = await dynamoClient.send(cmd);
  const item = (res.Items || [])[0];
  if (!item) return null;

  const baseMeta = item.metadata
    ? JSON.parse((item as any).metadata?.S || '{}')
    : (item as any).Metadata
    ? JSON.parse((item as any).Metadata?.S || '{}')
    : {};
  const keyPhrases = (item as any).KeyPhrases?.L
    ? ((item as any).KeyPhrases.L as Array<{ S?: string }>).map(x => x.S || '').filter(Boolean)
    : undefined;

  const mapped: MetadataRecord = {
    id: (item as any).id?.S || (item as any).Id?.S || (item as any).RecordID?.S || '',
    filename: (item as any).filename?.S || (item as any).FileName?.S || '',
    uploadTime: (item as any).uploadTime?.S || (item as any).UploadTime?.S || '',
    metadata: keyPhrases && keyPhrases.length ? { ...baseMeta, keyPhrases } : baseMeta,
    userId: (item as any).userId?.S || (item as any).UserId?.S || '',
  };

  return mapped;
};
