# VNE Outreach Automation

This repository contains the Google Apps Script project that powers Vin Noir Explorers & Importers (VNE) outbound prospecting. It automates lead discovery, outreach drafting, email delivery, and bounce recovery while keeping operators informed through a unified daily summary.

The project is ready to be shared internally with teammates who want to understand the system, extend it, or suggest improvements. This README walks through the intent of the tool, the major subsystems, how to run it, and how to collaborate.

---

## Product overview

### Why this exists
Wine outreach is repetitive and time-sensitive. The script packages our best practices into a single workflow so VNE reps can focus on high-touch conversations instead of manual research. Every run:

* surfaces promising hospitality targets using a layered search strategy,
* generates respectful, human-sounding insights and email copy with guardrails,
* sends HTML outreach from Gmail with the correct headers and compliance checks,
* logs what happened for auditing, and
* retries bounced messages by researching alternate contacts.

### Key capabilities

* **Lead discovery:** Combines curated datasets with Gemini-powered search prompts to find new prospects while avoiding duplicates.
* **Risk-aware content creation:** Builds insights and email bodies with safeties that keep tone, compliance, and brand aligned.
* **Automated delivery:** Crafts UTF-8 safe emails, injects signatures/headers, and respects blackout dates, quiet hours, and follow-up spacing.
* **Run visibility:** Tracks every action in the run history sheet and ships a unified summary email that includes bounce retry outcomes.
* **Bounce recovery:** Parses Gmail bounce notices, researches alternate contacts (site scraping, notes, domain heuristics), and resends when possible.

---

## System architecture

The Apps Script project is organized under `src/` so it can be versioned and tested locally. Highlights:

| Area | Key files | Responsibilities |
| --- | --- | --- |
| Configuration & safety | `config.gs`, `safety_guard.gs`, `blackout_dates.gs` | Environment constants, API keys, run gating, holiday logic. |
| Run orchestration | `main_run.gs`, `triggers.gs`, `run_history.gs` | Entry points, trigger registration, logging, and summary preparation. |
| Lead sourcing | `lead_generation.gs`, `strategy.gs`, `priority.gs`, `fetch_leads.gs` | Discover new accounts, pick strategies, score, and deduplicate prospects. |
| Outreach content | `classification_insight_helpers.gs`, `email_generation.gs`, `rep_notes.gs`, `btg_notes.gs`, `wine_db.gs` | Classify prospects, draft insights, and populate email templates using catalog data. |
| Email sending | `outreach.gs`, `outreach_extra.gs`, `headers.gs`, `send_mail.gs` | Build final HTML emails, attach headers, and dispatch via Gmail with throttling. |
| Bounce handling | `bounce_retry.gs`, `summary_email.gs` | Parse bounces, attempt retries, and fold results into the daily summary. |
| Utilities & shared logic | `utils.gs`, `row_builders.gs`, `gemini_api.gs`, `blocklist.gs` | Helpers for Sheets, Gemini retries, and safety lists. |

Supporting documentation lives alongside the code:

* `tests/` – Node-based unit tests executed locally to validate Apps Script behavior via a thin GAS shim.
* `sync_to_apps_script.md` – Manual steps and shortcuts for uploading the source to Apps Script.

---

## How the workflow runs

1. **Scheduling:** `setupDailyTrigger()` (in `triggers.gs`) installs a time-based trigger that executes `runDailyOutreach()` from `main_run.gs` each morning.
2. **Lead discovery:** `runDailyOutreach()` calls into the lead generation modules to build a prioritized queue of prospects and ensures we respect blocklists and quotas.
3. **Email production:** For each target, insight builders gather highlights, the email generator assembles copy, and senders push messages through Gmail with proper headers.
4. **Logging:** Actions are written to the run history sheet via `run_history.gs`, allowing post-run auditing and monitoring.
5. **Bounce retries:** New Gmail bounce notices are parsed by `bounce_retry.gs`. The script researches alternate contacts (public site addresses, social handles, Google results, existing notes) and attempts resends. Outcomes are logged back into Sheets.
6. **Summary email:** After all activity, `summary_email.gs` produces a digest email containing lead stats, bounce retry results, and operator action items.

---

## Getting started

### Prerequisites

* Google Workspace account with access to the VNE outreach Gmail inbox and target Sheets.
* Gemini API access – generate an API key and store it securely.
* Node.js 20+ and npm for local testing (mirrors Apps Script V8 behavior).

### Local setup

1. Clone this repository and install dependencies:
   ```bash
   npm install
   ```
2. Run the automated checks before committing changes:
   ```bash
   npm test
   npm audit
   ```
   The `tests/` suite exercises critical helpers such as bounce parsing so regressions surface quickly.

### Apps Script configuration

1. Open the Apps Script project connected to the outreach Sheet.
2. In **Project Settings → Script Properties**, add `GEMINI_API_KEY` with your key value.
3. Enable the **Advanced Gmail Service** to authorize bounce processing and email sending.
4. Deploy the latest source (see `sync_to_apps_script.md` for tips, or use `clasp` if you prefer a CLI sync).
5. Run `setupDailyTrigger()` once to schedule the daily execution. You can also manually run `runDailyOutreach()` for smoke testing.

### Verifying the installation

* Execute `test_NewCompanies_EndToEnd()` from the Apps Script editor to perform an end-to-end dry run with mock data.
* Confirm that the run history sheet updates and that the summary email lands in the configured monitoring inbox.
* Send yourself a test bounce (e.g., by emailing a fake address) to observe the retry workflow and sheet logging.

---

## Operating tips

* **Monitoring:** Review the unified summary email each morning. It includes new outreach counts, notable leads, bounce retry actions, and any warnings raised by safety checks.
* **Backoff controls:** Update `blackout_dates.gs` and `safety_guard.gs` when adding holidays, adjusting hourly limits, or pausing outreach entirely.
* **Content tuning:** Insight prompts and email templates live in `email_generation.gs` and related helpers. Make incremental edits and cover them with tests when possible.
* **Bounce intelligence:** The retry module will annotate Sheet rows with every avenue it explored (social, site, search) before marking a contact unreachable.

---

## Contributing & submitting suggestions

We encourage teammates to improve the automation. To propose a change:

1. Create a feature branch and update the relevant `.gs` or test files.
2. Run `npm test` and `npm audit` locally to ensure the change is safe.
3. Open a pull request that explains the problem, solution, and any operational considerations. Screenshots or Sheet snippets are welcome when they clarify behavior.

If you are not ready to open a PR, start a discussion by filing an issue or dropping a note in the VNE outreach Slack channel. Please include reproduction steps, expected behavior, and any logs (run history rows, summary snippets) that help us triage.

Before merging, we double-check for:

* Adherence to compliance guardrails (no direct model mentions, respectful tone).
* Safety around API limits and rate throttling.
* Clear documentation or tests for new behaviors, especially in bounce handling and run summaries.

---

## Support

Questions, blockers, or production incidents can be raised with the outreach automation maintainers. Keep the following handy:

* **Operations contact:** outreach@vinnoirexplorers.com (monitored by the sales ops team).
* **Escalation:** Ping #sales-automation in Slack for urgent fixes.

We welcome feedback—whether it is new data sources, copy tweaks, or improvements to bounce recovery logic. Open a PR or reach out through the channels above, and we will collaborate on the next iteration.
