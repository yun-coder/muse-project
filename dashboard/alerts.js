// Token Radar watchlist alerts: set a threshold per watchlist protocol and
// see which ones the current snapshot trips. Reads window.RADAR only; it
// never changes a row, a rank or a value. Settings live in localStorage, so
// they survive a reload and never leave the browser.
(function () {
  'use strict';

  var STORAGE_KEY = 'token-radar-alerts-v1';

  // A dollar amount in short form, the same shape the board shows.
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  // A percent with its sign, or 'n/a' when there is no figure.
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  // The watchlist rows: the board's rows at or above the watchlist floor.
  // The board carries 40 watchlist rows above the floor and 160 early rows
  // below it, so this filter is exact for this board.
  function watchlistRows(rows, floorUsd) {
    return rows.filter(function (r) { return r.tvl_usd >= floorUsd; }).sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
  }

  // The stored settings: an object keyed by slug, each value
  // { change: number|null, score: number|null }. A missing or broken stored
  // value reads as no thresholds at all.
  function loadSettings() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    } catch (e) {
      return {};
    }
  }

  // Write the settings back to localStorage. A browser that refuses storage
  // simply keeps the settings for this page load.
  function saveSettings(settings) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // Storage unavailable: the settings still apply until the page closes.
    }
  }

  // A number typed into a threshold box, or null when the box is empty or
  // holds something that is not a number.
  function readNumber(input) {
    var v = input.value.trim();
    if (v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  // Whether a row trips one threshold, and the reason in plain words.
  // A positive change threshold trips on a rise at least that big; a negative
  // one trips on a fall at least that deep. A score threshold trips when the
  // row's implied value reaches it. A row with no seven-day change never
  // trips on change.
  function reasonsFor(row, setting) {
    var reasons = [];
    if (setting && setting.change !== null && setting.change !== undefined) {
      var t = setting.change;
      if (row.change_7d !== null && row.change_7d !== undefined) {
        if (t > 0 && row.change_7d >= t) reasons.push('7-day change ' + fmtPct(row.change_7d) + ' is at least +' + t + '%');
        if (t < 0 && row.change_7d <= t) reasons.push('7-day change ' + fmtPct(row.change_7d) + ' is at most ' + t + '%');
      }
    }
    if (setting && setting.score !== null && setting.score !== undefined) {
      if (row.implied_value_usd >= setting.score) reasons.push('implied value ' + fmtUsd(row.implied_value_usd) + ' reached ' + fmtUsd(setting.score));
    }
    return reasons;
  }

  // Every watchlist row that trips at least one threshold, strongest first,
  // each with the reasons it tripped.
  function evaluate(rows, floorUsd, settings) {
    var out = [];
    watchlistRows(rows, floorUsd).forEach(function (row) {
      var reasons = reasonsFor(row, settings[row.slug]);
      if (reasons.length > 0) out.push({ row: row, reasons: reasons });
    });
    out.sort(function (a, b) { return b.row.implied_value_usd - a.row.implied_value_usd; });
    return out;
  }

  // The triggered-alerts list: one entry per tripped protocol, with its
  // reasons. An empty list says so in one line instead of showing nothing.
  function renderTriggeredList(triggered) {
    var wrap = document.createElement('div');
    wrap.className = 'alerts-triggered';
    if (triggered.length === 0) {
      var none = document.createElement('p');
      none.className = 'sub';
      none.textContent = 'No alert is triggered by this snapshot. Set a threshold below and the protocols that meet it will show up here.';
      wrap.appendChild(none);
      return wrap;
    }
    var ul = document.createElement('ul');
    triggered.forEach(function (item) {
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.textContent = item.row.name + ' (rank ' + item.row.rank + ')';
      li.appendChild(b);
      var span = document.createElement('span');
      span.textContent = ': ' + item.reasons.join('; ');
      li.appendChild(span);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  // One settings row: the protocol's name and two number boxes, one for the
  // seven-day change and one for the implied value. Editing a box saves the
  // settings at once and refreshes the triggered list in place.
  function settingsRow(row, settings, refresh) {
    var tr = document.createElement('tr');
    var name = document.createElement('td');
    name.textContent = row.name;
    tr.appendChild(name);
    var changeCell = document.createElement('td');
    var changeInput = document.createElement('input');
    changeInput.type = 'number';
    changeInput.step = 'any';
    changeInput.setAttribute('aria-label', 'Change threshold for ' + row.name);
    changeInput.placeholder = 'e.g. 10 or -5';
    var saved = settings[row.slug] || {};
    if (saved.change !== null && saved.change !== undefined) changeInput.value = String(saved.change);
    changeInput.addEventListener('change', function () {
      var next = settings[row.slug] || {};
      next.change = readNumber(changeInput);
      if (next.change === null && (next.score === null || next.score === undefined)) delete settings[row.slug];
      else settings[row.slug] = next;
      saveSettings(settings);
      refresh();
    });
    changeCell.appendChild(changeInput);
    tr.appendChild(changeCell);
    var scoreCell = document.createElement('td');
    var scoreInput = document.createElement('input');
    scoreInput.type = 'number';
    scoreInput.step = 'any';
    scoreInput.setAttribute('aria-label', 'Score threshold for ' + row.name);
    scoreInput.placeholder = 'e.g. 100000000';
    if (saved.score !== null && saved.score !== undefined) scoreInput.value = String(saved.score);
    scoreInput.addEventListener('change', function () {
      var next = settings[row.slug] || {};
      next.score = readNumber(scoreInput);
      if (next.score === null && (next.change === null || next.change === undefined)) delete settings[row.slug];
      else settings[row.slug] = next;
      saveSettings(settings);
      refresh();
    });
    scoreCell.appendChild(scoreInput);
    tr.appendChild(scoreCell);
    return tr;
  }

  // The alerts panel: a badge with the triggered count, the triggered list,
  // and the settings table for all 40 watchlist protocols.
  function renderAlertsPanel(data) {
    var settings = loadSettings();
    var panel = document.createElement('section');
    panel.className = 'panel alerts';
    var head = document.createElement('div');
    head.className = 'alerts-head';
    var h = document.createElement('h2');
    h.textContent = 'Watchlist alerts';
    head.appendChild(h);
    var badge = document.createElement('span');
    badge.className = 'badge';
    head.appendChild(badge);
    panel.appendChild(head);
    var note = document.createElement('p');
    note.className = 'sub';
    note.textContent = 'Pre-token protocols have no market cap, so the change threshold watches the seven-day change and the score threshold watches the implied value. Thresholds are kept in this browser only.';
    panel.appendChild(note);
    var listSlot = document.createElement('div');
    panel.appendChild(listSlot);
    function refresh() {
      var triggered = evaluate(data.rows, data.floor_usd, settings);
      badge.textContent = triggered.length + ' triggered';
      listSlot.textContent = '';
      listSlot.appendChild(renderTriggeredList(triggered));
    }
    refresh();
    var table = document.createElement('table');
    table.className = 'alerts-settings';
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    ['Protocol', 'Change % (7d)', 'Score (implied value $)'].forEach(function (label) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    watchlistRows(data.rows, data.floor_usd).forEach(function (row) {
      tbody.appendChild(settingsRow(row, settings, refresh));
    });
    table.appendChild(tbody);
    panel.appendChild(table);
    var clear = document.createElement('button');
    clear.className = 'button';
    clear.type = 'button';
    clear.textContent = 'Clear all thresholds';
    clear.addEventListener('click', function () {
      Object.keys(settings).forEach(function (key) { delete settings[key]; });
      saveSettings(settings);
      refresh();
      panel.querySelectorAll('input[type="number"]').forEach(function (input) { input.value = ''; });
    });
    panel.appendChild(clear);
    return panel;
  }

  window.RadarAlerts = {
    storageKey: STORAGE_KEY,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    evaluate: evaluate,
    renderAlertsPanel: renderAlertsPanel
  };
})();
