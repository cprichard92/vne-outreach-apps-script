# VNE Outreach Apps Script

Google Apps Script project for Vin Noir Explorers & Importers outreach automation.

## What it does
- Finds new NC leads with an LLM-backed search strategy.
- Classifies establishments with safe fallbacks.
- Generates cautious, human-sounding insights for emails.
- Builds and sends UTF-8 HTML outreach emails.
- Logs run history and emits a unified summary email.
- Resend logic after blackout windows and follow-up gates.

## Structure
Source is split under `src/`:
- `config.gs`: constants, sheet IDs, API keys.
- `triggers.gs`: time-based trigger setup.
- `main_run.gs`: daily orchestration entrypoints.
- `safety_guard.gs`: emergency stop and budgets.
- `lead_generation.gs`: candidate discovery.
- `strategy.gs`: search strategy selection.
- `priority.gs`: scoring and ordering.
- `fetch_leads.gs`: area pulls and de-dupe.
- `outreach.gs` & `outreach_extra.gs`: send logic.
- `classification_insight_helpers.gs`: safe type + insights.
- `rep_notes.gs`, `btg_notes.gs`: sales notes builders.
- `wine_db.gs`: wine catalog access and normalization.
- `blackout_dates.gs`: holiday and blackout checks.
- `email_generation.gs`: prompt assembly and templating.
- `headers.gs`, `send_mail.gs`: email headers and send.
- `run_history.gs`, `summary_email.gs`: logging and recap.
- `blocklist.gs`: client and domain blocklists.
- `utils.gs`, `row_builders.gs`: helpers and row ops.
- `gemini_api.gs`: retrying Gemini wrapper.
- `tests.gs`, `test_e2e.gs`: smoke and end-to-end tests.

## Setup
1. In Apps Script, set Script Property `GEMINI_API_KEY`.
2. Enable Advanced Gmail service.
3. Run `setupDailyTrigger()` once.
4. Use `test_NewCompanies_EndToEnd()` to verify.

## Notes
- Code prefers resilience: retries, fallbacks, and partial success.
- Never reveal model identity in emails. Always write as a VNE rep.
