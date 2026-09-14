import { Webhook } from "npm:svix@2.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { createDeliveryHandler } from "./handler.mjs";
Deno.serve(createDeliveryHandler(Webhook, createClient, (name: string) => Deno.env.get(name) || ""));
