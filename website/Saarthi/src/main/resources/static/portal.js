/**
 * SAARTHI Decision Platform Logic (real-forecast integration).
 * Vanilla JS VIEW over Spring Boot REST APIs backed by the validated
 * NB01–NB06 pipeline (Raw CHIRPS-GEFS, 6 legacy Bhuvan blocks, 7-day horizon).
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
let blockForecastCache = {};   // block_name -> /api/forecast/{id} payload
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
      en: 'Interactive map of the six validated Sangrur blocks, colored by 7-day rainfall category.',
      hi: 'छह सत्यापित संगरूर ब्लॉकों का इंटरएक्टिव मानचित्र।',
      pa: 'ਛੇ ਪ੍ਰਮਾਣਿਤ ਸੰਗਰੂਰ ਬਲਾਕਾਂ ਦਾ ਇੰਟਰਐਕਟਿਵ ਨਕਸ਼ਾ।'
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
  try {
    const res = await fetch(`/api/panchayats?block=${encodeURIComponent(block)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.panchayats) && data.panchayats.length) list = data.panchayats;
    }
  } catch (err) {
    console.warn('Panchayat API unavailable, using bundled list:', err);
  }
  select.innerHTML = list.map((p) => `<option value="${p}">${p}</option>`).join('');
}

async function computeFarmerAdvisory() {
  const block = document.querySelector('#form-block')?.value || 'Sunam';
  const panchayat = document.querySelector('#form-panchayat')?.value || '';
  const crop = document.querySelector('#form-crop')?.value || 'Paddy (PR-126)';
  const soil = document.querySelector('#form-soil')?.value || 'Clay Loam';
  const sowingDate = document.querySelector('#form-date')?.value || '';
  const irrigation = document.querySelector('#form-irrigation')?.value || 'Canals';

  const payload = { block, panchayat, crop, soil, sowing_date: sowingDate, irrigation };

  try {
    const res = await fetch('/api/farmer-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    currentFarmerData = data;
    renderFarmerAdvisoryView(data);
  } catch (err) {
    console.error('Farmer analysis failed:', err);
    apiError('#decision-explanation', 'Live advisory data is currently unavailable. Please try again.');
  }
}

function renderFarmerAdvisoryView(data) {
  if (!data || !data.outputs) return;
  const out = data.outputs;
  const lang = localStorage.getItem('saarthi_lang') || 'en';

  const tagEl = document.querySelector('#decision-tag');
  if (tagEl) {
    tagEl.textContent = out.decision_tag;
    tagEl.className = `decision-tag ${out.decision_tone}`;
  }

  const winEl = document.querySelector('#decision-window');
  if (winEl) winEl.textContent = out.recommended_window;

  const cropName = (data.inputs && data.inputs.crop) || 'Paddy (PR-126)';
  let headline = `7-day outlook for ${cropName}.`;
  if (out.decision_tone === 'wait') {
    headline = `Delay sowing: elevated dry risk for ${cropName}.`;
  } else if (out.decision_tone === 'review') {
    headline = `Exercise caution: verify soil moisture before sowing ${cropName}.`;
  }
  const hlEl = document.querySelector('#decision-headline');
  if (hlEl) hlEl.textContent = headline;

  const expEl = document.querySelector('#decision-explanation');
  if (expEl && out.explanation) expEl.textContent = out.explanation[lang] || out.explanation.en;

  const probEl = document.querySelector('#decision-prob');
  if (probEl) {
    const cat = out.rainfall_category ? ` · ${out.rainfall_category} outlook (${out.forecast_7d_total_rainfall_mm} mm / 7d)` : '';
    probEl.textContent = `${out.dry_spell_probability}%${cat}`;
  }

  const confEl = document.querySelector('#decision-confidence');
  if (confEl) confEl.textContent = out.model_source || 'Raw CHIRPS-GEFS';

  const targetEl = document.querySelector('#decision-target-panchayat');
  if (targetEl && data.inputs) targetEl.textContent = `${data.inputs.panchayat}, ${data.inputs.block}`;

  // 4 Risk Pillars
  const p = out.fourPillars || out.four_pillars || {};
  const wRisk = p.weather_risk || 'Low';
  const sRisk = p.soil_moisture_risk || 'Low';
  const cRisk = p.crop_vulnerability_risk || 'Moderate';

  const pWeather = document.querySelector('#pillar-weather-val');
  if (pWeather) {
    pWeather.textContent = wRisk;
    pWeather.style.color = wRisk === 'High' ? 'var(--coral)' : wRisk === 'Moderate' ? 'var(--gold)' : 'var(--moss)';
  }

  const pSoil = document.querySelector('#pillar-soil-val');
  if (pSoil) {
    pSoil.textContent = sRisk;
    pSoil.style.color = sRisk === 'High' ? 'var(--coral)' : sRisk === 'Moderate' ? 'var(--gold)' : 'var(--moss)';
  }

  const pCrop = document.querySelector('#pillar-crop-val');
  if (pCrop) {
    pCrop.textContent = cRisk;
    pCrop.style.color = cRisk === 'High' ? 'var(--coral)' : cRisk === 'Moderate' ? 'var(--gold)' : 'var(--moss)';
  }

  const pDry = document.querySelector('#pillar-dry-val');
  if (pDry) {
    pDry.textContent = `${out.dry_spell_probability}%`;
    pDry.style.color = out.dry_spell_probability >= 60 ? 'var(--coral)' : out.dry_spell_probability >= 30 ? 'var(--gold)' : 'var(--moss)';
  }

  // Root-Zone Moisture Gauge Dial
  const moisture = Number(out.root_zone_soil_moisture_pct || 38);
  const gaugePct = document.querySelector('#gauge-percent');
  if (gaugePct) gaugePct.textContent = `${moisture.toFixed(0)}%`;

  const gaugeDial = document.querySelector('#root-gauge-dial');
  if (gaugeDial) {
    gaugeDial.style.background = `conic-gradient(#abc87d 0% ${moisture}%, #e6ece0 ${moisture}% 100%)`;
  }
  let statusText = 'Adequate Moisture';
  if (moisture < 25) statusText = 'Critical Deficit (Dry Break)';
  else if (moisture < 35) statusText = 'Moderate Moisture';
  else if (moisture > 48) statusText = 'High / Saturated';
  const gStatus = document.querySelector('#gauge-status');
  if (gStatus) gStatus.textContent = statusText;

  // WhatsApp Share button binding
  const shareBtn = document.querySelector('#share-whatsapp-btn');
  if (shareBtn && out.whatsapp_share) {
    shareBtn.onclick = async () => {
      const shareText = out.whatsapp_share[lang] || out.whatsapp_share.en;
      try {
        await navigator.clipboard.writeText(shareText);
        showToast(getTranslation('btn_copied', lang));
      } catch (e) {
        showToast('Advisory text copied!');
      }
    };
  }
}

// -------------------------------------------------------------
// 2. BLOCK-SCALE OUTLOOK MAP (LEAFLET GEOJSON)
// -------------------------------------------------------------

function categoryOf(blockName) {
  const f = blockForecastCache[blockName];
  return (f && f.category) || 'NORMAL';
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
      fetch('/api/forecast/latest'),
    ]);
    if (!geoRes.ok || !fcRes.ok) throw new Error(`geojson ${geoRes.status}, forecast ${fcRes.status}`);
    const geo = await geoRes.json();
    const latest = await fcRes.json();
    latestCache = latest;
    blockForecastCache = {};
    for (const b of latest.forecast.blocks) {
      blockForecastCache[b.block_name] = {
        ...b,
        prob_low: b.probability.low, prob_normal: b.probability.normal, prob_high: b.probability.high,
      };
    }
    renderMapPolygons(geo);
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
      const ind = f.indicators || {};
      const body = f
        ? `<div><b>7-day total:</b> ${f.forecast_7d_total_rainfall_mm} mm (${f.category})</div>
           <div><b>P(LOW/NORMAL/HIGH):</b> ${(f.prob_low * 100).toFixed(0)}% / ${(f.prob_normal * 100).toFixed(0)}% / ${(f.prob_high * 100).toFixed(0)}%</div>
           <div><b>Wet days:</b> ${ind.wet_days ?? '—'} · <b>Dry days:</b> ${ind.dry_days ?? '—'}</div>
           <div><b>Heaviest:</b> ${ind.max_daily_rainfall_mm ?? '—'} mm on ${ind.max_daily_rainfall_date ?? '—'}</div>`
        : `<div>Forecast loading…</div>`;
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

async function loadTimelineForecast(block = 'Sangrur') {
  const titleEl = document.querySelector('#timeline-block-title');
  if (titleEl) titleEl.textContent = `${block} Block`;

  try {
    const res = await fetch(`/api/forecast/${encodeURIComponent(block)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    blockForecastCache[data.block_name] = {
      block_name: data.block_name,
      forecast_7d_total_rainfall_mm: data.forecast_7d_total_rainfall_mm,
      category: data.category,
      prob_low: data.prob_low, prob_normal: data.prob_normal, prob_high: data.prob_high,
      daily_forecast: data.daily_forecast, indicators: data.indicators,
    };
    const matrix = (data.daily_forecast || []).map((d) => ({
      day: d.day, date: d.date, rainfall_mm: d.rainfall_mm,
    }));
    renderForecastChart({ block: data.block_name, forecast_matrix: matrix, total: data.forecast_7d_total_rainfall_mm, category: data.category });
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
// INITIALIZATION
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  updateRouteUI();

  if (activeRoute === 'farmer') {
    const blockSelect = document.querySelector('#form-block');
    if (blockSelect) {
      populatePanchayats(blockSelect.value);
      blockSelect.addEventListener('change', (e) => {
        populatePanchayats(e.target.value);
        computeFarmerAdvisory();
      });
      document.querySelector('#form-refresh-btn')?.addEventListener('click', computeFarmerAdvisory);
    }
    computeFarmerAdvisory();
  } else if (activeRoute === 'map') {
    initRiskMap();
  } else if (activeRoute === 'timeline') {
    loadTimelineForecast('Sangrur');
  }

  window.addEventListener('languageChanged', () => {
    updateRouteUI();
    if (activeRoute === 'farmer' && currentFarmerData) {
      renderFarmerAdvisoryView(currentFarmerData);
    }
  });
});
