// getUser validates the JWT on the Auth server before any service-role operation.
// The platform JWT check is disabled for publishable-key compatibility; this
// endpoint implements its own bearer authentication and never trusts body IDs.
export function recentPasswordClaim(payload, now) {
  return (
    Array.isArray(payload.amr) &&
    payload.amr.some(
      (x) =>
        x.method === "password" &&
        typeof x.timestamp === "number" &&
        x.timestamp <= now + 30 &&
        now - x.timestamp <= 300,
    )
  );
}

export function createWithdrawalHandler(
  createClient,
  env,
  now = () => Date.now() / 1000,
) {
  return async (req) => {
    const origin = req.headers.get("Origin");
    const allowed = origin === "https://orbithere.com";
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowed ? origin : "https://orbithere.com",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    };
    const reply = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (origin && !allowed) return reply({ error: "origin_denied" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return reply({ error: "method_not_allowed" }, 405);
    const authorization = req.headers.get("Authorization") || "";
    if (!/^Bearer \S+$/.test(authorization))
      return reply({ error: "authentication_required" }, 401);
    const url = env("SUPABASE_URL"),
      key = env("SUPABASE_ANON_KEY");
    const userClient = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (
      error ||
      !data.user ||
      data.user.is_anonymous ||
      !data.user.email_confirmed_at
    )
      return reply({ error: "verified_member_required" }, 401);
    try {
      const body = await req.json();
      if (body.confirmation !== "DELETE_MY_ACCOUNT")
        return reply({ error: "confirmation_required" }, 400);
      const segment = authorization
        .slice(7)
        .split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const payload = JSON.parse(
        atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, "=")),
      );
      if (!recentPasswordClaim(payload, now()))
        return reply({ error: "password_reauthentication_required" }, 401);
      const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const userId = data.user.id;
      const rpc = async (name) => {
        const r = await admin.rpc(name, { p_user_id: userId });
        if (r.error) throw r.error;
        return r.data;
      };
      await rpc("member_begin_withdrawal");
      // Bounded execution. Failed/large removals remain frozen and can be retried.
      for (let batch = 0; batch < 20; batch++) {
        const paths = await rpc("member_withdrawal_files");
        if (!paths.length) break;
        const removed = await admin.storage.from("board-images").remove(paths);
        if (removed.error) throw removed.error;
      }
      await rpc("member_finish_withdrawal");
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error) throw deleted.error;
      return reply({ deleted: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error?.message || "");
      // Never return tokens, database errors, storage paths or email addresses.
      return reply(
        {
          error: message.includes("admin_transfer_required")
            ? "admin_transfer_required"
            : "withdrawal_retry_required",
        },
        409,
      );
    }
  };
}
