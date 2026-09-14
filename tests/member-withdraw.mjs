import assert from "node:assert/strict";
import {
  createWithdrawalHandler,
  recentPasswordClaim,
} from "../supabase/functions/member-withdraw/handler.mjs";
let count = 0;
function ok(name, value = true) {
  assert.ok(value, name);
  count++;
  console.log("✓ " + name);
}
const now = 2000000000;
for (const [claim, valid] of [
  [{}, false],
  [{ amr: [{ method: "anonymous", timestamp: now }] }, false],
  [{ amr: [{ method: "password", timestamp: now - 301 }] }, false],
  [{ amr: [{ method: "password", timestamp: now + 31 }] }, false],
  [{ amr: [{ method: "password", timestamp: now }] }, true],
  [{ amr: [{ method: "password", timestamp: "2000000000" }] }, false],
])
  ok(
    "password reauthentication checks " + JSON.stringify(claim),
    recentPasswordClaim(claim, now) === valid,
  );
function fixture(overrides = {}) {
  const state = {
    verified: true,
    anonymous: false,
    confirmed: true,
    files: ["actor/photo.jpg"],
    storageFail: false,
    finishFail: false,
    deleteFail: false,
    admin: false,
    calls: [],
    ...overrides,
  };
  const createClient = (url, key) => {
    if (key === "SUPABASE_ANON_KEY")
      return {
        auth: {
          getUser: async () => ({
            data: {
              user: state.verified
                ? {
                    id: "actor",
                    is_anonymous: state.anonymous,
                    email_confirmed_at: state.confirmed ? "2026-09-14" : null,
                    identities: state.google
                      ? [{ provider: "google" }]
                      : [{ provider: "email" }],
                    user_metadata: { provider: "google" },
                  }
                : null,
            },
            error: state.verified ? null : new Error("bad signature"),
          }),
        },
      };
    state.calls.push(["service-client"]);
    return {
      rpc: async (name, args) => {
        state.calls.push([name, args]);
        return {
          data: name === "member_withdrawal_files" ? state.files : null,
          error: state.admin
            ? { message: "admin_transfer_required" }
            : state.finishFail && name === "member_finish_withdrawal"
              ? { message: "photos_remain" }
              : null,
        };
      },
      storage: {
        from: () => ({
          remove: async (paths) => {
            state.calls.push(["storage-remove", paths]);
            if (state.storageFail) return { error: new Error("failure") };
            state.files = [];
            return { error: null };
          },
        }),
      },
      auth: {
        admin: {
          deleteUser: async (id) => {
            state.calls.push(["auth-delete", id]);
            return { error: state.deleteFail ? new Error("retry") : null };
          },
        },
      },
    };
  };
  return {
    state,
    handler: createWithdrawalHandler(
      createClient,
      (n) => n,
      () => now,
    ),
  };
}
function request({
  token = true,
  method = "POST",
  origin = "https://orbithere.com",
  payload = { amr: [{ method: "password", timestamp: now }] },
  body = { confirmation: "DELETE_MY_ACCOUNT", user_id: "victim" },
} = {}) {
  const jwt =
    "header." +
    Buffer.from(JSON.stringify(payload)).toString("base64url") +
    ".signature";
  return new Request("https://example.test/member-withdraw", {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(token ? { Authorization: "Bearer " + jwt } : {}),
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
for (const [name, options, req, status] of [
  ["missing token", {}, { token: false }, 401],
  ["invalid signature", { verified: false }, {}, 401],
  ["anonymous user", { anonymous: true }, {}, 401],
  ["unconfirmed email", { confirmed: false }, {}, 401],
  [
    "OAuth proof without a verified Google identity",
    {},
    { payload: { amr: [{ method: "oauth", timestamp: now }] } },
    401,
  ],
  [
    "stale Google OAuth proof",
    { google: true },
    { payload: { amr: [{ method: "oauth", timestamp: now - 301 }] } },
    401,
  ],
  [
    "future Google OAuth proof",
    { google: true },
    { payload: { amr: [{ method: "oauth", timestamp: now + 31 }] } },
    401,
  ],
  [
    "string Google OAuth timestamp",
    { google: true },
    { payload: { amr: [{ method: "oauth", timestamp: String(now) }] } },
    401,
  ],
  [
    "token refresh is not Google reauthentication",
    { google: true },
    { payload: { amr: [{ method: "token_refresh", timestamp: now }] } },
    401,
  ],
  [
    "expired password proof",
    {},
    { payload: { amr: [{ method: "password", timestamp: now - 301 }] } },
    401,
  ],
  [
    "missing explicit deletion confirmation",
    {},
    { body: { user_id: "victim" } },
    400,
  ],
  ["foreign website", {}, { origin: "https://attacker.test" }, 403],
  ["GET request", {}, { method: "GET" }, 405],
]) {
  const f = fixture(options),
    res = await f.handler(request(req));
  ok(
    name + " is rejected before any privileged action",
    res.status === status && f.state.calls.length === 0,
  );
}
let f = fixture(),
  res = await f.handler(request());
ok(
  "successful withdrawal returns completion",
  (await res.json()).deleted === true,
);
ok(
  "all privileged operations use the verified user, ignoring body user_id",
  f.state.calls
    .filter((c) => c[0].startsWith("member_"))
    .every((c) => c[1].p_user_id === "actor") &&
    f.state.calls.find((c) => c[0] === "auth-delete")[1] === "actor",
);
ok(
  "physical Storage removal precedes database and Auth deletion",
  f.state.calls.findIndex((c) => c[0] === "storage-remove") <
    f.state.calls.findIndex((c) => c[0] === "member_finish_withdrawal") &&
    f.state.calls.findIndex((c) => c[0] === "member_finish_withdrawal") <
      f.state.calls.findIndex((c) => c[0] === "auth-delete"),
);
f = fixture({ storageFail: true });
res = await f.handler(request());
ok(
  "failed physical deletion never deletes Auth or finalizes database",
  res.status === 409 &&
    !f.state.calls.some((c) =>
      ["auth-delete", "member_finish_withdrawal"].includes(c[0]),
    ),
);
f.state.storageFail = false;
res = await f.handler(request());
ok(
  "failed withdrawal can resume and complete on retry",
  (await res.json()).deleted === true,
);
f = fixture({ finishFail: true });
res = await f.handler(request());
ok(
  "remaining photos prevent Auth deletion",
  res.status === 409 && !f.state.calls.some((c) => c[0] === "auth-delete"),
);
f = fixture({ deleteFail: true });
res = await f.handler(request());
ok(
  "Auth deletion failure is never reported as success",
  res.status === 409 &&
    (await res.json()).error === "withdrawal_retry_required",
);
f = fixture({ admin: true });
res = await f.handler(request());
ok(
  "operator protection reports an actionable message",
  (await res.json()).error === "admin_transfer_required" &&
    !f.state.calls.some((c) => c[0] === "auth-delete"),
);
f = fixture({ google: true });
res = await f.handler(
  request({ payload: { amr: [{ method: "oauth", timestamp: now }] } }),
);
ok(
  "fresh Google OAuth proof permits withdrawal for the verified user",
  res.status === 200 &&
    f.state.calls.find((c) => c[0] === "auth-delete")[1] === "actor",
);
console.log("Withdrawal: " + count + " checks passed");
