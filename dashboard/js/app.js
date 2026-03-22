/* CouSy — Couple Sync App v2.0 */
(function() {
  'use strict';

  let currentUser = null;
  let currentView = 'home';
  let chartInstances = [];

  // ─── API Helper ─────────────────────────────────
  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) { logout(); return null; }
    return res.json();
  }

  // ─── Auth ───────────────────────────────────────
  async function init() {
    const data = await api('/auth/verify');
    if (data && data.user) {
      currentUser = data.user;
      showApp();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  }

  function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    navigate('home');
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    currentUser = null;
    showLogin();
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const data = await api('/auth/login', { method: 'POST', body: { username, password } });
    if (data && data.user) {
      currentUser = data.user;
      showApp();
    } else {
      document.getElementById('login-error').textContent = data?.error || 'Anmeldung fehlgeschlagen';
    }
  });

  // ─── Navigation ─────────────────────────────────
  const viewTitles = {
    home: 'Home', checkin: 'Check-In', trends: 'Trends',
    dates: 'Dates', planer: 'Planer', zyklus: 'Zyklus', watch: 'Watchlist'
  };

  function navigate(view) {
    currentView = view;
    document.getElementById('header-title').textContent = viewTitles[view] || view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    destroyCharts();
    removeFab();

    const headerAction = document.getElementById('header-action');
    headerAction.style.display = 'none';
    headerAction.onclick = null;

    const renderers = { home: renderHome, checkin: renderCheckin, trends: renderTrends, dates: renderDates, planer: renderPlaner, zyklus: renderZyklus, watch: renderWatch };
    if (renderers[view]) renderers[view]();
  }

  document.getElementById('bottom-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn) navigate(btn.dataset.view);
  });

  // ─── Modal ──────────────────────────────────────
  function openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-content').innerHTML = '';
  }

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // ─── FAB ────────────────────────────────────────
  function showFab(onclick) {
    removeFab();
    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.textContent = '+';
    fab.onclick = onclick;
    document.getElementById('app-screen').appendChild(fab);
  }

  function removeFab() {
    const fab = document.querySelector('.fab');
    if (fab) fab.remove();
  }

  // ─── Charts ─────────────────────────────────────
  function destroyCharts() {
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];
  }

  // ─── Helpers ────────────────────────────────────
  function daysSince(dateStr) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ─── HOME ──────────────────────────────────────
  async function renderHome() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="content-inner"><p class="text-muted">Laden...</p></div>';

    const [milestones, actions, events] = await Promise.all([
      api('/milestones'),
      api('/actions'),
      api('/events'),
    ]);

    let html = '<div class="content-inner">';

    // Milestones
    html += '<div class="section-title">Meilensteine</div>';
    if (milestones && milestones.length) {
      for (const m of milestones) {
        const days = daysSince(m.date);
        html += `<div class="milestone-item">
          <span class="milestone-icon">${esc(m.icon)}</span>
          <div class="milestone-info">
            <div class="card-title">${esc(m.title)}</div>
            <div class="card-subtitle">${formatDate(m.date)}</div>
          </div>
          <span class="milestone-days">${days} Tage</span>
        </div>`;
      }
    } else {
      html += '<div class="empty-state">Noch keine Meilensteine</div>';
    }

    // Open Actions
    const openActions = (actions || []).filter(a => !a.done);
    html += '<div class="section-title">Offene Aufgaben</div>';
    if (openActions.length) {
      for (const a of openActions.slice(0, 5)) {
        html += `<div class="action-item">
          <div class="action-text">${esc(a.text)}</div>
          <span class="text-small text-muted">${esc(a.display_name)}</span>
        </div>`;
      }
      if (openActions.length > 5) html += `<p class="text-muted text-small text-center mt-8">+${openActions.length - 5} weitere</p>`;
    } else {
      html += '<div class="empty-state">Keine offenen Aufgaben</div>';
    }

    // Upcoming Events
    const now = new Date();
    const upcoming = (events || []).filter(e => new Date(e.date_start) >= now).slice(0, 5);
    html += '<div class="section-title">Naechste Events</div>';
    if (upcoming.length) {
      for (const e of upcoming) {
        html += `<div class="card">
          <div class="card-title">${esc(e.title)}</div>
          <div class="card-subtitle">${formatDate(e.date_start)}${e.location ? ' · ' + esc(e.location) : ''}</div>
        </div>`;
      }
    } else {
      html += '<div class="empty-state">Keine anstehenden Events</div>';
    }

    // Logout
    html += `<button class="btn-secondary mt-16" style="width:100%" id="logout-btn">Abmelden</button>`;
    html += '</div>';
    content.innerHTML = html;

    document.getElementById('logout-btn').onclick = logout;

    // Header action for adding milestones
    const headerAction = document.getElementById('header-action');
    headerAction.textContent = '+ Milestone';
    headerAction.style.display = 'flex';
    headerAction.onclick = () => openMilestoneModal();
  }

  function openMilestoneModal(milestone) {
    const isEdit = !!milestone;
    openModal(`
      <div class="modal-title">${isEdit ? 'Milestone bearbeiten' : 'Neuer Milestone'}</div>
      <input type="text" id="ms-title" placeholder="Titel" value="${esc(milestone?.title || '')}">
      <input type="date" id="ms-date" value="${milestone?.date || ''}">
      <input type="text" id="ms-icon" placeholder="Icon (Emoji)" value="${esc(milestone?.icon || '❤️')}" maxlength="4">
      <div class="modal-actions">
        ${isEdit ? '<button class="btn-danger" id="ms-delete">Loeschen</button>' : ''}
        <button class="btn-primary" id="ms-save">${isEdit ? 'Speichern' : 'Erstellen'}</button>
      </div>
    `);
    document.getElementById('ms-save').onclick = async () => {
      const body = { title: document.getElementById('ms-title').value, date: document.getElementById('ms-date').value, icon: document.getElementById('ms-icon').value };
      if (!body.title || !body.date) return;
      if (isEdit) await api('/milestones/' + milestone.id, { method: 'PUT', body });
      else await api('/milestones', { method: 'POST', body });
      closeModal(); renderHome();
    };
    if (isEdit) {
      document.getElementById('ms-delete').onclick = async () => {
        await api('/milestones/' + milestone.id, { method: 'DELETE' });
        closeModal(); renderHome();
      };
    }
  }

  // ─── CHECK-IN ──────────────────────────────────
  let checkinAnswers = {};
  let checkinStep = 0;
  let checkinQuestions = [];
  let checkinWeek = '';

  async function renderCheckin() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="content-inner"><p class="text-muted">Laden...</p></div>';

    const [qData, weekData] = await Promise.all([api('/checkins/questions'), api('/checkins/current-week')]);
    checkinQuestions = qData || [];
    checkinWeek = weekData?.week_key || '';

    const weekInfo = await api('/checkins/week/' + checkinWeek);

    let html = '<div class="content-inner">';
    html += `<div class="text-small text-muted mb-16">Woche ${esc(checkinWeek)}</div>`;

    // Partner status
    if (weekInfo?.partner?.submitted && !weekInfo.partner.answers) {
      html += '<div class="card" style="border-color:var(--accent)"><div class="card-title" style="color:var(--accent)">Partner hat bereits ausgefuellt</div><div class="card-subtitle">Fuelle deinen Check-In aus, um die Antworten zu sehen.</div></div>';
    }

    // If both submitted — show comparison
    if (weekInfo?.own && weekInfo?.partner?.answers) {
      html += renderComparison(weekInfo.own, weekInfo.partner.answers, checkinQuestions);
      html += '</div>';
      content.innerHTML = html;
      return;
    }

    // If already submitted — show own answers
    if (weekInfo?.own) {
      html += '<div class="section-title">Deine Antworten</div>';
      for (const q of checkinQuestions) {
        const a = weekInfo.own.find(x => x.question_key === q.key);
        html += `<div class="card"><div class="card-subtitle">${esc(q.label)}</div>`;
        if (a) {
          if (q.type === 'emoji') html += `<div class="card-title">${['😢','😕','😐','🙂','😊'][Math.round((a.numeric_value || 3) - 1)]}</div>`;
          else if (q.type === 'slider') html += `<div class="card-title">${a.numeric_value}/10</div>`;
          else html += `<div class="card-title">${esc(a.text_value)}</div>`;
        }
        html += '</div>';
      }
      html += '<button class="btn-secondary mt-16" style="width:100%" id="checkin-redo">Erneut ausfuellen</button>';
      html += '</div>';
      content.innerHTML = html;
      document.getElementById('checkin-redo').onclick = () => startCheckinForm(weekInfo.previous);
      return;
    }

    // Show form
    startCheckinForm(weekInfo?.previous);
  }

  function startCheckinForm(prevAnswers) {
    checkinAnswers = {};
    checkinStep = 0;
    renderCheckinStep(prevAnswers);
  }

  function renderCheckinStep(prevAnswers) {
    const content = document.getElementById('content');
    const q = checkinQuestions[checkinStep];
    if (!q) return;

    const progress = ((checkinStep) / checkinQuestions.length) * 100;
    const prev = prevAnswers ? prevAnswers.find(a => a.question_key === q.key) : null;

    let html = '<div class="content-inner">';
    html += `<div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>`;
    html += `<div class="text-small text-muted mb-8">Frage ${checkinStep + 1} von ${checkinQuestions.length}</div>`;
    html += `<div class="card-title mb-16">${esc(q.label)}</div>`;

    if (q.type === 'emoji') {
      const emojis = ['😢','😕','😐','🙂','😊'];
      const currentVal = checkinAnswers[q.key]?.numeric_value;
      html += '<div class="emoji-picker">';
      emojis.forEach((em, i) => {
        html += `<button class="emoji-btn${currentVal === i + 1 ? ' selected' : ''}" data-val="${i + 1}">${em}</button>`;
      });
      html += '</div>';
    } else if (q.type === 'slider') {
      const val = checkinAnswers[q.key]?.numeric_value || 5;
      html += `<div class="slider-container">
        <div class="slider-value" id="slider-display">${val}</div>
        <input type="range" min="1" max="10" value="${val}" id="checkin-slider">
      </div>`;
    } else {
      html += `<textarea id="checkin-text" placeholder="Deine Antwort..." rows="4">${esc(checkinAnswers[q.key]?.text_value || '')}</textarea>`;
    }

    // Previous week hint
    if (prev) {
      html += '<div class="text-small text-muted mt-8">Letzte Woche: ';
      if (q.type === 'emoji') html += ['😢','😕','😐','🙂','😊'][Math.round((prev.numeric_value || 3) - 1)];
      else if (q.type === 'slider') html += prev.numeric_value + '/10';
      else html += esc(prev.text_value);
      html += '</div>';
    }

    if (q.optional) html += '<div class="text-small text-muted mt-8">Optional</div>';

    html += '<div class="modal-actions mt-16">';
    if (checkinStep > 0) html += '<button class="btn-secondary" id="checkin-prev">Zurueck</button>';
    if (checkinStep < checkinQuestions.length - 1) {
      html += '<button class="btn-primary" id="checkin-next">Weiter</button>';
    } else {
      html += '<button class="btn-primary" id="checkin-submit">Absenden</button>';
    }
    html += '</div></div>';

    content.innerHTML = html;

    // Event listeners
    if (q.type === 'emoji') {
      content.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.onclick = () => {
          content.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          checkinAnswers[q.key] = { question_key: q.key, answer_type: 'emoji', numeric_value: parseInt(btn.dataset.val) };
        };
      });
    } else if (q.type === 'slider') {
      const slider = document.getElementById('checkin-slider');
      const display = document.getElementById('slider-display');
      slider.oninput = () => {
        display.textContent = slider.value;
        checkinAnswers[q.key] = { question_key: q.key, answer_type: 'slider', numeric_value: parseInt(slider.value) };
      };
      if (!checkinAnswers[q.key]) checkinAnswers[q.key] = { question_key: q.key, answer_type: 'slider', numeric_value: 5 };
    }

    const prevBtn = document.getElementById('checkin-prev');
    if (prevBtn) prevBtn.onclick = () => { saveCurrentAnswer(q); checkinStep--; renderCheckinStep(prevAnswers); };

    const nextBtn = document.getElementById('checkin-next');
    if (nextBtn) nextBtn.onclick = () => { saveCurrentAnswer(q); checkinStep++; renderCheckinStep(prevAnswers); };

    const submitBtn = document.getElementById('checkin-submit');
    if (submitBtn) submitBtn.onclick = () => { saveCurrentAnswer(q); submitCheckin(); };
  }

  function saveCurrentAnswer(q) {
    if (q.type === 'text') {
      const el = document.getElementById('checkin-text');
      if (el) checkinAnswers[q.key] = { question_key: q.key, answer_type: 'text', text_value: el.value };
    }
  }

  async function submitCheckin() {
    const answers = Object.values(checkinAnswers).filter(a => a.numeric_value != null || a.text_value);
    await api('/checkins', { method: 'POST', body: { week_key: checkinWeek, answers } });
    renderCheckin();
  }

  function renderComparison(own, partner, questions) {
    let html = '<div class="section-title">Vergleich</div>';
    for (const q of questions) {
      const o = own.find(a => a.question_key === q.key);
      const p = partner.find(a => a.question_key === q.key);
      html += `<div class="card"><div class="card-subtitle mb-8">${esc(q.label)}</div><div class="compare-row">`;

      html += '<div class="compare-col"><div class="compare-label">' + esc(currentUser.display_name) + '</div>';
      html += '<div class="compare-value">' + formatAnswer(q, o) + '</div></div>';

      html += '<div class="compare-col"><div class="compare-label">Partner</div>';
      html += '<div class="compare-value">' + formatAnswer(q, p) + '</div></div>';

      html += '</div></div>';
    }
    return html;
  }

  function formatAnswer(q, a) {
    if (!a) return '–';
    if (q.type === 'emoji') return ['😢','😕','😐','🙂','😊'][Math.round((a.numeric_value || 3) - 1)];
    if (q.type === 'slider') return a.numeric_value + '/10';
    return esc(a.text_value) || '–';
  }

  // ─── TRENDS ────────────────────────────────────
  async function renderTrends() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="content-inner"><p class="text-muted">Laden...</p></div>';

    const data = await api('/checkins/trends');
    if (!data || !data.weeks || Object.keys(data.weeks).length === 0) {
      content.innerHTML = '<div class="content-inner"><div class="empty-state">Noch keine Daten fuer Trends</div></div>';
      return;
    }

    const weeks = Object.keys(data.weeks).sort();
    const users = [...new Set(weeks.flatMap(w => Object.keys(data.weeks[w])))];
    const colors = ['#e5484d', '#2b9a66'];

    const chartConfigs = [
      { key: 'satisfaction', label: 'Zufriedenheit' },
      { key: 'connection', label: 'Verbundenheit' },
      { key: 'energy', label: 'Energie' },
    ];

    let html = '<div class="content-inner">';
    for (const cfg of chartConfigs) {
      html += `<div class="chart-container"><div class="section-title">${cfg.label}</div><canvas id="chart-${cfg.key}"></canvas></div>`;
    }
    html += '</div>';
    content.innerHTML = html;

    for (const cfg of chartConfigs) {
      const ctx = document.getElementById('chart-' + cfg.key);
      if (!ctx) continue;
      const datasets = users.map((u, i) => ({
        label: u,
        data: weeks.map(w => data.weeks[w][u]?.[cfg.key] ?? null),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        tension: 0.3,
        spanGaps: true,
      }));
      const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: weeks, datasets },
        options: {
          responsive: true,
          scales: { y: { min: 1, max: 10, ticks: { color: '#777' }, grid: { color: 'rgba(255,255,255,0.06)' } }, x: { ticks: { color: '#777' }, grid: { display: false } } },
          plugins: { legend: { labels: { color: '#e8e8e8' } } },
        },
      });
      chartInstances.push(chart);
    }
  }

  // ─── DATES ─────────────────────────────────────
  let dateFilter = { category: '', status: '' };

  async function renderDates() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="content-inner"><p class="text-muted">Laden...</p></div>';

    let url = '/dates?';
    if (dateFilter.category) url += 'category=' + dateFilter.category + '&';
    if (dateFilter.status) url += 'status=' + dateFilter.status;
    const ideas = await api(url);

    const categories = ['', 'chill', 'adventure', 'romantic', 'food', 'culture'];
    const catLabels = { '': 'Alle', chill: 'Chill', adventure: 'Abenteuer', romantic: 'Romantisch', food: 'Essen', culture: 'Kultur' };

    let html = '<div class="content-inner">';
    html += '<div class="chip-row">';
    for (const c of categories) {
      html += `<button class="chip${dateFilter.category === c ? ' active' : ''}" data-cat="${c}">${catLabels[c]}</button>`;
    }
    html += '</div>';

    if (ideas && ideas.length) {
      html += '<div class="date-grid">';
      for (const idea of ideas) {
        html += `<div class="date-card" data-id="${idea.id}">
          <div class="flex-between mb-8"><span class="badge badge-${idea.status}">${idea.status}</span><span class="text-small text-muted">${'★'.repeat(idea.wish_level || 0)}</span></div>
          <div class="date-card-title">${esc(idea.title)}</div>
          <div class="date-card-meta">${esc(idea.category)}${idea.location ? ' · ' + esc(idea.location) : ''}</div>
        </div>`;
      }
      html += '</div>';
    } else {
      html += '<div class="empty-state">Keine Date-Ideen gefunden</div>';
    }
    html += '</div>';
    content.innerHTML = html;

    // Chip filters
    content.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => { dateFilter.category = chip.dataset.cat; renderDates(); };
    });

    // Card click → edit
    content.querySelectorAll('.date-card').forEach(card => {
      card.onclick = async () => {
        const all = await api('/dates');
        const idea = (all || []).find(i => i.id === parseInt(card.dataset.id));
        if (idea) openDateModal(idea);
      };
    });

    showFab(() => openDateModal());

    // Header: random picker
    const headerAction = document.getElementById('header-action');
    headerAction.textContent = '🎲 Zufall';
    headerAction.style.display = 'flex';
    headerAction.onclick = async () => {
      const idea = await api('/dates/random');
      if (idea) {
        openModal(`<div class="modal-title">Zufaellige Idee</div>
          <div class="card"><div class="card-title">${esc(idea.title)}</div>
          <div class="card-subtitle">${esc(idea.category)}${idea.location ? ' · ' + esc(idea.location) : ''}</div>
          ${idea.description ? '<div class="text-small mt-8">' + esc(idea.description) + '</div>' : ''}
          </div><div class="modal-actions"><button class="btn-primary" onclick="document.getElementById('modal-overlay').style.display='none'">OK</button></div>`);
      } else {
        openModal('<div class="modal-title">Keine Ideen vorhanden</div><div class="modal-actions"><button class="btn-primary" onclick="document.getElementById(\'modal-overlay\').style.display=\'none\'">OK</button></div>');
      }
    };
  }

  function openDateModal(idea) {
    const isEdit = !!idea;
    openModal(`
      <div class="modal-title">${isEdit ? 'Date-Idee bearbeiten' : 'Neue Date-Idee'}</div>
      <input type="text" id="date-title" placeholder="Titel" value="${esc(idea?.title || '')}">
      <textarea id="date-desc" placeholder="Beschreibung">${esc(idea?.description || '')}</textarea>
      <input type="text" id="date-location" placeholder="Ort" value="${esc(idea?.location || '')}">
      <select id="date-category">
        <option value="chill"${idea?.category === 'chill' ? ' selected' : ''}>Chill</option>
        <option value="adventure"${idea?.category === 'adventure' ? ' selected' : ''}>Abenteuer</option>
        <option value="romantic"${idea?.category === 'romantic' ? ' selected' : ''}>Romantisch</option>
        <option value="food"${idea?.category === 'food' ? ' selected' : ''}>Essen</option>
        <option value="culture"${idea?.category === 'culture' ? ' selected' : ''}>Kultur</option>
      </select>
      <select id="date-status">
        <option value="idea"${idea?.status === 'idea' ? ' selected' : ''}>Idee</option>
        <option value="planned"${idea?.status === 'planned' ? ' selected' : ''}>Geplant</option>
        <option value="done"${idea?.status === 'done' ? ' selected' : ''}>Erledigt</option>
        <option value="again"${idea?.status === 'again' ? ' selected' : ''}>Nochmal</option>
      </select>
      <div class="modal-actions">
        ${isEdit ? '<button class="btn-danger" id="date-delete">Loeschen</button>' : ''}
        <button class="btn-primary" id="date-save">${isEdit ? 'Speichern' : 'Erstellen'}</button>
      </div>
    `);
    document.getElementById('date-save').onclick = async () => {
      const body = {
        title: document.getElementById('date-title').value,
        description: document.getElementById('date-desc').value,
        location: document.getElementById('date-location').value,
        category: document.getElementById('date-category').value,
        status: document.getElementById('date-status').value,
      };
      if (!body.title) return;
      if (isEdit) await api('/dates/' + idea.id, { method: 'PUT', body });
      else await api('/dates', { method: 'POST', body });
      closeModal(); renderDates();
    };
    if (isEdit) {
      document.getElementById('date-delete').onclick = async () => {
        await api('/dates/' + idea.id, { method: 'DELETE' });
        closeModal(); renderDates();
      };
    }
  }

  // ─── PLANER (v2.0 — Post-it Calendar Board) ───
  let planerDate = new Date();

  async function renderPlaner() {
    const content = document.getElementById('content');
    const year = planerDate.getFullYear();
    const month = planerDate.getMonth() + 1;

    const [events, cycleEntries, prediction] = await Promise.all([
      api(`/events?month=${month}&year=${year}`) || [],
      api('/cycle') || [],
      api('/cycle/predict'),
    ]);

    const monthNames = ['Januar','Februar','Maerz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const dayNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];

    // Build event lookup by date
    const eventDates = {};
    for (const ev of (events || [])) {
      const d = (ev.date_start || '').split('T')[0];
      if (!eventDates[d]) eventDates[d] = [];
      eventDates[d].push(ev);
    }

    // Build cycle date sets
    const cycleDates = new Set();
    for (const e of (cycleEntries || [])) {
      const start = new Date(e.start_date);
      const end = e.end_date ? new Date(e.end_date) : start;
      for (let dd = new Date(start); dd <= end; dd.setDate(dd.getDate() + 1)) {
        cycleDates.add(dd.toISOString().split('T')[0]);
      }
    }

    const predictedDates = new Set();
    const fertileWindow = prediction?.fertile_window;
    if (prediction?.next_predicted && prediction?.avg_duration) {
      const pStart = new Date(prediction.next_predicted);
      for (let i = 0; i < prediction.avg_duration; i++) {
        const dd = new Date(pStart);
        dd.setDate(dd.getDate() + i);
        predictedDates.add(dd.toISOString().split('T')[0]);
      }
    }

    // Fertile + ovulation dates
    const fertileDates = new Set();
    let ovulationDate = null;
    if (fertileWindow) {
      const fs = new Date(fertileWindow.start);
      const fe = new Date(fertileWindow.end);
      ovulationDate = fertileWindow.end;
      for (let dd = new Date(fs); dd <= fe; dd.setDate(dd.getDate() + 1)) {
        fertileDates.add(dd.toISOString().split('T')[0]);
      }
    }

    let html = '<div class="content-inner">';
    html += `<div class="flex-between mb-16">
      <button class="btn-secondary" id="planer-prev">\u2190</button>
      <span style="font-weight:600">${monthNames[month - 1]} ${year}</span>
      <button class="btn-secondary" id="planer-next">\u2192</button>
    </div>`;

    // Calendar grid
    html += '<div class="calendar-grid">';
    for (const d of dayNames) html += `<div class="cal-header">${d}</div>`;

    const firstDay = new Date(year, month - 1, 1);
    let startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();

    // Pad start
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${prevMonth.getDate() - i}</div></div>`;
    }

    // v2.0: Post-it style day rendering
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === now.toISOString().split('T')[0];
      const dayEvents = eventDates[dateStr] || [];
      const isCycle = cycleDates.has(dateStr);
      const isPredicted = predictedDates.has(dateStr);
      const isFertile = fertileDates.has(dateStr);
      const isOvulation = dateStr === ovulationDate;

      const cls = [
        'cal-day',
        isToday ? 'today' : '',
        isCycle ? 'cycle-period' : '',
        isPredicted && !isCycle ? 'cycle-predicted' : '',
        isFertile ? 'cycle-fertile' : '',
        isOvulation ? 'cycle-ovulation' : ''
      ].filter(Boolean).join(' ');

      let inner = `<div class="cal-day-num">${d}</div>`;
      const maxShow = 2;
      for (let i = 0; i < Math.min(dayEvents.length, maxShow); i++) {
        const ev = dayEvents[i];
        const cat = ev.category || 'default';
        inner += `<div class="cal-postit cat-${cat}" title="${esc(ev.title)}">${esc(ev.title)}</div>`;
      }
      if (dayEvents.length > maxShow) inner += `<div class="cal-day-more">+${dayEvents.length - maxShow}</div>`;

      html += `<div class="${cls}" data-date="${dateStr}">${inner}</div>`;
    }

    // Pad end
    const totalCells = startDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
    }

    html += '</div>';

    // Event list below calendar
    html += '<div class="section-title">Events</div>';
    if (events && events.length) {
      for (const e of events) {
        const cat = e.category || 'default';
        html += `<div class="card" data-event-id="${e.id}" style="border-left:3px solid ${getCatColor(cat)}">
          <div class="card-row"><div class="card-title">${esc(e.title)}</div></div>
          <div class="card-subtitle">${formatDate(e.date_start)}${e.location ? ' · ' + esc(e.location) : ''}${e.linked_date_idea_id ? ' · 🔗' : ''}</div>
        </div>`;
      }
    } else {
      html += '<div class="empty-state">Keine Events in diesem Monat</div>';
    }
    html += '</div>';
    content.innerHTML = html;

    // Nav
    document.getElementById('planer-prev').onclick = () => { planerDate.setMonth(planerDate.getMonth() - 1); renderPlaner(); };
    document.getElementById('planer-next').onclick = () => { planerDate.setMonth(planerDate.getMonth() + 1); renderPlaner(); };

    // Click event cards to edit
    content.querySelectorAll('[data-event-id]').forEach(card => {
      card.onclick = () => {
        const ev = (events || []).find(e => e.id === parseInt(card.dataset.eventId));
        if (ev) openEventModal(ev);
      };
    });

    // v2.0: Click day opens Day Detail
    content.querySelectorAll('.cal-day:not(.other-month)').forEach(day => {
      day.onclick = (e) => {
        if (e.target.classList.contains('cal-postit')) return;
        openDayDetail(day.dataset.date);
      };
    });

    showFab(() => openEventModal());
  }

  function getCatColor(cat) {
    const colors = { romantic: '#f87171', adventure: '#fb923c', food: '#34d399', culture: '#60a5fa', chill: '#c084fc' };
    return colors[cat] || 'var(--text3)';
  }

  // v2.0: Day Detail Bottom Sheet
  async function openDayDetail(dateStr) {
    const [events, cycleDay] = await Promise.all([
      api(`/events?date=${dateStr}`),
      api(`/cycle/daily?date=${dateStr}`)
    ]);
    const dateObj = new Date(dateStr + 'T12:00:00');
    const formatted = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let html = `<div class="day-detail-header">
      <div class="day-detail-date">${formatted}</div>
      <div class="flex gap-8">
        <button class="btn-sm" id="day-add-event">+ Event</button>
        <button class="btn-sm" id="day-add-log">+ Log</button>
      </div>
    </div>`;

    // Cycle info banner
    const cd = Array.isArray(cycleDay) ? cycleDay[0] : cycleDay;
    if (cd) {
      const moods = ['','😢','😕','😐','🙂','😊'];
      const symptoms = JSON.parse(cd.symptoms || '[]');
      html += `<div class="day-cycle-banner">
        ${cd.mood ? moods[cd.mood] : ''} ${cd.flow || ''} ${symptoms.length ? '· ' + symptoms.join(', ') : ''}
        ${cd.notes ? '<br><span class="text-sm text-muted">' + esc(cd.notes) + '</span>' : ''}
      </div>`;
    }

    // Events as post-it cards
    const evts = events || [];
    if (evts.length) {
      for (const ev of evts) {
        const cat = ev.category || 'default';
        html += `<div class="day-postit-card cat-${cat}" data-ev-id="${ev.id}">
          <div class="event-title">${esc(ev.title)}</div>
          <div class="event-detail">${ev.location ? '📍 ' + esc(ev.location) : ''} ${ev.sleepover ? '🌙' : ''}</div>
          ${ev.linked_date_idea_id ? '<div class="text-xs text-muted">🔗 Verknuepfte Date-Idee</div>' : ''}
        </div>`;
      }
    } else {
      html += '<div class="empty-state"><div class="empty-icon">📋</div>Noch nichts geplant</div>';
    }

    openModal(html);

    // Wire up buttons after modal is open
    document.getElementById('day-add-event').onclick = () => { closeModal(); openEventModal(null, dateStr); };
    document.getElementById('day-add-log').onclick = () => { closeModal(); openCycleDayModal(dateStr); };

    // Click event card to edit
    document.querySelectorAll('.day-postit-card[data-ev-id]').forEach(card => {
      card.onclick = () => {
        const ev = evts.find(e => e.id === parseInt(card.dataset.evId));
        if (ev) { closeModal(); openEventModal(ev); }
      };
    });
  }

  // v2.0: Event Modal with Date-Idea linking
  async function openEventModal(event, preDate) {
    const isEdit = !!event;
    // Load date ideas for linking
    const ideas = await api('/dates?status=idea') || [];
    const plannedIdeas = await api('/dates?status=planned') || [];
    const allLinkable = [...ideas, ...plannedIdeas];

    let ideaOptions = '<option value="">Keine Verknuepfung</option>';
    for (const idea of allLinkable) {
      const sel = event?.linked_date_idea_id === idea.id ? ' selected' : '';
      ideaOptions += `<option value="${idea.id}"${sel}>${esc(idea.title)} (${idea.category})</option>`;
    }

    openModal(`
      <div class="modal-title">${isEdit ? 'Event bearbeiten' : 'Neues Event'}</div>
      <input type="text" id="ev-title" placeholder="Titel" value="${esc(event?.title || '')}">
      <input type="date" id="ev-start" value="${event?.date_start?.split('T')[0] || preDate || ''}">
      <input type="date" id="ev-end" value="${event?.date_end?.split('T')[0] || ''}">
      <input type="text" id="ev-location" placeholder="Ort" value="${esc(event?.location || '')}">
      <div class="form-group">
        <label>Date-Idee verknuepfen</label>
        <select class="idea-link-select" id="ev-link-idea">${ideaOptions}</select>
      </div>
      <textarea id="ev-notes" placeholder="Notizen">${esc(event?.notes || '')}</textarea>
      <div class="modal-actions">
        ${isEdit ? '<button class="btn-danger" id="ev-delete">Loeschen</button>' : ''}
        ${isEdit ? '<button class="btn-secondary" id="ev-complete">Erledigt ✓</button>' : ''}
        <button class="btn-primary" id="ev-save">${isEdit ? 'Speichern' : 'Erstellen'}</button>
      </div>
    `);

    // Auto-fill title when idea selected
    document.getElementById('ev-link-idea').onchange = function() {
      const idea = allLinkable.find(i => i.id === parseInt(this.value));
      if (idea && !document.getElementById('ev-title').value) {
        document.getElementById('ev-title').value = idea.title;
      }
    };

    document.getElementById('ev-save').onclick = async () => {
      const linkId = document.getElementById('ev-link-idea').value;
      const body = {
        title: document.getElementById('ev-title').value,
        date_start: document.getElementById('ev-start').value,
        date_end: document.getElementById('ev-end').value || null,
        location: document.getElementById('ev-location').value,
        notes: document.getElementById('ev-notes').value,
        linked_date_idea_id: linkId ? parseInt(linkId) : null,
      };
      if (!body.title || !body.date_start) return;
      if (isEdit) await api('/events/' + event.id, { method: 'PUT', body });
      else await api('/events', { method: 'POST', body });
      closeModal(); renderPlaner();
    };
    if (isEdit) {
      document.getElementById('ev-delete').onclick = async () => {
        await api('/events/' + event.id, { method: 'DELETE' });
        closeModal(); renderPlaner();
      };
      document.getElementById('ev-complete').onclick = async () => {
        await api('/events/' + event.id + '/complete', { method: 'PUT' });
        closeModal(); renderPlaner();
      };
    }
  }

  // ─── ZYKLUS (v2.0 — Enhanced Cycle Tracker) ───
  let zyklusDate = new Date();

  async function renderZyklus() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="content-inner"><p class="text-muted">Laden...</p></div>';

    const year = zyklusDate.getFullYear();
    const month = zyklusDate.getMonth() + 1;

    const [entries, daily, prediction] = await Promise.all([
      api('/cycle'),
      api(`/cycle/daily?month=${month}&year=${year}`),
      api('/cycle/predict'),
    ]);

    const monthNames = ['Januar','Februar','Maerz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const dayNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    const phaseNames = { menstruation: 'Menstruation', follikulaer: 'Follikulaerphase', ovulation: 'Ovulation', luteal: 'Lutealphase' };

    let html = '<div class="content-inner">';

    // v2.0: Phase Banner
    if (prediction && prediction.current_phase) {
      const phase = prediction.current_phase;
      html += `<div class="phase-banner phase-${phase}">
        <div class="phase-dot"></div>
        <div class="phase-info">
          <div class="phase-name">${phaseNames[phase] || phase}</div>
          <div class="phase-detail">Zyklustag ${prediction.cycle_day} · Tag ${prediction.phase_day} der Phase</div>
        </div>
      </div>`;
    }

    // v2.0: Stats Grid
    if (prediction && prediction.avg_cycle) {
      html += `<div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${prediction.avg_cycle}</div><div class="stat-label">Zykluslaenge</div></div>
        <div class="stat-card"><div class="stat-value">${prediction.avg_duration}</div><div class="stat-label">Periodenlaenge</div></div>
        <div class="stat-card"><div class="stat-value">${formatDate(prediction.next_predicted)}</div><div class="stat-label">Naechste Periode</div></div>
      </div>`;
    }

    // Calendar navigation
    html += `<div class="flex-between mb-16">
      <button class="btn-secondary" id="zyk-prev">\u2190</button>
      <span style="font-weight:600">${monthNames[month - 1]} ${year}</span>
      <button class="btn-secondary" id="zyk-next">\u2192</button>
    </div>`;

    // Build sets of period and predicted dates
    const periodDates = new Set();
    for (const e of (entries || [])) {
      const start = new Date(e.start_date);
      const end = e.end_date ? new Date(e.end_date) : start;
      for (let dd = new Date(start); dd <= end; dd.setDate(dd.getDate() + 1)) {
        periodDates.add(dd.toISOString().split('T')[0]);
      }
    }

    const predictedDates = new Set();
    const fertileDates = new Set();
    let ovulationDate = null;

    if (prediction && prediction.next_predicted && prediction.avg_duration) {
      const pStart = new Date(prediction.next_predicted);
      for (let i = 0; i < prediction.avg_duration; i++) {
        const dd = new Date(pStart);
        dd.setDate(dd.getDate() + i);
        predictedDates.add(dd.toISOString().split('T')[0]);
      }
    }
    if (prediction?.fertile_window) {
      const fs = new Date(prediction.fertile_window.start);
      const fe = new Date(prediction.fertile_window.end);
      ovulationDate = prediction.fertile_window.end;
      for (let dd = new Date(fs); dd <= fe; dd.setDate(dd.getDate() + 1)) {
        fertileDates.add(dd.toISOString().split('T')[0]);
      }
    }

    // Calendar
    html += '<div class="calendar-grid">';
    for (const d of dayNames) html += `<div class="cal-header">${d}</div>`;

    const firstDay = new Date(year, month - 1, 1);
    let startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    for (let i = startDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${prevMonthDays - i}</div></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;
      const isPeriod = periodDates.has(dateStr);
      const isPredicted = !isPeriod && predictedDates.has(dateStr);
      const isFertile = fertileDates.has(dateStr);
      const isOvulation = dateStr === ovulationDate;

      const cls = [
        'cal-day',
        isToday ? 'today' : '',
        isPeriod ? 'cycle-period' : '',
        isPredicted ? 'cycle-predicted' : '',
        isFertile ? 'cycle-fertile' : '',
        isOvulation ? 'cycle-ovulation' : ''
      ].filter(Boolean).join(' ');

      // Check if day has a daily log
      const dayLog = (daily || []).find(dl => dl.date === dateStr);
      const flowIcons = { none: '', spotting: '◔', light: '◑', medium: '◕', heavy: '●' };
      let inner = `<div class="cal-day-num">${d}</div>`;
      if (dayLog && dayLog.flow && dayLog.flow !== 'none') {
        inner += `<div style="font-size:0.7rem;text-align:center;width:100%">${flowIcons[dayLog.flow] || ''}</div>`;
      }

      html += `<div class="${cls}" data-date="${dateStr}">${inner}</div>`;
    }

    const totalCells = startDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
    }
    html += '</div>';

    // v2.0: Daily Log Form Card
    html += `<div class="section-title">Tages-Log</div>
      <div class="card" id="daily-log-card" style="cursor:pointer">
        <div class="card-title">Heutigen Log eintragen</div>
        <div class="card-subtitle">Flow, Stimmung, Symptome & mehr</div>
      </div>`;

    // v2.0: Log History (last 14 days)
    html += '<div class="section-title">Letzte 14 Tage</div>';
    const sortedDaily = (daily || []).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
    if (sortedDaily.length) {
      for (const dl of sortedDaily) {
        const flowIcons2 = { none: '○', spotting: '◔', light: '◑', medium: '◕', heavy: '●' };
        const moods = ['','😢','😕','😐','🙂','😊'];
        const symptoms = JSON.parse(dl.symptoms || '[]');
        html += `<div class="log-history-item">
          <div class="log-date">${dl.date.slice(5)}</div>
          <div class="log-flow">${flowIcons2[dl.flow] || '○'}</div>
          <div>${dl.mood ? moods[dl.mood] : ''}</div>
          <div class="log-tags">${symptoms.slice(0, 3).map(s => '<span class="log-tag">' + esc(s) + '</span>').join('')}</div>
        </div>`;
      }
    } else {
      html += '<div class="empty-state">Noch keine Logs</div>';
    }

    // Entries
    html += '<div class="section-title">Perioden-Eintraege</div>';
    if (entries && entries.length) {
      for (const e of entries.slice(0, 6)) {
        html += `<div class="card" data-cycle-id="${e.id}">
          <div class="card-row"><div class="card-title">${formatDate(e.start_date)}${e.end_date ? ' – ' + formatDate(e.end_date) : ' (laufend)'}</div></div>
          ${e.notes ? '<div class="card-subtitle">' + esc(e.notes) + '</div>' : ''}
        </div>`;
      }
    } else {
      html += '<div class="empty-state">Noch keine Eintraege</div>';
    }
    html += '</div>';
    content.innerHTML = html;

    document.getElementById('zyk-prev').onclick = () => { zyklusDate.setMonth(zyklusDate.getMonth() - 1); renderZyklus(); };
    document.getElementById('zyk-next').onclick = () => { zyklusDate.setMonth(zyklusDate.getMonth() + 1); renderZyklus(); };

    // Click day for daily log
    content.querySelectorAll('.cal-day:not(.other-month)').forEach(day => {
      day.onclick = () => openCycleDayModal(day.dataset.date);
    });

    // Click today's log card
    document.getElementById('daily-log-card').onclick = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      openCycleDayModal(todayStr);
    };

    // Click entry to edit
    content.querySelectorAll('[data-cycle-id]').forEach(card => {
      card.onclick = () => {
        const entry = entries.find(e => e.id === parseInt(card.dataset.cycleId));
        if (entry) openCycleEntryModal(entry);
      };
    });

    showFab(() => openCycleEntryModal());
  }

  function openCycleEntryModal(entry) {
    const isEdit = !!entry;
    openModal(`
      <div class="modal-title">${isEdit ? 'Eintrag bearbeiten' : 'Neue Periode'}</div>
      <input type="date" id="cyc-start" value="${entry?.start_date || ''}">
      <input type="date" id="cyc-end" value="${entry?.end_date || ''}">
      <textarea id="cyc-notes" placeholder="Notizen">${esc(entry?.notes || '')}</textarea>
      <div class="modal-actions">
        ${isEdit ? '<button class="btn-danger" id="cyc-delete">Loeschen</button>' : ''}
        <button class="btn-primary" id="cyc-save">${isEdit ? 'Speichern' : 'Erstellen'}</button>
      </div>
    `);
    document.getElementById('cyc-save').onclick = async () => {
      const body = {
        start_date: document.getElementById('cyc-start').value,
        end_date: document.getElementById('cyc-end').value || null,
        notes: document.getElementById('cyc-notes').value,
      };
      if (!body.start_date) return;
      if (isEdit) await api('/cycle/' + entry.id, { method: 'PUT', body });
      else await api('/cycle', { method: 'POST', body });
      closeModal(); renderZyklus();
    };
    if (isEdit) {
      document.getElementById('cyc-delete').onclick = async () => {
        await api('/cycle/' + entry.id, { method: 'DELETE' });
        closeModal(); renderZyklus();
      };
    }
  }

  // v2.0: Cycle Daily Log Modal (extended fields)
  function openCycleDayModal(dateStr) {
    const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

    openModal(`
      <div class="modal-title">Tages-Log: ${dateLabel}</div>
      <div class="form-group"><label>Flow</label>
        <div class="flow-row" id="mFlow">
          ${[['none','Kein','\u25CB'],['spotting','Schmier','\u25D4'],['light','Leicht','\u25D1'],['medium','Mittel','\u25D5'],['heavy','Stark','\u25CF']].map(([v,l,i]) =>
            '<button class="flow-btn" data-val="'+v+'"><span class="flow-icon">'+i+'</span>'+l+'</button>'
          ).join('')}
        </div>
      </div>
      <div class="form-group"><label>Stimmung</label>
        <div class="emoji-row" id="mMood">
          ${['😢','😕','😐','🙂','😊'].map((e,i) => '<button class="emoji-btn" data-val="'+(i+1)+'">'+e+'</button>').join('')}
        </div>
      </div>
      <div class="form-group"><label>Symptome</label>
        <div class="symptom-tags" id="mSymptoms">
          ${['Kraempfe','Kopfschmerzen','Blaehungen','Brustspannen','Rueckenschmerzen','Uebelkeit','Muedigkeit','Stimmungsschwankung','Heisshunger','Schlafprobleme','Schwindel','Hautunreinheiten'].map(s =>
            '<button class="symptom-tag">'+s+'</button>'
          ).join('')}
        </div>
      </div>
      <div class="form-group"><label>Zervixschleim</label>
        <div class="cm-row" id="mCM">
          ${[['dry','Trocken'],['sticky','Klebrig'],['creamy','Cremig'],['watery','Waessrig'],['egg_white','Spinnbar']].map(([v,l]) =>
            '<button class="cm-btn" data-val="'+v+'">'+l+'</button>'
          ).join('')}
        </div>
      </div>
      <div class="form-group"><label>Energie (1-5)</label>
        <div class="emoji-row" id="mEnergy">
          ${['🔋','🔋','🔋','🔋','🔋'].map((e,i) => '<button class="emoji-btn" data-val="'+(i+1)+'" style="font-size:16px">'+(i+1)+'</button>').join('')}
        </div>
      </div>
      <div class="form-group"><label>Notizen</label><textarea class="form-input" id="mCycleNotes" rows="2"></textarea></div>
      <div class="modal-actions">
        <button class="btn-accent" id="modal-cycle-save">Speichern</button>
        <button class="btn-ghost" id="modal-cycle-cancel">Abbrechen</button>
      </div>
    `);

    let modalFlow = null;
    let modalMood = null;
    let modalCM = null;
    let modalEnergy = null;

    const mc = document.getElementById('modal-content');

    // Flow buttons
    mc.querySelectorAll('#mFlow .flow-btn').forEach(btn => {
      btn.onclick = () => {
        mc.querySelectorAll('#mFlow .flow-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        modalFlow = btn.dataset.val;
      };
    });

    // Mood buttons
    mc.querySelectorAll('#mMood .emoji-btn').forEach(btn => {
      btn.onclick = () => {
        mc.querySelectorAll('#mMood .emoji-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        modalMood = parseInt(btn.dataset.val);
      };
    });

    // Symptom toggles
    mc.querySelectorAll('#mSymptoms .symptom-tag').forEach(btn => {
      btn.onclick = () => btn.classList.toggle('selected');
    });

    // CM buttons
    mc.querySelectorAll('#mCM .cm-btn').forEach(btn => {
      btn.onclick = () => {
        mc.querySelectorAll('#mCM .cm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        modalCM = btn.dataset.val;
      };
    });

    // Energy buttons
    mc.querySelectorAll('#mEnergy .emoji-btn').forEach(btn => {
      btn.onclick = () => {
        mc.querySelectorAll('#mEnergy .emoji-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        modalEnergy = parseInt(btn.dataset.val);
      };
    });

    document.getElementById('modal-cycle-save').onclick = async () => {
      const symptoms = [...mc.querySelectorAll('#mSymptoms .symptom-tag.selected')].map(b => b.textContent);
      await api('/cycle/daily', { method: 'POST', body: {
        date: dateStr,
        flow: modalFlow,
        mood: modalMood,
        symptoms: symptoms,
        cervical_mucus: modalCM,
        energy_level: modalEnergy,
        notes: document.getElementById('mCycleNotes').value
      }});
      closeModal();
      if (currentView === 'planer') renderPlaner();
      else renderZyklus();
    };

    document.getElementById('modal-cycle-cancel').onclick = closeModal;
  }

  // ─── WATCHLIST ─────────────────────────────────
  let watchFilter = { type: '', status: '' };

  async function renderWatch() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="content-inner"><p class="text-muted">Laden...</p></div>';

    let url = '/watchlist?';
    if (watchFilter.type) url += 'type=' + watchFilter.type + '&';
    if (watchFilter.status) url += 'status=' + watchFilter.status;
    const items = await api(url) || [];

    const types = ['', 'movie', 'series', 'docu'];
    const typeLabels = { '': 'Alle', movie: 'Filme', series: 'Serien', docu: 'Dokus' };
    const statuses = ['', 'want', 'watching', 'watched'];
    const statusLabels = { '': 'Alle', want: 'Wollen', watching: 'Schauen', watched: 'Gesehen' };

    let html = '<div class="content-inner">';
    html += '<div class="chip-row">';
    for (const t of types) {
      html += `<button class="chip${watchFilter.type === t ? ' active' : ''}" data-type="${t}">${typeLabels[t]}</button>`;
    }
    html += '</div>';
    html += '<div class="chip-row">';
    for (const s of statuses) {
      html += `<button class="chip${watchFilter.status === s ? ' active' : ''}" data-status="${s}">${statusLabels[s]}</button>`;
    }
    html += '</div>';

    if (items.length) {
      for (const item of items) {
        html += `<div class="card" data-watch-id="${item.id}">
          <div class="card-row">
            <div class="card-title">${esc(item.title)}</div>
            <span class="badge badge-${item.status}">${item.status}</span>
          </div>
          <div class="card-subtitle">${esc(item.type)}${item.platform ? ' · ' + esc(item.platform) : ''}</div>
          <div class="card-row mt-8">
            <span class="text-small">Dion: ${item.rating_dion != null ? item.rating_dion + '/10' : '–'}</span>
            <span class="text-small">Linda: ${item.rating_linda != null ? item.rating_linda + '/10' : '–'}</span>
          </div>
        </div>`;
      }
    } else {
      html += '<div class="empty-state">Keine Eintraege gefunden</div>';
    }
    html += '</div>';
    content.innerHTML = html;

    // Type filter
    content.querySelectorAll('.chip[data-type]').forEach(chip => {
      chip.onclick = () => { watchFilter.type = chip.dataset.type; renderWatch(); };
    });
    // Status filter
    content.querySelectorAll('.chip[data-status]').forEach(chip => {
      chip.onclick = () => { watchFilter.status = chip.dataset.status; renderWatch(); };
    });
    // Card click → edit
    content.querySelectorAll('[data-watch-id]').forEach(card => {
      card.onclick = () => {
        const item = items.find(i => i.id === parseInt(card.dataset.watchId));
        if (item) openWatchModal(item);
      };
    });

    showFab(() => openWatchModal());
  }

  function openWatchModal(item) {
    const isEdit = !!item;
    openModal(`
      <div class="modal-title">${isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</div>
      <input type="text" id="watch-title" placeholder="Titel" value="${esc(item?.title || '')}">
      <select id="watch-type">
        <option value="movie"${item?.type === 'movie' ? ' selected' : ''}>Film</option>
        <option value="series"${item?.type === 'series' ? ' selected' : ''}>Serie</option>
        <option value="docu"${item?.type === 'docu' ? ' selected' : ''}>Doku</option>
      </select>
      <input type="text" id="watch-platform" placeholder="Plattform" value="${esc(item?.platform || '')}">
      <select id="watch-status">
        <option value="want"${item?.status === 'want' ? ' selected' : ''}>Wollen</option>
        <option value="watching"${item?.status === 'watching' ? ' selected' : ''}>Schauen</option>
        <option value="watched"${item?.status === 'watched' ? ' selected' : ''}>Gesehen</option>
      </select>
      ${isEdit ? `
      <div class="section-title">Bewertungen</div>
      <label class="text-small text-muted">Dion (1-10)</label>
      <input type="number" id="watch-rdion" min="1" max="10" value="${item?.rating_dion || ''}">
      <label class="text-small text-muted">Linda (1-10)</label>
      <input type="number" id="watch-rlinda" min="1" max="10" value="${item?.rating_linda || ''}">
      ` : ''}
      <textarea id="watch-notes" placeholder="Notizen">${esc(item?.notes || '')}</textarea>
      <div class="modal-actions">
        ${isEdit ? '<button class="btn-danger" id="watch-delete">Loeschen</button>' : ''}
        <button class="btn-primary" id="watch-save">${isEdit ? 'Speichern' : 'Erstellen'}</button>
      </div>
    `);
    document.getElementById('watch-save').onclick = async () => {
      const body = {
        title: document.getElementById('watch-title').value,
        type: document.getElementById('watch-type').value,
        platform: document.getElementById('watch-platform').value,
        status: document.getElementById('watch-status').value,
        notes: document.getElementById('watch-notes').value,
      };
      if (isEdit) {
        const rdion = document.getElementById('watch-rdion')?.value;
        const rlinda = document.getElementById('watch-rlinda')?.value;
        if (rdion) body.rating_dion = parseFloat(rdion);
        if (rlinda) body.rating_linda = parseFloat(rlinda);
      }
      if (!body.title) return;
      if (isEdit) await api('/watchlist/' + item.id, { method: 'PUT', body });
      else await api('/watchlist', { method: 'POST', body });
      closeModal(); renderWatch();
    };
    if (isEdit) {
      document.getElementById('watch-delete').onclick = async () => {
        await api('/watchlist/' + item.id, { method: 'DELETE' });
        closeModal(); renderWatch();
      };
    }
  }

  // ─── Init ──────────────────────────────────────
  init();
})();
