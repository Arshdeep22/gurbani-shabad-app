"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import TopBar from "../../components/TopBar";
import CountdownTimer from "../../components/CountdownTimer";

export default function ReadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [shabads, setShabads] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [understanding, setUnderstanding] = useState("");
  const [saving, setSaving] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [showUnderstanding, setShowUnderstanding] = useState(false);

  // refs to always read fresh values inside async handlers
  const progressRef = useRef({});
  const profileRef = useRef(null);
  const ensuringRef = useRef({}); // shabadId -> in-flight insert promise

  function setProgress(shabadId, row) {
    progressRef.current = { ...progressRef.current, [shabadId]: row };
    setProgressMap(progressRef.current);
  }

  const loadEverything = useCallback(async () => {
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
    setProfile(prof);
    profileRef.current = prof;

    const { data: sh } = await supabase
      .from("shabads")
      .select("*")
      .order("order_index", { ascending: true });

    const { data: prog } = await supabase
      .from("reading_progress")
      .select("*")
      .eq("user_id", uid);

    const map = {};
    (prog || []).forEach((p) => (map[p.shabad_id] = p));
    progressRef.current = map;
    setProgressMap(map);
    setShabads(sh || []);

    let idx = 0;
    if (sh && sh.length) {
      const firstIncomplete = sh.findIndex((s) => !map[s.id]?.completed);
      if (firstIncomplete === -1) {
        setAllDone(true);
        idx = sh.length - 1;
      } else {
        idx = firstIncomplete;
      }
    }
    setCurrentIndex(idx);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  const current = shabads[currentIndex];
  const currentProgress = current ? progressMap[current.id] : null;

  // Create a progress row for the current shabad if it doesn't exist yet.
  // Uses a per-shabad in-flight promise so concurrent callers await the same
  // insert instead of creating duplicates or bailing out.
  const ensureProgress = useCallback(async () => {
    if (!current || !profileRef.current) return null;
    const existing = progressRef.current[current.id];
    if (existing) return existing;

    const inFlight = ensuringRef.current[current.id];
    if (inFlight) return inFlight;

    const shabadId = current.id;
    const promise = (async () => {
      const { data } = await supabase
        .from("reading_progress")
        .insert({
          user_id: profileRef.current.id,
          shabad_id: shabadId,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (data) setProgress(shabadId, data);
      delete ensuringRef.current[shabadId];
      return data || null;
    })();

    ensuringRef.current[shabadId] = promise;
    return promise;
  }, [current]);

  useEffect(() => {
    if (!loading && current && !progressRef.current[current.id]) {
      ensureProgress();
    }
    const p = current ? progressRef.current[current.id] : null;
    setUnderstanding(p?.understanding || "");
    setShowUnderstanding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, loading]);

  async function toggleRead(which) {
    if (!current) return;
    const prog = (await ensureProgress()) || progressRef.current[current.id];
    if (!prog) return;

    const field = `read_${which}`;
    const atField = `read_${which}_at`;
    const newVal = !prog[field];

    // enforce sequential order
    if (newVal) {
      if (which === 2 && !prog.read_1) return;
      if (which === 3 && !prog.read_2) return;
    } else {
      if (which === 1 && prog.read_2) return;
      if (which === 2 && prog.read_3) return;
    }

    // optimistic update
    const optimistic = {
      ...prog,
      [field]: newVal,
      [atField]: newVal ? new Date().toISOString() : null,
    };
    setProgress(current.id, optimistic);

    const { data } = await supabase
      .from("reading_progress")
      .update({
        [field]: newVal,
        [atField]: optimistic[atField],
      })
      .eq("id", prog.id)
      .select()
      .single();
    if (data) setProgress(current.id, data);
  }

  const allThreeChecked =
    currentProgress?.read_1 &&
    currentProgress?.read_2 &&
    currentProgress?.read_3;

  function handleNext() {
    setShowUnderstanding(true);
  }

  async function handleSubmitUnderstanding() {
    if (!understanding.trim() || !current) return;
    const prog = progressRef.current[current.id];
    if (!prog) return;
    setSaving(true);
    const { data } = await supabase
      .from("reading_progress")
      .update({
        understanding: understanding.trim(),
        submitted_at: new Date().toISOString(),
        completed: true,
      })
      .eq("id", prog.id)
      .select()
      .single();
    setSaving(false);
    if (data) {
      setProgress(current.id, data);
      if (currentIndex < shabads.length - 1) {
        setCurrentIndex((i) => i + 1);
        setUnderstanding("");
        setShowUnderstanding(false);
      } else {
        setAllDone(true);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-card animate-pulse px-8 py-6 text-[#6a5b8a]">
          ਤੁਹਾਡੀ ਯਾਤਰਾ ਲੋਡ ਹੋ ਰਹੀ ਹੈ…
        </div>
      </div>
    );
  }

  if (!shabads.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <TopBar title="ਗੁਰਬਾਣੀ ਵਿਚਾਰ" name={profile?.full_name} />
        <div className="glass-card p-10 text-center">
          <p className="text-lg text-[#5b4c7d]">
            ਅਜੇ ਕੋਈ ਸ਼ਬਦ ਸ਼ਾਮਲ ਨਹੀਂ ਕੀਤਾ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਵੇਖੋ। 🌸
          </p>
        </div>
      </div>
    );
  }

  const deadline = currentProgress?.started_at
    ? new Date(
        new Date(currentProgress.started_at).getTime() +
          (current.deadline_days || 2) * 24 * 60 * 60 * 1000
      )
    : null;

  const completedCount = shabads.filter(
    (s) => progressMap[s.id]?.completed
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <TopBar
        title="ਗੁਰਬਾਣੀ ਵਿਚਾਰ"
        name={profile?.full_name}
        right={<CountdownTimer deadline={deadline} />}
      />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#6a5b8a]">
          <span>
            ਸ਼ਬਦ {currentIndex + 1} / {shabads.length}
          </span>
          <span>{completedCount} ਪੂਰੇ ਹੋਏ</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pastel-purple to-pastel-teal transition-all duration-500"
            style={{ width: `${(completedCount / shabads.length) * 100}%` }}
          />
        </div>
      </div>

      {allDone && completedCount === shabads.length ? (
        <div className="glass-card animate-fadeInUp p-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 animate-floaty items-center justify-center rounded-3xl bg-gradient-to-br from-pastel-rose to-pastel-purple text-4xl">
            🎉
          </div>
          <h2 className="text-2xl font-bold text-[#5b4c7d]">
            ਤੁਸੀਂ ਸਾਰੇ ਸ਼ਬਦ ਪੂਰੇ ਕਰ ਲਏ ਹਨ!
          </h2>
          <p className="mt-2 text-[#6a5b8a]">
            ਤੁਹਾਡੀ ਲਗਨ ਲਈ ਧੰਨਵਾਦ। 🙏
          </p>
        </div>
      ) : (
        <div className="animate-fadeInUp">
          {/* Shabad card */}
          <div className="glass-card mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-pastel-purple/30 to-pastel-teal/30 px-6 py-4">
              <h2 className="gurmukhi text-xl font-semibold text-[#4a3d6b]">
                {current.title}
              </h2>
            </div>
            <div className="space-y-5 px-6 py-6">
              {(current.lines || []).map((line, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white/40 p-4 shadow-inner-soft"
                >
                  <p className="gurmukhi mb-2 text-lg font-semibold text-[#3f3560]">
                    {line.gurmukhi}
                  </p>
                  {line.meaning && (
                    <p className="gurmukhi text-[15px] leading-relaxed text-[#6a5b8a]">
                      {line.meaning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reading checks */}
          <div className="glass-card mb-6 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#8a7ba8]">
              ਆਪਣੀ ਪੜ੍ਹਾਈ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ
            </h3>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => {
                const checked = currentProgress?.[`read_${n}`];
                const locked =
                  (n === 2 && !currentProgress?.read_1) ||
                  (n === 3 && !currentProgress?.read_2);
                return (
                  <label
                    key={n}
                    className={`checkbox-card ${checked ? "checked" : ""} ${
                      locked ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#b39ddb]"
                      checked={!!checked}
                      disabled={locked}
                      onChange={() => toggleRead(n)}
                    />
                    <span className="text-sm font-medium text-[#5b4c7d]">
                      ਮੈਂ ਇਸਨੂੰ{" "}
                      {n === 1
                        ? "ਪਹਿਲੀ"
                        : n === 2
                        ? "ਦੂਜੀ"
                        : "ਤੀਜੀ"}{" "}
                      ਵਾਰ ਪੜ੍ਹ ਤੇ ਸਮਝ ਲਿਆ ਹੈ
                    </span>
                  </label>
                );
              })}
            </div>

            {!showUnderstanding && (
              <button
                onClick={handleNext}
                disabled={!allThreeChecked}
                className="btn-3d mt-6 w-full"
              >
                ਅੱਗੇ →
              </button>
            )}
          </div>

          {/* Understanding input */}
          {showUnderstanding && (
            <div className="glass-card animate-fadeInUp p-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#8a7ba8]">
                ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ
              </h3>
              <p className="mb-4 text-sm text-[#6a5b8a]">
                ਇਸ ਸ਼ਬਦ ਤੋਂ ਤੁਸੀਂ ਕੀ ਸਮਝਿਆ, ਸਾਂਝਾ ਕਰੋ। ਇਹ ਸਮੀਖਿਆ ਲਈ ਸੰਭਾਲਿਆ ਜਾਵੇਗਾ।
              </p>
              <textarea
                className="input-soft min-h-[140px] resize-y"
                placeholder="ਆਪਣੀ ਸਮਝ ਇੱਥੇ ਲਿਖੋ…"
                value={understanding}
                onChange={(e) => setUnderstanding(e.target.value)}
              />
              <button
                onClick={handleSubmitUnderstanding}
                disabled={saving || !understanding.trim()}
                className="btn-3d mt-4 w-full"
              >
                {saving ? "ਸੰਭਾਲ ਰਹੇ…" : "ਭੇਜੋ ਤੇ ਅੱਗੇ ਵਧੋ →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
