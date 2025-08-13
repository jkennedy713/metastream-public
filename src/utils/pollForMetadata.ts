import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

/**
 * Wait until Lambda has written the item for the given fileName.
 * Returns the first matching item or throws on timeout.
 */
export async function waitForMetadata(fileName: string, timeoutMs = 30000, intervalMs = 1500) {
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    try {
      const awsConfig = getAWSConfig();
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

      const ddb = DynamoDBDocumentClient.from(dynamoClient);
      
      const out = await ddb.send(new QueryCommand({
        TableName: awsConfig.dynamoTableName,
        KeyConditionExpression: "fileName = :f",
        ExpressionAttributeValues: { ":f": fileName }
      }));
      
      if ((out.Items?.length ?? 0) > 0) {
        return out.Items![0];
      }
    } catch (error) {
      console.warn('Error polling for metadata:', error);
    }
    
    await new Promise(r => setTimeout(r, intervalMs));
  }
  
  throw new Error(`Timed out waiting for metadata for ${fileName}`);
}