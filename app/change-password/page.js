"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const DEFAULT_PASSWORD = "131313";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.push("/");
        return;
      }
      const uid = data.session.user.id;
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();

      if (!prof) {
        router.push("/");
        return;
      }
      // If user does not need to change password, send them onward.
      if (!prof.must_change_password) {
        if (prof.role === "admin") router.push("/admin");
        else router.push("/read");
        return;
      }
      setProfile(prof);
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);

    if (pw1.length < 6) {
      setErr("ਪਾਸਵਰਡ ਘੱਟੋ-ਘੱਟ 6 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।");
      return;
    }
    if (pw1 !== pw2) {
      setErr("ਦੋਵੇਂ ਪਾਸਵਰਡ ਮੇਲ ਨਹੀਂ ਖਾ ਰਹੇ।");
      return;
    }
    if (pw1 === DEFAULT_PASSWORD) {
      setErr("ਕਿਰਪਾ ਕਰਕੇ ਡਿਫਾਲਟ ਪਾਸਵਰਡ ਤੋਂ ਵੱਖਰਾ ਪਾਸਵਰਡ ਚੁਣੋ।");
      return;
    }

    setSaving(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({
        password: pw1,
      });
      if (upErr) throw upErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", profile.id);
      if (profErr) throw profErr;

      if (profile.role === "admin") router.push("/admin");
      else router.push("/read");
    } catch (e) {
      setErr(e.message || "ਪਾਸਵਰਡ ਬਦਲਣ ਵਿੱਚ ਗੜਬੜ ਹੋਈ।");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-card animate-pulse px-8 py-6 text-[#6a5b8a]">
          ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fadeInUp">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pastel-purple to-pastel-teal shadow-soft-lg">
            <span className="gurmukhi text-4xl text-white">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-[#5b4c7d]">
            ਪਾਸਵਰਡ ਬਦਲੋ
          </h1>
          <p className="mt-2 text-sm text-[#6a5b8a]">
            ਪਹਿਲੀ ਵਾਰ ਲੌਗ-ਇਨ ਕਰਨ ਤੇ ਨਵਾਂ ਪਾਸਵਰਡ ਸੈੱਟ ਕਰਨਾ ਜ਼ਰੂਰੀ ਹੈ।
          </p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                ਨਵਾਂ ਪਾਸਵਰਡ
              </label>
              <input
                className="input-soft"
                type="password"
                placeholder="••••••••"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                ਨਵਾਂ ਪਾਸਵਰਡ ਦੁਬਾਰਾ
              </label>
              <input
                className="input-soft"
                type="password"
                placeholder="••••••••"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {err && (
              <div className="rounded-xl bg-rose-100/70 px-4 py-2.5 text-sm text-rose-600">
                {err}
              </div>
            )}

            <button type="submit" className="btn-3d w-full" disabled={saving}>
              {saving ? "ਸੰਭਾਲ ਰਿਹਾ ਹੈ…" : "ਪਾਸਵਰਡ ਸੰਭਾਲੋ"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost w-full text-sm"
            >
              ਲੌਗ-ਆਊਟ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}