# AI Agent Handoff Document

> **CRITICAL INSTRUCTION TO AI AGENTS:** 
> Whenever you start working in this repository, **you MUST read this file first** to understand the current context and where the last agent left off. 
> Before ending your session, **you MUST update the "Handoff Log" and "Current Focus" sections** to ensure the next agent is perfectly in sync. 

---

## 🏗️ Project Overview
**Name:** JobsMatchAI (Smart Job Matching Platform)
**Objective:** An AI-powered job matching platform featuring CV parsing, multi-directional NLP skill extraction, and scoring-based recommendations for Employers and Job Searchers.
**Roles:** Admin, Employer, Job Searcher

### Stack & Architecture
- **Backend:** Node.js, Express.js
- **Database:** SQLite3 (`better-sqlite3`) + WAL mode
- **Frontend:** Vanilla HTML/CSS/JS (Monochromatic grey/black/white UI)
- **Algorithm:** Two-way matching engine utilizing experience gaps, NLP skill sets, and requirement matching criteria. 
- **Start Command:** `npm run dev` (runs `node --watch src/index.js`)

---

## 📍 Current State (Last Updated: 2026-04-27)
### 🟢 Completed Features
1. **Node.js Migration:** Python/FastAPI backend was fully rewritten in Node.js.
2. **Role-based Architecture:** Middleware, DB, and frontend were upgraded to handle 3 distinct roles. 
3. **Monochromatic UX Redesign:** The UI was fully updated to a premium dark mode layout with responsive Mobile-First tap layouts.
4. **Bidirectional Matching:** Users match to jobs, and employers match to users based on advanced weighted criteria.
5. **Full Profile Page:** A dedicated profile page with cover photo, avatar upload (base64 resized via canvas), bio, phone number, email, experience, education, skills cloud, and account status. Edit via modal.
6. **Job Edit & Delete:** Job cards now show edit (pencil) and delete (trash) buttons for owners/admins. Delete uses an inline card overlay confirmation (not browser confirm()).
7. **Mobile UX Polish:** Bottom sheet modals, 44px touch targets, scale-on-tap feedback, responsive profile layout, full-width toasts, mobile bottom tab bar pointing to Profile.

8. **Job Applications:** Candidates can apply to jobs with an optional cover letter. The application UI dynamically updates to show the applied state.
9. **Employer Notifications:** Real-time (polling) notifications alert employers when a candidate applies to their jobs, complete with a notification bell and dropdown. Clicking a notification opens a detailed Applicant Modal.
10. **Employer Type Selection:** Employers choose between Company or Individual during registration. Stored as `employer_type` on the user record.
11. **Enhanced Job Postings:** Jobs now have `employment_type` (permanent/short-term/long-term/contract), `worker_type` (staff/freelancer), and optional `duration_min`/`duration_max` (months). Displayed as colored badges on job cards.
12. **Global Talent Search:** New "Find Talent" page for employers to search all searcher profiles globally by job profile (fuzzy), skills, and education level. Separate from existing per-job Candidates search.
13. **Best Candidates Button:** Job owners see a "⭐ Best Candidates" button on their job cards, opening a modal with top 10 ranked matches plus optional filters.
14. **Role-based Restrictions:** Searchers cannot access Candidates, Find Talent, or Best Candidates features.

### 🟡 Current Focus / In-Progress
- All 4 requested features are complete and verified.
- Awaiting the next set of user directives.

### 🔴 Known Issues / Blockers
- Windows execution policies (`npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded`) block `npm run dev` in some terminal configurations. Use `cmd.exe /c "node --watch src/index.js"` directly.
- The bottom tab bar may not trigger in headless/automated browser environments at 375px, but works in real mobile and dev tools responsive mode.

---

## 📁 Key File Map

| File | Purpose |
|---|---|
| `src/database.js` | SQLite schema + migrations (users w/ employer_type, jobs w/ employment fields, applications, notifications) |
| `src/routes/auth.js` | Registration (accepts employer_type), login, getUserWithSkills helper |
| `src/routes/users.js` | GET/PUT /api/users/me (supports employer_type), POST /api/users/me/skills |
| `src/routes/jobs.js` | CRUD for jobs with employment_type, worker_type, duration fields |
| `src/routes/talent-search.js` | Global talent search + per-job best candidates (top 10) |
| `src/routes/applications.js` | Job Application flow, fetching own and job applications |
| `src/routes/notifications.js` | Fetching and updating employer notifications |
| `src/routes/admin.js` | Admin user management, stats |
| `src/routes/employer-matching.js` | Employer→candidate matching (existing) |
| `src/routes/matching.js` | Searcher→job matching |
| `src/middleware/auth.js` | requireAuth, optionalAuth, requireRole |
| `frontend/index.html` | All pages, Find Talent page, Best Candidates modal, employer type selector |
| `frontend/styles.css` | Full CSS design system (~3100 lines) |
| `frontend/app.js` | All frontend logic (~2100 lines) |

### DB Schema: `users` table columns
`id, email, hashed_password, full_name, role, status, company_name, employer_type, phone_number, bio, profile_picture, title, experience_years, education_level, cv_text, cv_filename, created_at, updated_at`

