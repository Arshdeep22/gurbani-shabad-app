"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

// Supabase Auth needs an email under the hood. We derive a stable synthetic
// email from the username so the UI can stay username-only.
const EMAIL_DOMAIN = "gurbani.local";
function usernameToEmail(username) {
  const clean = String(username).trim().toLowerCase().replace(/\s+/g, "");
  return `${clean}@${EMAIL_DOMAIN}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        await routeByRole();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function routeByRole() {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", uid)
      .single();
    if (profile?.must_change_password) {
      router.push("/change-password");
      return;
    }
    if (profile?.role === "admin") router.push("/admin");
    else router.push("/read");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const email = usernameToEmail(username);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await routeByRole();
    } catch (e) {
      setErr(e.message || "ਕੁਝ ਗੜਬੜ ਹੋ ਗਈ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fadeInUp">
        {/* Logo / heading */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 animate-floaty items-center justify-center rounded-3xl bg-gradient-to-br from-pastel-purple to-pastel-teal shadow-soft-lg">
            <span className="gurmukhi text-4xl text-white">ੴ</span>
          </div>
          <p className="mb-3 gurmukhi text-sm font-medium text-[#8a7ba8]">
            ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ
          </p>
          <h1 className="text-3xl font-bold text-[#5b4c7d]">
            ਗੁਰਬਾਣੀ ਵਿਚਾਰ
          </h1>
          <p className="mt-2 text-sm text-[#6a5b8a]">
            ਸ਼ਬਦ ਪੜ੍ਹੋ, ਸਮਝੋ ਤੇ ਕਮਾਓ
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="mb-6 text-center text-lg font-semibold text-[#5b4c7d]">
            ਲੌਗ-ਇਨ ਕਰੋ
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                ਨਾਮ
              </label>
              <input
                className="input-soft"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="ਜਿਵੇਂ ਅਮਨਦੀਪ_ਕੌਰ"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                ਪਾਸਵਰਡ
              </label>
              <input
                className="input-soft"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {err && (
              <div className="rounded-xl bg-rose-100/70 px-4 py-2.5 text-sm text-rose-600">
                {err}
              </div>
            )}

            <button type="submit" className="btn-3d w-full" disabled={loading}>
              {loading ? "ਉਡੀਕ ਕਰੋ…" : "ਦਾਖਲ ਹੋਵੋ"}
            </button>

            <p className="pt-2 text-center text-xs text-[#8a7ba8]">
              ਨਵਾਂ ਖਾਤਾ ਸਿਰਫ਼ ਐਡਮਿਨ ਵੱਲੋਂ ਬਣਾਇਆ ਜਾਂਦਾ ਹੈ।
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}