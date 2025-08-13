import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

export interface MetadataRecord {
  id: string;
  filename: string;
  uploadTime: string;
  metadata: Record<string, any>;
  userId: string;
  fileName: string;
  RecordID: string;
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
    const awsConfig = getAWSConfig();
    // Get AWS credentials from Amplify session with retry logic
    let credentials;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!credentials && attempts < maxAttempts) {
      try {
        const session = await fetchAuthSession({ forceRefresh: attempts > 0 });
        credentials = session.credentials;
        if (!credentials) {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        }
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }
    
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
      id: item.id?.S || (item as any).Id?.S || (item as any).RecordID?.S || '',
      filename: item.filename?.S || (item as any).FileName?.S || '',
      fileName: item.filename?.S || (item as any).FileName?.S || '',
      RecordID: item.id?.S || (item as any).Id?.S || (item as any).RecordID?.S || '',
      uploadTime: item.uploadTime?.S || (item as any).UploadTime?.S || '',
      metadata: (() => {
        const base = item.metadata
          ? JSON.parse(item.metadata.S || '{}')
          : (item as any).Metadata
          ? JSON.parse((item as any).Metadata.S || '{}')
          : {};
        // Merge in KeyPhrases from top-level DynamoDB attribute if present
        const kp = (item as any).KeyPhrases?.L
          ? ((item as any).KeyPhrases.L as Array<{ S?: string }>).map(x => x.S || '').filter(Boolean)
          : undefined;
        if (kp && kp.length) {
          return { ...base, keyPhrases: kp };
        }
        return base;
      })(),
      userId: item.userId?.S || (item as any).UserId?.S || '',
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

// Client-side metadata saving removed - handled by S3->Lambda->DynamoDB flow