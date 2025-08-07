import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { fetchAuthSession } from 'aws-amplify/auth';
import { awsConfig } from './awsConfig';

export interface MetadataRecord {
  id: string;
  filename: string;
  uploadTime: string;
  metadata: Record<string, any>;
  userId: string;
}

export interface QueryFilters {
  filename?: string;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
}

export const queryMetadata = async (
  filters: QueryFilters = {},
  limit: number = 100,
  lastEvaluatedKey?: Record<string, any>
): Promise<{
  items: MetadataRecord[];
  lastEvaluatedKey?: Record<string, any>;
  hasMore: boolean;
}> => {
  try {
    // Get AWS credentials from Amplify session
    const session = await fetchAuthSession();
    const credentials = session.credentials;
    
    if (!credentials) {
      throw new Error('Not authenticated');
    }

    const dynamoClient = new DynamoDBClient({
      region: awsConfig.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    // For now, we'll use a simple scan operation
    // In production, you'd want to implement more efficient querying with GSIs
    const scanCommand = new ScanCommand({
      TableName: awsConfig.dynamoTableName,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await dynamoClient.send(scanCommand);
    
    const items: MetadataRecord[] = (response.Items || []).map(item => ({
      id: item.id?.S || '',
      filename: item.filename?.S || '',
      uploadTime: item.uploadTime?.S || '',
      metadata: item.metadata ? JSON.parse(item.metadata.S || '{}') : {},
      userId: item.userId?.S || '',
    }));

    // Apply client-side filtering (in production, this should be done server-side)
    let filteredItems = items;

    if (filters.filename) {
      filteredItems = filteredItems.filter(item => 
        item.filename.toLowerCase().includes(filters.filename!.toLowerCase())
      );
    }

    if (filters.searchTerm) {
      filteredItems = filteredItems.filter(item => 
        item.filename.toLowerCase().includes(filters.searchTerm!.toLowerCase()) ||
        JSON.stringify(item.metadata).toLowerCase().includes(filters.searchTerm!.toLowerCase())
      );
    }

    if (filters.dateFrom) {
      filteredItems = filteredItems.filter(item => 
        new Date(item.uploadTime) >= new Date(filters.dateFrom!)
      );
    }

    if (filters.dateTo) {
      filteredItems = filteredItems.filter(item => 
        new Date(item.uploadTime) <= new Date(filters.dateTo!)
      );
    }

    return {
      items: filteredItems,
      lastEvaluatedKey: response.LastEvaluatedKey,
      hasMore: !!response.LastEvaluatedKey,
    };
  } catch (error) {
    console.error('DynamoDB query error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to query metadata');
  }
};