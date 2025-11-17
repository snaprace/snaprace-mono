import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl =
  process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey =
  supabaseServiceKey ||
  process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

export const createLambdaClient = () => {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

let lambdaClient: ReturnType<typeof createLambdaClient>;

export const getLambdaClient = () => {
  if (!lambdaClient) {
    lambdaClient = createLambdaClient();
  }
  return lambdaClient;
};
