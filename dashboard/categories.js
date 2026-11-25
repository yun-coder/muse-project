// Token Radar category comparison: one row per category, computed read-only
// from the board data the page already holds. Nothing here changes a row, a
// rank or a value; it only groups and summarises what the board shows.
(function () {
  'use strict';

  // A dollar amount in short form, the same shape the board shows.
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  // The median of a list of numbers, or null when the list is empty.
  function median(values) {
    if (values.length === 0) return null;
    var s = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // A category's name for grouping: rows without one count as Other.
  function categoryOf(row) {
    return row.category || 'Other';
  }

  // The board rows grouped by category, each group in rank order.
  function groupRows(rows) {
    var groups = {};
    rows.forEach(function (row) {
      var key = categoryOf(row);
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }

  // The live-token rows grouped by category, for the median mcap/TVL.
  // Pre-token rows have no market cap, so the median mcap/TVL can only come
  // from the protocols in the same category that already trade.
  function groupLive(live) {
    var groups = {};
    (live || []).forEach(function (row) {
      var key = categoryOf(row);
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }

  // A category's median mcap/TVL from its live-token rows, or null when no
  // live row in the category carries both a market cap and a TVL.
  function liveMedianMcapTvl(liveRows) {
    var ratios = [];
    liveRows.forEach(function (row) {
      if (row.mcap_usd !== null && row.mcap_usd !== undefined && row.tvl_usd > 0) ratios.push(row.mcap_usd / row.tvl_usd);
    });
    return median(ratios);
  }

  // One category's summary: how many board rows it holds, the median of
  // their calibrated multiples, the strongest row by implied value, the
  // total TVL, and the live median mcap/TVL of the same category.
  function categoryStats(name, rows, liveGroups) {
    var multiples = rows.map(function (r) { return r.base_multiple; });
    var top = rows.slice().sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; })[0];
    var totalTvl = 0;
    rows.forEach(function (r) { totalTvl += r.tvl_usd; });
    return {
      category: name,
      count: rows.length,
      medianMultiple: median(multiples),
      medianMcapTvl: liveMedianMcapTvl(liveGroups[name] || []),
      topName: top ? top.name : 'n/a',
      topImplied: top ? top.implied_value_usd : null,
      totalTvl: totalTvl
    };
  }

  // Every category on the board, summarised and sorted by total TVL,
  // strongest first.
  function summarize(rows, live) {
    var groups = groupRows(rows);
    var liveGroups = groupLive(live);
    var out = Object.keys(groups).map(function (name) {
      return categoryStats(name, groups[name], liveGroups);
    });
    out.sort(function (a, b) { return b.totalTvl - a.totalTvl; });
    return out;
  }

  // A multiple with two decimals, or 'n/a' when there is none.
  function fmtMultiple(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2);
  }

  // A mcap/TVL ratio with two decimals, or 'n/a' when the category has no
  // live row to measure it from.
  function fmtRatio(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2);
  }

  // The categories table: one row per category with its count, median
  // multiple, live median mcap/TVL, top protocol and total TVL.
  function renderCategoriesTable(data) {
    var stats = summarize(data.rows, data.live);
    var section = document.createElement('section');
    section.className = 'panel categories';
    var h = document.createElement('h2');
    h.textContent = 'Categories compared';
    section.appendChild(h);
    var p = document.createElement('p');
    p.className = 'sub';
    p.textContent = stats.length + ' categories on this board. The median multiple is the median of the board rows\' calibrated multiples; the live median mcap/TVL comes from the same category\'s protocols that already trade, and reads n/a where none do.';
    section.appendChild(p);
    var wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    ['Category', 'Protocols', 'Median multiple', 'Live median mcap/TVL', 'Top protocol', 'Total TVL'].forEach(function (label) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    stats.forEach(function (s) {
      var tr = document.createElement('tr');
      var name = document.createElement('td');
      var b = document.createElement('b');
      b.textContent = s.category;
      name.appendChild(b);
      tr.appendChild(name);
      var count = document.createElement('td');
      count.className = 'num';
      count.textContent = String(s.count);
      tr.appendChild(count);
      var mult = document.createElement('td');
      mult.className = 'num';
      mult.textContent = fmtMultiple(s.medianMultiple);
      tr.appendChild(mult);
      var ratio = document.createElement('td');
      ratio.className = 'num';
      ratio.textContent = fmtRatio(s.medianMcapTvl);
      tr.appendChild(ratio);
      var top = document.createElement('td');
      top.textContent = s.topName + ' (' + fmtUsd(s.topImplied) + ')';
      tr.appendChild(top);
      var tvl = document.createElement('td');
      tvl.className = 'num';
      tvl.textContent = fmtUsd(s.totalTvl);
      tr.appendChild(tvl);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
  }

  window.RadarCategories = {
    median: median,
    summarize: summarize,
    renderCategoriesTable: renderCategoriesTable
  };
})();
