/**
 * SAARTHI Decision Platform Logic (live-forecast integration).
 * Vanilla JS VIEW over Spring Boot REST APIs backed by the LIVE
 * Open-Meteo/ECMWF-IFS feed (6 Sangrur blocks, D+1..D+16), with the
 * 17-30 day climatological outlook kept strictly separate.
 * Observed rainfall (CHIRPS) is OPTIONAL display context only: when
 * unavailable the UI reports "Observed rainfall context unavailable" and
 * the live forecast keeps working.
 * No forecasting is computed here. No synthetic fallback: API failure shows
 * an explicit error message.
 */

let activeRoute = location.pathname.slice(1) || 'farmer';
if (!['farmer', 'map', 'timeline'].includes(activeRoute)) {
  activeRoute = 'farmer';
}

let currentFarmerData = null;
let leafletMapInstance = null;
let mapGeoLayer = null;
let blockForecastCache = {};   // block_name -> /api/weather/forecast payload
let blocksMetaCache = [];      // [{block_id, block_name, ...}]
let latestCache = null;

// Panchayat lists for the farmer form (place names only; no forecast values).
const PANCHAYATS = {
  Dhuri: ['Rangian', 'Maanwala', 'Benra', 'Kalerian', 'Babbanpur', 'Jahangir', 'Ranike', 'Mullowal', 'Mimsa', 'Bardwal', 'Pakhoke', 'Rajomajra', 'Daulatpur', 'Bhulran', 'Bhalwan Dhuri', 'Bugra'],
  Lehra: ['Lehal Kalan', 'Kotra Amru', 'Chhajli Khurd', 'Sangha', 'Alampur', 'Gaga', 'Dhadrian', 'Bakhoran Kalan', 'Sekhuwas', 'Bhutal Kalan', 'Chotian', 'Khokhar', 'Anderana', 'Balran Lehra'],
  Malerkotla: ['Ahmedgarh Rural', 'Kup Kalan', 'Himmatpura', 'Jamalpura', 'Sandaur', 'Bhadas', 'Mithewal', 'Maholi Kalan', 'Nathuwala', 'Rohira', 'Chaunda', 'Balyal'],
  Moonak: ['Moonak Rural', 'Ghamoor Ghat', 'Makror Sahib', 'Kakra', 'Mandvi', 'Hamirgarh', 'Surjan Bhaini', 'Lehal Khurd', 'Balran', 'Dehla', 'Bhundar Bhaini', 'Ramnagar Sibian', 'Banawali', 'Bushehra'],
  Sangrur: ['Bhalwan', 'Mangwal', 'Ubhawal', 'Kanganwal', 'Badrukhan', 'Ladda', 'Akoi Sahib', 'Ghabdan', 'Duggan', 'Khurana', 'Fatehgarh Chhanna', 'Soian', 'Uppli', 'Gharachon', 'Bahadurpur'],
  Sunam: ['Suler Gherat', 'Kularan', 'Chhajli', 'Dirba', 'Cheema', 'Mehlan', 'Ubhawal', 'Togawal', 'Shahpur Kaler', 'Bigarwal', 'Dhandiwal', 'Mauran', 'Namol', 'Jakhepal', 'Janal', 'Khanal Kalan', 'Khanal Khurd', 'Kauhar Singh Wala'],
};

const CATEGORY_COLORS = { LOW: '#e2be62', NORMAL: '#9ed683', HIGH: '#f27256' };

// P0 freshness: same rule as src/utils/forecast_freshness.py and the backend
// (stale = expired OR age_days > 2). Stale forecasts must NEVER render
// identically to fresh ones.
const STALE_AFTER_DAYS = 2;

function freshnessOf(issueDate, validTo) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const issue = new Date(`${issueDate}T00:00:00`);
    const validEnd = new Date(`${validTo}T00:00:00`);
    if (Number.isNaN(issue.getTime()) || Number.isNaN(validEnd.getTime())) return { unknown: true };
    const ageDays = Math.round((today - issue) / 86400000);
    const expired = today > validEnd;
    return { ageDays, expired, stale: expired || ageDays > STALE_AFTER_DAYS };
  } catch (err) {
    return { unknown: true };
  }
}

function freshnessLabel(issueDate, validFrom, validTo) {
  const f = freshnessOf(issueDate, validTo);
  const base = `Issued ${issueDate} · Valid ${validFrom} – ${validTo}`;
  if (f.unknown) return `${base} · freshness unknown — verify before acting`;
  if (f.expired) return `${base} · EXPIRED (${f.ageDays}d old) — forecast data are outdated`;
  if (f.stale) return `${base} · STALE (${f.ageDays}d old) — may be outdated`;
  return `${base} · fresh (${f.ageDays}d old)`;
}

// Paints a static (portal.html placeholder) freshness banner by element id.
function paintStaticBanner(id, issueDate, validFrom, validTo) {
  const el = document.getElementById(id);
  if (!el) return;
  const f = freshnessOf(issueDate, validTo);
  el.textContent = freshnessLabel(issueDate, validFrom, validTo);
  el.style.background = f.stale ? '#fbe3dc' : '#e4efe0';
  el.style.color = f.stale ? '#a33' : '#3c6e47';
  el.style.border = f.stale ? '1px solid #e0a08e' : '1px solid #b9d2bd';
}

// Freshness banner for the LIVE contract (/api/weather/forecast): the server
// decides staleness (cache age vs TTL); the UI only renders it honestly.
function paintLiveBanner(id, liveEnvelope) {
  const el = document.getElementById(id);
  if (!el) return;
  const stale = !!(liveEnvelope && liveEnvelope.stale);
  const label = `${liveEnvelope.provider || 'Open-Meteo'} / ${liveEnvelope.model || 'ECMWF IFS'} · issued ${liveEnvelope.issue_date} · retrieved ${liveEnvelope.retrieved_at}`
    + (stale ? ' · STALE — may be outdated' : ' · fresh');
  el.textContent = label;
  el.style.background = stale ? '#fbe3dc' : '#e4efe0';
  el.style.color = stale ? '#a33' : '#3c6e47';
  el.style.border = stale ? '1px solid #e0a08e' : '1px solid #b9d2bd';
}

// Live rain category for map colouring: from the 7-day cumulative window of
// the live feed (NOT the frozen training-threshold categories).
function liveCategoryOf(blockName) {
  const f = blockForecastCache[blockName];
  if (!f || !f.rain_7d && f.rain_7d !== 0) return 'nodata';
  if (f.rain_7d < 10) return 'LOW';
  if (f.rain_7d > 35) return 'HIGH';
  return 'NORMAL';
}

// Injects (or updates) a freshness banner as the first child of container.
function renderFreshnessBanner(container, issueDate, validFrom, validTo) {
  if (!container) return;
  const f = freshnessOf(issueDate, validTo);
  let banner = container.querySelector('[data-freshness-banner]');
  if (!banner) {
    banner = document.createElement('p');
    banner.setAttribute('data-freshness-banner', 'true');
    banner.style.cssText = 'margin:0 0 12px;font-size:12.5px;font-weight:700;padding:8px 12px;border-radius:8px;';
    container.prepend(banner);
  }
  banner.textContent = freshnessLabel(issueDate, validFrom, validTo);
  banner.style.background = f.stale ? '#fbe3dc' : '#e4efe0';
  banner.style.color = f.stale ? '#a33' : '#3c6e47';
  banner.style.border = f.stale ? '1px solid #e0a08e' : '1px solid #b9d2bd';
}

