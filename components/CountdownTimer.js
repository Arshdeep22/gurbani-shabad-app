"use client";

import { useEffect, useState } from "react";

/**
 * Shows time remaining until `deadline` (a Date or ISO string).
 * Renders in top-right style pill.
 */
export default function CountdownTimer({ deadline }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!deadline) return null;

  const end = new Date(deadline).getTime();
  const diff = end - now;
  const expired = diff <= 0;

  const abs = Math.abs(diff);
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((abs / (1000 * 60)) % 60);
  const secs = Math.floor((abs / 1000) % 60);

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-soft backdrop-blur ${
        expired
          ? "bg-rose-100/80 text-rose-600"
          : diff < 1000 * 60 * 60 * 6
          ? "bg-amber-100/80 text-amber-700"
          : "bg-white/70 text-[#5b4c7d]"
      }`}
      title={expired ? "ਸਮਾਂ ਖ਼ਤਮ ਹੋ ਗਿਆ" : "ਪੂਰਾ ਕਰਨ ਲਈ ਬਾਕੀ ਸਮਾਂ"}
    >
      <span className="text-base">⏳</span>
      {expired ? (
        <span>ਸਮਾਂ ਖ਼ਤਮ</span>
      ) : (
        <span className="tabular-nums">
          {days > 0 && `${days}d `}
          {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:
          {String(secs).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}