/* Field Tools — UI. Core math lives in core.js. */
(function () {
  'use strict';
  const C = window.Core;
  const $ = id => document.getElementById(id);
  const fmt = C.format;
  const parse = C.parse;
  const bridge = window.fieldTools || null;   // provided by the Electron preload

  // ---------------------------------------------------------------- settings
  const KEY = 'fieldtools.settings.v1';
  const defaults = {
    tool: 'vfd',
    vfd: { sMin: 0, sMax: 100, pct: 75, gpm: 300 },
    scale: { inMin: 4, inMax: 20, outMin: 0, outMax: 100, input: 12 },
    ohm: { E: '24', I: '', R: '250', P: '', order: ['R', 'E'], units: { E: 'V', I: 'mA', R: 'Ω', P: 'W' } },
    mv: { kgPerL: C.Catalog.Density.find('lb/gal').toBase(8.34), factorUnit: 'lb/gal', from: 'gal', to: 'lb', value: '1' },
    units: { category: 'Length', pairs: {}, value: '1' },
  };
  let S;
  try { S = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { S = Object.assign({}, defaults); }
  for (const k of Object.keys(defaults)) if (typeof defaults[k] === 'object') S[k] = Object.assign({}, defaults[k], S[k]);
  S.ohm.units = Object.assign({}, defaults.ohm.units, S.ohm.units);
  let saveTimer = null;
  function flush() { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ } }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // ---------------------------------------------------------------- helpers
  function on(el, ev, fn) { el.addEventListener(ev, fn); }
  function setInvalid(el, bad) { el.classList.toggle('invalid', !!bad); }
  function option(value, text, selected) {
    const o = document.createElement('option'); o.value = value; o.textContent = text; if (selected) o.selected = true; return o;
  }
  function fillUnitSelect(sel, units, selected, groups, short) {
    sel.innerHTML = '';
    if (groups) {
      for (const [label, list] of groups) {
        const g = document.createElement('optgroup'); g.label = label;
        list.forEach(u => g.appendChild(option(u.symbol, `${u.symbol}  ·  ${u.name}`, u.symbol === selected)));
        sel.appendChild(g);
      }
    } else units.forEach(u => sel.appendChild(option(u.symbol, short ? u.symbol : `${u.symbol}  ·  ${u.name}`, u.symbol === selected)));
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Select the whole value when an input gets focus, so typing replaces it.
  document.addEventListener('focusin', e => { if (e.target.matches('input.num')) setTimeout(() => e.target.select(), 0); });

  // ---------------------------------------------------------------- status bar
  const statusEl = $('status');
  const status = { vfd: '', scale: '', ohm: '', mv: '', units: '' };
  function setStatus(tool, html) {
    status[tool] = html;
    if (tool === S.tool) statusEl.innerHTML = html;
  }
  function copyStatus() {
    const text = statusEl.textContent.trim();
    if (!text) return;
    const done = () => {
      const old = statusEl.innerHTML;
      statusEl.innerHTML = '<span class="flash">Copied: ' + esc(text) + '</span>';
      setTimeout(() => { statusEl.innerHTML = status[S.tool]; }, 1300);
      void old;
    };
    if (bridge) { bridge.copy(text); done(); }
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
  }
  on($('copyBtn'), 'click', copyStatus);

  // ---------------------------------------------------------------- navigation
  const TOOLS = {
    vfd:   { label: 'Flow & Signals · Tool 1', title: 'VFD Speed → <span>GPM</span>', sub: 'reverse-solve min / max GPM from a known speed and flow reading', accent: '#00d4aa', rgb: '0,212,170' },
    scale: { label: 'Flow & Signals · Tool 2', title: 'Analog <span>Scaling</span>', sub: 'linear scaling between a raw signal and engineering units', accent: '#a078f0', rgb: '160,120,240' },
    ohm:   { label: 'Electrical · Tool 3', title: "Ohm's Law <span>PIE</span>", sub: 'power · current · voltage · resistance — enter any two', accent: '#f0c040', rgb: '240,192,64' },
    mv:    { label: 'Conversions · Tool 4', title: 'Mass <span>↔</span> Volume', sub: 'convert gallons, litres and pounds using a weight factor', accent: '#f0c040', rgb: '240,192,64' },
    units: { label: 'Conversions · Tool 5', title: 'Unit <span>Converter</span>', sub: 'length · mass · volume · temperature · pressure · flow · and more', accent: '#4c9aff', rgb: '76,154,255' },
  };
  const ORDER = ['vfd', 'scale', 'ohm', 'mv', 'units'];
  function setTool(tool) {
    if (!TOOLS[tool]) tool = 'vfd';
    S.tool = tool; save();
    const t = TOOLS[tool];
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + tool));
    $('tLabel').textContent = t.label;
    $('tTitle').innerHTML = t.title;
    $('tSub').textContent = t.sub;
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--accent-rgb', t.rgb);
    statusEl.innerHTML = status[tool];
    document.title = 'Field Tools — ' + $('tTitle').textContent;
  }
  document.querySelectorAll('.nav-btn').forEach(b => on(b, 'click', () => setTool(b.dataset.tool)));

  // ================================================================ 1. VFD -> GPM
  const V = { sMin: $('vScaleMin'), sMax: $('vScaleMax'), pct: $('vPct'), gpm: $('vGpm'), slider: $('vSlider') };
  V.sMin.value = S.vfd.sMin; V.sMax.value = S.vfd.sMax; V.pct.value = S.vfd.pct; V.gpm.value = S.vfd.gpm;
  function vfdCalc() {
    const pct = parseFloat(V.pct.value), gpm = parseFloat(V.gpm.value);
    const sMin = parseFloat(V.sMin.value), sMax = parseFloat(V.sMax.value);
    Object.assign(S.vfd, { sMin: V.sMin.value, sMax: V.sMax.value, pct: V.pct.value, gpm: V.gpm.value }); save();

    const okRange = !isNaN(sMin) && !isNaN(sMax) && sMax > sMin;
    V.slider.min = okRange ? sMin : 0; V.slider.max = okRange ? sMax : 100;
    if (!isNaN(pct)) V.slider.value = pct;
    $('vSliderVal').textContent = isNaN(pct) ? '—' : fmt(pct) + '%';
    $('vGL').textContent = isNaN(sMin) ? '?' : fmt(sMin) + '%';
    $('vGR').textContent = isNaN(sMax) ? '?' : fmt(sMax) + '%';
    $('vOutMinL').textContent = 'at ' + (isNaN(sMin) ? '?' : fmt(sMin) + '%');
    $('vOutMaxL').textContent = 'at ' + (isNaN(sMax) ? '?' : fmt(sMax) + '%');

    const r = C.vfdSolve(pct, gpm, sMin, sMax);
    if (r.error) {
      $('vOutMin').textContent = '—'; $('vOutMax').textContent = '—';
      $('vGFill').style.width = '0%'; $('vGC').textContent = '—';
      $('vErr').textContent = r.error; $('vFormula').innerHTML = '';
      setStatus('vfd', r.error);
      return;
    }
    $('vErr').textContent = '';
    $('vOutMin').textContent = fmt(r.minGpm);
    $('vOutMax').textContent = fmt(r.maxGpm);
    $('vGFill').style.width = (r.position * 100) + '%';
    $('vGC').textContent = `${fmt(gpm)} GPM @ ${fmt(pct)}%`;
    $('vFormula').innerHTML =
      `<span class="hip">range</span> = <span class="tx">${fmt(sMax)}</span>% − <span class="tx">${fmt(sMin)}</span>% = <span class="tx">${fmt(r.range)}</span>%<br>` +
      `<span class="hip">position</span> = ( <span class="tx">${fmt(pct)}</span>% − <span class="tx">${fmt(sMin)}</span>% ) ÷ <span class="tx">${fmt(r.range)}</span>% = <span class="tx">${fmt(r.position)}</span><br>` +
      `<span class="hi2">max GPM</span> = <span class="tx">${fmt(gpm)}</span> ÷ <span class="tx">${fmt(r.position)}</span> = <span class="hi2">${fmt(r.maxGpm)}</span> GPM<br>` +
      `<span class="hi">min GPM</span> = <span class="hi">${fmt(r.minGpm)}</span> GPM &nbsp;(at ${fmt(sMin)}%)`;
    setStatus('vfd', `Range <b>${fmt(r.minGpm)} – ${fmt(r.maxGpm)} GPM</b> &nbsp;(${fmt(gpm)} GPM at ${fmt(pct)}% of ${fmt(sMin)}–${fmt(sMax)}%)`);
  }
  on(V.slider, 'input', () => { V.pct.value = V.slider.value; vfdCalc(); });
  [V.pct, V.gpm, V.sMin, V.sMax].forEach(el => on(el, 'input', vfdCalc));

  // ================================================================ 2. Analog scaling
  const SC = { inMin: $('sInMin'), inMax: $('sInMax'), outMin: $('sOutMin'), outMax: $('sOutMax'), inp: $('sIn'), out: $('sOut'), slider: $('sSlider'), preset: $('sPreset') };
  let scaleSource = 'in';
  SC.preset.appendChild(option('', 'Input 1 range preset…'));
  C.ScalePresets.forEach((p, i) => SC.preset.appendChild(option(String(i), p.name)));
  SC.inMin.value = fmt(+S.scale.inMin); SC.inMax.value = fmt(+S.scale.inMax);
  SC.outMin.value = fmt(+S.scale.outMin); SC.outMax.value = fmt(+S.scale.outMax);
  SC.inp.value = fmt(+S.scale.input);

  function matchPreset(a, b) {
    const i = C.ScalePresets.findIndex(p => p.min === a && p.max === b);
    SC.preset.value = i >= 0 ? String(i) : '';
  }
  function scaleCalc() {
    [SC.inMin, SC.inMax, SC.outMin, SC.outMax, SC.inp, SC.out].forEach(el => setInvalid(el, false));
    const inMin = parse(SC.inMin.value), inMax = parse(SC.inMax.value), outMin = parse(SC.outMin.value), outMax = parse(SC.outMax.value);
    const clear = msg => {
      (scaleSource === 'in' ? SC.out : SC.inp).value = '';
      $('sCardOut').textContent = '—'; $('sCardPct').textContent = '—'; $('sGFill').style.width = '0%';
      $('sFormula').innerHTML = msg ? `<span class="warn">${esc(msg)}</span>` : ''; $('sTable').innerHTML = '';
      setStatus('scale', esc(msg || ''));
    };
    for (const [el, v] of [[SC.inMin, inMin], [SC.inMax, inMax], [SC.outMin, outMin], [SC.outMax, outMax]])
      if (Number.isNaN(v)) { setInvalid(el, true); return clear('Enter the input and output min and max'); }
    matchPreset(inMin, inMax);
    Object.assign(S.scale, { inMin, inMax, outMin, outMax }); save();
    const s = C.linearScale(inMin, inMax, outMin, outMax);
    if (!s.canScale) { setInvalid(SC.inMax, true); return clear("Input 1 min and max can't be equal"); }
    if (scaleSource === 'out' && !s.canUnscale) { setInvalid(SC.outMax, true); return clear("Input 2 min and max can't be equal"); }

    const lo = Math.min(inMin, inMax), hi = Math.max(inMin, inMax);
    $('sSlMin').textContent = fmt(lo); $('sSlMax').textContent = fmt(hi);
    $('sGL').textContent = fmt(inMin); $('sGR').textContent = fmt(inMax);
    $('sCardOutL').textContent = `range ${fmt(outMin)} – ${fmt(outMax)}`;

    const srcEl = scaleSource === 'in' ? SC.inp : SC.out;
    const dstEl = scaleSource === 'in' ? SC.out : SC.inp;
    let input, output;
    if (!srcEl.value.trim()) { dstEl.value = ''; return clear(''); }
    const v = parse(srcEl.value);
    if (Number.isNaN(v)) { setInvalid(srcEl, true); return clear('Enter a number'); }
    if (scaleSource === 'in') { input = v; output = s.scale(v); } else { output = v; input = s.unscale(v); }
    dstEl.value = fmt(scaleSource === 'in' ? output : input);
    S.scale.input = input; save();

    // slider
    SC.slider.min = lo; SC.slider.max = hi; SC.slider.step = (hi - lo) / 1000;
    SC.slider.value = Math.min(hi, Math.max(lo, input));
    const pct = (input - inMin) / (inMax - inMin) * 100;
    $('sPctVal').textContent = fmt(Math.round(pct * 10) / 10) + '%';
    $('sCardOut').textContent = fmt(output);
    $('sCardPct').textContent = fmt(Math.round(pct * 100) / 100) + '%';
    $('sCardPctL').textContent = `${fmt(input)} of ${fmt(inMin)} – ${fmt(inMax)}`;
    $('sGFill').style.width = Math.min(100, Math.max(0, pct)) + '%';
    $('sGC').textContent = `${fmt(input)} → ${fmt(output)}`;

    const off = s.offset, sign = off < 0 ? '−' : '+';
    const offTxt = Math.abs(off) < 1e-12 ? '' : ` ${sign} ${fmt(Math.abs(off))}`;
    const eqn = `Input 2 = ${fmt(s.slope)} × Input 1${offTxt}`;
    const inRange = s.isInputInRange(input);
    $('sFormula').innerHTML =
      `<span class="hip">slope</span> = ( <span class="tx">${fmt(outMax)}</span> − <span class="tx">${fmt(outMin)}</span> ) ÷ ( <span class="tx">${fmt(inMax)}</span> − <span class="tx">${fmt(inMin)}</span> ) = <span class="tx">${fmt(s.slope)}</span><br>` +
      `<span class="hip">offset</span> = <span class="tx">${fmt(outMin)}</span> − <span class="tx">${fmt(s.slope)}</span> × <span class="tx">${fmt(inMin)}</span> = <span class="tx">${fmt(off)}</span><br>` +
      `<span class="hi2">${esc(eqn)}</span>` +
      (inRange ? '' : `<br><span class="warn">⚠ Input 1 is outside ${fmt(inMin)} – ${fmt(inMax)}, so the result is extrapolated</span>`);

    // span check table
    let rows = '<tr><th>% span</th><th>Input 1</th><th>Input 2</th></tr>';
    for (const p of [0, 25, 50, 75, 100]) {
      const x = inMin + (inMax - inMin) * p / 100;
      rows += `<tr class="${Math.abs(pct - p) < 0.05 ? 'hl' : ''}"><td class="m">${p}%</td><td>${fmt(x)}</td><td>${fmt(s.scale(x))}</td></tr>`;
    }
    $('sTable').innerHTML = rows;
    setStatus('scale', inRange ? `<b>${esc(eqn)}</b> &nbsp;·&nbsp; ${fmt(input)} → ${fmt(output)}`
      : `⚠ Input 1 outside ${fmt(inMin)} – ${fmt(inMax)}, extrapolated &nbsp;·&nbsp; ${esc(eqn)}`);
  }
  [SC.inMin, SC.inMax, SC.outMin, SC.outMax].forEach(el => on(el, 'input', scaleCalc));
  on(SC.inp, 'input', () => { scaleSource = 'in'; scaleCalc(); });
  on(SC.out, 'input', () => { scaleSource = 'out'; scaleCalc(); });
  on(SC.preset, 'change', () => {
    const p = C.ScalePresets[+SC.preset.value];
    if (!p) return;
    SC.inMin.value = fmt(p.min); SC.inMax.value = fmt(p.max);
    scaleSource = 'in';
    SC.inp.value = fmt((p.min + p.max) / 2);
    scaleCalc();
  });
  on(SC.slider, 'input', () => {
    const range = +SC.slider.max - +SC.slider.min;
    if (!(range > 0)) return;
    // Round to about a thousandth of the span: 4–20 gives 12.34, 0–27648 gives whole counts.
    const decimals = Math.min(10, Math.max(0, 3 - Math.floor(Math.log10(range))));
    SC.inp.value = fmt(Number((+SC.slider.value).toFixed(decimals)));
    scaleSource = 'in'; scaleCalc();
  });
  function scaleSwap() {
    [SC.inMin.value, SC.outMin.value] = [SC.outMin.value, SC.inMin.value];
    [SC.inMax.value, SC.outMax.value] = [SC.outMax.value, SC.inMax.value];
    [SC.inp.value, SC.out.value] = [SC.out.value, SC.inp.value];
    scaleSource = 'in'; scaleCalc();
  }
  on($('sSwapRanges'), 'click', scaleSwap);

  // ================================================================ 3. Ohm's law (PIE)
  const OHM_UNITS = {
    E: [['mV', 1e-3], ['V', 1], ['kV', 1e3]],
    I: [['µA', 1e-6], ['mA', 1e-3], ['A', 1]],
    R: [['Ω', 1], ['kΩ', 1e3], ['MΩ', 1e6]],
    P: [['mW', 1e-3], ['W', 1], ['kW', 1e3], ['hp', 745.699872]],
  };
  const OHM_NAMES = { E: 'Voltage', I: 'Current', R: 'Resistance', P: 'Power' };
  const OK = ['E', 'I', 'R', 'P'];
  const O = {}; const OU = {};
  for (const k of OK) {
    O[k] = $('o' + k); OU[k] = $('oU' + k);
    OHM_UNITS[k].forEach(([sym]) => OU[k].appendChild(option(sym, sym, sym === S.ohm.units[k])));
    O[k].value = S.ohm[k] || '';
  }
  let ohmOrder = (S.ohm.order || []).filter(k => OK.includes(k));
  const factor = k => (OHM_UNITS[k].find(u => u[0] === OU[k].value) || OHM_UNITS[k][1])[1];

  // PIE wheel drawing
  const WHEEL = { P: [270, 360], I: [0, 90], E: [90, 180], R: [180, 270] };
  function polar(r, deg) { const a = (deg - 90) * Math.PI / 180; return [80 + r * Math.cos(a), 80 + r * Math.sin(a)]; }
  function arc(r1, r2, a1, a2) {
    const [x1, y1] = polar(r2, a1), [x2, y2] = polar(r2, a2), [x3, y3] = polar(r1, a2), [x4, y4] = polar(r1, a1);
    return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`;
  }
  function drawWheel(knowns, used) {
    const svg = $('oWheel');
    svg.setAttribute('viewBox', '0 0 160 160');
    let h = '';
    for (const x of OK) {
      const [a1, a2] = WHEEL[x];
      const isKnown = knowns.includes(x);
      const isCalc = used && used[x];
      const fill = isKnown ? '#00d4aa' : isCalc ? '#f0c040' : '#1b1f26';
      h += `<path d="${arc(0.01, 27, a1, a2)}" fill="${fill}" stroke="#0b0d10" stroke-width="1.5"/>`;
      const [lx, ly] = polar(15, (a1 + a2) / 2);
      h += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-family="Share Tech Mono" font-size="12" fill="${isKnown || isCalc ? '#0b0d10' : '#6a6f84'}">${x}</text>`;
      const forms = Object.values(C.OhmFormulas[x]);
      forms.forEach((f, i) => {
        const b1 = a1 + i * 30, b2 = b1 + 30;
        const active = used && used[x] === f;
        h += `<path d="${arc(29, 78, b1, b2)}" fill="${active ? 'rgba(240,192,64,0.22)' : '#13161b'}" stroke="${active ? '#f0c040' : '#252830'}" stroke-width="1"/>`;
        const [tx, ty] = polar(53, (b1 + b2) / 2);
        h += `<text x="${tx}" y="${ty + 2.5}" text-anchor="middle" font-family="Share Tech Mono" font-size="7.2" fill="${active ? '#f0c040' : '#6a6f84'}">${f.replace(/ /g, '')}</text>`;
      });
    }
    svg.innerHTML = h;
  }

  function ohmCalc() {
    OK.forEach(k => setInvalid(O[k], false));
    S.ohm.units = Object.fromEntries(OK.map(k => [k, OU[k].value]));
    const valid = ohmOrder.filter(k => O[k].value.trim() && !Number.isNaN(parse(O[k].value)));
    const knowns = valid.slice(0, 2);
    OK.forEach(k => { if (!knowns.includes(k)) O[k].classList.add('result'); else O[k].classList.remove('result'); });
    const bad = ohmOrder.find(k => O[k].value.trim() && Number.isNaN(parse(O[k].value)));
    const reset = msg => {
      OK.forEach(k => {
        if (!knowns.includes(k) && k !== bad) O[k].value = '';
        $('oC' + k).textContent = knowns.includes(k) ? fmt(parse(O[k].value)) : '—';
        $('oC' + k + 'u').textContent = OU[k].value + (knowns.includes(k) ? ' · given' : '');
        $('oC' + k).parentElement.className = 'out-card ' + (knowns.includes(k) ? 'teal' : '');
        $('oTag' + k).textContent = knowns.includes(k) ? 'given' : '';
      });
      $('oErr').textContent = msg; $('oFormula').innerHTML = '<span class="tx">P = I × E</span> &nbsp;and&nbsp; <span class="tx">E = I × R</span><br>Fill in any two of the four boxes.';
      drawWheel(knowns, null);
      setStatus('ohm', esc(msg || 'Enter any two of volts, amps, ohms and watts'));
      persistOhm();
    };
    if (bad) { setInvalid(O[bad], true); return reset('Enter a number'); }
    if (knowns.length < 2) return reset('');
    const known = {};
    knowns.forEach(k => { known[k] = parse(O[k].value) * factor(k); });
    const r = C.ohmSolve(known);
    if (r.error) { knowns.forEach(k => setInvalid(O[k], true)); return reset(r.error); }
    $('oErr').textContent = '';
    let lines = '';
    for (const k of OK) {
      const shown = r[k] / factor(k);
      const isKnown = knowns.includes(k);
      if (!isKnown) O[k].value = fmt(shown);
      $('oC' + k).textContent = fmt(shown);
      $('oC' + k + 'u').textContent = OU[k].value + (isKnown ? ' · given' : ' · calculated');
      $('oC' + k).parentElement.className = 'out-card ' + (isKnown ? 'teal' : 'yellow');
      $('oTag' + k).textContent = isKnown ? 'given' : 'calculated';
      if (!isKnown) lines += `<span class="hi2">${k}</span> = ${esc(r.used[k])} = <span class="hi2">${fmt(shown)} ${esc(OU[k].value)}</span><br>`;
    }
    lines += `<span class="hi">given</span> ${knowns.map(k => `${k} = <span class="tx">${fmt(parse(O[k].value))} ${esc(OU[k].value)}</span>`).join(', ')}`;
    $('oFormula').innerHTML = lines;
    drawWheel(knowns, r.used);
    setStatus('ohm', OK.map(k => `${k} <b>${fmt(r[k] / factor(k))} ${esc(OU[k].value)}</b>`).join(' &nbsp;·&nbsp; '));
    persistOhm();
  }
  function persistOhm() {
    OK.forEach(k => { S.ohm[k] = ohmOrder.slice(0, 2).includes(k) ? O[k].value : ''; });
    S.ohm.order = ohmOrder.slice(0, 2); save();
  }
  OK.forEach(k => {
    on(O[k], 'input', () => {
      ohmOrder = ohmOrder.filter(x => x !== k);
      if (O[k].value.trim()) ohmOrder.unshift(k);
      // Only the two most recent entries count; clear the rest so they get recalculated.
      ohmCalc();
    });
    on(OU[k], 'change', ohmCalc);
  });
  on($('oClear'), 'click', () => { OK.forEach(k => { O[k].value = ''; }); ohmOrder = []; ohmCalc(); O.E.focus(); });
  on($('oLoop'), 'click', () => {
    OK.forEach(k => { O[k].value = ''; });
    OU.E.value = 'V'; OU.I.value = 'mA'; OU.R.value = 'Ω'; OU.P.value = 'mW';
    O.I.value = '20'; O.R.value = '250'; ohmOrder = ['R', 'I']; ohmCalc();
  });

  // ================================================================ 4. Mass <-> Volume
  const MV = C.MassVolume, Dens = C.Catalog.Density;
  const M = { factor: $('mFactor'), fUnit: $('mFactorUnit'), from: $('mFrom'), to: $('mTo'), fromU: $('mFromU'), toU: $('mToU') };
  let mvSource = 'from';
  fillUnitSelect(M.fUnit, Dens.units, S.mv.factorUnit, null, true);
  const mvGroups = () => [['Volume', C.Catalog.Volume.units], ['Mass', C.Catalog.Mass.units]];
  fillUnitSelect(M.fromU, null, S.mv.from, mvGroups());
  fillUnitSelect(M.toU, null, S.mv.to, mvGroups());
  const fUnit = () => Dens.find(M.fUnit.value) || Dens.find('lb/gal');
  M.factor.value = fmt(fUnit().fromBase(S.mv.kgPerL));
  M.from.value = S.mv.value;

  const matGrid = $('mMaterials');
  C.Materials.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'mat'; b.dataset.i = i;
    b.innerHTML = `<span class="mn">${esc(m.name)}</span><span class="mv">${m.lbPerGal.toFixed(2)} lb/gal</span>`;
    on(b, 'click', () => { S.mv.kgPerL = m.kgPerL; M.factor.value = fmt(fUnit().fromBase(m.kgPerL)); mvCalc(); });
    matGrid.appendChild(b);
  });

  function mvCalc() {
    [M.factor, M.from, M.to].forEach(el => setInvalid(el, false));
    S.mv.factorUnit = M.fUnit.value; S.mv.from = M.fromU.value; S.mv.to = M.toU.value;
    const shown = parse(M.factor.value);
    const kgPerL = fUnit().toBase(shown);
    const from = MV.find(M.fromU.value), to = MV.find(M.toU.value);
    const fail = msg => {
      (mvSource === 'from' ? M.to : M.from).value = '';
      $('mCard').textContent = '—'; $('mCardU').textContent = ''; $('mFormula').innerHTML = msg ? `<span class="warn">${esc(msg)}</span>` : ''; $('mTable').innerHTML = '';
      setStatus('mv', esc(msg)); save();
    };
    const mat = C.Materials.findIndex(m => Math.abs(m.kgPerL - kgPerL) < 1e-9 * Math.max(1, kgPerL));
    matGrid.querySelectorAll('.mat').forEach(b => b.classList.toggle('on', +b.dataset.i === mat));
    if (!(kgPerL > 0)) { setInvalid(M.factor, true); return fail('Weight factor must be a positive number'); }
    S.mv.kgPerL = kgPerL;
    const conv = (v, a, b) => MV.convert(v, a, b, kgPerL);
    const src = mvSource === 'from' ? M.from : M.to, dst = mvSource === 'from' ? M.to : M.from;
    if (!src.value.trim()) { dst.value = ''; return fail(''); }
    const v = parse(src.value);
    if (Number.isNaN(v)) { setInvalid(src, true); return fail('Enter a number'); }
    const fromVal = mvSource === 'from' ? v : conv(v, to, from);
    const toVal = mvSource === 'from' ? conv(v, from, to) : v;
    dst.value = fmt(mvSource === 'from' ? toVal : fromVal);
    S.mv.value = fmt(fromVal);

    const toIsMass = MV.isMass(to), fromIsMass = MV.isMass(from);
    $('mCardL').textContent = toIsMass ? 'Weight' : 'Volume';
    $('mCard').textContent = fmt(toVal);
    $('mCardU').textContent = `${to.symbol}  ·  from ${fmt(fromVal)} ${from.symbol}`;
    const rate = conv(1, from, to);
    const usesFactor = fromIsMass !== toIsMass;
    const matName = mat >= 0 ? ` (${C.Materials[mat].name})` : '';
    $('mFormula').innerHTML =
      `<span class="hi2">1 ${esc(from.symbol)}</span> = <span class="tx">${fmt(rate)} ${esc(to.symbol)}</span><br>` +
      `<span class="hi">${fmt(fromVal)} ${esc(from.symbol)}</span> × ${fmt(rate)} = <span class="hi2">${fmt(toVal)} ${esc(to.symbol)}</span><br>` +
      (usesFactor ? `weight factor <span class="tx">${fmt(shown)} ${esc(fUnit().symbol)}</span>${esc(matName)}`
                  : `<span class="warn">${toIsMass ? 'Mass to mass' : 'Volume to volume'}: weight factor not used</span>`);

    const amounts = [1, 5, 10, 55, 100, 275, 330, 1000];
    const note = a => from.symbol === 'gal' ? ({ 55: 'drum', 275: 'tote', 330: 'tote' }[a] || '') : '';
    let rows = `<tr><th>${esc(from.symbol)}</th><th>${esc(to.symbol)}</th><th></th></tr>`;
    for (const a of amounts) rows += `<tr class="${Math.abs(a - fromVal) < 1e-9 ? 'hl' : ''}"><td>${fmt(a)}</td><td>${fmt(conv(a, from, to))}</td><td class="m">${note(a)}</td></tr>`;
    $('mTable').innerHTML = rows;
    setStatus('mv', `<b>${fmt(fromVal)} ${esc(from.symbol)} = ${fmt(toVal)} ${esc(to.symbol)}</b>` +
      (usesFactor ? ` &nbsp;·&nbsp; at ${fmt(shown)} ${esc(fUnit().symbol)}${esc(matName)}` : ''));
    save();
  }
  on(M.factor, 'input', mvCalc);
  on(M.fUnit, 'change', () => { M.factor.value = fmt(fUnit().fromBase(S.mv.kgPerL)); mvCalc(); });
  on(M.from, 'input', () => { mvSource = 'from'; mvCalc(); });
  on(M.to, 'input', () => { mvSource = 'to'; mvCalc(); });
  on(M.fromU, 'change', mvCalc);
  on(M.toU, 'change', mvCalc);
  function mvSwap() {
    [M.fromU.value, M.toU.value] = [M.toU.value, M.fromU.value];
    [M.from.value, M.to.value] = [M.to.value, M.from.value];
    mvSource = 'from'; mvCalc();
  }
  on($('mSwap'), 'click', mvSwap);

  // ================================================================ 5. Unit converter
  const UC = { from: $('uFrom'), to: $('uTo'), fromU: $('uFromU'), toU: $('uToU') };
  let unitSource = 'from';
  let cat = C.Catalog.find(S.units.category) || C.Catalog.Length;
  UC.from.value = S.units.value;
  const chipBox = $('uCats');
  C.Catalog.all.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = c.name; b.dataset.cat = c.name;
    on(b, 'click', () => setCategory(c));
    chipBox.appendChild(b);
  });
  function setCategory(c) {
    cat = c; S.units.category = c.name;
    chipBox.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.cat === c.name));
    $('uCatName').textContent = c.name;
    const pair = S.units.pairs[c.name] || [];
    const f = c.find(pair[0]) || c.defaultFrom, t = c.find(pair[1]) || c.defaultTo;
    fillUnitSelect(UC.fromU, c.units, f.symbol);
    fillUnitSelect(UC.toU, c.units, t.symbol);
    if (unitSource !== 'from') unitSource = 'from';
    if (!UC.from.value.trim()) UC.from.value = '1';
    unitsCalc();
  }
  function unitsCalc() {
    [UC.from, UC.to].forEach(el => setInvalid(el, false));
    const from = cat.find(UC.fromU.value), to = cat.find(UC.toU.value);
    S.units.pairs[cat.name] = [from.symbol, to.symbol];
    const src = unitSource === 'from' ? UC.from : UC.to, dst = unitSource === 'from' ? UC.to : UC.from;
    const fail = msg => { dst.value = ''; $('uFormula').innerHTML = msg ? `<span class="warn">${esc(msg)}</span>` : ''; $('uTable').innerHTML = ''; setStatus('units', esc(msg)); save(); };
    if (!src.value.trim()) return fail('');
    const v = parse(src.value);
    if (Number.isNaN(v)) { setInvalid(src, true); return fail('Enter a number'); }
    const fromVal = unitSource === 'from' ? v : C.convert(v, to, from);
    const toVal = unitSource === 'from' ? C.convert(v, from, to) : v;
    dst.value = fmt(unitSource === 'from' ? toVal : fromVal);
    S.units.value = fmt(fromVal);

    // rate: linear units show "1 a = x b"; offset units (temperature) show the equation.
    const k = C.convert(1, from, to) - C.convert(0, from, to), b0 = C.convert(0, from, to);
    const offset = Math.abs(b0) > 1e-12;
    const rateTxt = offset
      ? `${to.symbol} = ${from.symbol} × ${fmt(k)} ${b0 < 0 ? '−' : '+'} ${fmt(Math.abs(b0))}`
      : `1 ${from.symbol} = ${fmt(k)} ${to.symbol}`;
    $('uFormula').innerHTML = `<span class="hi2">${esc(rateTxt)}</span><br>` +
      (offset ? '' : `<span class="tx">1 ${esc(to.symbol)}</span> = ${fmt(C.convert(1, to, from))} ${esc(from.symbol)}<br>`) +
      `<span class="hi">${fmt(fromVal)} ${esc(from.symbol)}</span> = <span class="hi2">${fmt(toVal)} ${esc(to.symbol)}</span>`;

    let rows = '<tr><th>Unit</th><th></th><th>Value</th></tr>';
    for (const u of cat.units) {
      const cls = ['click', u === to ? 'sel' : '', u === from ? 'src' : ''].join(' ');
      rows += `<tr class="${cls}" data-sym="${esc(u.symbol)}"><td>${esc(u.name)}</td><td class="m">${esc(u.symbol)}</td><td class="v">${fmt(C.convert(fromVal, from, u))}</td></tr>`;
    }
    $('uTable').innerHTML = rows;
    const main = `${fmt(fromVal)} ${from.symbol} = ${fmt(toVal)} ${to.symbol}`;
    setStatus('units', `<b>${esc(main)}</b>` + (main === rateTxt ? '' : ` &nbsp;·&nbsp; ${esc(rateTxt)}`));
    save();
  }
  on($('uTable'), 'click', e => {
    const tr = e.target.closest('tr[data-sym]');
    if (!tr || tr.dataset.sym === UC.fromU.value) return;
    UC.toU.value = tr.dataset.sym; unitSource = 'from'; unitsCalc();
  });
  on(UC.from, 'input', () => { unitSource = 'from'; unitsCalc(); });
  on(UC.to, 'input', () => { unitSource = 'to'; unitsCalc(); });
  on(UC.fromU, 'change', unitsCalc);
  on(UC.toU, 'change', unitsCalc);
  function unitsSwap() {
    [UC.fromU.value, UC.toU.value] = [UC.toU.value, UC.fromU.value];
    [UC.from.value, UC.to.value] = [UC.to.value, UC.from.value];
    unitSource = 'from'; unitsCalc();
  }
  on($('uSwap'), 'click', unitsSwap);

  // ---------------------------------------------------------------- keyboard
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key >= '1' && e.key <= String(ORDER.length)) {
      e.preventDefault(); setTool(ORDER[+e.key - 1]); return;
    }
    if (e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      ({ scale: scaleSwap, mv: mvSwap, units: unitsSwap }[S.tool] || (() => {}))();
      return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) { e.preventDefault(); copyStatus(); return; }
    if (e.key === 'Escape' && bridge) { bridge.hide(); }
  });

  // ---------------------------------------------------------------- always on top
  const pin = $('pinBtn');
  if (bridge) {
    bridge.getTop().then(v => pin.classList.toggle('on', !!v));
    bridge.onTopChanged(v => pin.classList.toggle('on', !!v));
    on(pin, 'click', () => bridge.setTop(!pin.classList.contains('on')));
  } else pin.style.display = 'none';

  // ---------------------------------------------------------------- start
  vfdCalc(); scaleCalc(); ohmCalc(); mvCalc(); setCategory(cat);
  setTool(S.tool);
})();