// Page Titles and Subtitles
const PAGE_METADATA = {
  farmer: {
    title: { en: 'Farmer <em>advisory.</em>', hi: 'किसान <em>परामर्श पोर्टल।</em>', pa: 'ਕਿਸਾਨ <em>ਸਲਾਹਕਾਰ ਪੋਰਟਲ।</em>' },
    intro: {
      en: 'Block outlook from the validated 7-day forecast, plus crop guidance. Prototype decision support.',
      hi: 'सत्यापित 7-दिवसीय पूर्वानुमान पर आधारित ब्लॉक सलाह और फसल मार्गदर्शन।',
      pa: 'ਪ੍ਰਮਾਣਿਤ 7-ਦਿਨਾਂ ਦੇ ਅਨੁਮਾਨ ਉੱਤੇ ਆਧਾਰਿਤ ਬਲਾਕ ਸਲਾਹ ਅਤੇ ਫ਼ਸਲ ਮਾਰਗਦਰਸ਼ਨ।'
    }
  },
  map: {
    title: { en: 'Block-scale <em>outlook map.</em>', hi: '<em>ब्लॉक मानचित्र।</em>', pa: '<em>ਬਲਾਕ ਨਕਸ਼ਾ।</em>' },
    intro: {
      en: 'Sangrur polygon blocks colored by live rainfall, plus a marker for any selected block.',
      hi: 'लाइव वर्षा के अनुसार संगरूर बहुभुज ब्लॉक, तथा चुने गए ब्लॉक हेतु मार्कर।',
      pa: 'ਲਾਈਵ ਮੀਂਹ ਅਨੁਸਾਰ ਸੰਗਰੂਰ ਬਹੁਭੁਜ ਬਲਾਕ, ਅਤੇ ਚੁਣੇ ਬਲਾਕ ਲਈ ਮਾਰਕਰ।'
    }
  },
  timeline: {
    title: { en: 'Forecast <em>outlook.</em>', hi: '7 दिन <em>पूर्वानुमान।</em>', pa: '7 ਦਿਨਾਂ ਦਾ <em>ਮੌਸਮ ਅਨੁਮਾਨ।</em>' },
    intro: {
      en: 'Validated 7-day daily rainfall, probabilities and day-by-day matrix per block.',
      hi: 'प्रति ब्लॉक सत्यापित 7-दिवसीय वर्षा, संभावनाएँ और दैनिक मैट्रिक्स।',
      pa: 'ਪ੍ਰਤੀ ਬਲਾਕ ਪ੍ਰਮਾਣਿਤ 7-ਦਿਨਾਂ ਮੀਂਹ, ਸੰਭਾਵਨਾਵਾਂ ਅਤੇ ਰੋਜ਼ਾਨਾ ਮੈਟ੍ਰਿਕਸ।'
    }
  }
};

// Show Toast Notification Helper
function showToast(message) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function apiError(target, message) {
  if (typeof target === 'string') target = document.querySelector(target);
  if (target) target.innerHTML = `<p style="color:#a33;">${message}</p>`;
  showToast(message);
}

// Update Active Navigation Tab and Page Header
function updateRouteUI() {
  document.querySelectorAll('.nav-tabs a').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `/${activeRoute}`);
  });

  document.querySelectorAll('.portal-page').forEach((section) => {
    section.style.display = section.id === activeRoute ? 'block' : 'none';
  });

  const lang = localStorage.getItem('saarthi_lang') || 'en';
  const meta = PAGE_METADATA[activeRoute] || PAGE_METADATA.farmer;
  document.querySelector('#page-title').innerHTML = meta.title[lang] || meta.title.en;
  document.querySelector('#page-intro').textContent = meta.intro[lang] || meta.intro.en;
}

// -------------------------------------------------------------
// 1. FARMER ADVISORY PORTAL LOGIC (API-driven)
// -------------------------------------------------------------