### DB Schema: `jobs` table new columns
`employment_type, worker_type, duration_min, duration_max`

---

## 📝 Agent Handoff Log

*Append your session summary here before exiting.*

### Agent Session: 2026-04-26 (Antigravity — Session 1)
**Tasks Completed:**
- Validated the system architecture overhaul implementation from the previous disconnected session.
- Tested `localhost:8000` via a dedicated browser subagent to confirm monochromatic styling and responsive role-based dashboards.
- Generated this `agents.md` index file for persistent tracking. 
**Next Steps for incoming Agent:** 
- Await user directives for new features. The baseline application is clean, functional, and fully configured.

### Agent Session: 2026-04-26 (Claude Opus 4.6 — Session 2)
**Tasks Completed:**
- **Backend:** Added `phone_number`, `bio`, `profile_picture` columns to users table (database.js schema + migrations). Updated auth.js getUserWithSkills to return new fields. Updated users.js PUT /me to accept new fields including company_name.
- **Frontend HTML:** Added full Profile page section (`#page-profile`) with cover, avatar, info grid, bio card, skills cloud, account card. Added Edit Profile modal (`#profile-modal`). Added Profile nav link. Updated mobile tab bar to point to profile page.
- **Frontend CSS:** Added ~300 lines of profile page styles (cover animation, avatar with edit overlay, info grid, responsive stacking). Added job card action button styles (`.job-card-actions`, `.btn-icon-delete`). Added inline delete confirmation overlay (`.job-delete-confirm`). Enhanced mobile: bottom-sheet modals, 44px touch targets, scale-on-tap cards, full-width toasts, condensed profile on 480px.
- **Frontend JS:** Added `initProfile()`, `loadProfileData()`, `openEditProfileModal()`, `handleProfileSave()`, `handleAvatarUpload()` (with canvas resize to 200px JPEG). Added `confirmDeleteJob()` with inline overlay and `deleteJob()`. Updated `updateNavForRole()` to show Profile link for all logged-in users. Updated `renderJobs()` to show edit+delete action buttons.
- **Verified:** All features tested via browser subagent — registration, profile editing (phone/bio/title), job CRUD with edit/delete buttons, inline delete confirmation with cancel.
**Next Steps for incoming Agent:**
- The 3 features requested are done. Await new user directives.

### Agent Session: 2026-04-26 (Gemini 3.1 Pro — Session 3)
**Tasks Completed:**
- **Backend:** Added `applications` and `notifications` tables to `src/database.js`. Created `src/routes/applications.js` to handle submitting, fetching, and updating job applications. Created `src/routes/notifications.js` to serve unread counts and notifications for employers. Registered routes in `src/index.js`.
- **Frontend HTML & CSS:** Added the notification bell and badge in the top navigation, the dropdown panel, the layout for notifications list, CSS for notifications. Added the Apply button in the job cards and the Applicant Details modal mapping fields (name, email, phone, experience, cover letter, skills).
- **Frontend JS:** Hooked up fetching notifications, polling every 30 seconds for unread count, and loading user applications inside `fetchCurrentUser`. Used event delegation for handling notification clicks (via `data-notif-id` mapping to a window `_notifCache` to prevent quoting errors in inline onClick handler). Set up form handlers for Apply button cover letter submission.
- **Verified:** All features successfully tested end to end using the browser-subagent. Logging in as candidate, clicking Apply, logging in as Employer, hovering notification dropdown, and clicking the notification item to view full applicant modal with data.
**Next Steps for incoming Agent:**
- Application functionality is entirely functioning. Await user directives.

### Agent Session: 2026-04-27 (Claude Opus 4.6 — Session 4)
**Tasks Completed:**
- **Backend:** Added `employer_type` column to users (company/individual). Added `employment_type`, `worker_type`, `duration_min`, `duration_max` columns to jobs table with migrations. Updated auth.js, users.js, jobs.js to accept/return new fields. Created `talent-search.js` with global fuzzy search (`GET /api/talent/search`) and per-job best candidates (`GET /api/talent/best/:jobId`). Fuzzy matching uses stem extraction for terms like "economist" ↔ "economics".
- **Frontend HTML:** Added employer type selector (Company/Individual) in auth modal. Added Employment Type, Worker Type, and Duration fields in job form. Added Find Talent page (`#page-talent`) with search/filter inputs. Added Best Candidates modal with filter inputs. Added `nav-talent` link.
- **Frontend CSS:** Added ~400 lines: employer type selector, job card employment badges (6 badge variants), Find Talent page grid/cards, Best Candidates modal card layout, responsive breakpoints.
- **Frontend JS:** Added employer type click handling + registration payload. Added job form employment type change handler (auto-toggles duration/worker type). Updated `renderJobs()` with employment badges + Best Candidates button. Added `initTalentSearch()`, `searchTalent()`, `initBestCandidates()`, `openBestCandidates()`, `loadBestCandidates()`. Updated `updateNavForRole()` to show/hide Find Talent for employers only.
- **Verified:** Browser subagent confirmed: employer type selector works, job badges render correctly, Find Talent page loads, searcher nav correctly hides employer-only links.
**Next Steps for incoming Agent:**
- All 4 user-requested features are done. Await new user directives.

