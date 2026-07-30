#!/usr/bin/env node
/**
 * Parses a plain-text export of the shabads document into a seed JSON / SQL.
 *
 * Expected input format (as in shabads_with_completion_lines):
 *   - A "title" line (e.g. ਵਡਹੰਸੁਮਹਲਾ੪॥) usually the first Gurmukhi line of a block
 *   - Alternating Gurmukhi line, then its meaning line
 *   - Each shabad terminated by:  -----------shabad complete ------------
 *
 * Heuristic:
 *   Within a shabad block, we collect non-empty lines. The FIRST line is the title.
 *   Then remaining lines pair up: gurmukhi, meaning, gurmukhi, meaning...
 *   A line is considered "gurmukhi" if it is mostly Gurmukhi script; meaning
 *   lines contain spaces / punctuation / translation text.
 *
 * Usage:
 *   node scripts/parseShabads.js input.txt > supabase/seed.sql
 *   node scripts/parseShabads.js input.txt --json > shabads.json
 */

const fs = require("fs");

const inputPath = process.argv[2];
const asJson = process.argv.includes("--json");

if (!inputPath) {
  console.error("Usage: node scripts/parseShabads.js <input.txt> [--json]");
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");

// Strip leading "NN | " line-number prefixes if present.
const cleaned = raw
  .split("\n")
  .map((l) => l.replace(/^\s*\d+\s*\|\s?/, ""))
  .join("\n");

const SEPARATOR = /-+\s*shabad complete\s*-+/i;

const blocks = cleaned
  .split(SEPARATOR)
  .map((b) => b.trim())
  .filter(Boolean);

// The original Gurbani verse lines have words joined together (very few/no
// spaces), while the meaning/translation lines are normal prose WITH spaces.
// So we classify: a "verse" line has almost no spaces; otherwise it's meaning.
function isVerseLine(str) {
  const gurmukhiChars = (str.match(/[\u0A00-\u0A7F]/g) || []).length;
  if (gurmukhiChars < 3) return false; // headings like "ਤ੍ਰਿਭੰਗੀ ਛੰਦ:" handled elsewhere
  const spaces = (str.match(/\s/g) || []).length;
  const words = str.trim().split(/\s+/).length;
  // Verse lines are typically a single long joined token (0-2 spaces) or
  // have a very high char-per-word ratio.
  const charsPerWord = str.replace(/\s/g, "").length / words;
  return spaces <= 2 || charsPerWord > 14;
}

const shabads = [];

for (const block of blocks) {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) continue;

  // Title = first line (the raag/heading — a joined verse-style line)
  const title = lines[0];
  const rest = lines.slice(1);

  // Walk through: a verse line starts a new entry; following non-verse
  // (prose) lines become its meaning (concatenated).
  const paired = [];
  for (const line of rest) {
    if (isVerseLine(line)) {
      paired.push({ gurmukhi: line, meaning: "" });
    } else {
      if (paired.length) {
        const last = paired[paired.length - 1];
        last.meaning += (last.meaning ? " " : "") + line;
      } else {
        // meaning before any verse — attach as its own note
        paired.push({ gurmukhi: "", meaning: line });
      }
    }
  }

  shabads.push({ title, lines: paired });
}

if (asJson) {
  console.log(JSON.stringify(shabads, null, 2));
  process.exit(0);
}

// Emit SQL
function esc(s) {
  return String(s).replace(/'/g, "''");
}

let sql = "-- Auto-generated shabad seed\n";
sql += "-- Run in Supabase SQL editor AFTER schema.sql\n\n";
shabads.forEach((s, idx) => {
  const linesJson = esc(JSON.stringify(s.lines));
  sql += `insert into public.shabads (order_index, title, lines, deadline_days) values (${idx}, '${esc(
    s.title
  )}', '${linesJson}'::jsonb, 2);\n`;
});

console.log(sql);
console.error(`Parsed ${shabads.length} shabads.`);