async function populatePanchayats(block) {
  const select = document.querySelector('#form-panchayat');
  if (!select) return;
  let list = PANCHAYATS[block] || [];
  let apiOk = false;
  try {
    const res = await fetch(`/api/panchayats?block=${encodeURIComponent(block)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.panchayats) && data.panchayats.length) {
        list = data.panchayats;
        apiOk = true;
      }
    } else if (res.status === 404) {
      list = []; // non-Sangrur block: no panchayat list, block-level only
      apiOk = true;
    }
  } catch (err) {
    console.warn('Panchayat API unavailable, using bundled list:', err);
  }
  if (!list.length) {
    select.innerHTML = `<option value="">Block-level weather (panchayat lists cover Sangrur blocks only)</option>`;
  } else {
    select.innerHTML = list.map((p) => `<option value="${p}">${p}</option>`).join('');
  }
  const note = document.querySelector('#form-location-note');
  if (note) {
    const sel = farmerSelection;
    note.textContent = sel
      ? `${SaarthiGeo.locationLabel(sel)} · weather served at block level (no fabricated panchayat resolution)`
      : '';
  }
  return apiOk || list.length > 0;
}

// Currently selected registry block on the farmer route (null until chosen).
let farmerSelection = null;

async function computeFarmerAdvisory() {
  const sel = farmerSelection;
  const panchayat = document.querySelector('#form-panchayat')?.value || '';
  const crop = document.querySelector('#form-crop')?.value || 'Paddy (PR-126)';
  const soil = document.querySelector('#form-soil')?.value || 'Clay Loam';
  const sowingDate = document.querySelector('#form-date')?.value || '';
  const irrigation = document.querySelector('#form-irrigation')?.value || 'Canals';

  if (!sel) {
    apiError('#decision-explanation', 'Select State → District → Block to compute the advisory.');
    return;
  }
  const payload = {
    block: sel.block_name, panchayat, crop, soil,
    sowing_date: sowingDate, irrigation,
  };

  try {
    const res = await fetch('/api/farmer-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      currentFarmerData = data;
      renderFarmerAdvisoryView(data);
      return;
    }
    // Non-legacy blocks 404 here (advisory engine covers Sangrur polygons):
    // fall through to the generic block-level view, never another block.
    if (res.status !== 404 && res.status !== 503) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('Farmer analysis failed:', err);
    apiError('#decision-explanation', 'Live advisory data is currently unavailable. Please try again.');
    return;
  }
  // Generic path: live centroid weather + honest subset, no invented agronomy.
  try {
    const { envelope } = await SaarthiGeo.fetchBlockForecast(sel);
    currentFarmerData = null;
    renderGenericAdvisoryView(sel, envelope, { crop, irrigation, sowingDate });
  } catch (err) {
    console.error('Generic advisory failed:', err);
    apiError('#decision-explanation', 'Live advisory data is currently unavailable. Please try again.');
  }
}

/**
 * Block-level advisory for non-Sangrur registry blocks: location, live
 * weather and soil shown factually; crop-stage/risk sections are marked as
 * Sangrur-polygon-only instead of being invented.
 */
function renderGenericAdvisoryView(sel, env, inputs) {
  const lang = localStorage.getItem('saarthi_lang') || 'en';
  const noData = '<span style="color:#a33;">No data</span>';
  const b = (env && env.block) || {};
  const label = SaarthiGeo.locationLabel(sel);
  const days = b.days || [];
  const rain7 = b.cum_7d_mm && b.cum_7d_mm.available ? b.cum_7d_mm.rainfall_mm : null;
  const et0 = b.et0_7d_mm && b.et0_7d_mm.available ? b.et0_7d_mm.rainfall_mm : null;
  const wet = days.filter((d) => (d.rainfall_mm || 0) >= 1).length;
  const heavy = days.reduce((a, d) => ((d.rainfall_mm || 0) > (a.rainfall_mm || 0) ? d : a), days[0] || {});
  const sm = b.soil_moisture_0_to_7cm_pct;
  const smv = sm && sm.available ? sm.value : null;
  const soilLine = env.soil && env.soil.available && env.soil.line
    ? env.soil.line
    : 'Soil data unavailable for this block';

  const set = (id, text) => { const el = document.querySelector(id); if (el) el.textContent = text; };
  const setHtml = (id, html) => { const el = document.querySelector(id); if (el) el.innerHTML = html; };
  set('#decision-headline', `${inputs.crop} — ${label}`);
  set('#decision-confidence', `${env.provider} / ${env.model} · issued ${env.issue_date} · block-level forecast`);
  set('#decision-target-panchayat', label);
  set('#decision-explanation',
    `Weather is served at block level for ${label} (no fabricated panchayat resolution). ` +
    `7-day rainfall ${rain7 != null ? rain7 + ' mm' : 'No data'}, ` +
    `${wet} wet days (≥1 mm) in the 16-day horizon. ` +
    `Crop-stage and dry-spell risk sections are computed for Sangrur polygon blocks; ` +
    `the live weather and soil below cover ${sel.block_name}.`);
  const tagEl = document.querySelector('#decision-tag');
  if (tagEl) { tagEl.textContent = 'Block-level outlook'; tagEl.className = 'decision-tag review'; }
  set('#decision-window', 'Stage-specific window: Sangrur polygon blocks');
  set('#decision-prob', '');
  setHtml('#decision-prob',
    `7-day rain: <b>${rain7 != null ? rain7 + ' mm' : 'No data'}</b>` +
    ` · ET0 7-day: <b>${et0 != null ? et0 + ' mm' : 'No data'}</b>`);
  set('#gauge-status', smv == null ? 'Forecast surface soil moisture: No data' : `Forecast surface soil moisture: ${smv} m³/m³ (ECMWF IFS, 0–7 cm — not a measurement)`);
  const gaugePct = document.querySelector('#gauge-percent');
  if (gaugePct) gaugePct.textContent = smv == null ? '—' : `${Number(smv).toFixed(2)} m³/m³`;
  set('#pillar-weather-val', rain7 == null ? 'No data' : `${rain7} mm / 7d`);
  set('#pillar-soil-val', smv == null ? 'No data' : 'Forecast (see gauge)');
  set('#pillar-crop-val', 'Advisory: Sangrur polygons');
  set('#pillar-dry-val', `${wet} wet days / 16d`);
  setHtml('#advisory-actions',
    `<ul><li>Heaviest forecast day: ${heavy && heavy.date ? `${heavy.rainfall_mm} mm (${heavy.date})` : 'No data'}.</li>` +
    `<li>${soilLine}.</li>` +
    `<li>Irrigation input on file: ${inputs.irrigation}; sowing date on file: ${inputs.sowingDate || 'not set'}. Stage-specific guidance is computed for Sangrur polygon blocks.</li></ul>`);
  setHtml('#advisory-sources',
    `<ul><li>Open-Meteo API delivering ECMWF IFS — GET /api/weather/forecast/by-coords (single-point centroid, not polygon-averaged)</li>` +
    `<li>${soilLine}</li></ul>`);
  const shareBtn = document.querySelector('#share-whatsapp-btn');
  if (shareBtn) {
    const lines = [
      `🌾 *SAARTHI KISAN ADVISORY*`,
      `📍 ${label}`,
      `🌱 ${inputs.crop}`,
      `🌧 7-day rain: ${rain7 != null ? rain7 + ' mm' : 'No data'}`,
      `💧 ${soilLine}`,
      `— SAARTHI (ECMWF IFS live forecast, block level)`,
    ];
    shareBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        showToast(getTranslation('btn_copied', lang));
      } catch (e) {
        showToast('Advisory text copied!');
      }
    };
  }
}

function renderFarmerAdvisoryView(data) {
  if (!data || !data.location) return;
  const lang = localStorage.getItem('saarthi_lang') || 'en';
  const noData = '<span style="color:#a33;">No data</span>';
  const v = (x) => (x === null || x === undefined ? noData : x);

  // Header: crop + block + provenance (section 1)
  const cropName = (data.inputs && data.inputs.crop) || '';
  const hlEl = document.querySelector('#decision-headline');
  if (hlEl) hlEl.textContent = `${cropName} — ${data.location.panchayat_label || ''} (${data.location.block} block)`;

  const confEl = document.querySelector('#decision-confidence');
  if (confEl) confEl.textContent =
    `${data.location.provider} / ${data.location.model} · issued ${data.location.forecast_issue_date} · block-level forecast`;

  const targetEl = document.querySelector('#decision-target-panchayat');
  if (targetEl) targetEl.textContent = data.location.panchayat_label || '';

  const expEl = document.querySelector('#decision-explanation');
  if (expEl) expEl.textContent =
    (data.location.resolution_note || '') + ' ' +
    ((data.advisory && data.advisory.explanation) || '');

  // Stage (section 3)
  const st = data.stage || {};
  const tagEl = document.querySelector('#decision-tag');
  if (tagEl) {
    tagEl.textContent = st.available
      ? `Stage: ${String(st.stage).replace(/_/g, ' ')} (day ${st.days_since_sowing})`
      : (st.days_since_sowing != null
        ? `Day ${st.days_since_sowing} — stage not available`
        : 'Set sowing date for stage guidance');
    tagEl.className = `decision-tag ${st.available ? 'sow' : 'review'}`;
  }

  const winEl = document.querySelector('#decision-window');
  if (winEl) {
    const w = data.crop && data.crop.sowing_window;
    winEl.textContent = (data.crop && data.crop.known && w && w.start)
      ? `Cited sowing window: ${w.start} → ${w.end || '-'}`
      : 'Sowing window not available for this crop';
  }

  // Weather snapshot (section 4)
  const wx = data.weather || {};
  const probEl = document.querySelector('#decision-prob');
  if (probEl) {
    probEl.innerHTML =
      `7-day rain: <b>${v(wx.rain_7d_mm != null ? wx.rain_7d_mm + ' mm' : null)}</b>` +
      ` · ET0 7-day: <b>${v(wx.et0_7d_mm != null ? wx.et0_7d_mm + ' mm' : null)}</b>`;
  }

  // Soil (section 5) — forecast surface moisture, honest units
  const soil = data.soil || {};
  const gaugePct = document.querySelector('#gauge-percent');
  const gaugeDial = document.querySelector('#root-gauge-dial');
  const gStatus = document.querySelector('#gauge-status');
  const smv = soil.forecast_surface_soil_moisture_vwc;
  if (gStatus) {
    gStatus.textContent = smv == null
      ? 'Forecast surface soil moisture: No data'
      : `Forecast surface soil moisture: ${smv} m³/m³ (ECMWF IFS, 0–7 cm — not a measurement)`;
  }
  if (gaugePct) gaugePct.textContent = smv == null ? '—' : `${smv.toFixed(2)} m³/m³`;
  if (gaugeDial) {
    // VWC 0–0.5 mapped to 0–100% dial position for display only.
    const pct = smv == null ? 0 : Math.max(0, Math.min(100, (smv / 0.5) * 100));
    gaugeDial.style.background = smv == null
      ? 'conic-gradient(#c9d2c4 0% 100%)'
      : `conic-gradient(#abc87d 0% ${pct}%, #e6ece0 ${pct}% 100%)`;
  }

  // Risk pillars (section 7) — worded watches, never fake percentages
  const risks = data.risks || {};
  const flags = risks.flags || [];
  const pWeather = document.querySelector('#pillar-weather-val');
  if (pWeather) {
    const heavy = flags.includes('heavy_rain_watch');
    const dry = flags.includes('dry_spell_watch');
    pWeather.textContent = heavy ? 'Heavy rain watch' : dry ? 'Dry-spell watch' : 'No watch flags';
    pWeather.style.color = heavy || dry ? 'var(--gold)' : 'var(--moss)';
  }
  const pSoil = document.querySelector('#pillar-soil-val');
  if (pSoil) {
    pSoil.textContent = smv == null ? 'No data'
      : smv < 0.12 ? 'Dry surface (forecast)' : 'Adequate (forecast)';
    pSoil.style.color = smv != null && smv < 0.12 ? 'var(--coral)' : 'var(--moss)';
  }
  const pCrop = document.querySelector('#pillar-crop-val');
  if (pCrop) {
    pCrop.textContent = (data.crop && data.crop.water_need_class)
      ? `Water need: ${String(data.crop.water_need_class).replace(/_/g, ' ')}`
      : 'Water need: not available';
    pCrop.style.color = 'var(--moss)';
  }
  const pDry = document.querySelector('#pillar-dry-val');
  if (pDry) {
    pDry.textContent = flags.includes('dry_spell_watch') ? 'Watch active' : 'No dry-spell signal';
    pDry.style.color = flags.includes('dry_spell_watch') ? 'var(--coral)' : 'var(--moss)';
  }

  // Advisory actions (section 8)
  const advEl = document.querySelector('#advisory-actions');
  if (advEl) {
    const actions = (data.advisory && data.advisory.actions) || [];
    advEl.innerHTML = actions.length
      ? `<ul>${actions.map((a) => `<li>${a}</li>`).join('')}</ul>`
      : 'No advisory actions available.';
  }

  // Sources (section 9)
  const srcEl = document.querySelector('#advisory-sources');
  if (srcEl && data.sources) {
    const items = [].concat(data.sources.weather || [], data.sources.agronomy || [],
      data.sources.soil ? [data.sources.soil] : []);
    srcEl.innerHTML = `<ul>${items.map((s) => `<li>${s}</li>`).join('')}</ul>`;
  }

  // WhatsApp share (plain-text digest of the new sections)
  const shareBtn = document.querySelector('#share-whatsapp-btn');
  if (shareBtn) {
    const lines = [
      `🌾 *SAARTHI KISAN ADVISORY*`,
      `📍 ${data.location.panchayat_label} · ${data.location.block} block`,
      `🌱 ${cropName}${st.available ? ` · ${String(st.stage).replace(/_/g, ' ')}` : ''}`,
      `🌧 7-day rain: ${wx.rain_7d_mm != null ? wx.rain_7d_mm + ' mm' : 'No data'} · ET0: ${wx.et0_7d_mm != null ? wx.et0_7d_mm + ' mm' : 'No data'}`,
      `💧 ${smv != null ? `Forecast surface moisture ${smv} m³/m³` : 'Surface moisture: No data'}`,
      flags.length ? `⚠️ ${flags.map((f) => f.replace(/_/g, ' ')).join(', ')}` : '',
      ``,
      `💡 ${(data.advisory && data.advisory.actions || []).map((a) => '• ' + a).join('\n')}`,
      `— SAARTHI (ECMWF IFS live forecast + PAU/ICAR agronomy)`,
    ].filter((l) => l !== '');
    shareBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        showToast(getTranslation('btn_copied', lang));
      } catch (e) {
        showToast('Advisory text copied!');
      }
    };
  }
}

