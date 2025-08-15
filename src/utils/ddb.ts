import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { getAWSConfig } from "./awsConfig";

let ddbInstance: DynamoDBDocumentClient | null = null;

export const getDDBClient = () => {
  if (ddbInstance) return ddbInstance;
  
  const config = getAWSConfig();
  
  const cognitoClient = new CognitoIdentityClient({
    region: config.region,
  });

  const ddbClient = new DynamoDBClient({
    region: config.region,
    credentials: fromCognitoIdentityPool({
      client: cognitoClient,
      identityPoolId: config.identityPoolId,
    }),
  });

  ddbInstance = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
    unmarshallOptions: { wrapNumbers: false },
  });

  return ddbInstance;
};

// List recent items for the dashboard (cheap + simple)
export async function listItems(limit = 100) {
  const config = getAWSConfig();
  const ddb = getDDBClient();
  const res = await ddb.send(new ScanCommand({ TableName: config.dynamoTableName, Limit: limit }));
  return res.Items ?? [];
}

// Fetch a single record by PK (+ SK if available); returns plain JS object
export async function fetchRecord(fileName: string, recordId?: string, signal?: AbortSignal) {
  const config = getAWSConfig();
  const ddb = getDDBClient();
  const rid = recordId ?? `${fileName}#full`;
  const g = await ddb.send(new GetCommand({ TableName: config.dynamoTableName, Key: { FileName: fileName, RecordID: rid } }), { abortSignal: signal });
  if (g.Item) return g.Item;

  const q = await ddb.send(new QueryCommand({
    TableName: config.dynamoTableName,
    KeyConditionExpression: "FileName = :f",
    ExpressionAttributeValues: { ":f": fileName },
    Limit: 1
  }), { abortSignal: signal });
  return q.Items?.[0] ?? null;
}