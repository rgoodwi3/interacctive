/* Platform bridge for the accounting games.
   Loaded by each game page. When the page is opened from a course (?course=…&act=…), it saves
   the first finished try of each round to Supabase. Opened on its own, it does nothing. */
window.PLATFORM_CONFIG = {
  url: 'https://yoijetxcolixkjqsxkpo.supabase.co',
  key: 'sb_publishable_R7CQN_jmNSlHZiGvXa9Jqw_bQv3q3fE'
};

window.Platform = (() => {
  const cfg = window.PLATFORM_CONFIG;
  const q = new URLSearchParams(location.search);
  const courseId = q.get('course'), slug = q.get('act');
  const active = !!(courseId && slug && window.supabase);
  const sb = active ? window.supabase.createClient(cfg.url, cfg.key) : null;

  let round = 0, ctx = null, ready = null, bar = null;
  const done = new Set();           // rounds already saved or forfeited
  const queue = [];                 // results reported before the context finished loading

  // The games declare `const Game` at the top level, which is not a property of window.
  const game = () => (typeof Game !== 'undefined' ? Game : null);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chText = set => { const a = [...set].sort((x, y) => x - y), out = []; for (let i = 0; i < a.length; i++) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; out.push(j > i ? a[i] + '-' + a[j] : String(a[i])); i = j; } return out.join(','); };
  const chSet = s => { const o = new Set(); String(s || '').split(',').forEach(p => { const [a, b] = p.split('-').map(Number); if (a) for (let c = a; c <= (b || a); c++) o.add(c); }); return o; };

  function say(html, kind) {
    if (!bar) return;
    bar.querySelector('.pl-msg').innerHTML = html;
    bar.dataset.kind = kind || 'info';
  }

  function mountBar() {
    const css = document.createElement('style');
    css.textContent = `.pl-bar{background:#fff6d9;border-bottom:1px solid #e0c96a;font-size:15px}
      .pl-bar .wrap{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding-top:8px;padding-bottom:8px}
      .pl-bar b{color:#002D74}.pl-bar .pl-msg{margin-left:auto;font-weight:600}
      .pl-bar[data-kind=good] .pl-msg{color:#1d7a46}.pl-bar[data-kind=bad] .pl-msg{color:#b3261e}
      .pl-bar a{font-weight:600}`;
    document.head.appendChild(css);
    bar = document.createElement('div');
    bar.className = 'pl-bar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<div class="wrap"><span class="pl-who">Connecting to your course…</span><span class="pl-msg"></span></div>';
    const mh = document.querySelector('.masthead');
    if (mh) mh.after(bar); else document.body.prepend(bar);
  }

  async function load() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      bar.querySelector('.pl-who').innerHTML = 'You are not signed in, so results will not be saved.';
      say('<a href="index.html" target="_blank" rel="noopener">Sign in</a>, then reopen this game from your course.', 'bad');
      return null;
    }
    const [{ data: course }, { data: act }, { data: me }] = await Promise.all([
      sb.from('courses').select('id,name').eq('id', courseId).maybeSingle(),
      sb.from('activities').select('id,title,scored').eq('slug', slug).maybeSingle(),
      sb.from('profiles').select('full_name,email,role').eq('id', session.user.id).maybeSingle()
    ]);
    if (!course || !act) {
      bar.querySelector('.pl-who').innerHTML = 'This game is not assigned in a course you are enrolled in.';
      return null;
    }
    const { data: asg } = await sb.from('course_activities').select('mode,due_at,max_attempts,chapters')
      .eq('course_id', courseId).eq('activity_id', act.id).maybeSingle();
    if (!asg) { bar.querySelector('.pl-who').innerHTML = 'This game is not assigned in this course.'; return null; }
    const { count } = await sb.from('attempts').select('id', { count: 'exact', head: true })
      .eq('course_id', courseId).eq('activity_id', act.id).eq('student_id', session.user.id);
    const name = (me && (me.full_name || me.email)) || session.user.email;
    const c = { courseId, activityId: act.id, scored: act.scored, asg, used: count || 0, userId: session.user.id, student: me && me.role === 'student' };
    const lim = asg.mode === 'graded' && asg.max_attempts ? ` · Attempts used: <b data-used>${c.used}</b> of ${asg.max_attempts}` : '';
    const due = asg.due_at ? ` · Due ${new Date(asg.due_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : '';
    bar.querySelector('.pl-who').innerHTML = `<b>${esc(course.name)}</b> · ${esc(name)} · ${asg.mode === 'graded' ? 'Graded' : 'Practice'} · Chapters ${esc(asg.chapters)}${due}${lim}`;
    if (!act.scored) say('Class game. Nothing is saved.', 'info');
    else if (!c.student) say('Preview only. Sign in as a student to save results.', 'info');
    else say('Finish a round to save your result. Show answers forfeits the round.', 'info');
    return c;
  }

  async function save(r) {
    if (!ctx || !ctx.scored || !ctx.student) return;
    const g = game(), ch = g ? g.chapters : new Set();
    if (chText(ch) !== chText(chSet(ctx.asg.chapters))) {
      say(`Not saved: this assignment uses chapters ${esc(ctx.asg.chapters)}. Reopen it from your course page.`, 'bad');
      return;
    }
    say('Saving…', 'info');
    const { error } = await sb.from('attempts').insert({
      course_id: ctx.courseId, activity_id: ctx.activityId, student_id: ctx.userId,
      seed: r.seed, score: Math.round(r.score), total: Math.round(r.total),
      answers: { chapters: chText(ch), ...(r.detail || {}) }
    });
    if (error) {
      say(ctx.asg.mode === 'graded'
        ? 'Not saved: the due date has passed or you have used all your attempts.'
        : 'Not saved. Check your connection and try again.', 'bad');
      return;
    }
    ctx.used++;
    const u = bar.querySelector('[data-used]'); if (u) u.textContent = ctx.used;
    say(`Saved: ${Math.round(r.score)} of ${Math.round(r.total)} (round ${r.seed}).`, 'good');
  }

  /** Called by the game engine each time a round starts (new round, replay, chapter change). */
  function newRound() { round++; }

  /** Called by a game when a round is finished. Only the first result of each round counts. */
  function report(score, total, detail) {
    if (!active || done.has(round) || !(total > 0)) return;
    done.add(round);
    const r = { score: Math.max(0, Math.min(score, total)), total, detail, seed: game() ? game().seed : 0 };
    if (ready) ready.then(() => save(r)); else queue.push(r);
  }

  /** Called by a game when answers are revealed. The current round can no longer be saved. */
  function skip() {
    if (!active || done.has(round)) return;
    done.add(round);
    if (ctx && ctx.scored && ctx.student) say('Answers shown, so this round will not be saved. Click <b>New round</b> to try again for credit.', 'bad');
  }

  if (active) {
    const start = () => {
      mountBar();
      ready = load().then(c => { ctx = c; queue.splice(0).forEach(r => save(r)); }).catch(() => say('Could not reach the course. Results will not be saved.', 'bad'));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }

  return { newRound, report, skip, get active() { return active; } };
})();
