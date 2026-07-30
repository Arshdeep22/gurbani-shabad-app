"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function TopBar({ title, name, right }) {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="sticky top-0 z-20 mb-6 flex items-center justify-between gap-3 rounded-3xl bg-white/50 px-4 py-3 shadow-soft backdrop-blur-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pastel-purple to-pastel-teal text-white shadow-soft">
          <span className="gurmukhi text-xl">ੴ</span>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[#5b4c7d]">{title}</p>
          {name && <p className="text-xs text-[#8a7ba8]">{name}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {right}
        <button onClick={logout} className="btn-ghost text-sm">
          Logout
        </button>
      </div>
    </div>
  );
}