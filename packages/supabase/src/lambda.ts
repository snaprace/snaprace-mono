import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const createLambdaClient = (url: string, key: string) => {
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

let lambdaClient: ReturnType<typeof createLambdaClient> | null = null;

export const getLambdaClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables when creating lambda client"
    );
  }

  if (!lambdaClient) {
    lambdaClient = createLambdaClient(supabaseUrl, supabaseServiceKey);
  }
  return lambdaClient;
};
