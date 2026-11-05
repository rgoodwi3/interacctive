# InterACCtive

The course page for the financial accounting labs and games, published at
https://rgoodwi3.github.io/interacctive/. It is a static site backed by the Supabase project
"Financial Accounting Skills." The database and the `lab-attempt` edge function live in the
`fa-lab-platform` repo.

- `index.html` is the course page: sign-in, students, instructors, gradebook and the admin page.
- `platform.js` holds the Supabase URL and publishable key, and the save logic the games use.
- The game pages are the published games from `accounting-games` with a save hook added. They are
  here because `activities.url` for each game is relative to this page. Labs live in their own repos.

## Sign-in

Email steps use a one-time code typed on the page, never a link, because university mail scanners
use links up. This needs "Confirm email" on, and the Confirm signup and Reset password email
templates must show `{{ .Token }}`.

## Run it locally

    python -m http.server 8000

Use port 8000: the `lab-attempt` function allows that origin for testing. Signing in here does not
carry over to the labs, which share a session with this page only on rgoodwi3.github.io.

## Limits

- The Canvas CSV is out of 100 points, for graded activities only, and puts the email in the
  SIS Login ID column. Check it against a real Canvas export before importing.
