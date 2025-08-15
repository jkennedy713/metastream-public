import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = import.meta.env.VITE_REGION as string;
const TABLE  = import.meta.env.VITE_DYNAMODB_TABLE_NAME as string;

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

// List recent items for the dashboard (cheap + simple)
export async function listItems(limit = 100) {
  const res = await ddb.send(new ScanCommand({ TableName: TABLE, Limit: limit }));
  return res.Items ?? [];
}

// Fetch a single record by PK (+ SK if available); returns plain JS object
export async function fetchRecord(fileName: string, recordId?: string, signal?: AbortSignal) {
  const rid = recordId ?? `${fileName}#full`;
  const g = await ddb.send(new GetCommand({ TableName: TABLE, Key: { FileName: fileName, RecordID: rid } }), { abortSignal: signal });
  if (g.Item) return g.Item;

  const q = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "FileName = :f",
    ExpressionAttributeValues: { ":f": fileName },
    Limit: 1
  }), { abortSignal: signal });
  return q.Items?.[0] ?? null;
}