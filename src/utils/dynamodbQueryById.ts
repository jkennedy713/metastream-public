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

  // Use a scan with FilterExpression to locate by any of the potential key names
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

  const mapped: MetadataRecord = {
    id: item.id?.S || (item as any).Id?.S || (item as any).RecordID?.S || '',
    filename: item.filename?.S || (item as any).FileName?.S || '',
    uploadTime: item.uploadTime?.S || (item as any).UploadTime?.S || '',
    metadata: item.metadata
      ? JSON.parse(item.metadata.S || '{}')
      : (item as any).Metadata
      ? JSON.parse((item as any).Metadata.S || '{}')
      : {},
    userId: item.userId?.S || (item as any).UserId?.S || '',
  };

  return mapped;
};
