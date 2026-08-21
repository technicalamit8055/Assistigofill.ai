# Chrome Extension

Derived from master spec §15, §7.4, §19.6.

---

## 1. Manifest

Manifest V3. Permissions requested at install:

```json
"permissions": ["activeTab", "storage", "scripting", "sidePanel"]
```

No `host_permissions` at install time. Page access comes from `activeTab` (user gesture) plus
`chrome.scripting.executeScript`. If broad host access is ever needed, it must be an optional
permission with an in-product explanation and matching Chrome Web Store copy.

`externally_connectable.matches` lists the dashboard origins only — `http://localhost:3000` and
`https://assistigo.ai` — because pairing (§3) is the one thing a web page is allowed to start.
Nothing else may message the extension.

Icons are generated from `Assests/assistfill-logo.png` into `apps/extension/public/icons`
(16/32/48/128 plus the `wordmark.png` used in the panel header). The 512px store tile lives at
`Assests/assistigo-mark-512.png` and is deliberately outside the bundle.

## 2. Components

| Component                      | Responsibility                                        | Must not                            |
| ------------------------------ | ----------------------------------------------------- | ----------------------------------- |
| `background/` (service worker) | auth/session, message routing, all API calls          | touch the DOM                       |
| `content/`                     | detect fields, apply fills, floating launcher         | store PII, log values, click submit |
| `popup/`                       | connection status, customer selector, "Detect fields" | render untrusted HTML               |
| `review/`                      | review table, confidence, edit/skip, Fill, results    | call the API directly               |
| `sidepanel/`                   | mounts `review/ReviewPanel` in Chrome's side panel    | add chrome the browser provides     |
| `shared/`                      | Zod message schemas, API client, storage helpers      | import DOM APIs                     |

Chrome's side panel is the only review surface. `review/ReviewPanel.tsx` holds the UI and
`sidepanel/` is a thin mount of it, so the panel can be re-hosted later without touching the
review logic. It renders a Disconnect button next to the organization/role row, so ending a
session does not require reopening the popup.

## 3. Auth

The extension does not implement its own login form. "Connect account" opens
`${APP_URL}/extension/connect?ext=<runtime id>`, the signed-in dashboard mints a short-lived
pairing code, and the service worker exchanges it at `POST /api/extension/pair` for a session.
Tokens live in `chrome.storage.session` and are refreshed by the service worker. Signing out of
the dashboard revokes the extension session — the extension holds the _Supabase_ refresh token,
so `POST /api/extension/refresh` fails the moment that token family is revoked.

Rationale: no password ever passes through extension code, and Chrome Web Store review sees no
credential handling.

```text
popup  ──"Connect account"──▶  tab: /extension/connect?ext=<id>
                                     │  operator presses "Connect this extension"
                                     ▼
                               POST /api/extension/pairing-code   (cookie auth)
                                     │  → code (returned once, never stored in the clear)
                                     ▼
                               chrome.runtime.sendMessage(<id>, { code })
                                     │
                                     ▼
service worker  ──▶  POST /api/extension/pair { code }  ──▶  { accessToken, refreshToken, expiresAt }
```

What holds this together:

| Risk                                         | Control                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A crafted `?ext=` pairs a hostile extension  | `resolveExtensionId` checks `EXTENSION_ALLOWED_IDS`; empty allowlist fails closed outside local |
| A page other than the dashboard sends a code | `externally_connectable`, plus an exact `sender.origin` comparison in the service worker        |
| The pairing table leaks                      | Only SHA-256 of the code is stored; the session is AES-256-GCM sealed with the code hash as AAD |
| A code is replayed                           | `consume_extension_pairing_code()` checks expiry and marks consumed in one statement            |
| A code outlives its tab                      | 120-second TTL, one live code per user, `purge_extension_pairing_codes()` sweeps the rest       |

### CORS

The service worker calls the dashboard from `chrome-extension://<id>`, which is a cross-origin
request, so the browser preflights `/api/*` and discards the response unless it allows that
origin. `apps/web/middleware.ts` echoes the origin back when the id passes the same
`EXTENSION_ALLOWED_IDS` gate used for pairing, and `apps/web/lib/extension/cors.ts` does the same
for the pairing routes so their 401s carry the headers too.

`Access-Control-Allow-Credentials` is never sent. The extension authenticates with a bearer token,
and allowing credentials would let a permitted extension ride the operator's dashboard cookies.

Without this the pairing request never leaves the browser: a code is minted, nothing consumes it,
and the panel reports that the extension refused the connection.

