import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { dynamoClient } from "@/lib/dynamodb";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "@/env";
import { OrganizationSchema } from "@/types/organization";

// Re-export for backward compatibility
export { OrganizationSchema, type Organization } from "@/types/organization";

export const organizationsRouter = createTRPCRouter({
  getBySubdomain: publicProcedure
    .input(z.object({ subdomain: z.string() }))
    .query(async ({ input }) => {
      if (!input.subdomain) {
        return null;
      }

      try {
        // Query using GSI subdomain-index
        const command = new QueryCommand({
          TableName: env.DYNAMO_ORGANIZATIONS_TABLE,
          IndexName: "subdomain-index",
          KeyConditionExpression: "subdomain = :subdomain",
          ExpressionAttributeValues: {
            ":subdomain": input.subdomain,
          },
          Limit: 1,
        });

        const result = await dynamoClient.send(command);
        const item = result.Items?.[0];

        if (!item) {
          return null;
        }

        // Parse and validate the organization data
        return OrganizationSchema.parse(item);
      } catch (error) {
        console.error("Error fetching organization by subdomain:", error);
        return null;
      }
    }),

  getById: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => {
      if (!input.organizationId) {
        return null;
      }

      try {
        const command = new GetCommand({
          TableName: env.DYNAMO_ORGANIZATIONS_TABLE,
          Key: {
            organization_id: input.organizationId,
          },
        });

        const result = await dynamoClient.send(command);

        if (!result.Item) {
          return null;
        }

        // Parse and validate the organization data
        return OrganizationSchema.parse(result.Item);
      } catch (error) {
        console.error("Error fetching organization by ID:", error);
        return null;
      }
    }),
});