// Single-fetch timeline refresh: one live request serves the chart,
// the 16-day table, the risk card and the W3/W4 panel for a selection.
let timelineSelection = null;

async function refreshTimeline(sel) {
  timelineSelection = sel;
  if (!sel) {
    loadTimelineForecast(null);
    loadLiveOutlook(null);
    loadFieldRisk(null, true, 'Sangrur');
    loadWeeks34Outlook(null, true, 'Sangrur');
    return;
  }
  try {
    const pre = await SaarthiGeo.fetchBlockForecast(sel);
    const canonical = (pre.block && pre.block.block_name) || sel.block_name;
    await loadTimelineForecast(sel, pre);
    await loadLiveOutlook(sel, pre);
    await loadFieldRisk(sel, pre.isLegacy, canonical);
    await loadWeeks34Outlook(sel, pre.isLegacy, canonical);
  } catch (err) {
    console.error('Timeline refresh failed:', err);
    apiError('#recharts-forecast-canvas', `Live forecast unavailable for ${sel.block_name} (${err.message}). No fallback data is shown.`);
  }
}

// -------------------------------------------------------------
// 2b. SELECTION MARKER (non-polygon registry blocks on the map)
// -------------------------------------------------------------
let selectionMarker = null;

async function renderSelectionMarker() {
  if (!leafletMapInstance) return;
  const sel = SaarthiGeo.loadSelection();
  if (selectionMarker) {
    leafletMapInstance.removeLayer(selectionMarker);
    selectionMarker = null;
  }
  if (!sel || sel.latitude == null) return;
  // Polygon blocks already render from GeoJSON — no marker needed.
  if (blockForecastCache[sel.block_name]) return;
  selectionMarker = L.marker([sel.latitude, sel.longitude]).addTo(leafletMapInstance);
  selectionMarker.bindPopup(`<div style="font-family: Manrope, sans-serif; font-size: 12px;"><strong>${sel.block_name}</strong><div style="color:#617163;">${sel.district_name}, ${sel.state_name} · centroid (no block boundary compiled)</div><div>Loading live forecast…</div></div>`);
  try {
    const { envelope } = await SaarthiGeo.fetchBlockForecast(sel);
    const b = envelope.block || {};
    const rain7 = b.cum_7d_mm && b.cum_7d_mm.available ? `${b.cum_7d_mm.rainfall_mm} mm` : 'No data';
    selectionMarker.setPopupContent(
      `<div style="font-family: Manrope, sans-serif; font-size: 12px; min-width: 200px;">` +
      `<strong style="font-size: 14px;">${sel.block_name}</strong>` +
      `<div style="color:#617163;">${sel.district_name}, ${sel.state_name} · centroid</div>` +
      `<div style="margin-top:6px;"><b>7-day rain (live IFS):</b> ${rain7}</div>` +
      `<div><b>Method:</b> single-point centroid (not polygon-averaged)</div></div>`);
  } catch (err) {
    selectionMarker.setPopupContent(
      `<div style="font-family: Manrope, sans-serif; font-size: 12px;"><strong>${sel.block_name}</strong>` +
      `<div style="color:#a33;">Live forecast unavailable (${err.message})</div></div>`);
  }
}

// -------------------------------------------------------------
// 2. BLOCK-SCALE OUTLOOK MAP (LEAFLET GEOJSON)
// -------------------------------------------------------------

function categoryOf(blockName) {
  return liveCategoryOf(blockName);
}

async function initRiskMap() {
  const mapContainer = document.querySelector('#leaflet-map-canvas');
  if (!mapContainer) return;

  if (!leafletMapInstance) {
    leafletMapInstance = L.map('leaflet-map-canvas', {
      center: [30.2458, 75.8421],
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors | SAARTHI validated outlook',
      maxZoom: 18,
    }).addTo(leafletMapInstance);

    mapGeoLayer = L.layerGroup().addTo(leafletMapInstance);

    document.querySelector('#map-block-filter')?.addEventListener('change', renderMapPolygons);
    document.querySelector('#map-category-filter')?.addEventListener('change', renderMapPolygons);
    // legacy risk-filter id (older markup): keep working if present
    document.querySelector('#map-risk-filter')?.addEventListener('change', renderMapPolygons);
  }

  try {
    const [geoRes, fcRes] = await Promise.all([
      fetch('/api/blocks/geojson'),
      fetch('/api/weather/forecast'),
    ]);
    if (!geoRes.ok || !fcRes.ok) throw new Error(`geojson ${geoRes.status}, forecast ${fcRes.status}`);
    const geo = await geoRes.json();
    const latest = await fcRes.json();
    latestCache = latest;
    // LIVE contract banner: stale flag comes from the server (cache age), not
    // any frozen package dates.
    paintLiveBanner('map-freshness-banner', latest);
    blockForecastCache = {};
    for (const b of (latest.blocks || [])) {
      blockForecastCache[b.block_name] = {
        ...b,
        rain_7d: b.cum_7d_mm && b.cum_7d_mm.available ? b.cum_7d_mm.rainfall_mm : null,
      };
    }
    renderMapPolygons(geo);
    renderSelectionMarker();
    setTimeout(() => leafletMapInstance.invalidateSize(), 200);
  } catch (err) {
    console.error('Map data failed:', err);
    apiError('#leaflet-map-canvas', 'Live map data is currently unavailable. Please try again.');
  }
}

