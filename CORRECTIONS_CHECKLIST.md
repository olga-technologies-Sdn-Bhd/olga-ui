# Client corrections checklist — temporary

> Tracks the "Olga Corrected Screens" client feedback (1 Oct 2026 handover PDF).
> **Delete this file before going live** — it's a working doc, not part of the shipped app.
> Check an item by changing `- [ ]` to `- [x]` as it's actually done in code, not just planned.

Last updated: 2026-10-03 (checked against develop @ 610c3ca, incl. Jigar's PRs #11–#18)

## Foundation

- [x] Brand retheme — bone/sand/ink tokens, green reserved for live/match, amber for outcomes, no blue, no gradients
- [x] Typography — Outfit (headings/scores), Instrument Sans (body/buttons), IBM Plex Mono (small uppercase labels) wired in and linked natively
- [x] True pill buttons, 44–48px tall
- [ ] "The loop must close" — Commit → Accept → reveal → meet
- [ ] Presence gated — Go Live unlocks only after badge-desk check-in

## Screens

- [ ] 01 Home — sand intent card done; still needs 3rd tip "Confirm you met", one set of numbers on coming-up card, first-name-only welcome
- [ ] 02 Events — list — needs date blocks, 3 sections (You're going / Open for sign-up / Past). *(Done, Jigar #18: "All cities" chip. ⚠ #18 also dropped the "N match your intent" line from list cards — the spec wants it on every card, so it needs to come back once the backend provides a count.)*
- [ ] 03 Event detail, signed up — needs tagline removed, no Go Live button before the event, per-event intent editable. *(Done, Jigar #18: duplicate match pill removed. ⚠ #18 also removed the "match your intent" number from the stats row — the spec's stats row should carry both 612 signed up and 41 match your intent. Partial, Jigar: intent card shows the member's real intent — still not editable per event.)*
- [ ] 04 Who's going — needs neutral silhouette (no "?"), score badge back on each card, confirm the header count is "N of total" for intent-matched attendees. *(Done, Jigar #18: copy now says "Names appear when you both accept"; list and header count come from the real attendees API.)*
- [ ] 05 Go Live — before the event *(new screen)* — "Not in a room yet," OFF toggle, opens at check-in
- [ ] 06 Go Live — ready (checked in) — needs press-and-hold (not tap), user colour picker, visible-until time in the ready state. *(Partial: "visible in this room until HH:MM" already shows once live; not in the ready state.)*
- [ ] 07 Filter — remove "Add tags for this session", live-count on slider, two off-by-default toggles
- [ ] 08 Go Live — live — ripple is green ✅; still needs SEARCHING→LIVE·3 READY text states, "Go invisible" control
- [ ] 09 Your three — Commit/Pass — add Commit/Pass to match cards, neutral silhouette instead of initials
- [ ] 10 Chat — Commits/meetings — replace "coming soon" modal with real Commits-for-you + meetings UI
- [ ] 15 Your Go Live colour *(new screen)*
- [ ] 16 Commit — where and when *(new screen)*

## Brand assets (not in the client PDF — done alongside this work)

- [x] App icon replaced with the "Ol-ga" wordmark on both iOS and Android, plus the Play Store 512×512 listing icon
- [x] Sign-up screen retheme — dropped the old dark photo-carousel background, matches the rest of the app now

## Landed on develop by Jigar (not on the client list)

- [x] Lucide icons in the bottom tab bar
- [x] Sign-in: Continue with Email (in-app code entry), Google and Apple via Entra; Bearer token on Core calls; local sign-out
- [x] Dark-mode contrast fixes (primary buttons, send button) and dev-API warm-up at app start
- [x] Admin-managed events (list/detail refresh, cancelled-event handling, event description)
- [x] Live Mode consent policy version read from Core; OFFER intent built from the member's profile; NLP intent IDs capped at 64 chars
- [x] #18: all mock data removed — events, matching and Who's going use the real APIs; intent re-save fix; Go Live asks for an intent on Home first

## Explicitly out of scope (per the client doc — don't build without asking)

- [ ] Empty room / incoming request detail / conversation presets / required states
- [ ] Login, Account, "How you appear," Delete account
- [ ] Universal Links / App Links on ol-ga.com
