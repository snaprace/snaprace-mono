import { dynamoClient } from "@/lib/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "@/env";
import type { Organization } from "@/server/api/routers/organizations";

export async function getOrganizationBySubdomain(
  subdomain: string,
): Promise<Organization | null> {
  if (!subdomain) return null;

  try {
    const command = new QueryCommand({
      TableName: env.DYNAMO_ORGANIZATIONS_TABLE,
      IndexName: "subdomain-index",
      KeyConditionExpression: "subdomain = :subdomain",
      ExpressionAttributeValues: {
        ":subdomain": subdomain,
      },
      Limit: 1,
    });

    const result = await dynamoClient.send(command);
    const item = result.Items?.[0];

    if (!item) {
      return null;
    }

    return item as Organization;
  } catch (error) {
    console.error("Error fetching organization by subdomain:", error);
    return null;
  }
}
