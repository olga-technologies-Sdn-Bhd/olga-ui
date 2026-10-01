# Client corrections checklist — temporary

> Tracks the "Olga Corrected Screens" client feedback (1 Oct 2026 handover PDF).
> **Delete this file before going live** — it's a working doc, not part of the shipped app.
> Check an item by changing `- [ ]` to `- [x]` as it's actually done in code, not just planned.

Last updated: 2026-10-01

## Foundation

- [x] Brand retheme — bone/sand/ink tokens, green reserved for live/match, amber for outcomes, no blue, no gradients
- [x] Typography — Outfit (headings/scores), Instrument Sans (body/buttons), IBM Plex Mono (small uppercase labels) wired in and linked natively
- [x] True pill buttons, 44–48px tall
- [ ] "The loop must close" — Commit → Accept → reveal → meet
- [ ] Presence gated — Go Live unlocks only after badge-desk check-in

## Screens

- [ ] 01 Home — sand intent card done; still needs 3rd tip "Confirm you met", one set of numbers on coming-up card, first-name-only welcome
- [ ] 02 Events — list — needs date blocks, 3 sections (You're going / Open for sign-up / Past), "All cities" chip
- [ ] 03 Event detail, signed up — needs tagline removed, no Go Live button before the event, per-event intent editable, duplicate match pill removed
- [ ] 04 Who's going — needs neutral silhouette (no "?"), corrected copy ("both accept"), header count matching the event
- [ ] 05 Go Live — before the event *(new screen)* — "Not in a room yet," OFF toggle, opens at check-in
- [ ] 06 Go Live — ready (checked in) — needs press-and-hold (not tap), visible-until time shown, user colour picker
- [ ] 07 Filter — remove "Add tags for this session", live-count on slider, two off-by-default toggles
- [ ] 08 Go Live — live — ripple is green ✅; still needs SEARCHING→LIVE·3 READY text states, "Go invisible" control
- [ ] 09 Your three — Commit/Pass — add Commit/Pass to match cards, neutral silhouette instead of initials
- [ ] 10 Chat — Commits/meetings — replace "coming soon" modal with real Commits-for-you + meetings UI
- [ ] 15 Your Go Live colour *(new screen)*
- [ ] 16 Commit — where and when *(new screen)*

## Explicitly out of scope (per the client doc — don't build without asking)

- [ ] Empty room / incoming request detail / conversation presets / required states
- [ ] Login, Account, "How you appear," Delete account
- [ ] Universal Links / App Links on ol-ga.com
