"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // If already logged in, route based on role.
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
      .select("role")
      .eq("id", uid)
      .single();
    if (profile?.role === "admin") router.push("/admin");
    else router.push("/read");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setMsg(
          "Account created! If email confirmation is on, check your inbox. Otherwise you can log in now."
        );
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await routeByRole();
      }
    } catch (e) {
      setErr(e.message || "Something went wrong");
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
          <h1 className="text-3xl font-bold text-[#5b4c7d]">
            Gurbani Reflections
          </h1>
          <p className="mt-2 text-sm text-[#6a5b8a]">
            Read, understand & journey through shabads
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="mb-6 flex rounded-2xl bg-white/40 p-1">
            <button
              onClick={() => {
                setMode("login");
                setErr(null);
                setMsg(null);
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                mode === "login"
                  ? "bg-white text-[#5b4c7d] shadow-soft"
                  : "text-[#8a7ba8]"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setErr(null);
                setMsg(null);
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                mode === "signup"
                  ? "bg-white text-[#5b4c7d] shadow-soft"
                  : "text-[#8a7ba8]"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                  Full Name
                </label>
                <input
                  className="input-soft"
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                Email
              </label>
              <input
                className="input-soft"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                Password
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
            {msg && (
              <div className="rounded-xl bg-emerald-100/70 px-4 py-2.5 text-sm text-emerald-700">
                {msg}
              </div>
            )}

            <button type="submit" className="btn-3d w-full" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Enter"
                : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[#8a7ba8]">
          ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ
        </p>
      </div>
    </div>
  );
}