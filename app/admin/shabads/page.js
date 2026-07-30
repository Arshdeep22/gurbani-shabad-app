"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import TopBar from "../../../components/TopBar";

const emptyLine = { gurmukhi: "", meaning: "" };

export default function ManageShabads() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [shabads, setShabads] = useState([]);

  // form state
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(2);
  const [orderIndex, setOrderIndex] = useState(0);
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

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
    await refreshShabads();
    setLoading(false);
  }, [router]);

  async function refreshShabads() {
    const { data } = await supabase
      .from("shabads")
      .select("*")
      .order("order_index");
    setShabads(data || []);
  }

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDeadlineDays(2);
    setOrderIndex(shabads.length);
    setLines([{ ...emptyLine }]);
    setBulkText("");
    setMsg(null);
  }

  function startEdit(s) {
    setEditingId(s.id);
    setTitle(s.title);
    setDeadlineDays(s.deadline_days);
    setOrderIndex(s.order_index);
    setLines(s.lines?.length ? s.lines : [{ ...emptyLine }]);
    setBulkText("");
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateLine(i, key, val) {
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [key]: val } : l))
    );
  }
  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Parse bulk paste: alternating gurmukhi line then meaning line, separated by blank lines.
  // Format expected: gurmukhi line, then meaning line(s). Pairs split on blank lines.
  function parseBulk() {
    const blocks = bulkText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    // pair them: [gurmukhi, meaning, gurmukhi, meaning, ...]
    const parsed = [];
    for (let i = 0; i < blocks.length; i += 2) {
      parsed.push({
        gurmukhi: blocks[i] || "",
        meaning: blocks[i + 1] || "",
      });
    }
    if (parsed.length) {
      setLines(parsed);
      setMsg(`Parsed ${parsed.length} line pair(s) from bulk text.`);
    }
  }

  async function saveShabad() {
    if (!title.trim()) {
      setMsg("Please enter a title.");
      return;
    }
    const cleanLines = lines.filter(
      (l) => l.gurmukhi.trim() || l.meaning.trim()
    );
    setSaving(true);
    setMsg(null);
    const payload = {
      title: title.trim(),
      deadline_days: Number(deadlineDays) || 2,
      order_index: Number(orderIndex) || 0,
      lines: cleanLines,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("shabads")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase.from("shabads").insert(payload));
    }
    setSaving(false);
    if (error) {
      setMsg("Error: " + error.message);
      return;
    }
    setMsg(editingId ? "Shabad updated!" : "Shabad added!");
    await refreshShabads();
    resetForm();
  }

  async function deleteShabad(id) {
    if (!confirm("Delete this shabad? This cannot be undone.")) return;
    const { error } = await supabase.from("shabads").delete().eq("id", id);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    await refreshShabads();
    if (editingId === id) resetForm();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-card animate-pulse px-8 py-6 text-[#6a5b8a]">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <TopBar
        title="Manage Shabads"
        name={profile?.full_name}
        right={
          <button
            className="btn-ghost text-sm"
            onClick={() => router.push("/admin")}
          >
            ← Dashboard
          </button>
        }
      />

      {/* Editor */}
      <div className="glass-card mb-8 p-6">
        <h3 className="mb-4 text-lg font-semibold text-[#5b4c7d]">
          {editingId ? "Edit Shabad" : "Add New Shabad"}
        </h3>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
              Title (Raag / heading)
            </label>
            <input
              className="input-soft gurmukhi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ਵਡਹੰਸੁ ਮਹਲਾ ੪॥"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
              Deadline (days)
            </label>
            <input
              type="number"
              min={1}
              className="input-soft"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
              Order Index
            </label>
            <input
              type="number"
              className="input-soft"
              value={orderIndex}
              onChange={(e) => setOrderIndex(e.target.value)}
            />
          </div>
        </div>

        {/* Bulk paste helper */}
        <div className="mt-4 rounded-2xl bg-white/40 p-4">
          <label className="mb-1.5 block text-sm font-medium text-[#6a5b8a]">
            Quick paste (optional): paste alternating Gurmukhi & meaning blocks
            separated by blank lines, then click Parse.
          </label>
          <textarea
            className="input-soft min-h-[100px] resize-y gurmukhi"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"ਗੁਰਮੁਖੀ ਲਾਈਨ\n\nMeaning line\n\nnext gurmukhi\n\nnext meaning"}
          />
          <button className="btn-ghost mt-2 text-sm" onClick={parseBulk}>
            Parse into lines
          </button>
        </div>

        {/* Line editor */}
        <div className="mt-5 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#8a7ba8]">
            Lines
          </p>
          {lines.map((line, i) => (
            <div key={i} className="rounded-2xl bg-white/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[#8a7ba8]">
                  Line {i + 1}
                </span>
                {lines.length > 1 && (
                  <button
                    className="text-xs text-rose-500 hover:underline"
                    onClick={() => removeLine(i)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                className="input-soft gurmukhi mb-2"
                placeholder="Gurmukhi line"
                value={line.gurmukhi}
                onChange={(e) => updateLine(i, "gurmukhi", e.target.value)}
              />
              <textarea
                className="input-soft gurmukhi min-h-[70px] resize-y"
                placeholder="Meaning (Punjabi / English)"
                value={line.meaning}
                onChange={(e) => updateLine(i, "meaning", e.target.value)}
              />
            </div>
          ))}
          <button className="btn-ghost text-sm" onClick={addLine}>
            + Add line
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-white/60 px-4 py-2.5 text-sm text-[#5b4c7d]">
            {msg}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button className="btn-3d" onClick={saveShabad} disabled={saving}>
            {saving ? "Saving…" : editingId ? "Update Shabad" : "Add Shabad"}
          </button>
          {editingId && (
            <button className="btn-ghost" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Existing shabads */}
      <div className="glass-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-[#5b4c7d]">
          Existing Shabads ({shabads.length})
        </h3>
        <div className="space-y-3">
          {shabads.length === 0 && (
            <p className="text-sm text-[#8a7ba8]">No shabads yet.</p>
          )}
          {shabads.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/40 p-4"
            >
              <div className="min-w-0">
                <p className="gurmukhi truncate font-semibold text-[#5b4c7d]">
                  #{s.order_index} — {s.title}
                </p>
                <p className="text-xs text-[#8a7ba8]">
                  {s.lines?.length || 0} lines · {s.deadline_days} day deadline
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="btn-ghost text-sm"
                  onClick={() => startEdit(s)}
                >
                  Edit
                </button>
                <button
                  className="rounded-2xl bg-rose-100/70 px-4 py-2 text-sm font-medium text-rose-600 transition-all hover:bg-rose-200/70"
                  onClick={() => deleteShabad(s.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
