import { DynamoDBClient, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
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
  console.log('queryMetadataById called with id:', id);
  const awsConfig = getAWSConfig();
  console.log('AWS config:', awsConfig);
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

  // Decode filename from route parameter
  const fileName = decodeURIComponent(id);
  console.log('Decoded fileName:', fileName);
  
  // Try GetItem first with FileName and RecordID
  const recordId = `${fileName}#full`;
  console.log('Trying GetItem with recordId:', recordId);
  const getItemCmd = new GetItemCommand({
    TableName: awsConfig.dynamoTableName,
    Key: {
      FileName: { S: fileName },
      RecordID: { S: recordId },
    },
  });

  try {
    const getItemRes = await dynamoClient.send(getItemCmd);
    console.log('GetItem response:', getItemRes);
    if (getItemRes.Item) {
      const item = getItemRes.Item;
      console.log('Found item with GetItem:', item);
      const mapped = mapDynamoItem(item);
      return mapped;
    }
    console.log('No item found with GetItem, trying Query...');
  } catch (e) {
    console.warn('GetItem failed, falling back to Query:', e);
  }

  // Fallback: Query on FileName and take the single item
  const queryCmd = new QueryCommand({
    TableName: awsConfig.dynamoTableName,
    KeyConditionExpression: 'FileName = :fileName',
    ExpressionAttributeValues: {
      ':fileName': { S: fileName },
    },
    Limit: 1,
  });

  const queryRes = await dynamoClient.send(queryCmd);
  console.log('Query response:', queryRes);
  const item = (queryRes.Items || [])[0];
  if (!item) {
    console.log('No item found with Query either');
    return null;
  }

  console.log('Found item with Query:', item);
  return mapDynamoItem(item);
};

const mapDynamoItem = (item: any): MetadataRecord => {
  // Extract all DynamoDB attributes directly
  console.log('Raw DynamoDB item:', JSON.stringify(item, null, 2));
  const metadata: Record<string, any> = {};
  
  // Map DynamoDB types to JavaScript values
  Object.entries(item).forEach(([key, value]: [string, any]) => {
    // Skip primary keys but continue processing other attributes
    if (key !== 'FileName' && key !== 'RecordID' && key !== 'UserId') {
      if (value.S !== undefined) {
        metadata[key] = value.S;
      } else if (value.N !== undefined) {
        metadata[key] = Number(value.N);
      } else if (value.L !== undefined) {
        metadata[key] = value.L.map((item: any) => item.S || item.N || item);
      } else if (value.M !== undefined) {
        metadata[key] = Object.fromEntries(
          Object.entries(value.M).map(([k, v]: [string, any]) => [k, v.S || v.N || v])
        );
      } else if (value.BOOL !== undefined) {
        metadata[key] = value.BOOL;
      }
    }
  });

  console.log('Processed metadata:', metadata);
  
  const result = {
    id: item.RecordID?.S || item.FileName?.S || '',
    filename: item.FileName?.S || '',
    uploadTime: '', // Hidden per requirements
    metadata,
    userId: item.UserId?.S || '',
  };
  
  console.log('Final mapped record:', result);
  return result;
};
