# The Tribe website

A static site for The Tribe, an Ottawa B2B networking community. It shows the members and upcoming events from a Google Sheet. Members add events through a passcode-protected Google Form.

No server, no database, no build step: plain HTML/CSS/JS on GitHub Pages.

| File | What it is |
|---|---|
| `config.js` | The only place with Sheet and Form URLs |
| `app.js` | Fetches the published CSVs and renders the Members and Events pages |
| `style.css` | All styling; colours and spacing are tokens at the top |
| `index.html`, `members/`, `events/` | The three pages |
| `images/` | Side-panel photo (`bg.jpg`), white logo for the panel (`logo.svg`), browser-tab icon (`icon.svg`) |
| `test-data/` | Sample CSVs, handy for local testing or for importing into a new Sheet |

## How the data flows

- **Members** tab: typed by hand. Rows with `active` = `no` or an empty `name` are hidden. An optional `photo_url` column (a Google Drive share link or any image URL) shows a photo instead of the initials.
- **Form Responses 1** tab: filled by the Google Form (timestamp, passcode, name, date, event name, description). Never published.
- **Events** tab: row 1 holds the headers `event_name`, `date`, `description`, `submitted_by`, and A2 holds this formula, which keeps only today and future events, in date order, without the passcode:

  ```
  =QUERY('Form Responses 1'!A:F, "select E, D, F, C where E is not null and D >= date '"&TEXT(TODAY(),"yyyy-mm-dd")&"' order by D asc format D 'yyyy-mm-dd'", 0)
  ```

Only the Members and Events tabs are published (File > Share > Publish to web > Published content & settings: Members, Events). Changes show on the site within a few minutes.

## Everyday tasks for the organizer

- **Add a member:** add a row to Members, then add their name to the "Your name" dropdown in the Form.
- **Hide a member:** set `active` to `no`.
- **Add a member photo:** upload it to Google Drive, share it as "Anyone with the link", and paste that share link into the member's `photo_url` cell. Easiest: share one "Member photos" folder that way once, and every photo uploaded into it is ready to use. Square photos look best; without a photo, the member's initials show instead.
- **Remove an event:** delete its row in Form Responses 1.
- **Change the passcode:** in the Form, open the Passcode question's ⋮ > Response validation and change the pattern, e.g. `^NewPasscode$` (case sensitive).

The passcode is light protection that keeps random visitors out; it is not real security.

## Moving to the client's Google account

1. In the Sheet: File > Make a copy (the linked Form is copied with it), or transfer ownership of both files.
2. In the new Form: Publish, with responders set to "Anyone with the link".
3. In the new Sheet: Publish to web with only Members and Events selected, then copy each tab's CSV link (Link tab > pick the tab > "Comma-separated values").
4. Paste the two CSV links and the Form's responder link into `config.js`.

## Custom domain

The site lives at https://ottawatribe.ca (registered at GoDaddy, on the client's account). Its DNS records there:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (four records) |
| CNAME | `www` | `davron2004.github.io` |

The `CNAME` file in this repo and the custom domain under Settings > Pages both say `ottawatribe.ca`; `www` redirects to it. If the repository moves to another GitHub account, change the `www` CNAME to that account's `<user>.github.io` ([GitHub's instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)). All links are relative, so nothing else changes.

## Local testing

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. To test without the live Sheet, point `config.js` at `/test-data/members.csv` and `/test-data/events.csv` (don't commit that change).