Pairing is behind an explicit button on the connect page, not automatic on load: granting an
extension your session is an authorisation, and it should be one the operator performed on
purpose. Failures from `/api/extension/pair` are deliberately indistinguishable — unknown,
expired and already-redeemed all return the same 401, so the endpoint is not an oracle.

## 4. Message contract

Every message is `{ type, requestId, payload }`, Zod-parsed on receipt. The receiver verifies
`sender.id === chrome.runtime.id`. Unknown types are dropped, not forwarded.

```text
PING                     sidepanel/popup → background
GET_SESSION              → background
SELECT_CUSTOMER          → background   (id + display summary only)
DETECT_FIELDS            → background → content
DETECT_RESULT            content → background → sidepanel
REQUEST_MAPPING          sidepanel → background → server
APPLY_FILL               sidepanel → background → content   (values travel only here)
                         instructions come from buildFillInstructions(), never from the panel
                         itself: that applies the named transforms, re-checks safety classes,
                         and orders dependent dropdowns parent-first
FILL_RESULT              content → background → sidepanel → server
REPORT_FORM              sidepanel → background → server
```

Customer values exist in the content script only for the duration of the fill, are never written
to storage, and are cleared from the message context when the fill completes.

## 5. Fill safety

The content script refuses, unconditionally:

- clicking anything that `isSubmitControl()` identifies,
- calling `form.submit()` or `form.requestSubmit()`,
- dispatching Enter keydown inside a form,
- writing to a field classified as captcha, OTP or payment,
- writing to a disabled, readonly or hidden field.

These are asserted by `apps/extension/tests/safety.test.ts`. That file must not be deleted or
weakened.

## 6. Detection

Walks `document.forms` plus loose inputs, skipping invisible elements
(`offsetParent === null`, zero-size, `visibility:hidden`, `opacity:0`). Label resolution order:
`<label for>` → wrapping `<label>` → `aria-labelledby` → `aria-label` → preceding text node →
table header cell → placeholder. Nearby text is trimmed to 120 characters and excludes a
`<select>`'s own `<option>` text — options are the field's possible _values_, they travel
separately, and leaving them in made them act as naming signals. Same-origin iframes are walked;
cross-origin frames are reported as `frameBlocked` so the operator knows a section could not be
read.

`FIELD_SELECTOR` in `detector.ts` is the one definition of what counts as a field: native
controls, `[contenteditable]`, and the ARIA roles a component library uses when it rebuilds a
control out of divs. It is exported and imported by `filler.ts` rather than duplicated, because a
field's signature is derived from its index in *that selector's* result list — a filler querying a
different set of elements would resolve every signature to the wrong field. The same applies to
`collectCustomOptionElements`: detection and filling look for a custom dropdown's options in the
same places, so an option the operator was shown is never one the filler cannot find.

The types a control reports and the values it can accept are covered in
`docs/FORM_ENGINE.md` §9a.

## 7. Storage

| Key                | Store                    | Contains                                         |
| ------------------ | ------------------------ | ------------------------------------------------ |
| `session`          | `chrome.storage.session` | access token, refresh token, expiry              |
| `selectedCustomer` | `chrome.storage.session` | id, display name, mobile last 4                  |
| `settings`         | `chrome.storage.local`   | locale, overwrite-filled-fields flag, panel side |
| `recentCustomers`  | `chrome.storage.session` | id + display name only, max 10                   |

Nothing sensitive is written to `chrome.storage.local`.

## 8. Blocked pages

The content script never runs on `chrome://`, `chrome-extension://`, `edge://`, `about:`,
`view-source:`, `file://`, or `chromewebstore.google.com`.

## 9. Build

Vite, multi-entry, fully bundled. No remote script tags, no CDN fonts, no `eval`, no
`new Function`. `npm run build:extension` emits `apps/extension/dist`, which is loaded unpacked in
development and zipped by `scripts/build-extension.ts` for store upload.

`VITE_DASHBOARD_URL` selects the backend at build time and defaults to `http://localhost:3000`.
A store build must set it, and the value must be one of the `externally_connectable` origins:

```bash
VITE_DASHBOARD_URL=https://assistigo.ai npm run build:extension
```

Regenerate the icons after any logo change with `scripts/generate-icons.mjs`.

## 10. Acceptance criteria (§15.5)

- [ ] Connects to a signed-in dashboard account
- [ ] Detects fields on every demo form
- [ ] Displays the selected customer's name and mobile last four at all times
- [ ] Fills text, date, select, radio and checkbox fields
- [ ] Skips CAPTCHA and OTP placeholders and says so in the results
- [ ] Never submits
- [ ] Records a fill session with filled / skipped / review counts
- [ ] Reports errors with no PII
