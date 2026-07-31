"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import TopBar from "../../components/TopBar";

const DEFAULT_PASSWORD = "131313";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [shabads, setShabads] = useState([]);
  const [progress, setProgress] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Add-user form state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addErr, setAddErr] = useState(null);
  const [addMsg, setAddMsg] = useState(null);

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

    if (prof?.must_change_password) {
      router.push("/change-password");
      return;
    }

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

    const nonAdminUsers = (allUsers || []).filter((u) => u.role !== "admin");
    const nonAdminIds = new Set(nonAdminUsers.map((u) => u.id));
    setUsers(nonAdminUsers);
    setShabads(allShabads || []);
    setProgress((allProgress || []).filter((p) => nonAdminIds.has(p.user_id)));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddUser(e) {
    e.preventDefault();
    setAddErr(null);
    setAddMsg(null);

    const uname = newUsername.trim();
    if (!uname) {
      setAddErr("ਯੂਜ਼ਰਨੇਮ ਜ਼ਰੂਰੀ ਹੈ।");
      return;
    }

    setAddLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: newFullName.trim(),
          username: uname,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ਯੂਜ਼ਰ ਬਣਾਉਣ ਵਿੱਚ ਗੜਬੜ");
      setAddMsg(
        `ਯੂਜ਼ਰ "${uname}" ਬਣ ਗਿਆ। ਡਿਫਾਲਟ ਪਾਸਵਰਡ: ${DEFAULT_PASSWORD}`
      );
      setNewFullName("");
      setNewUsername("");
      await load();
    } catch (e) {
      setAddErr(e.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteUser(user) {
    const ok = window.confirm(
      `ਕੀ ਤੁਸੀਂ ਯਕੀਨ ਨਾਲ "${user.full_name || user.username}" ਨੂੰ ਹਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ? ਇਹ ਵਾਪਸ ਨਹੀਂ ਹੋ ਸਕਦਾ।`
    );
    if (!ok) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ਹਟਾਉਣ ਵਿੱਚ ਗੜਬੜ");
      if (selectedUser?.id === user.id) setSelectedUser(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-card animate-pulse px-8 py-6 text-[#6a5b8a]">
          ਡੈਸ਼ਬੋਰਡ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…
        </div>
      </div>
    );
  }

  const totalShabads = shabads.length;
  const completedRows = progress.filter((p) => p.completed);
  const totalCompletions = completedRows.length;
  const activeUsers = new Set(progress.map((p) => p.user_id)).size;

  function userCompleted(userId) {
    return progress.filter((p) => p.user_id === userId && p.completed).length;
  }

  function shabadCompleted(shabadId) {
    return progress.filter((p) => p.shabad_id === shabadId && p.completed)
      .length;
  }

  const selectedProgress = selectedUser
    ? progress.filter((p) => p.user_id === selectedUser.id)
    : [];

  function exportToExcel() {
    const rows = [
      ["ਪਾਠਕ", "ਸ਼ਬਦ", "ਪੜ੍ਹਾਈ 1", "ਪੜ੍ਹਾਈ 2", "ਪੜ੍ਹਾਈ 3", "ਸਮਝ", "ਪੂਰਾ ਹੋਇਆ", "ਭੇਜਿਆ"],
    ];
    for (const u of users) {
      for (const s of shabads) {
        const p = progress.find(
          (x) => x.user_id === u.id && x.shabad_id === s.id
        );
        rows.push([
          u.full_name || u.username,
          s.title,
          p?.read_1 ? "✓" : "",
          p?.read_2 ? "✓" : "",
          p?.read_3 ? "✓" : "",
          p?.understanding || "",
          p?.completed ? "✓" : "",
          p?.submitted_at ? new Date(p.submitted_at).toLocaleString() : "",
        ]);
      }
    }
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gurbani-progress-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <TopBar
        title="ਐਡਮਿਨ ਡੈਸ਼ਬੋਰਡ"
        name={profile?.full_name}
        right={
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-ghost text-sm"
              onClick={() => setShowAddUser((s) => !s)}
            >
              + ਪਾਠਕ ਸ਼ਾਮਲ ਕਰੋ
            </button>
            <button className="btn-ghost text-sm" onClick={exportToExcel}>
              ↓ Excel ਨਿਰਯਾਤ
            </button>
            <button
              className="btn-ghost text-sm"
              onClick={() => router.push("/admin/shabads")}
            >
              ✦ ਸ਼ਬਦ ਪ੍ਰਬੰਧਨ
            </button>
          </div>
        }
      />

      {/* Add user panel */}
      {showAddUser && (
        <div className="glass-card mb-6 animate-fadeInUp p-6">
          <h3 className="mb-1 text-lg font-semibold text-[#5b4c7d]">
            ਨਵਾਂ ਪਾਠਕ ਸ਼ਾਮਲ ਕਰੋ
          </h3>
          <p className="mb-4 text-sm text-[#8a7ba8]">
            ਸਾਰੇ ਨਵੇਂ ਪਾਠਕਾਂ ਦਾ ਡਿਫਾਲਟ ਪਾਸਵਰਡ{" "}
            <span className="font-semibold text-[#5b4c7d]">
              {DEFAULT_PASSWORD}
            </span>{" "}
            ਹੋਵੇਗਾ। ਪਹਿਲੀ ਵਾਰ ਲੌਗ-ਇਨ ਕਰਨ ਤੇ ਪਾਠਕ ਨੂੰ ਪਾਸਵਰਡ ਬਦਲਣਾ ਪਵੇਗਾ।
          </p>
          <form onSubmit={handleAddUser} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                ਪੂਰਾ ਨਾਮ
              </label>
              <input
                className="input-soft"
                type="text"
                placeholder="ਜਿਵੇਂ ਅਮਨਦੀਪ ਕੌਰ ਜੀ"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
                ਯੂਜ਼ਰਨੇਮ
              </label>
              <input
                className="input-soft"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="ਜਿਵੇਂ amandeep_kaur"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
            </div>

            {addErr && (
              <div className="rounded-xl bg-rose-100/70 px-4 py-2.5 text-sm text-rose-600 md:col-span-2">
                {addErr}
              </div>
            )}
            {addMsg && (
              <div className="rounded-xl bg-emerald-100/70 px-4 py-2.5 text-sm text-emerald-700 md:col-span-2">
                {addMsg}
              </div>
            )}

            <div className="md:col-span-2">
              <button type="submit" className="btn-3d w-full" disabled={addLoading}>
                {addLoading ? "ਬਣਾ ਰਿਹਾ ਹੈ…" : "ਯੂਜ਼ਰ ਬਣਾਓ"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="ਕੁੱਲ ਸ਼ਬਦ" value={totalShabads} emoji="📖" />
        <StatCard label="ਪਾਠਕ" value={users.length} emoji="🧑‍🤝‍🧑" />
        <StatCard label="ਸਰਗਰਮ ਪਾਠਕ" value={activeUsers} emoji="🔥" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Users progress */}
        <div className="glass-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-[#5b4c7d]">
            ਪਾਠਕ ਦੀ ਤਰੱਕੀ
          </h3>
          <div className="space-y-3">
            {users.length === 0 && (
              <p className="text-sm text-[#8a7ba8]">ਅਜੇ ਕੋਈ ਪਾਠਕ ਨਹੀਂ।</p>
            )}
            {[...users]
              .map((u) => ({ u, done: userCompleted(u.id) }))
              .sort((a, b) => {
                if (b.done !== a.done) return b.done - a.done;
                // Tie-breaker: alphabetical by display name / username
                const an = (a.u.full_name || a.u.username || "").toLowerCase();
                const bn = (b.u.full_name || b.u.username || "").toLowerCase();
                return an.localeCompare(bn);
              })
              .map(({ u, done }) => {
              const pct = totalShabads
                ? Math.round((done / totalShabads) * 100)
                : 0;
              return (
                <div
                  key={u.id}
                  className={`flex items-center gap-2 rounded-2xl p-3 transition-all ${
                    selectedUser?.id === u.id
                      ? "bg-white/80 shadow-soft"
                      : "bg-white/40 hover:bg-white/60"
                  }`}
                >
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="flex-1 text-left"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#5b4c7d]">
                        {u.full_name || u.username}
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
                    {u.must_change_password && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-600">
                        ਪਾਸਵਰਡ ਬਦਲਣਾ ਬਾਕੀ
                      </p>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u)}
                    title="ਹਟਾਓ"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100/70 text-rose-600 transition hover:bg-rose-200/80"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shabad-wise stats */}
        <div className="glass-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-[#5b4c7d]">
            ਸ਼ਬਦ ਪੂਰਤੀ
          </h3>
          <div className="space-y-3">
            {shabads.length === 0 && (
              <p className="text-sm text-[#8a7ba8]">ਅਜੇ ਕੋਈ ਸ਼ਬਦ ਸ਼ਾਮਲ ਨਹੀਂ।</p>
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
              {selectedUser.full_name || selectedUser.username} — ਵੇਰਵਾ
            </h3>
            <button
              className="btn-ghost text-sm"
              onClick={() => setSelectedUser(null)}
            >
              ਬੰਦ ਕਰੋ
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#8a7ba8]">
                  <th className="px-3 py-2">ਸ਼ਬਦ</th>
                  <th className="px-3 py-2">ਪੜ੍ਹਾਈ</th>
                  <th className="px-3 py-2">ਸਮਝ</th>
                  <th className="px-3 py-2">ਭੇਜਿਆ</th>
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
