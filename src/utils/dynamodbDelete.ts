// src/utils/dynamodbDelete.ts
// DynamoDB delete utilities for table: metadata
// Key schema: PK=fileName (String), SK=RecordID (String)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

// Adjust if you centralize config elsewhere
const REGION = "us-east-1";
const TABLE_NAME = "metadata";

const ddbDoc = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION })
);

/**
 * Delete by explicit keys (preferred).
 */
export async function deleteMetadataByKeys(
    fileName: string,
    recordId: string
): Promise<void> {
    await ddbDoc.send(
        new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { fileName, RecordID: recordId },
        })
    );
}

/**
 * Convenience helper if your UI passes an object/row.
 * Expects properties exactly named fileName and RecordID.
 */
export async function deleteMetadataFromRow(row: {
    fileName: string;
    RecordID: string;
}): Promise<void> {
    if (!row?.fileName || !row?.RecordID) {
        throw new Error(
            'Delete requires both keys. Missing "fileName" or "RecordID".'
        );
    }
    await deleteMetadataByKeys(row.fileName, row.RecordID);
}