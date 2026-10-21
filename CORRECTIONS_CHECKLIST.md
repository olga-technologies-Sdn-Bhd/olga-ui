# Client corrections checklist — temporary

> Tracks the "Olga Corrected Screens" client feedback (1 Oct 2026 handover PDF).
> **Delete this file before going live** — it's a working doc, not part of the shipped app.
> Check an item by changing `- [ ]` to `- [x]` only when every bullet of the spec for it is met in code. Items that are only waiting on the backend stay unchecked, with the gap named.

Last updated: 2026-10-08 — verified in the code on develop @ e164a30 (Jigar's PRs #11–#26). Static check only: `tsc` is clean; the new screens have not been run end to end.

## Foundation

- [x] Brand retheme — bone/sand/ink tokens, green reserved for live/match, amber for outcomes, no blue, no gradients
- [x] Typography — Outfit (headings/scores), Instrument Sans (body/buttons), IBM Plex Mono (small uppercase labels) wired in and linked natively
- [x] True pill buttons, 44–48px tall
- [x] "The loop must close" — Commit → Accept → reveal → meet. *(Jigar #21: send Commit, per-room quota, Commits for you with Accept/Decline, sent Commits and meetings, all on real Core endpoints. Not yet tested end to end with two real members.)*
- [ ] Presence gated — Go Live unlocks only after badge-desk check-in. *(Not enforced: Go Live is gated by the event's live window; check-in is only a notice on the event page ("check in at the badge desk before you appear in matches") and Core's matching skips members who aren't checked in, Jigar #22. Spec wants Go Live itself locked until checked in.)*

## Screens

- [ ] 01 Home — first name only, sand intent card with Edit, "Get started" with the three tips (they disappear once done), coming-up card with a date block and "N signed up" are all done (Jigar #20). Still needs: "N match your intent" on the coming-up card (no match count from Core/NLP yet).
- [ ] 02 Events — list — "All cities" chip, date blocks, titles wrapping to two lines, the three sections with the Past empty state are done (Jigar #18, #20). Still needs: "N match your intent" on every card (Core `match_count`), and real past events.
- [ ] 03 Event detail, signed up — name/date/venue lead, tagline removed, duplicate match pill removed, no Go Live button before the event (it only appears while the event is live), signed-up state, intent card editable (Jigar #18, #20). Still needs: per-event intent (today it edits the general intent); "Leave this event" (needs a Core unregister); the stats row's "N match your intent" next to "signed up".
- [ ] 04 Who's going — "Names appear when you both accept" copy, neutral silhouette, top five + "Show all", real attendees API (Jigar #18, #20). Still needs: score badge on each card; confirm the list and count are intent-matched attendees only (Core/NLP).
- [x] 05 Go Live — before the event — "Not in a room yet", locked disc, next room named, filter summary (Jigar #20)
- [x] 06 Go Live — ready — press-and-hold disc, colour row, end time stated, filter summary under it (Jigar #20)
- [ ] 07 Filter — "Add tags for this session" removed, intent on top (editable once per live session), the two toggles default off (Jigar #20). Still needs: "N people live clear this" on the minimum-match slider (needs NLP).
- [x] 08 Go Live — live — SEARCHING → LIVE · N READY, green waves, "Go invisible", bounded retries + one manual retry (Jigar #20)
- [x] 09 Your three — at most three (the app asks the server for up to 7 and shows the top 3), silhouettes, Commit / Pass (Jigar #20)
- [x] 10 Chat — Commits for you (Accept / Decline) and meetings replace the "coming soon" modal (Jigar #21)
- [ ] 11 Go Live mark — the client's ring-with-dot mark. *(Jigar #23 uses the Lucide "Radio" icon for the tab instead of the ring mark, and the tab turns green while live. Still not built: Quick Settings tile, status-bar icon, lock-screen control. Decide whether the Radio icon is acceptable to the client.)*
- [x] 15 Your Go Live colour — six colours, saved on the phone (Jigar #20)
- [x] 16 Commit — where and when — sheet with meeting spots and quota, sending calls Core (Jigar #20, #21)

## Brand assets (not in the client PDF — done alongside this work)

- [x] App icon replaced with the "Ol-ga" wordmark on both iOS and Android, plus the Play Store 512×512 listing icon
- [x] Sign-up screen retheme — dropped the old dark photo-carousel background, matches the rest of the app now
- [x] Bundle ID / application ID set to `com.olga.connect` on iOS and Android (Jigar #24; replaces the template placeholders and my earlier `com.olga.app`). ⚠ The ID is registered under a colleague's Apple Developer account, so signing needs that account. Not yet confirmed on Google Play.
- [x] iOS sign-in hang fixed — Microsoft redirects to `olga-dev://auth/` (with a slash) and iOS AppAuth rejected it silently; the redirect now carries the slash on iOS only (Android unchanged). The production tenant will need the same handling.

## Landed on develop by Jigar (not on the client list)

- [x] Lucide icons in the bottom tab bar
- [x] Sign-in: Continue with Email (in-app code entry), Google and Apple via Entra; Bearer token on Core calls; local sign-out
- [x] Dark-mode contrast fixes (primary buttons, send button) and dev-API warm-up at app start
- [x] Admin-managed events (list/detail refresh, cancelled-event handling, event description)
- [x] Live Mode consent policy version read from Core; OFFER intent built from the member's profile; NLP intent IDs capped at 64 chars
- [x] #18: all mock data removed — events, matching and Who's going use the real APIs; intent re-save fix; Go Live asks for an intent on Home first
- [x] #19: Core Go Live error codes mapped (EVENT_NOT_LIVE, LIVE_MODE_DISABLED, MEMBER_NOT_ACTIVE)
- [x] #20: the corrected screens (Home, Events, Go Live, Filter, Your three, colour) plus the green-tint token #E7F3EB
- [x] #21: the Commit flow (send, quota, incoming/outgoing, Accept/Decline, meetings)
- [x] #22: MATCHING consent asked before Go Live; check-in notice for events that need it
- [x] #23: Go Live tab icon (Lucide Radio)
- [x] #24: app ID `com.olga.connect` on both platforms
- [x] #25: search again when the minimum match changes while live; equal Commit and Pass buttons
- [x] #26: Android bold brand fonts (`_bold` font copies; they were falling back to Roboto)

## Explicitly out of scope (per the client doc — don't build without asking)

- [ ] Empty room / incoming request detail / conversation presets / required states
- [ ] Login, Account, "How you appear," Delete account
- [ ] Universal Links / App Links on ol-ga.com
