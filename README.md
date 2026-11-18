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

- The Canvas CSV is out of 100 points and puts the email in the SIS Login ID column. Check it
  against a real Canvas export before importing. In the gradebook's Scores view it has graded
  activities only. In the Completion view it has percent complete for graded labs and games, in
  columns named "… completion" so an import doesn't overwrite the score columns.
- Each assignment has Start, Due and End dates, as in Canvas. Students can't open it before the
  start date. Graded work after the due date is allowed but marked Late in the gradebook. Graded
  work closes at the end date, or at the due date when there's no end date. The database
  (can_submit, a lab_attempts trigger, the auto-close job) and the lab-attempt function enforce
  the same rules. Late work isn't penalized automatically.
- The Assignments tab saves every changed row with one Save changes button. Select rows with the
  first column to fill in a mode, dates or an attempt limit for all of them, then save.
- Deleting a class deletes its assignments, students, roster, scores and lab attempts. The
  delete dialog offers every grade as a CSV first.
- Copy for Canvas (each assigned lab) and Copy student instructions for Canvas (under the join
  code) build their HTML in the instructor's school name and colors. Canvas keeps inline styles
  only, so every element carries its own.
