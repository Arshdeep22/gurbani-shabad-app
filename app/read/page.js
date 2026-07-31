"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import TopBar from "../../components/TopBar";
import CountdownTimer from "../../components/CountdownTimer";

const ADMIN_NAME = "ਅਮਨਦੀਪ ਕੌਰ";
const EXTENSION_HOURS = 5;
const HOUR_MS = 60 * 60 * 1000;

export default function ReadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [shabads, setShabads] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [firstIncompleteIndex, setFirstIncompleteIndex] = useState(0);
  const [understanding, setUnderstanding] = useState("");
  const [saving, setSaving] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [showUnderstanding, setShowUnderstanding] = useState(false);

  // Tick every second so we react to deadline expiry live
  const [nowTs, setNowTs] = useState(Date.now());

  // Popup state (one of: null | "extend" | "skipped")
  const [popup, setPopup] = useState(null);
  const [extending, setExtending] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Track which shabads we've already shown the "time's up" popup for in this
  // session (so it doesn't reappear every second).
  const seenExpiryRef = useRef(new Set());
  const seenSkippedRef = useRef(new Set());

  const progressRef = useRef({});
  const profileRef = useRef(null);
  const ensuringRef = useRef({});

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

    if (prof?.must_change_password) {
      router.push("/change-password");
      return;
    }

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
    let firstInc = 0;
    if (sh && sh.length) {
      // First shabad that is neither completed nor skipped is the "current" one.
      const firstOpen = sh.findIndex(
        (s) => !map[s.id]?.completed && !map[s.id]?.skipped
      );
      if (firstOpen === -1) {
        setAllDone(true);
        idx = sh.length - 1;
        firstInc = sh.length;
      } else {
        idx = firstOpen;
        firstInc = firstOpen;
      }
    }
    setFirstIncompleteIndex(firstInc);
    setCurrentIndex(idx);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  // Live ticking clock
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const current = shabads[currentIndex];
  const currentProgress = current ? progressMap[current.id] : null;

  // A shabad is "read-only" if it is already completed OR was skipped (deadline lapsed).
  const isCompleted = !!currentProgress?.completed;
  const isSkipped = !!currentProgress?.skipped;
  const isReadOnly = isCompleted || isSkipped;

  // Compute the effective deadline: extended_until if set, else started_at + deadline_days.
  function computeDeadline(prog, shabad) {
    if (!prog?.started_at || !shabad) return null;
    if (prog.extended_until) return new Date(prog.extended_until);
    return new Date(
      new Date(prog.started_at).getTime() +
        (shabad.deadline_days || 2) * 24 * HOUR_MS
    );
  }

  const currentDeadline = computeDeadline(currentProgress, current);
  const timeExpired =
    !!currentDeadline && nowTs >= currentDeadline.getTime();

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
    // Only create a fresh progress row for the current shabad the user is
    // actively working on (not for review browsing).
    if (
      !loading &&
      current &&
      !progressRef.current[current.id] &&
      currentIndex >= firstIncompleteIndex
    ) {
      ensureProgress();
    }
    const p = current ? progressRef.current[current.id] : null;
    setUnderstanding(p?.understanding || "");
    setShowUnderstanding(!!p?.completed || !!p?.skipped);
    setPopup(null); // clear any lingering popup when switching shabads
    if (!loading) window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, loading]);

  // Watch for deadline expiry on the current shabad and surface the popup.
  useEffect(() => {
    if (!current || !currentProgress || isReadOnly) return;
    if (!currentDeadline) return;
    if (!timeExpired) return;

    // Extension not yet used → show "extend" popup once per session
    if (!currentProgress.extension_used) {
      if (!seenExpiryRef.current.has(current.id)) {
        seenExpiryRef.current.add(current.id);
        setPopup("extend");
      }
      return;
    }

    // Extension already used AND still not completed → auto-skip the shabad
    // and show the "reported" popup.
    if (currentProgress.extension_used && !currentProgress.skipped) {
      if (!seenSkippedRef.current.has(current.id)) {
        seenSkippedRef.current.add(current.id);
        (async () => {
          setSkipping(true);
          const { data } = await supabase
            .from("reading_progress")
            .update({
              skipped: true,
              skipped_at: new Date().toISOString(),
            })
            .eq("id", currentProgress.id)
            .select()
            .single();
          setSkipping(false);
          if (data) setProgress(current.id, data);
          setPopup("skipped");
        })();
      }
    }
  }, [timeExpired, current, currentProgress, currentDeadline, isReadOnly]);

  async function toggleRead(which) {
    if (!current || isReadOnly || timeExpired) return;
    const prog = (await ensureProgress()) || progressRef.current[current.id];
    if (!prog) return;

    const field = `read_${which}`;
    const atField = `read_${which}_at`;
    const newVal = !prog[field];

    if (newVal) {
      if (which === 2 && !prog.read_1) return;
      if (which === 3 && !prog.read_2) return;
    } else {
      if (which === 1 && prog.read_2) return;
      if (which === 2 && prog.read_3) return;
    }

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

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  function goNext() {
    const maxIndex = shabads.length - 1;
    const target = Math.min(currentIndex + 1, firstIncompleteIndex, maxIndex);
    if (target > currentIndex) setCurrentIndex(target);
  }

  async function handleExtend() {
    if (!current || !currentProgress) return;
    setExtending(true);
    const extendedUntil = new Date(Date.now() + EXTENSION_HOURS * HOUR_MS);
    const { data } = await supabase
      .from("reading_progress")
      .update({
        extension_used: true,
        extended_until: extendedUntil.toISOString(),
      })
      .eq("id", currentProgress.id)
      .select()
      .single();
    setExtending(false);
    if (data) {
      setProgress(current.id, data);
      // Let the timer effect see the new deadline
      seenExpiryRef.current.delete(current.id);
    }
    setPopup(null);
  }

  async function handleSubmitUnderstanding() {
    if (!understanding.trim() || !current || isReadOnly) return;
    if (timeExpired) return; // safety — shouldn't happen because inputs disable
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
      advanceToNextIncomplete();
    }
  }

  function advanceToNextIncomplete() {
    // Recompute first-incomplete index from fresh progressRef
    const newFirstIncomplete = shabads.findIndex(
      (s) =>
        !progressRef.current[s.id]?.completed &&
        !progressRef.current[s.id]?.skipped
    );
    const nextFirstInc =
      newFirstIncomplete === -1 ? shabads.length : newFirstIncomplete;
    setFirstIncompleteIndex(nextFirstInc);

    if (currentIndex < shabads.length - 1) {
      setCurrentIndex((i) => i + 1);
      setUnderstanding("");
      setShowUnderstanding(false);
    } else {
      setAllDone(true);
    }
  }

  function closeSkippedPopup() {
    setPopup(null);
    // After acknowledging the "reported" popup, we don't auto-advance —
    // the user will click the "ਅੱਗੇ →" button which is now unlocked.
    // We recompute firstIncompleteIndex so the Next button becomes enabled.
    const newFirstIncomplete = shabads.findIndex(
      (s) =>
        !progressRef.current[s.id]?.completed &&
        !progressRef.current[s.id]?.skipped
    );
    const nextFirstInc =
      newFirstIncomplete === -1 ? shabads.length : newFirstIncomplete;
    setFirstIncompleteIndex(nextFirstInc);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-card animate-pulse px-8 py-6 text-[#6a5b8a]">
          ਤੁਹਾਡੇ ਲਈ ਸ਼ਬਦ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…
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

  const completedCount = shabads.filter(
    (s) => progressMap[s.id]?.completed
  ).length;
  const skippedCount = shabads.filter(
    (s) => progressMap[s.id]?.skipped
  ).length;

  const canGoPrev = currentIndex > 0;
  const canGoNext =
    currentIndex < shabads.length - 1 &&
    currentIndex < firstIncompleteIndex;

  // Timer is only shown for the shabad currently being worked on (not review
  // and not skipped ones).
  const timerDeadline =
    !isReadOnly && currentDeadline ? currentDeadline : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <TopBar
        title="ਗੁਰਬਾਣੀ ਵਿਚਾਰ"
        name={profile?.full_name}
        right={timerDeadline ? <CountdownTimer deadline={timerDeadline} /> : null}
      />

      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#6a5b8a]">
          <span>
            ਸ਼ਬਦ {currentIndex + 1} / {shabads.length}
          </span>
          <span>
            {completedCount} ਪੂਰੇ
            {skippedCount > 0 ? ` • ${skippedCount} ਛੱਡੇ` : ""}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pastel-purple to-pastel-teal transition-all duration-500"
            style={{
              width: `${
                ((completedCount + skippedCount) / shabads.length) * 100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Prev / Next nav */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className="btn-ghost text-sm disabled:opacity-40"
        >
          ← ਪਿੱਛੇ
        </button>
        {isCompleted && (
          <span className="rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-medium text-emerald-700">
            ਇਹ ਸ਼ਬਦ ਪੂਰਾ ਹੋ ਚੁੱਕਾ ਹੈ (ਸਿਰਫ਼ ਵੇਖਣ ਲਈ)
          </span>
        )}
        {isSkipped && (
          <span className="rounded-full bg-rose-100/70 px-3 py-1 text-xs font-medium text-rose-700">
            ਇਹ ਸ਼ਬਦ ਸਮੇਂ ਵਿੱਚ ਪੂਰਾ ਨਹੀਂ ਹੋਇਆ
          </span>
        )}
        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="btn-ghost text-sm disabled:opacity-40"
        >
          ਅੱਗੇ →
        </button>
      </div>

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
                <p className="gurmukhi mb-2 break-all text-lg font-semibold text-[#3f3560]">
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
              const disabled = isReadOnly || timeExpired || locked;
              return (
                <label
                  key={n}
                  className={`checkbox-card ${checked ? "checked" : ""} ${
                    disabled ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#b39ddb]"
                    checked={!!checked}
                    disabled={disabled}
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

          {!showUnderstanding && !isReadOnly && !timeExpired && (
            <button
              onClick={handleNext}
              disabled={!allThreeChecked}
              className="btn-3d mt-6 w-full"
            >
              ਅੱਗੇ →
            </button>
          )}
        </div>

        {/* Understanding input / display */}
        {showUnderstanding && (
          <div className="glass-card animate-fadeInUp p-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#8a7ba8]">
              ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ
            </h3>
            <p className="mb-4 text-sm text-[#6a5b8a]">
              {isSkipped
                ? "ਇਸ ਸ਼ਬਦ ਦਾ ਸਮਾਂ ਖ਼ਤਮ ਹੋ ਗਿਆ ਸੀ, ਇਸ ਲਈ ਇਹ ਛੱਡਿਆ ਗਿਆ।"
                : isCompleted
                ? "ਤੁਸੀਂ ਇਸ ਸ਼ਬਦ ਬਾਰੇ ਪਹਿਲਾਂ ਇਹ ਸਾਂਝਾ ਕੀਤਾ ਸੀ:"
                : "ਇਸ ਸ਼ਬਦ ਤੋਂ ਤੁਸੀਂ ਕੀ ਸਮਝਿਆ, ਸਾਂਝਾ ਕਰੋ। ਇਹ ਸਮੀਖਿਆ ਲਈ ਸੰਭਾਲਿਆ ਜਾਵੇਗਾ।"}
            </p>
            {!isSkipped && (
              <textarea
                className="input-soft min-h-[140px] resize-y disabled:opacity-80"
                placeholder="ਆਪਣੀ ਸਮਝ ਇੱਥੇ ਲਿਖੋ…"
                value={understanding}
                onChange={(e) => setUnderstanding(e.target.value)}
                readOnly={isReadOnly || timeExpired}
                disabled={isReadOnly || timeExpired}
              />
            )}
            {!isReadOnly && !timeExpired && (
              <button
                onClick={handleSubmitUnderstanding}
                disabled={saving || !understanding.trim()}
                className="btn-3d mt-4 w-full"
              >
                {saving ? "ਸੰਭਾਲ ਰਹੇ…" : "ਭੇਜੋ ਤੇ ਅੱਗੇ ਵਧੋ →"}
              </button>
            )}
            {isCompleted && currentProgress?.submitted_at && (
              <p className="mt-3 text-xs text-[#8a7ba8]">
                ਭੇਜਿਆ: {new Date(currentProgress.submitted_at).toLocaleString()}
              </p>
            )}
            {isSkipped && currentProgress?.skipped_at && (
              <p className="mt-3 text-xs text-rose-600">
                ਛੱਡਿਆ ਗਿਆ: {new Date(currentProgress.skipped_at).toLocaleString()} — {ADMIN_NAME} ਜੀ ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।
              </p>
            )}
          </div>
        )}
      </div>

      {allDone && completedCount + skippedCount === shabads.length && (
        <div className="glass-card mt-6 animate-fadeInUp p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 animate-floaty items-center justify-center rounded-3xl bg-gradient-to-br from-pastel-rose to-pastel-purple text-2xl">
            🎉
          </div>
          <p className="font-semibold text-[#5b4c7d]">
            ਤੁਸੀਂ ਸਾਰੇ ਸ਼ਬਦ ਵੇਖ ਲਏ ਹਨ! ਤੁਸੀਂ &quot;ਪਿੱਛੇ&quot; ਬਟਨ ਨਾਲ ਕੋਈ ਵੀ ਸ਼ਬਦ ਦੁਬਾਰਾ ਵੇਖ ਸਕਦੇ ਹੋ।
          </p>
        </div>
      )}

      {/* ================= POPUPS ================= */}
      {popup === "extend" && (
        <Modal>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-100 text-3xl">
            ⏰
          </div>
          <h3 className="mb-3 text-center text-lg font-bold text-[#5b4c7d]">
            ਤੁਹਾਡਾ ਸਮਾਂ ਖ਼ਤਮ ਹੋ ਗਿਆ ਹੈ
          </h3>
          <p className="mb-6 text-center text-sm leading-relaxed text-[#6a5b8a]">
            ਹੁਣ ਇਹ ਸਿਰਫ਼ <span className="font-semibold text-[#5b4c7d]">{EXTENSION_HOURS} ਘੰਟੇ</span> ਹੋਰ ਵਧਾਇਆ ਜਾਵੇਗਾ। ਜੇਕਰ ਤੁਸੀਂ ਫਿਰ ਵੀ ਪੜ੍ਹ ਤੇ ਸਮਝ ਨਾ ਸਕੇ ਤਾਂ{" "}
            <span className="font-semibold text-[#5b4c7d]">{ADMIN_NAME} ਜੀ</span> ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਜਾਵੇਗਾ।
          </p>
          <button
            onClick={handleExtend}
            disabled={extending}
            className="btn-3d w-full"
          >
            {extending ? "ਵਧਾ ਰਹੇ…" : `${EXTENSION_HOURS} ਘੰਟੇ ਵਧਾਓ`}
          </button>
        </Modal>
      )}

      {popup === "skipped" && (
        <Modal>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-100 text-3xl">
            📨
          </div>
          <h3 className="mb-3 text-center text-lg font-bold text-[#5b4c7d]">
            ਸਮਾਂ ਪੂਰਾ ਹੋ ਗਿਆ
          </h3>
          <p className="mb-6 text-center text-sm leading-relaxed text-[#6a5b8a]">
            ਤੁਹਾਡੀ ਰਿਪੋਰਟ{" "}
            <span className="font-semibold text-[#5b4c7d]">{ADMIN_NAME} ਜੀ</span> ਨੂੰ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ। ਇਹ ਸ਼ਬਦ ਹੁਣ ਬੰਦ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਤੁਸੀਂ &quot;ਅੱਗੇ&quot; ਬਟਨ ਨਾਲ ਅਗਲੇ ਸ਼ਬਦ ਤੇ ਜਾ ਸਕਦੇ ਹੋ।
          </p>
          <button onClick={closeSkippedPopup} className="btn-3d w-full">
            ਬੰਦ ਕਰੋ
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-fadeInUp">
      <div className="glass-card w-full max-w-sm p-6 shadow-soft-lg">
        {children}
      </div>
    </div>
  );
}