function currentGeoCache() {
  return currentGeoCache._geo || null;
}

function renderMapPolygons(geo) {
  if (!leafletMapInstance || !mapGeoLayer) return;
  if (geo) currentGeoCache._geo = geo;
  geo = geo || currentGeoCache();
  if (!geo) return;
  mapGeoLayer.clearLayers();

  const blockFilter = document.querySelector('#map-block-filter')?.value || 'all';
  const catFilter = document.querySelector('#map-category-filter')?.value
    || document.querySelector('#map-risk-filter')?.value || 'all';

  const layer = L.geoJSON(geo, {
    filter: (feature) => {
      const name = feature.properties.block_name;
      if (blockFilter !== 'all' && name !== blockFilter) return false;
      if (catFilter !== 'all' && categoryOf(name) !== catFilter) return false;
      return true;
    },
    style: (feature) => ({
      fillColor: CATEGORY_COLORS[categoryOf(feature.properties.block_name)] || '#9ed683',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.65,
    }),
    onEachFeature: (feature, lyr) => {
      const name = feature.properties.block_name;
      const f = blockForecastCache[name];
      const body = f
        ? `<div><b>7-day rain (live IFS):</b> ${f.rain_7d != null ? f.rain_7d + ' mm' : 'No data'}</div>
           <div><b>ET0 7-day:</b> ${f.et0_7d_mm && f.et0_7d_mm.available ? f.et0_7d_mm.rainfall_mm + ' mm' : 'No data'}</div>
           <div><b>Surface soil moisture (D+1):</b> ${f.soil_moisture_0_to_7cm_pct && f.soil_moisture_0_to_7cm_pct.available ? f.soil_moisture_0_to_7cm_pct.value + ' m³/m³' : 'No data'}</div>
           <div><b>Live category:</b> ${liveCategoryOf(name)}</div>`
        : `<div>Live forecast loading…</div>`;
      lyr.bindPopup(
        `<div style="font-family: Manrope, sans-serif; font-size: 12px; min-width: 200px;">
          <strong style="font-size: 14px;">${name}</strong>
          <div style="color:#617163;">Block ID: <b>${feature.properties.block_id}</b></div>
          <div style="margin-top:6px;">${body}</div>
        </div>`
      );
      lyr.on('click', () => {
        const sel = document.querySelector('#map-block-filter');
        if (sel) sel.value = name;
      });
    },
  });
  mapGeoLayer.addLayer(layer);
  try {
    const bounds = layer.getBounds();
    if (bounds.isValid()) leafletMapInstance.fitBounds(bounds.pad(0.1));
  } catch (e) { /* keep default view */ }
}

// -------------------------------------------------------------
// 3. 7-DAY FORECAST OUTLOOK & MATRIX (TIMELINE)
// -------------------------------------------------------------

