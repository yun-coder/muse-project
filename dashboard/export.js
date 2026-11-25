// Token Radar export: download the board as CSV and the watchlist as JSON.
// Reads window.RADAR only; it never changes a row, a rank or a value.
(function () {
  'use strict';

  // The CSV columns, in order. Score is the model's raw implied value in
  // dollars; the last column is the same number formatted for reading.
  var COLUMNS = ['rank', 'protocol', 'category', 'chain', 'tvl_usd', 'mcap_usd', 'multiple', 'score', 'implied_value'];

  // One CSV cell: quote when it holds a comma, a quote or a newline, and
  // double any quote inside.
  function csvCell(value) {
    if (value === null || value === undefined) return '';
    var s = String(value);
    if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // A dollar amount in short form, the same shape the board shows.
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  // The first chain a row names, or an empty string when it names none.
  function firstChain(row) {
    return row.chains && row.chains.length > 0 ? row.chains[0] : '';
  }

  // One board row as a CSV record, in COLUMNS order. A pre-token row has no
  // market cap, so its mcap cell is empty.
  function rowToRecord(row) {
    return [
      row.rank,
      row.name,
      row.category || 'Other',
      firstChain(row),
      row.tvl_usd,
      row.mcap_usd === null || row.mcap_usd === undefined ? '' : row.mcap_usd,
      row.base_multiple,
      row.implied_value_usd,
      fmtUsd(row.implied_value_usd)
    ];
  }

  // The whole board as CSV text: one header row and one record per row, in
  // rank order.
  function boardToCsv(rows) {
    var lines = [COLUMNS.join(',')];
    rows.slice().sort(function (a, b) { return a.rank - b.rank; }).forEach(function (row) {
      lines.push(rowToRecord(row).map(csvCell).join(','));
    });
    return lines.join('\n') + '\n';
  }

  // The watchlist rows: the board's rows at or above the watchlist floor.
  // The board carries 40 watchlist rows above the floor and 160 early rows
  // below it, so this filter is exact for this board.
  function watchlistRows(rows, floorUsd) {
    return rows.filter(function (r) { return r.tvl_usd >= floorUsd; }).sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
  }

  // One watchlist row as a plain JSON object, with the fields the CSV
  // carries plus the row's age and seven-day change.
  function watchlistEntry(row) {
    return {
      rank: row.rank,
      slug: row.slug,
      name: row.name,
      category: row.category,
      chain: firstChain(row),
      tvl_usd: row.tvl_usd,
      mcap_usd: row.mcap_usd,
      multiple: row.base_multiple,
      score: row.implied_value_usd,
      implied_value: fmtUsd(row.implied_value_usd),
      change_7d: row.change_7d,
      age_days: row.age_days
    };
  }

  // The watchlist as JSON text: the snapshot date, the floor, and one entry
  // per watchlist row.
  function watchlistToJson(rows, floorUsd, asOf) {
    var doc = { as_of: asOf, floor_usd: floorUsd, count: 0, rows: [] };
    doc.rows = watchlistRows(rows, floorUsd).map(watchlistEntry);
    doc.count = doc.rows.length;
    return JSON.stringify(doc, null, 2) + '\n';
  }

  // Offer `text` as a download under `filename`, then release the object URL.
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // The file stem for a download: token-radar plus the snapshot date.
  function stem(asOf) {
    return 'token-radar-' + (asOf || 'snapshot');
  }

  // The export panel: two buttons and a note on what each file holds.
  function renderExportPanel(data) {
    var rows = data.rows;
    var watch = watchlistRows(rows, data.floor_usd);
    var panel = document.createElement('section');
    panel.className = 'panel export';
    var h = document.createElement('h2');
    h.textContent = 'Export the board';
    panel.appendChild(h);
    var p = document.createElement('p');
    p.className = 'sub';
    p.textContent = 'Download the ranked board or the watchlist as a file. The numbers are the same ones the board shows; nothing is recomputed.';
    panel.appendChild(p);
    var csvBtn = document.createElement('button');
    csvBtn.className = 'button primary';
    csvBtn.type = 'button';
    csvBtn.textContent = 'Download board as CSV (' + rows.length + ' rows)';
    csvBtn.addEventListener('click', function () { download(stem(data.as_of) + '-board.csv', boardToCsv(rows), 'text/csv'); });
    panel.appendChild(csvBtn);
    var jsonBtn = document.createElement('button');
    jsonBtn.className = 'button';
    jsonBtn.type = 'button';
    jsonBtn.textContent = 'Download watchlist as JSON (' + watch.length + ' rows)';
    jsonBtn.addEventListener('click', function () { download(stem(data.as_of) + '-watchlist.json', watchlistToJson(rows, data.floor_usd, data.as_of), 'application/json'); });
    panel.appendChild(jsonBtn);
    return panel;
  }

  window.RadarExport = {
    columns: COLUMNS,
    boardToCsv: boardToCsv,
    watchlistRows: watchlistRows,
    watchlistToJson: watchlistToJson,
    renderExportPanel: renderExportPanel
  };
})();
