import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { createWithdrawalHandler } from "./handler.mjs";
Deno.serve(
  createWithdrawalHandler(
    createClient,
    (name: string) => Deno.env.get(name) || "",
  ),
);
