import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const REGION = import.meta.env.VITE_REGION as string;
const TABLE  = import.meta.env.VITE_DYNAMODB_TABLE_NAME as string;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false }
});

export async function fetchRecord(fileName: string, recordId?: string) {
  const rid = recordId ?? `${fileName}#full`;
  const g = await ddb.send(new GetCommand({ TableName: TABLE, Key: { FileName: fileName, RecordID: rid } }));
  if (g.Item) return g.Item;
  const q = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "FileName = :f",
    ExpressionAttributeValues: { ":f": fileName },
    Limit: 1
  }));
  return q.Items?.[0] ?? null;
}