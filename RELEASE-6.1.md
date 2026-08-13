# The Set Helsinki Enterprise 6.1 — Rota Autosave

## Changes
- Rota changes autosave after 1.5 seconds of inactivity.
- Autosave covers start/end times, codes, notes, multi-shift slots and shift removal.
- Rota QA blocks autosave when a shift is incomplete, invalid or overlapping.
- Status indicator: Autosave pending / Saving / Saved / Not saved.
- Manual Save remains available as a fallback.
- Safe concurrent save handling: edits made while a save is in progress remain dirty and are saved in the next autosave.
- Existing before-unload protection remains active while unsaved changes exist.
- Employee drag/drop ordering already saves immediately and remains unchanged.

## Database
No new SQL migration is required. This release uses the existing `shift_slot` support from migration 021.
