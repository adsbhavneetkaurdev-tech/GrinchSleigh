# Grump Sleigh

Guests scan a QR code and anonymously submit a grudge (a grump) from the year. Each one pops up on the
big screen as a note, crumples into a paper ball (or a lump of coal) and arcs into the sack on
the Grumpster's rickety goat-drawn sled. When the host presses **L**, the Grumpster ties the sack and
the goats haul the lot away across the sky, leaving the room grudge-free.

## Look
Festive storybook styling: candy-cane stripes, Christmas red and green, a snowy village with lit
windows, and a red-and-gold sleigh pulled by two stubborn goats.

The character ("the Grumpster") is a picture: `public/assets/grumpster.png`, cut out from the
event owner's own mockup for a private, non-commercial party. To swap him, replace that PNG with
any character cut out to the waist on a transparent background (about 640 x 670 px, body centred
roughly a third of the way in from the left) and keep the same filename. The goats, sleigh and
sack are drawn in code (`public/js/art.js`).

## Run it

```bash
npm install
ADMIN_PASSWORD=pick-a-password npm start
```

On Windows PowerShell: `$env:ADMIN_PASSWORD="pick-a-password"; npm start`.
Without it, the password is `hostKey` in `config/event.json` (default `change-me`).

The console prints four links:

| Page | URL | Who uses it |
|---|---|---|
| Guest form | `http://<your-ip>:3000/` | Guests (this is what the QR code points to) |
| Big screen | `/display?key=HOST_KEY` | Projector / TV |
| Admin / host review | `/admin` (asks for the password; `/host` also works) | Host on a phone or laptop |
| Sales demo | `/display?demo=true` | Demos, no guests needed |

Before the event, set `ADMIN_PASSWORD` (or `hostKey` in `config/event.json`). The big screen uses the same password: `/display?key=YOUR_PASSWORD`.
If guests reach the server through a tunnel or a domain, set `publicUrl` so the QR code points there.

## Keyboard controls (big screen)

| Key | Action |
|---|---|
| Q | Show/hide QR code |
| T | Show/hide on-screen text (title, counter, hint) |
| F | Fullscreen |
| L | Launch the finale |
| R | Reset for a new round (counter to 0, empty sack) |
| H | Show the controls hint |

Open the display with `?key=HOST_KEY` so L and R also update the server (the guest form closes
during the finale and reopens on reset). The host panel has the same buttons.

### Demo mode
- `/display?demo=true` plays sample grudges, no server traffic.
- `&speed=2` makes grudges arrive faster.
- `&autoloop=true` launches the finale at `demo.autoFinaleAt` grudges, then resets by itself (good for a looping booth screen).
- Opening `public/display.html` straight from disk also works for demos (the QR shows a placeholder).

## Moderation and privacy
- The form only has one text box (max 80 characters). No names, emails or accounts. IPs are only held in memory, salted and hashed, for rate limiting.
- Each grudge is checked for: common first names and nicknames, "my boss Kevin" or "Mr Smith" patterns, profanity (including `sh1t`, `f u c k`, `fuuuck`), emails, phone numbers, links and @handles.
- Flagged grudges go to the **host review queue** and are never shown until approved. The host can edit the text (for example, remove a name) before approving.
- Tick **Hold every grudge for review** in the host panel to approve everything by hand.
- Add your guests' or colleagues' names to `moderation.extraBlockedNames`. This is the most effective single step for an office party.
- Words that should never be flagged go in `moderation.allowedWords`.

## Configuration (`config/event.json`)
The file reloads automatically when saved, so text changes apply without a restart (refresh the display).

- `display.*`: title, subtitle, QR caption, counter labels, **`finaleMessage`**, `finaleSubMessage`, `coalChance`, `sackFullAt` (how many grudges make the sack "full"), `moodThresholds` (when the Grumpster becomes delighted, then straining, then sits on the sack), `noteDisplayMs`.
- `speech.*`: everything the Grumpster and the goats say.
- `form.*`: every line of text on the guest form, including the "Keep it light. No names, please!" note.
- `limits.*`: max/min length and submissions per minute per device.
- `moderation.*`: the filters described above.

## Files
```
server.js              Express + Socket.IO server, QR code, guest and host APIs
config/event.json      All event text and settings
lib/moderation.js      Name, profanity and contact-info filter
lib/wordlists.js       Name and profanity lists
lib/store.js           Round state and review queue (data/state.json)
public/display.html    Big screen (+ js/display.js, css/display.css)
public/js/art.js       Artwork drawn in code: goats, sleigh, sack, paper balls
public/assets/         grumpster.png, the character picture
public/index.html      Guest form (+ js/submit.js, css/submit.css)
public/host.html       Host review panel (+ js/host.js, css/host.css)
test/                  Moderation tests (npm test)
```
