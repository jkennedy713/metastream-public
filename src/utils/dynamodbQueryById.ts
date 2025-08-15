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

  // Decode filename from route parameter
  const fileName = decodeURIComponent(id);
  
  // Try GetItem first with FileName and RecordID
  const recordId = `${fileName}#full`;
  const getItemCmd = new GetItemCommand({
    TableName: awsConfig.dynamoTableName,
    Key: {
      FileName: { S: fileName },
      RecordID: { S: recordId },
    },
  });

  try {
    const getItemRes = await dynamoClient.send(getItemCmd);
    if (getItemRes.Item) {
      const item = getItemRes.Item;
      const mapped = mapDynamoItem(item);
      return mapped;
    }
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
  const item = (queryRes.Items || [])[0];
  if (!item) return null;

  return mapDynamoItem(item);
};

const mapDynamoItem = (item: any): MetadataRecord => {
  // Map DynamoDB AttributeValue objects to JavaScript values
  const metadata: Record<string, any> = {};
  
  Object.entries(item).forEach(([key, attributeValue]: [string, any]) => {
    // Handle each DynamoDB AttributeValue type directly
    if (attributeValue.S !== undefined) {
      metadata[key] = attributeValue.S;
    } else if (attributeValue.N !== undefined) {
      metadata[key] = Number(attributeValue.N);
    } else if (attributeValue.BOOL !== undefined) {
      metadata[key] = attributeValue.BOOL;
    } else if (attributeValue.L !== undefined) {
      // Handle Lists - extract values from each item
      metadata[key] = attributeValue.L.map((listItem: any) => {
        if (listItem.S !== undefined) return listItem.S;
        if (listItem.N !== undefined) return Number(listItem.N);
        if (listItem.BOOL !== undefined) return listItem.BOOL;
        return listItem;
      });
    } else if (attributeValue.M !== undefined) {
      // Handle Maps - recursively extract values
      const mapValue: Record<string, any> = {};
      Object.entries(attributeValue.M).forEach(([mapKey, mapVal]: [string, any]) => {
        if (mapVal.S !== undefined) mapValue[mapKey] = mapVal.S;
        else if (mapVal.N !== undefined) mapValue[mapKey] = Number(mapVal.N);
        else if (mapVal.BOOL !== undefined) mapValue[mapKey] = mapVal.BOOL;
        else mapValue[mapKey] = mapVal;
      });
      metadata[key] = mapValue;
    } else if (attributeValue.NULL !== undefined) {
      metadata[key] = null;
    } else {
      // Fallback for any other types
      metadata[key] = attributeValue;
    }
  });

  console.log('Mapped metadata from DynamoDB item:', metadata);

  return {
    id: metadata.RecordID || metadata.FileName || '',
    filename: metadata.FileName || '',
    uploadTime: '', // Hidden per requirements
    metadata, // Now includes ALL DynamoDB attributes properly mapped
    userId: metadata.UserId || '',
  };
};
