import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "../../../../lib/supabaseAdmin";

const EMAIL_DOMAIN = "gurbani.local";
const DEFAULT_PASSWORD = "131313";

function usernameToEmail(username) {
  const clean = String(username).trim().toLowerCase().replace(/\s+/g, "");
  return `${clean}@${EMAIL_DOMAIN}`;
}

// Verify the caller is an admin (using their bearer token).
async function requireAdmin(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Missing token", status: 401 };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return { error: "Invalid session", status: 401 };

  const admin = getAdminClient();
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profErr || profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }
  return { adminUserId: userData.user.id };
}

export async function POST(request) {
  try {
    const check = await requireAdmin(request);
    if (check.error) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const body = await request.json();
    const fullName = String(body?.fullName || "").trim();
    const username = String(body?.username || "").trim();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    const email = usernameToEmail(username);
    const admin = getAdminClient();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || username,
        username,
        must_change_password: true,
      },
    });

    if (createErr) {
      return NextResponse.json(
        { error: createErr.message || "Failed to create user" },
        { status: 400 }
      );
    }

    // Make sure the profile row reflects the flag and correct fields
    // (in case the trigger inserted defaults).
    const newUserId = created?.user?.id;
    if (newUserId) {
      await admin
        .from("profiles")
        .update({
          full_name: fullName || username,
          username,
          must_change_password: true,
          role: "user",
        })
        .eq("id", newUserId);
    }

    return NextResponse.json({ ok: true, user: created?.user });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const check = await requireAdmin(request);
    if (check.error) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");
    if (!userId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (userId === check.adminUserId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Safety: don't allow deleting admins via this endpoint
    const { data: target } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (target?.role === "admin") {
      return NextResponse.json(
        { error: "Cannot delete another admin" },
        { status: 400 }
      );
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Server error" },
      { status: 500 }
    );
  }
}