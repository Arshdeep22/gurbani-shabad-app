"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import TopBar from "../../components/TopBar";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [shabads, setShabads] = useState([]);
  const [progress, setProgress] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      router.push("/");
      return;
    }
    const uid = sessionData.session.user.id;
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (prof?.role !== "admin") {
      router.push("/read");
      return;
    }
    setProfile(prof);

    const [{ data: allUsers }, { data: allShabads }, { data: allProgress }] =
      await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("shabads").select("*").order("order_index"),
        supabase.from("reading_progress").select("*"),
      ]);

    setUsers((allUsers || []).filter((u) => u.role !== "admin"));
    setShabads(allShabads || []);
    setProgress(allProgress || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-card animate-pulse px-8 py-6 text-[#6a5b8a]">
          Loading dashboard…
        </div>
      </div>
    );
  }

  const totalShabads = shabads.length;
  const completedRows = progress.filter((p) => p.completed);
  const totalCompletions = completedRows.length;
  const activeUsers = new Set(progress.map((p) => p.user_id)).size;

  // per-user completed count
  function userCompleted(userId) {
    return progress.filter((p) => p.user_id === userId && p.completed).length;
  }

  // per-shabad completed count
  function shabadCompleted(shabadId) {
    return progress.filter((p) => p.shabad_id === shabadId && p.completed)
      .length;
  }

  const selectedProgress = selectedUser
    ? progress.filter((p) => p.user_id === selectedUser.id)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <TopBar
        title="Admin Dashboard"
        name={profile?.full_name}
        right={
          <button
            className="btn-ghost text-sm"
            onClick={() => router.push("/admin/shabads")}
          >
            ✦ Manage Shabads
          </button>
        }
      />

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Shabads" value={totalShabads} emoji="📖" />
        <StatCard label="Readers" value={users.length} emoji="🧑‍🤝‍🧑" />
        <StatCard label="Active Readers" value={activeUsers} emoji="🔥" />
        <StatCard
          label="Total Completions"
          value={totalCompletions}
          emoji="✅"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Users progress */}
        <div className="glass-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-[#5b4c7d]">
            Reader Progress
          </h3>
          <div className="space-y-3">
            {users.length === 0 && (
              <p className="text-sm text-[#8a7ba8]">No readers yet.</p>
            )}
            {users.map((u) => {
              const done = userCompleted(u.id);
              const pct = totalShabads
                ? Math.round((done / totalShabads) * 100)
                : 0;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full rounded-2xl p-3 text-left transition-all ${
                    selectedUser?.id === u.id
                      ? "bg-white/80 shadow-soft"
                      : "bg-white/40 hover:bg-white/60"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#5b4c7d]">
                      {u.full_name || u.email}
                    </span>
                    <span className="text-xs font-medium text-[#8a7ba8]">
                      {done}/{totalShabads}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pastel-purple to-pastel-teal"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shabad-wise stats */}
        <div className="glass-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-[#5b4c7d]">
            Shabad Completion
          </h3>
          <div className="space-y-3">
            {shabads.length === 0 && (
              <p className="text-sm text-[#8a7ba8]">No shabads added yet.</p>
            )}
            {shabads.map((s) => {
              const done = shabadCompleted(s.id);
              const pct = users.length
                ? Math.round((done / users.length) * 100)
                : 0;
              return (
                <div key={s.id} className="rounded-2xl bg-white/40 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="gurmukhi truncate pr-2 text-sm font-semibold text-[#5b4c7d]">
                      {s.title}
                    </span>
                    <span className="whitespace-nowrap text-xs font-medium text-[#8a7ba8]">
                      {done}/{users.length}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pastel-rose to-pastel-purple"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected user detail */}
      {selectedUser && (
        <div className="glass-card mt-6 animate-fadeInUp p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#5b4c7d]">
              {selectedUser.full_name || selectedUser.email} — Details
            </h3>
            <button
              className="btn-ghost text-sm"
              onClick={() => setSelectedUser(null)}
            >
              Close
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#8a7ba8]">
                  <th className="px-3 py-2">Shabad</th>
                  <th className="px-3 py-2">Reads</th>
                  <th className="px-3 py-2">Understanding</th>
                  <th className="px-3 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {shabads.map((s) => {
                  const p = selectedProgress.find(
                    (x) => x.shabad_id === s.id
                  );
                  return (
                    <tr
                      key={s.id}
                      className="rounded-xl border-b border-white/40"
                    >
                      <td className="gurmukhi px-3 py-3 font-medium text-[#5b4c7d]">
                        {s.title}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                                p?.[`read_${n}`]
                                  ? "bg-emerald-200 text-emerald-700"
                                  : "bg-white/60 text-[#b3a8c8]"
                              }`}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-xs px-3 py-3 text-[#6a5b8a]">
                        {p?.understanding ? (
                          <span className="gurmukhi line-clamp-2">
                            {p.understanding}
                          </span>
                        ) : (
                          <span className="text-[#b3a8c8]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#8a7ba8]">
                        {p?.submitted_at
                          ? new Date(p.submitted_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, emoji }) {
  return (
    <div className="glass-card flex items-center gap-3 p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pastel-purple/40 to-pastel-teal/40 text-2xl">
        {emoji}
      </div>
      <div>
        <p className="text-2xl font-bold text-[#5b4c7d]">{value}</p>
        <p className="text-xs text-[#8a7ba8]">{label}</p>
      </div>
    </div>
  );
}