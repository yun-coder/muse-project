// Token Radar board search extras: a chain filter and a row limit to sit
// beside the search box the board already has. Reads window.RADAR only; it
// never changes a row, a rank or a value.
(function () {
  'use strict';

  // Every chain the board rows name, in alphabetical order.
  function chainOptions(rows) {
    var seen = {};
    rows.forEach(function (row) {
      (row.chains || []).forEach(function (chain) { seen[chain] = true; });
    });
    return Object.keys(seen).sort();
  }

  // Whether a row runs on a chain, for the chain filter. 'all' keeps every
  // row; any other value keeps only rows that name that chain.
  function matchesChain(row, chain) {
    if (chain === 'all') return true;
    return (row.chains || []).indexOf(chain) >= 0;
  }

  // The chain dropdown: All chains plus one option per chain on the board.
  // Picking one calls `onChange` with the chosen chain.
  function renderChainFilter(rows, current, onChange) {
    var select = document.createElement('select');
    select.setAttribute('aria-label', 'Filter by chain');
    var all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'All chains';
    select.appendChild(all);
    chainOptions(rows).forEach(function (chain) {
      var option = document.createElement('option');
      option.value = chain;
      option.textContent = chain;
      if (chain === current) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function () { onChange(select.value); });
    return select;
  }

  // The row-limit dropdown: the whole board, or only the strongest 50 or 10
  // rows after sorting. Picking one calls `onChange` with the chosen limit,
  // 0 meaning no limit.
  function renderLimitSelect(current, onChange) {
    var select = document.createElement('select');
    select.setAttribute('aria-label', 'Limit rows shown');
    [['0', 'All rows'], ['50', 'Top 50'], ['10', 'Top 10']].forEach(function (pair) {
      var option = document.createElement('option');
      option.value = pair[0];
      option.textContent = pair[1];
      if (Number(pair[0]) === current) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function () { onChange(Number(select.value)); });
    return select;
  }

  window.RadarSearch = {
    chainOptions: chainOptions,
    matchesChain: matchesChain,
    renderChainFilter: renderChainFilter,
    renderLimitSelect: renderLimitSelect
  };
})();
