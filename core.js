/* Field Tools — conversion core (ported from UnitConverter.Core, C#).
   No UI code here, so it can be tested with plain Node. */
(function (root) {
  'use strict';

  function unit(name, symbol, toBase, fromBase) {
    return { name, symbol, toBase, fromBase };
  }
  function linear(name, symbol, factor) {
    return unit(name, symbol, v => v * factor, v => v / factor);
  }
  function category(name, units, defaultFrom, defaultTo) {
    const c = { name, units };
    c.find = s => units.find(u => u.symbol === s) || null;
    c.defaultFrom = c.find(defaultFrom);
    c.defaultTo = c.find(defaultTo);
    if (!c.defaultFrom || !c.defaultTo) throw new Error('Bad default unit in ' + name);
    return c;
  }

  // Factors are exact definitions where one exists (1 in = 0.0254 m, 1 lb = 0.45359237 kg).
  const Length = category('Length', [
    linear('Micrometre', 'µm', 1e-6), linear('Millimetre', 'mm', 1e-3), linear('Centimetre', 'cm', 1e-2),
    linear('Metre', 'm', 1), linear('Kilometre', 'km', 1e3), linear('Inch', 'in', 0.0254),
    linear('Foot', 'ft', 0.3048), linear('Yard', 'yd', 0.9144), linear('Mile', 'mi', 1609.344),
    linear('Nautical mile', 'nmi', 1852),
  ], 'cm', 'in');

  const Mass = category('Mass', [
    linear('Milligram', 'mg', 1e-6), linear('Gram', 'g', 1e-3), linear('Kilogram', 'kg', 1),
    linear('Tonne', 't', 1e3), linear('Ounce', 'oz', 0.028349523125), linear('Pound', 'lb', 0.45359237),
    linear('Stone', 'st', 6.35029318), linear('US ton', 'ton', 907.18474),
  ], 'kg', 'lb');

  // Base unit: kelvin.
  const Temperature = category('Temperature', [
    unit('Celsius', '°C', c => c + 273.15, k => k - 273.15),
    unit('Fahrenheit', '°F', f => (f - 32) * 5 / 9 + 273.15, k => (k - 273.15) * 9 / 5 + 32),
    unit('Kelvin', 'K', k => k, k => k),
  ], '°C', '°F');

  // Base unit: litre.
  const Volume = category('Volume', [
    linear('Millilitre', 'mL', 1e-3), linear('Litre', 'L', 1), linear('Cubic metre', 'm³', 1e3),
    linear('Teaspoon (US)', 'tsp', 0.00492892159375), linear('Tablespoon (US)', 'tbsp', 0.01478676478125),
    linear('Fluid ounce (US)', 'fl oz', 0.0295735295625), linear('Cup (US)', 'cup', 0.2365882365),
    linear('Pint (US)', 'pt', 0.473176473), linear('Quart (US)', 'qt', 0.946352946),
    linear('Gallon (US)', 'gal', 3.785411784), linear('Gallon (UK)', 'gal UK', 4.54609),
    linear('Cubic inch', 'in³', 0.016387064), linear('Cubic foot', 'ft³', 28.316846592),
  ], 'L', 'gal');

  // Base unit: square metre.
  const Area = category('Area', [
    linear('Square centimetre', 'cm²', 1e-4), linear('Square metre', 'm²', 1), linear('Hectare', 'ha', 1e4),
    linear('Square kilometre', 'km²', 1e6), linear('Square inch', 'in²', 0.00064516),
    linear('Square foot', 'ft²', 0.09290304), linear('Square yard', 'yd²', 0.83612736),
    linear('Acre', 'ac', 4046.8564224), linear('Square mile', 'mi²', 2589988.110336),
  ], 'm²', 'ft²');

  // Base unit: metre per second.
  const Speed = category('Speed', [
    linear('Metre per second', 'm/s', 1), linear('Kilometre per hour', 'km/h', 1 / 3.6),
    linear('Mile per hour', 'mph', 0.44704), linear('Knot', 'kn', 1852 / 3600),
    linear('Foot per second', 'ft/s', 0.3048),
  ], 'km/h', 'mph');

  // Base unit: second. Month and year use the Gregorian average (365.2425 days).
  const Time = category('Time', [
    linear('Millisecond', 'ms', 1e-3), linear('Second', 's', 1), linear('Minute', 'min', 60),
    linear('Hour', 'h', 3600), linear('Day', 'd', 86400), linear('Week', 'wk', 604800),
    linear('Month (avg)', 'mo', 2629746), linear('Year (avg)', 'yr', 31556952),
  ], 'h', 'min');

  // Base unit: byte.
  const Data = category('Data', [
    linear('Bit', 'bit', 0.125), linear('Byte', 'B', 1), linear('Kilobyte', 'KB', 1e3),
    linear('Megabyte', 'MB', 1e6), linear('Gigabyte', 'GB', 1e9), linear('Terabyte', 'TB', 1e12),
    linear('Kibibyte', 'KiB', 1024), linear('Mebibyte', 'MiB', 1048576),
    linear('Gibibyte', 'GiB', 1073741824), linear('Tebibyte', 'TiB', 1099511627776),
  ], 'GB', 'GiB');

  // Base unit: pascal.
  const Pressure = category('Pressure', [
    linear('Pascal', 'Pa', 1), linear('Kilopascal', 'kPa', 1e3), linear('Megapascal', 'MPa', 1e6),
    linear('Millibar', 'mbar', 100), linear('Bar', 'bar', 1e5),
    linear('Pound per square inch', 'psi', 6894.757293168361), linear('Atmosphere', 'atm', 101325),
    linear('Kilogram-force per cm²', 'kgf/cm²', 98066.5), linear('Inch of water (4 °C)', 'inH₂O', 249.08891),
    linear('Inch of mercury (0 °C)', 'inHg', 3386.389), linear('Millimetre of mercury', 'mmHg', 133.322387415),
  ], 'psi', 'bar');

  // Base unit: cubic metre per second.
  const Flow = category('Flow', [
    linear('Litre per second', 'L/s', 1e-3), linear('Litre per minute', 'L/min', 1e-3 / 60),
    linear('Litre per hour', 'L/h', 1e-3 / 3600), linear('Cubic metre per hour', 'm³/h', 1 / 3600),
    linear('Cubic metre per second', 'm³/s', 1), linear('US gallon per minute', 'GPM', 3.785411784e-3 / 60),
    linear('US gallon per hour', 'GPH', 3.785411784e-3 / 3600),
    linear('Cubic foot per minute', 'CFM', 0.028316846592 / 60),
  ], 'GPM', 'L/min');

  // Base unit: kilogram per litre. Specific gravity is taken relative to 1 kg/L.
  const Density = category('Density', [
    linear('Kilogram per litre', 'kg/L', 1), linear('Gram per cubic centimetre', 'g/cm³', 1),
    linear('Kilogram per cubic metre', 'kg/m³', 1e-3),
    linear('Pound per US gallon', 'lb/gal', 0.45359237 / 3.785411784),
    linear('Pound per cubic foot', 'lb/ft³', 0.45359237 / 28.316846592),
    linear('Specific gravity', 'SG', 1),
  ], 'kg/L', 'lb/gal');

  const Catalog = {
    Length, Mass, Volume, Temperature, Pressure, Flow, Density, Area, Speed, Time, Data,
    all: [Length, Mass, Volume, Temperature, Pressure, Flow, Density, Area, Speed, Time, Data],
  };
  Catalog.find = name => Catalog.all.find(c => c.name.toLowerCase() === String(name).toLowerCase()) || null;

  // ---- Converter -------------------------------------------------------------------
  function convert(value, from, to) {
    return from === to ? value : to.fromBase(from.toBase(value));
  }

  /** Parses user input: thousands separators, spaces and a leading '+' are fine. Returns NaN if invalid. */
  function parse(text) {
    if (text === null || text === undefined) return NaN;
    let t = String(text).trim().replace(/[\s  ]/g, '');
    if (!t) return NaN;
    t = t.replace(/,/g, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
    const v = Number(t);
    return Number.isFinite(v) ? v : NaN;
  }

  /** Up to 10 significant digits, no trailing zeros, thousands separators,
      scientific notation only for very large or very small magnitudes. */
  function format(value) {
    if (value === null || !Number.isFinite(value)) return '—';
    const rounded = Number(value.toPrecision(10));   // snaps noise like 0.30000000000000004
    if (rounded === 0) return '0';
    const mag = Math.abs(rounded);
    if (mag >= 1e15 || mag < 1e-6) {
      let [m, e] = rounded.toExponential(9).split('e');
      m = m.replace(/\.?0+$/, '');
      const exp = Number(e);
      return m + 'E' + (exp < 0 ? '-' : '+') + Math.abs(exp);
    }
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 10 });
  }

  // ---- Mass <-> volume -------------------------------------------------------------
  const lbPerGal = Density.find('lb/gal');
  const MassVolume = {
    units: [...Mass.units, ...Volume.units],
    defaultFrom: Volume.find('gal'),
    defaultTo: Mass.find('lb'),
    isMass: u => Mass.units.includes(u),
    find: s => MassVolume.units.find(u => u.symbol === s) || null,
    /** densityKgPerL must be positive. Mass→mass and volume→volume ignore it. */
    convert(value, from, to, densityKgPerL) {
      if (!(densityKgPerL > 0)) throw new RangeError('Density must be positive.');
      const fm = MassVolume.isMass(from), tm = MassVolume.isMass(to);
      if (fm === tm) return convert(value, from, to);
      const base = from.toBase(value);
      return to.fromBase(fm ? base / densityKgPerL : base * densityKgPerL);
    },
  };

  function material(name, kgPerL) { return { name, kgPerL, lbPerGal: lbPerGal.fromBase(kgPerL) }; }
  const fromLbGal = (name, v) => material(name, lbPerGal.toBase(v));
  /** Typical densities near room temperature. Real fluids vary with temperature and grade. */
  const Materials = [
    fromLbGal('Water', 8.34), material('Seawater', 1.025), material('Milk', 1.03),
    fromLbGal('Liquid egg', 8.64), material('Ethanol', 0.789), material('Gasoline', 0.745),
    material('Diesel', 0.832), material('Hydraulic oil', 0.87), material('Glycol 50% / water', 1.07),
    material('Sulfuric acid 98%', 1.84), material('Sodium hydroxide 50%', 1.52),
  ];

  // ---- Linear scaling (SCP / SCL / NORM_X + SCALE_X) -----------------------------------
  function linearScale(inMin, inMax, outMin, outMax) {
    const s = { inMin, inMax, outMin, outMax };
    s.canScale = inMax !== inMin;
    s.canUnscale = outMax !== outMin;
    s.slope = (outMax - outMin) / (inMax - inMin);
    s.offset = outMin - s.slope * inMin;
    s.scale = x => outMin + (x - inMin) * (outMax - outMin) / (inMax - inMin);
    s.unscale = y => inMin + (y - outMin) * (inMax - inMin) / (outMax - outMin);
    s.isInputInRange = x => x >= Math.min(inMin, inMax) && x <= Math.max(inMin, inMax);
    return s;
  }

  const ScalePresets = [
    { name: '4–20 mA', min: 4, max: 20 }, { name: '0–20 mA', min: 0, max: 20 },
    { name: '0–10 V', min: 0, max: 10 }, { name: '±10 V', min: -10, max: 10 },
    { name: '1–5 V', min: 1, max: 5 }, { name: '0–100 %', min: 0, max: 100 },
    { name: 'Siemens 0–27648', min: 0, max: 27648 }, { name: 'Siemens ±27648', min: -27648, max: 27648 },
    { name: '0–32767', min: 0, max: 32767 }, { name: '12-bit 0–4095', min: 0, max: 4095 },
    { name: '16-bit 0–65535', min: 0, max: 65535 },
  ];

  // ---- VFD speed -> GPM (reverse-solve the 0..max range from one reading) ---------------
  /** Returns { range, position, maxGpm, minGpm } or { error }. */
  function vfdSolve(pct, gpm, sMin, sMax) {
    if ([pct, gpm, sMin, sMax].some(Number.isNaN)) return { error: 'Fill in all fields to calculate.' };
    if (sMax <= sMin) return { error: 'Scale Max must be greater than Scale Min.' };
    if (pct < sMin || pct > sMax) return { error: `VFD % must be between ${sMin}% and ${sMax}%.` };
    if (gpm < 0) return { error: 'GPM cannot be negative.' };
    const range = sMax - sMin;
    const position = (pct - sMin) / range;
    if (position === 0) return { error: 'VFD % equals Scale Min — cannot divide by zero position.' };
    return { range, position, maxGpm: gpm / position, minGpm: 0 };
  }

  // ---- Ohm's law / PIE wheel ------------------------------------------------------------
  // E = volts, I = amps, R = ohms, P = watts. Give any two (positive) and get all four.
  const OhmFormulas = {
    P: { EI: 'E × I', IR: 'I² × R', ER: 'E² ÷ R' },
    I: { ER: 'E ÷ R', EP: 'P ÷ E', PR: '√(P ÷ R)' },
    E: { IR: 'I × R', IP: 'P ÷ I', PR: '√(P × R)' },
    R: { EI: 'E ÷ I', EP: 'E² ÷ P', IP: 'P ÷ I²' },
  };
  /** known: object with exactly two of E, I, R, P. Returns { E, I, R, P, used: {X: formula} } or { error }. */
  function ohmSolve(known) {
    const keys = ['E', 'I', 'R', 'P'].filter(k => known[k] !== undefined && known[k] !== null);
    if (keys.length !== 2) return { error: 'Enter any two values.' };
    for (const k of keys) if (!(known[k] > 0)) return { error: 'Values must be greater than zero.' };
    let { E, I, R, P } = known;
    const pair = keys.join('');
    switch (pair) {
      case 'EI': R = E / I; P = E * I; break;
      case 'ER': I = E / R; P = E * E / R; break;
      case 'EP': I = P / E; R = E * E / P; break;
      case 'IR': E = I * R; P = I * I * R; break;
      case 'IP': E = P / I; R = P / (I * I); break;
      case 'RP': E = Math.sqrt(P * R); I = Math.sqrt(P / R); break;
    }
    const used = {};
    const sorted = s => s.split('').sort().join('');
    for (const x of ['E', 'I', 'R', 'P']) {
      if (keys.includes(x)) continue;
      const f = Object.entries(OhmFormulas[x]).find(([k]) => sorted(k) === sorted(pair));
      used[x] = f ? f[1] : '';
    }
    return { E, I, R, P, used, pair };
  }

  const Core = { Catalog, ohmSolve, OhmFormulas, convert, parse, format, MassVolume, Materials, linearScale, ScalePresets, vfdSolve };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(this);
