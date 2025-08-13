import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

export const deleteMetadataCompat = async (params: { id: string; filename?: string }) => {
  const { id, filename } = params;
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

  const attempts = [
    { // Preferred: RecordID
      key: { RecordID: { S: id } },
      label: 'RecordID'
    },
    { // Alternate: Id
      key: { Id: { S: id } },
      label: 'Id'
    },
    { // Alternate: id
      key: { id: { S: id } },
      label: 'id'
    },
    ...(filename ? [{ key: { FileName: { S: filename } }, label: 'FileName' } as const] : []),
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      await dynamoClient.send(
        new DeleteItemCommand({ TableName: awsConfig.dynamoTableName, Key: attempt.key })
      );
      return; // success
    } catch (e) {
      lastError = e;
      // Continue to next attempt if ValidationException about key mismatch
      const msg = (e as any)?.message || '';
      if (!/key element does not match|ValidationException/i.test(msg)) {
        break;
      }
    }
  }
  console.error('DynamoDB delete error:', lastError);
  throw new Error(
    lastError instanceof Error ? `Failed to delete metadata: ${lastError.message}` : 'Failed to delete metadata'
  );
};
