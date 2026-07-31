# 🌸 Gurbani Reflections

A serene, mobile-friendly web app to read Gurbani shabads with their meanings, confirm your reading (3 times), reflect in your own words, and track progress — with a beautiful pastel, glassmorphic, 3D-effect UI.

Built with **Next.js** (React) + **Supabase** (Postgres + Auth) so it can be hosted **100% free** on **Vercel** + **Supabase free tier**.

---

## ✨ Features

### For readers
- Beautiful **login** screen (accounts are created by the admin only).
- First-time login forces the reader to **change their password** from the default `131313`.
- Reads shabads one at a time (Gurmukhi + meanings).
- Three confirmation checkboxes: *read & understood* 1st, 2nd, 3rd time (must be checked in order — each check is saved to the DB instantly).
- After all three checks → **Next** button unlocks → an input box appears asking *what did you understand*.
- On **Submit**, the reflection is saved to the DB against the user, and the **next shabad** is shown.
- **Countdown timer** in the top-right showing time remaining to finish the current shabad (default 2 days, configurable per shabad).
- Progress bar + celebration screen when all shabads are complete.

### For admins
- **Dashboard** with stats: total shabads, readers, active readers, completions.
- **Per-reader progress** bars; click a reader to see exactly which reads they've done, their reflections, and submission times.
- **Per-shabad completion** stats.
- **Manage Shabads** page to **add / edit / delete** shabads, set order & deadline, add lines one-by-one or bulk-paste.

---

## 🧱 Tech Stack

| Layer     | Choice                          | Free hosting            |
|-----------|---------------------------------|-------------------------|
| Frontend  | Next.js 14 (App Router) + Tailwind | Vercel (free)        |
| Backend   | Next.js API + Supabase JS       | Vercel (free)           |
| Database  | Supabase Postgres               | Supabase (free tier)    |
| Auth      | Supabase Auth (email/password)  | Supabase (free tier)    |

---

## 🚀 Setup

### 1. Create a Supabase project (free)
1. Go to <https://supabase.com> → **New project**.
2. Once ready, open **SQL Editor** and run the contents of **`supabase/schema.sql`**.
3. (Optional) Run **`supabase/seed.sql`** to load all 66 shabads from the source document.
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (secret)

### 2. Configure environment variables
Copy `.env.example` → `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
```

### 3. Run locally
```bash
npm install
npm run dev
```
Open <http://localhost:3000>.

### 4. Apply migrations
Run these in the Supabase **SQL Editor** (in order, once):
```sql
-- if you haven't already
\i supabase/migration_username.sql
\i supabase/migration_admin_users.sql
```
(or just copy-paste the contents of each file into the SQL Editor and click **Run**).

### 5. Make yourself an admin
Public sign-up is disabled — accounts are created only by admins. To bootstrap the very first admin:

1. In the Supabase dashboard go to **Authentication → Users → Add user**, create a user with email `admin@gurbani.local` and any password of your choice (this becomes your username `admin`).
2. In **SQL Editor** run:
   ```sql
   update public.profiles
   set role = 'admin', must_change_password = false
   where email = 'admin@gurbani.local';
   ```
3. Log in from the app with username `admin` and the password you set.
4. Use the **+ ਪਾਠਕ ਸ਼ਾਮਲ ਕਰੋ** ("Add reader") button on the admin dashboard to create all other users. Each new user gets the default password **`131313`** and is forced to change it on first login.

---

## 🌐 Deploy free on Vercel
1. Push this repo to GitHub.
2. Go to <https://vercel.com> → **Add New Project** → import the repo.
3. Add the same three env vars in **Vercel → Settings → Environment Variables**.
4. Deploy. Done — you get a free `*.vercel.app` URL.

> In Supabase **Authentication → URL Configuration**, add your Vercel URL to the allowed redirect URLs. To skip email confirmation during testing, disable **"Confirm email"** under **Authentication → Providers → Email**.

---

## 📄 Regenerating shabad seed from the Word doc
The source doc uses the format: each verse line (joined Gurmukhi) followed by its meaning (spaced Punjabi), shabads separated by `-----------shabad complete ------------`.

```bash
# Convert docx → text (macOS)
textutil -convert txt -stdout "shabads_with_completion_lines.docx" > /tmp/shabads_raw.txt

# Generate SQL
node scripts/parseShabads.js /tmp/shabads_raw.txt > supabase/seed.sql

# Or JSON
node scripts/parseShabads.js /tmp/shabads_raw.txt --json > shabads.json
```

---

## 🗂 Project structure
```
app/
  layout.js            # root layout + floating pastel blobs
  globals.css          # pastel theme, glassmorphism, 3D buttons
  page.js              # login / signup
  read/page.js         # main reader flow (checks → reflection → next)
  admin/page.js        # admin dashboard
  admin/shabads/page.js# add / edit / delete shabads
components/
  TopBar.js            # header with logout
  CountdownTimer.js    # top-right countdown
lib/
  supabaseClient.js    # browser client (anon key)
  supabaseAdmin.js     # server client (service role)
supabase/
  schema.sql           # tables, RLS, triggers
  seed.sql             # 66 shabads (auto-generated)
scripts/
  parseShabads.js      # docx-text → seed generator
```

---

ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ 🙏