async function loadTimelineForecast(sel, pre) {
  const titleEl = document.querySelector('#timeline-block-title');
  const blockName = (sel && sel.block_name) || 'Sangrur';
  if (titleEl) titleEl.textContent = sel ? SaarthiGeo.locationLabel(sel) : `${blockName} Block`;
  const placeEl = document.querySelector('#timeline-place');
  if (placeEl) placeEl.textContent = sel ? `${sel.district_name}, ${sel.state_name}` : 'Select a block';

  try {
    // LIVE contract: single source for the timeline chart + matrix (D+1..D+16).
    // Legacy Sangrur names resolve to the polygon path; all other registry
    // blocks resolve to their centroid — same render, honest method label.
    let data = pre && pre.envelope;
    if (!data) {
      if (sel) {
        ({ envelope: data } = await SaarthiGeo.fetchBlockForecast(sel));
      } else {
        const res = await fetch(`/api/weather/forecast/${encodeURIComponent(blockName)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }
    }
    paintLiveBanner('timeline-freshness-banner', data);
    const b = data.block || {};
    blockForecastCache[b.block_name] = { ...b, rain_7d: b.cum_7d_mm && b.cum_7d_mm.available ? b.cum_7d_mm.rainfall_mm : null };
    const matrix = (b.days || []).map((d) => ({
      day: d.horizon_day, date: d.date, rainfall_mm: d.rainfall_mm,
    }));
    const total7 = b.cum_7d_mm && b.cum_7d_mm.available ? b.cum_7d_mm.rainfall_mm : null;
    renderForecastChart({ block: b.block_name, forecast_matrix: matrix, total: total7, category: null });
    renderForecastMatrix(matrix);
  } catch (err) {
    console.error('Timeline forecast failed:', err);
    apiError('#recharts-forecast-canvas', 'Live forecast data is currently unavailable. Please try again.');
  }
}

function renderForecastChart(data) {
  const container = document.querySelector('#recharts-forecast-canvas');
  if (!container) return;

  const matrix = data.forecast_matrix || [];
  const n = matrix.length;
  if (n === 0) return;

  const svgWidth = 920;
  const svgHeight = 310;
  const padLeft = 60;
  const padRight = 60;
  const padTop = 25;
  const padBottom = 45;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const rawMaxRain = Math.max(...matrix.map((m) => m.rainfall_mm), 1);
  const maxRain = Math.max(12, Math.ceil(rawMaxRain / 4) * 4);

  const stepX = plotWidth / n;
  const barWidth = Math.min(42, Math.max(14, stepX * 0.58));

  const rainTicks = [0, maxRain * 0.25, maxRain * 0.5, maxRain * 0.75, maxRain];
  const gridLinesSvg = rainTicks
    .map((val) => {
      const y = padTop + plotHeight - (val / maxRain) * plotHeight;
      return `
        <line x1="${padLeft}" y1="${y}" x2="${svgWidth - padRight}" y2="${y}" stroke="#e8ece4" stroke-dasharray="3,3" stroke-width="1" />
        <text x="${padLeft - 10}" y="${y + 3.5}" text-anchor="end" fill="#587482" font-family="'DM Mono', monospace" font-size="10">${val.toFixed(0)} mm</text>
      `;
    })
    .join('');

  const barsSvg = matrix
    .map((m, i) => {
      const centerX = padLeft + i * stepX + stepX / 2;
      const barX = centerX - barWidth / 2;
      const barH = Math.max(3, (m.rainfall_mm / maxRain) * plotHeight);
      const barY = padTop + plotHeight - barH;
      const isPeak = m.rainfall_mm === rawMaxRain && rawMaxRain > 3;
      const fill = isPeak ? 'url(#rainBarPeakGrad)' : 'url(#rainBarGrad)';

      const textLabel = (barH > 18 || (isPeak && barH > 14))
        ? `<text x="${centerX}" y="${barY - 4}" text-anchor="middle" fill="#2d6b8b" font-family="'DM Mono', monospace" font-weight="700" font-size="9.5">${m.rainfall_mm}</text>`
        : '';

      return `
        <g class="chart-bar" style="cursor: pointer;">
          <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" rx="4" fill="${fill}" />
          ${textLabel}
          <title>Day ${m.day} (${m.date}): Rain ${m.rainfall_mm}mm</title>
        </g>
      `;
    })
    .join('');

  const xAxisLabelsSvg = matrix
    .map((m, i) => {
      const x = padLeft + i * stepX + stepX / 2;
      return `
        <line x1="${x}" y1="${padTop + plotHeight}" x2="${x}" y2="${padTop + plotHeight + 5}" stroke="#b8c4b4" stroke-width="1" />
        <text x="${x}" y="${padTop + plotHeight + 18}" text-anchor="middle" fill="#3c4e3f" font-family="'DM Mono', monospace" font-weight="700" font-size="10">D${m.day}</text>
        <text x="${x}" y="${padTop + plotHeight + 30}" text-anchor="middle" fill="#788a7b" font-family="'DM Mono', monospace" font-size="9">${m.date}</text>
      `;
    })
    .join('');

  const total = data.total != null ? data.total : matrix.reduce((a, m) => a + m.rainfall_mm, 0);
  container.innerHTML = `
    <div class="chart-legend-row">
      <div style="display: flex; gap: 16px; align-items: center;">
        <span class="chart-legend-badge rain">■ Validated Daily Rain (mm)</span>
        <span class="chart-legend-badge">7-day total: <b>${total.toFixed ? total.toFixed(1) : total} mm</b>${data.category ? ` · <b>${data.category}</b>` : ''}</span>
      </div>
    </div>

    <div class="chart-svg-wrap">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; display: block; overflow: visible;">
        <defs>
          <linearGradient id="rainBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#427c9c" />
            <stop offset="100%" stop-color="#82b7c7" />
          </linearGradient>
          <linearGradient id="rainBarPeakGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2a5d77" />
            <stop offset="100%" stop-color="#5599b8" />
          </linearGradient>
        </defs>

        <!-- Grid Lines & Y-Axis Labels -->
        ${gridLinesSvg}

        <!-- Rainfall Bars -->
        ${barsSvg}

        <!-- Baseline X-Axis -->
        <line x1="${padLeft}" y1="${padTop + plotHeight}" x2="${svgWidth - padRight}" y2="${padTop + plotHeight}" stroke="#adbdb0" stroke-width="1.5" />

        <!-- X-Axis Labels -->
        ${xAxisLabelsSvg}
      </svg>
    </div>
  `;
}

function renderForecastMatrix(matrix) {
  const tbody = document.querySelector('#forecast-matrix-tbody');
  if (!tbody) return;

  tbody.innerHTML = matrix
    .map((row) => {
      const wet = row.rainfall_mm >= 1.0;
      return `
        <tr>
          <td><b>Day ${row.day}</b></td>
          <td>${row.date}</td>
          <td><strong style="color: #427c9c;">${row.rainfall_mm} mm</strong></td>
          <td>${wet ? 'Wet (≥1 mm)' : 'Dry (<1 mm)'}</td>
        </tr>
      `;
    })
    .join('');
}

// -------------------------------------------------------------
// 3b. LIVE OPERATIONAL OUTLOOK (Phase 1+2: /api/weather/*)
// -------------------------------------------------------------
// Block-level live rainfall from Open-Meteo delivery + ECMWF IFS NWP.
// Display-only view: no forecasting here, no zero-filling, horizon served
// honestly (16 days; 16–30 explicitly unavailable).

async function loadLiveOutlook(sel, pre) {
  const tbody = document.querySelector('#live-matrix-tbody');
  const metaEl = document.querySelector('#live-meta');
  const freshEl = document.querySelector('#live-freshness');
  if (!tbody || !metaEl) return;

  const blockName = (sel && sel.block_name) || 'Sangrur';
  tbody.innerHTML = `<tr><td colspan="4">Loading live outlook for ${sel ? SaarthiGeo.locationLabel(sel) : blockName}…</td></tr>`;
  metaEl.textContent = 'Live outlook loading…';

  try {
    let data;
    let isLegacy = false;
    if (pre && pre.envelope) {
      data = pre.envelope;
      isLegacy = !!pre.isLegacy;
    } else if (sel) {
      const r = await SaarthiGeo.fetchBlockForecast(sel);
      data = r.envelope;
      isLegacy = r.isLegacy;
    } else {
      const res = await fetch(`/api/weather/forecast/${encodeURIComponent(blockName)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      data = await res.json();
      isLegacy = true;
    }
    const b = data.block || {};
    const days = b.days || [];

    const staleTag = data.stale
      ? ` · STALE${data.stale_warning ? ` — ${data.stale_warning}` : ' — cached forecast served'}` : ' · fresh';
    const method = b.spatial_method || '';
    const methodTag = method.includes('single_point_centroid')
      ? ' · single-point centroid (not polygon-averaged)'
      : method.includes('multipoint') ? ' · polygon multipoint mean' : '';
    metaEl.textContent =
      `${b.block_name || blockName}: ${data.provider || 'Open-Meteo'} / ${data.model || 'ECMWF IFS'} · ` +
      `issued ${data.issue_date} · ${days.length}-day horizon${staleTag}${methodTag}`;
    if (sel && !isLegacy && data.soil) {
      metaEl.textContent += data.soil.available && data.soil.line
        ? ` · Soil: ${data.soil.line}` : ' · Soil data unavailable for this block';
    }

    if (freshEl) {
      freshEl.textContent = data.stale
        ? `Live forecast STALE (retrieved ${data.retrieved_at}) — may be outdated`
        : `Live forecast fresh (retrieved ${data.retrieved_at})`;
      freshEl.style.background = data.stale ? '#fbe3dc' : '#e4efe0';
      freshEl.style.color = data.stale ? '#a33' : '#3c6e47';
      freshEl.style.border = data.stale ? '1px solid #e0a08e' : '1px solid #b9d2bd';
    }

    const cum = (c) => (c && c.available ? `${c.rainfall_mm} mm` : 'unavailable');
    tbody.innerHTML = days.map((d) => {
      const rain = d.rainfall_mm == null
        ? '<span style="color:#a33;">No data (not zero)</span>'
        : `<strong style="color: #427c9c;">${d.rainfall_mm} mm</strong>`;
      const prob = d.rain_probability_pct == null ? '—' : `${d.rain_probability_pct}%`;
      return `<tr><td><b>Day ${d.horizon_day}</b></td><td>${d.date}</td><td>${rain}</td><td>${prob}</td></tr>`;
    }).join('') + `
      <tr><td colspan="2"><b>3-day total</b></td><td colspan="2">${cum(b.cum_3d_mm)}</td></tr>
      <tr><td colspan="2"><b>7-day total</b></td><td colspan="2">${cum(b.cum_7d_mm)}</td></tr>
      <tr><td colspan="2"><b>15-day total</b></td><td colspan="2">${cum(b.cum_15d_mm)}</td></tr>
      <tr><td colspan="2"><b>30-day</b></td><td colspan="2">Not served — 16-day deterministic feed only</td></tr>`;
  } catch (err) {
    console.error('Live outlook failed:', err);
    metaEl.textContent = 'Live outlook unavailable.';
    tbody.innerHTML = `<tr><td colspan="4" style="color:#a33;">Live outlook data is currently unavailable (${err.message}). No fallback forecast is synthesised — please try again.</td></tr>`;
    if (freshEl) {
      freshEl.textContent = 'Live forecast freshness unknown — provider unreachable.';
      freshEl.style.background = '#fbe3dc';
      freshEl.style.color = '#a33';
      freshEl.style.border = '1px solid #e0a08e';
    }
  }
}

// -------------------------------------------------------------
// 3b2. AGRICULTURAL RISK — COMPOSITE (Phase 4.3: composite_v1, /api/risks/*)
// -------------------------------------------------------------
// Rule-based priority served from the same live IFS forecast (no second
// request): FIELD_HIGH -> HIGH; provisional dry-spell watch -> MODERATE
// (never HIGH); stale -> MODERATE; incomplete -> UNAVAILABLE (never LOW).
// Generic wording only — no crops, no agronomic prescriptions.

async function loadFieldRisk(sel, isLegacy, canonical) {
  const metaEl = document.querySelector('#risk-meta');
  const cardEl = document.querySelector('#risk-card');
  const primEl = document.querySelector('#risk-primary');
  const evEl = document.querySelector('#risk-evidence');
  const othEl = document.querySelector('#risk-others');
  const advEl = document.querySelector('#risk-advisory');
  if (!metaEl || !cardEl) return;

  const label = sel ? SaarthiGeo.locationLabel(sel) : (canonical || 'Sangrur');
  const paint = (bg, fg, border) => {
    cardEl.style.background = bg;
    cardEl.style.color = fg;
    cardEl.style.border = border;
  };
  const clearRest = () => {
    if (primEl) primEl.textContent = '';
    if (evEl) evEl.textContent = '';
    if (othEl) othEl.textContent = '';
    if (advEl) advEl.textContent = '';
  };
  if (!isLegacy) {
    // composite_v1 / FIELD_HIGH are validated on the Sangrur polygon feed.
    metaEl.textContent = `Agricultural risk for ${label}: served for Sangrur polygon blocks.`;
    cardEl.textContent = 'UNAVAILABLE for this block — no threshold set outside Sangrur';
    paint('#eef1ea', '#657566', '1px solid #c9cfc4');
    clearRest();
    if (advEl) advEl.textContent = 'The live 16-day rainfall outlook above covers this block; field-work risk scoring is not calibrated here.';
    return;
  }
  const block = canonical || 'Sangrur';

  metaEl.textContent = `Agricultural risk loading for ${block}…`;
  cardEl.textContent = 'Loading…';
  clearRest();

  const prettyConcern = (c) => (c || '—').replace(/_/g, ' ');
  try {
    const res = await fetch(`/api/risks/${encodeURIComponent(block)}?window=3d`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    // Backward compatible: older responses carry category without overall_risk.
    const overall = data.overall_risk || data.category || 'UNAVAILABLE';
    const ev = data.evidence || {};
    const wetTxt = ev.wet_days == null ? 'unknown' : `${ev.wet_days} of 3 forecast days are wet`;
    const maxTxt = ev.max_precipitation_mm == null ? 'unknown' : `${ev.max_precipitation_mm} mm`;
    metaEl.textContent =
      `${data.block || block}: AGRICULTURAL RISK · D+1–D+3 ` +
      `(${Array.isArray(data.window_dates) ? data.window_dates.join(' … ') : '—'}) · ` +
      `confidence ${data.confidence || '—'}` +
      (data.stale ? ' · STALE forecast — capped confidence' : ' · fresh');
    if (overall === 'HIGH') {
      cardEl.textContent = 'Overall: HIGH — field work may be disrupted';
      paint('#fbe3dc', '#a33', '1px solid #e0a08e');
    } else if (overall === 'MODERATE') {
      cardEl.textContent = 'Overall: MODERATE — stay aware, check back';
      paint('#fdf3e0', '#8a6d1b', '1px solid #e0c98e');
    } else if (overall === 'LOW') {
      cardEl.textContent = 'Overall: LOW — no strong risk signal';
      paint('#e4efe0', '#3c6e47', '1px solid #b9d2bd');
    } else {
      cardEl.textContent = 'UNAVAILABLE — incomplete forecast data';
      paint('#eef1ea', '#657566', '1px solid #c9cfc4');
    }
    if (primEl) {
      primEl.textContent = `Primary concern: ${prettyConcern(data.primary_concern)}. ` +
        `Why: ${overall === 'HIGH' ? `${wetTxt} (≥1 mm/day).` : (data.reasons || []).join(', ') || '—'}`;
    }
    if (evEl) {
      evEl.textContent = `Evidence: ${wetTxt}; max forecast rainfall ${maxTxt}.`;
    }
    if (othEl) {
      const risks = Array.isArray(data.risks) ? data.risks : [];
      const byName = {};
      risks.forEach((r) => { byName[r.name] = r; });
      const watch = byName.DRY_SPELL_WATCH;
      const heavy = byName.HEAVY_RAIN_EVIDENCE;
      const ctx = data.context || {};
      const parts = [];
      if (watch) {
        parts.push(watch.state === 'ACTIVE'
          ? 'Dry-spell watch: PROVISIONAL watch active (IFS validation pending)'
          : `Dry-spell watch: ${String(watch.state || 'unknown').toLowerCase()}`);
      }
      if (heavy && heavy.state === 'PRESENT') {
        parts.push('Heavy-rain evidence present (display-only, not a validated risk)');
      }
      if (ctx.recent_rainfall && ctx.recent_rainfall.available) {
        parts.push(`Recent rainfall: 14-day total ${ctx.recent_rainfall.d14_mm} mm ` +
          `(observed through ${ctx.recent_rainfall.through})`);
      }
      if (ctx.soil && ctx.soil.line) parts.push(`Soil: ${ctx.soil.line}`);
      othEl.textContent = parts.length ? `Other signals: ${parts.join(' · ')}` : '';
    }
    if (advEl) {
      const adv = Array.isArray(data.advisories) ? data.advisories : [data.advisory];
      advEl.textContent = adv.filter(Boolean).join(' ');
    }
  } catch (err) {
    console.error('Agricultural risk failed:', err);
    metaEl.textContent = 'Agricultural risk unavailable.';
    cardEl.textContent = `UNAVAILABLE — ${err.message}`;
    paint('#eef1ea', '#657566', '1px solid #c9cfc4');
    if (primEl) primEl.textContent = '';
    if (evEl) evEl.textContent = '';
    if (othEl) othEl.textContent = '';
    if (advEl) advEl.textContent = 'Agricultural risk is unavailable because the required forecast data is incomplete.';
  }
}

// -------------------------------------------------------------
// 3c. WEEKS 3-4 EXTENDED CLIMATE OUTLOOK (Phase 3B: /api/outlook/*)
// -------------------------------------------------------------
// Display-only, climatology-based outlook: W3 = D+17..D+23, W4 = D+24..D+30.
// Probabilities are the tercile prior (1/3 each); amounts are climatological
// normals for reference, never deterministic forecasts. MJO/IOD/ENSO are
// context only. All honesty states (loading/unavailable/stale/error) explicit.

async function loadWeeks34Outlook(sel, isLegacy, canonical) {
  const tbody = document.querySelector('#w34-matrix-tbody');
  const metaEl = document.querySelector('#w34-meta');
  const freshEl = document.querySelector('#w34-freshness');
  const narrEl = document.querySelector('#w34-narrative');
  if (!tbody || !metaEl) return;

  const label = sel ? SaarthiGeo.locationLabel(sel) : (canonical || 'Sangrur');
  if (!isLegacy) {
    // Phase 3B climatology normals exist for Sangrur blocks only.
    tbody.innerHTML = `<tr><td colspan="5">Extended outlook is served for Sangrur polygon blocks — block climatology is not compiled for ${label}. The live 16-day IFS outlook above is unaffected.</td></tr>`;
    metaEl.textContent = 'Extended outlook unavailable for this block.';
    if (narrEl) narrEl.textContent = '';
    return;
  }
  const block = canonical || 'Sangrur';

  tbody.innerHTML = `<tr><td colspan="5">Loading extended outlook for ${block}…</td></tr>`;
  metaEl.textContent = 'Extended outlook loading…';
  if (narrEl) narrEl.textContent = '';

  try {
    const res = await fetch(`/api/outlook/17-30/${encodeURIComponent(block)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const fmtProb = (p) => `${Math.round(p * 100)}%`;
    const row = (label, w) => {
      if (!w || w.status !== 'available') {
        return `<tr><td><b>${label}</b></td><td colspan="4" style="color:#a33;">Unavailable — ${w ? (w.reason || 'no data') : 'no data'} (never zero-filled)</td></tr>`;
      }
      return `<tr><td><b>${label}</b></td><td>${w.period_start}…${w.period_end}</td>` +
        `<td>${fmtProb(w.below_probability)} / ${fmtProb(w.near_probability)} / ${fmtProb(w.above_probability)}</td>` +
        `<td>${w.climatological_normal_mm} mm <span style="opacity:.65">(normal, not forecast)</span></td>` +
        `<td>${data.confidence || '—'}</td></tr>`;
    };
    tbody.innerHTML = row('W3 (Days 17–23)', data.w3) + row('W4 (Days 24–30)', data.w4);

    const stale = data.climate_context && data.climate_context.any_stale;
    metaEl.textContent =
      `${data.block_name || block}: issued ${data.issue_date} · confidence ${data.confidence || '—'}` +
      (stale ? ' · climate context STALE — confidence capped' : ' · climate context fresh') +
      ` (${data.confidence_reason || ''})`;
    if (freshEl) {
      freshEl.textContent = stale
        ? 'Extended outlook based on STALE climate context — climatology baseline, reduced confidence'
        : `Extended outlook fresh (issued ${data.issue_date}) — climatology baseline`;
      freshEl.style.background = stale ? '#fbe3dc' : '#e4efe0';
      freshEl.style.color = stale ? '#a33' : '#3c6e47';
      freshEl.style.border = stale ? '1px solid #e0a08e' : '1px solid #b9d2bd';
    }
    if (narrEl) narrEl.textContent = data.narrative || '';
    const rec = data.recent_observed || {};
    if (rec.observed_14d_mm == null && rec.observed_30d_mm == null && narrEl) {
      narrEl.textContent += ' Recent observed rainfall unavailable (not zero).';
    }
  } catch (err) {
    console.error('Weeks 3-4 outlook failed:', err);
    metaEl.textContent = 'Extended outlook unavailable.';
    tbody.innerHTML = `<tr><td colspan="5" style="color:#a33;">Extended outlook data is currently unavailable (${err.message}). No fallback outlook is synthesised — please try again.</td></tr>`;
    if (freshEl) {
      freshEl.textContent = 'Extended outlook freshness unknown.';
      freshEl.style.background = '#fbe3dc';
      freshEl.style.color = '#a33';
      freshEl.style.border = '1px solid #e0a08e';
    }
  }
}

async function loadClimateContext() {
  const tbody = document.querySelector('#climate-context-tbody');
  if (!tbody) return;
  try {
    const res = await fetch('/api/climate-context');
    if (!res.ok) throw new Error(`climate-context ${res.status}`);
    const ctx = await res.json();
    if (ctx.available === false) {
      tbody.innerHTML = `<tr><td>Climate context unavailable — ${ctx.reason || 'no data'}. Rainfall forecast above is unaffected.</td></tr>`;
      return;
    }
    const rows = [];
    const mjo = ctx.mjo || {};
    if (mjo.available === false) {
      rows.push(['MJO', `Unavailable — ${mjo.reason || 'no RMM data'}`]);
    } else {
      const f = mjo.forecast_H7 || {};
      const o = mjo.observed || {};
      rows.push(['MJO Phase', `Observed ${o.phase} (amp ${o.amplitude}) → forecast phase ${f.phase} (amp ${f.amplitude}) for ${f.forecast_date}${mjo.stale ? ' — from latest available observations' : ''}`]);
      rows.push(['MJO RMM', `RMM1 ${f.RMM1}, RMM2 ${f.RMM2}`]);
    }
    const enso = ctx.enso || {};
    rows.push(['ENSO', enso.available === false ? `Unavailable — ${enso.reason || ''}` : `${enso.status} (Niño-3.4 anomaly ${enso.nino34_anom}°C, ${enso.latest_month})`]);
    const iod = ctx.iod || {};
    let iodTxt;
    if (iod.available === false) {
      iodTxt = `Data unavailable · Module: integration-ready<br><span style="opacity:.75">Local OISST data unavailable — live IOD enables automatically once OISST ingest lands. No value fabricated.</span>`;
    } else {
      const stale = iod.stale ? `<br><span style="opacity:.75">Latest available IOD data is stale (data ${iod.data_month || ''}).</span>` : '';
      const dmi = `${iod.dmi >= 0 ? '+' : ''}${iod.dmi}°C`;
      iodTxt = `${iod.phase} IOD<br>DMI ${dmi} · Forecast: ${iod.forecast_month || ''} · Model: ${iod.model || ''}${stale}`;
    }
    rows.push(['IOD', iodTxt]);
    tbody.innerHTML = rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('');
  } catch (err) {
    console.error('Climate context failed:', err);
    tbody.innerHTML = `<tr><td>Climate context unavailable — live data could not be loaded. Rainfall forecast above is unaffected.</td></tr>`;
  }
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  updateRouteUI();

  if (activeRoute === 'farmer') {
    const fState = document.querySelector('#form-state');
    const fDist = document.querySelector('#form-district');
    const fBlock = document.querySelector('#form-block');
    if (fState && fDist && fBlock && typeof SaarthiGeo !== 'undefined') {
      SaarthiGeo.wireCascade(fState, fDist, fBlock, (sel) => {
        farmerSelection = sel;
        updateGeoEyebrow();
        if (!sel) return; // mid-cascade: wait for a complete selection
        populatePanchayats(sel.block_name);
        computeFarmerAdvisory();
      });
      document.querySelector('#form-refresh-btn')?.addEventListener('click', computeFarmerAdvisory);
      ['form-crop', 'form-soil', 'form-date', 'form-irrigation'].forEach((id) => {
        document.querySelector(`#${id}`)?.addEventListener('change', computeFarmerAdvisory);
      });
    } else {
      computeFarmerAdvisory();
    }
  } else if (activeRoute === 'map') {
    initRiskMap();
  } else if (activeRoute === 'timeline') {
    loadClimateContext();
    const tState = document.querySelector('#tl-state');
    const tDist = document.querySelector('#tl-district');
    const tBlock = document.querySelector('#live-block-select');
    if (tState && tDist && tBlock && typeof SaarthiGeo !== 'undefined') {
      SaarthiGeo.wireCascade(tState, tDist, tBlock, (sel) => {
        updateGeoEyebrow();
        if (sel) refreshTimeline(sel);
      });
    } else {
      refreshTimeline(null);
    }
  }

  window.addEventListener('languageChanged', () => {
    updateRouteUI();
    updateGeoEyebrow();
    if (activeRoute === 'farmer' && currentFarmerData) {
      renderFarmerAdvisoryView(currentFarmerData);
    }
  });
});

// Portal header eyebrow follows the persisted selection (block · district,
// state); falls back to the translated static label when nothing is chosen.
function updateGeoEyebrow() {
  const el = document.querySelector('.portal-header .eyebrow span[data-i18n="district_name"]');
  if (!el) return;
  const sel = farmerSelection || timelineSelection || SaarthiGeo.loadSelection();
  if (sel) el.textContent = `${sel.block_name} · ${sel.district_name}, ${sel.state_name} · Live ECMWF IFS Outlook`;
}
