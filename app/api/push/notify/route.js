import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  "mailto:admin@gurbani.local",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function getSubscriptions(userIds) {
  const { data } = await supabaseAdmin
    .from("push_subscriptions")
    .select("subscription")
    .in("user_id", userIds);
  return (data || []).map((r) => r.subscription);
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { type, shabadTitle, userName } = await request.json();

    // Build messages for user and admin
    const userPayload = buildUserPayload(type, shabadTitle);
    const adminPayload = buildAdminPayload(type, userName || "ਉਪਭੋਗਤਾ", shabadTitle);

    // Get caller's subscriptions
    const userSubs = await getSubscriptions([user.id]);

    // Get all admin subscriptions
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    const adminIds = (admins || []).map((a) => a.id).filter((id) => id !== user.id);
    const adminSubs = adminIds.length ? await getSubscriptions(adminIds) : [];

    const sends = [
      ...userSubs.map((sub) => send(sub, userPayload)),
      ...adminSubs.map((sub) => send(sub, adminPayload)),
    ];
    await Promise.allSettled(sends);

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function send(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    // 410 Gone = subscription expired; silently ignore
    if (err.statusCode !== 410) console.error("push error", err.statusCode);
  }
}

function buildUserPayload(type, shabadTitle) {
  if (type === "deadline_expired") {
    return {
      title: "⏰ ਸਮਾਂ ਖ਼ਤਮ ਹੋ ਗਿਆ",
      body: `"${shabadTitle}" ਦਾ 48 ਘੰਟਿਆਂ ਦਾ ਸਮਾਂ ਖ਼ਤਮ ਹੋ ਗਿਆ — ਵਾਧਾ ਲਓ ਜਾਂ ਸ਼ਬਦ ਪੂਰਾ ਕਰੋ।`,
      url: "/read",
    };
  }
  return {
    title: "📨 ਵਾਧੂ ਸਮਾਂ ਵੀ ਖ਼ਤਮ ਹੋ ਗਿਆ",
    body: `"${shabadTitle}" ਦਾ ਵਾਧੂ ਸਮਾਂ ਵੀ ਖ਼ਤਮ ਹੋ ਗਿਆ — ਸ਼ਬਦ ਛੱਡਿਆ ਗਿਆ।`,
    url: "/read",
  };
}

function buildAdminPayload(type, userName, shabadTitle) {
  if (type === "deadline_expired") {
    return {
      title: "⏰ ਉਪਭੋਗਤਾ ਦਾ ਸਮਾਂ ਖ਼ਤਮ",
      body: `${userName} ਦਾ "${shabadTitle}" ਸ਼ਬਦ ਦਾ 48 ਘੰਟਿਆਂ ਦਾ ਸਮਾਂ ਖ਼ਤਮ ਹੋ ਗਿਆ।`,
      url: "/admin",
    };
  }
  return {
    title: "📨 ਉਪਭੋਗਤਾ ਦਾ ਵਾਧੂ ਸਮਾਂ ਵੀ ਖ਼ਤਮ",
    body: `${userName} ਨੇ "${shabadTitle}" ਸ਼ਬਦ ਨਹੀਂ ਕੀਤਾ — ਸ਼ਬਦ ਛੱਡਿਆ ਗਿਆ।`,
    url: "/admin",
  };
}
