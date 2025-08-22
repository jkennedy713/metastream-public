import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

export const clearAllDynamoDBRecords = async (): Promise<{ deletedCount: number }> => {
  try {
    const awsConfig = getAWSConfig();
    const session = await fetchAuthSession({ forceRefresh: true });
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

    // First, scan all records
    const scanCommand = new ScanCommand({
      TableName: awsConfig.dynamoTableName,
    });

    const response = await dynamoClient.send(scanCommand);
    const items = response.Items || [];
    
    let deletedCount = 0;
    
    // Delete each record
    for (const item of items) {
      try {
        // Determine the primary key (could be 'id', 'Id', or 'RecordID')
        const primaryKey = item.id?.S || item.Id?.S || item.RecordID?.S;
        
        if (primaryKey) {
          const deleteCommand = new DeleteItemCommand({
            TableName: awsConfig.dynamoTableName,
            Key: {
              // Try different key formats based on what's found
              ...(item.id?.S && { id: { S: item.id.S } }),
              ...(item.Id?.S && { Id: { S: item.Id.S } }),
              ...(item.RecordID?.S && { RecordID: { S: item.RecordID.S } })
            }
          });
          
          await dynamoClient.send(deleteCommand);
          deletedCount++;
        }
      } catch (deleteError) {
        console.warn('Failed to delete item:', deleteError);
        // Continue with next item
      }
    }

    return { deletedCount };
  } catch (error) {
    console.error('DynamoDB cleanup error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to clear DynamoDB records');
  }
};