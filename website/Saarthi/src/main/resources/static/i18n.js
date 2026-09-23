/**
 * SAARTHI Trilingual Translation Engine
 * Instant Language Switching for English (EN), Hindi (हिं), and Punjabi (ਪੰ)
 * Tailored specifically for Punjab's farming community.
 */

const I18N_DICTIONARY = {
  en: {
    // Navigation
    nav_home: "Overview",
    nav_farmer: "Farmer Portal",
    nav_map: "Risk Map",
    nav_timeline: "Forecast",
    nav_check_block: "Check your block",
    live_monitoring: "Live Monitoring",
    district_name: "Select State → District → Block · Live ECMWF IFS Outlook",
    geo_state: "State",
    geo_district: "District",

    // Hero / Landing
    hero_eyebrow: "Hyperlocal Climate Intelligence",
    hero_title_1: "Know the",
    hero_title_em: "monsoon",
    hero_title_2: "before it arrives.",
    hero_desc: "Live 16-day ECMWF IFS rainfall outlook for your selected block, with a 17–30 day climatological outlook.",
    hero_cta: "Open Farmer Portal",
    hero_secondary_cta: "View Risk Map",
    hero_badge: "Designed for every field, every season",
    hero_card_kicker: "Saarthi · Live Block Outlook",
    hero_card_signal: "This week's monsoon signal",
    hero_card_days: "days",
    hero_card_sub: "early warning for dry spells",
    risk_low: "LOW (<10.94 mm)",
    risk_mod: "NORMAL",
    risk_high: "HIGH (>34.66 mm)",

    // Stats
    stat_1_val: "7-Day",
    stat_1_lbl: "Validated Rainfall Outlook",
    stat_2_val: "D+1–D+16",
    stat_2_lbl: "Live horizon per selected block",
    stat_3_val: "6 Blocks",
    stat_3_lbl: "Validated Bhuvan Boundaries",
    stat_4_val: "19.54 mm",
    stat_4_lbl: "Historical Test MAE (NB04)",

    // Feature Cards
    portal_features_title: "Explore the SAARTHI Platform",
    portal_features_sub: "Decision support portals for farmers and agriculture communities.",
    card_farmer_title: "Farmer Advisory Portal",
    card_farmer_desc: "Personalized sowing decisions, 4-pillar risk breakdown, and root-zone moisture dial.",
    card_map_title: "Block-Scale Outlook Map",
    card_map_desc: "Interactive map with live rainfall categories for Sangrur polygons and any selected block.",
    card_timeline_title: "7-Day Forecast Outlook",
    card_timeline_desc: "Live daily rainfall, probabilities and day-by-day matrix for the selected block.",

    // Landing Outlook Section
    outlook_heading: "Your Block Outlook",
    outlook_title_1: "One selection.",
    outlook_title_em: "A clear decision.",
    outlook_desc: "Select State → District → Block. Saarthi shows the live ECMWF IFS rainfall outlook with 3/7/15-day totals.",
    choose_block: "Choose your block",
    latest_block_analysis: "Latest Block Analysis",
    rain_7d: "7-day total rainfall",
    dry_14d: "Dry / wet days",
    expected_rain: "Heaviest day",
    rain_trend: "Rainfall Trend",
    dry_spell_prob_label: "Dry Spell Probability",
    dry_spell_caption: "LOW / NORMAL / HIGH 7-day rainfall category with calibrated probabilities (training thresholds).",
    sowing_rec: "Sowing Recommendation",

    // Farmer Portal
    farmer_title: "Farmer Advisory",
    farmer_subtitle: "Hyperlocal sowing decisions for your selected block.",
    farm_profile: "Farm Profile",
    lbl_block: "Block",
    lbl_panchayat: "Panchayat",
    lbl_crop: "Crop Variety",
    lbl_soil: "Soil Type",
    lbl_sowing_date: "Planned Sowing Date",
    lbl_irrigation: "Irrigation Source",
    btn_update_advisory: "Compute Advisory",
    lbl_sowing_decision: "Sowing Decision",
    lbl_recommended_window: "Cited Sowing Window",
    lbl_model_confidence: "Model Source",
    pillar_weather: "Weather Watch",
    pillar_soil: "Surface Soil Moisture",
    pillar_crop: "Crop Water Need",
    pillar_dry_spell: "Dry-Spell Watch",
    lbl_root_moisture: "Forecast Surface Soil Moisture",
    lbl_root_moisture_sub: "Volumetric water content in active root zone (0–30 cm).",
    btn_copy_whatsapp: "Share WhatsApp Advisory",
    btn_copied: "Advisory Copied to Clipboard ✓",

    // Map
    map_title: "Block-Scale Outlook Map",
    map_subtitle: "Interactive block map with live rainfall categories.",
    map_filter_block: "Filter by Block",
    map_filter_risk: "Filter by Category",
    map_all_blocks: "All blocks",
    map_all_risks: "All Categories",
    map_panchayats_active: "Panchayats Monitored",

    // Timeline / Forecast
    timeline_title: "7-Day Forecast Outlook",
    timeline_subtitle: "Live daily rainfall and day-by-day matrix for the selected block.",
    timeline_horizon: "Forecast Interval",
    timeline_chart_label: "Probabilistic Cumulative Rainfall vs Soil Moisture Depletion Curve",
    th_day: "Day",
    th_date: "Date",
    th_rain: "Predicted Rain",
    th_temp: "Temperature",
    th_moisture: "Soil Moisture",
    th_risk: "Risk Status",
    th_wetdry: "Wet / Dry (≥1 mm)",

    // Footer
    footer_text: "Climate clarity for stronger rural futures.",
    footer_copy: "© 2026 · SIH26086 Hyperlocal Monsoon Intelligence"
  },

  hi: {
    // Navigation
    nav_home: "मुख्य पृष्ठ",
    nav_farmer: "किसान पोर्टल",
    nav_map: "जोखिम मानचित्र",
    nav_timeline: "पूर्वानुमान",
    nav_check_block: "अपना ब्लॉक देखें",
    live_monitoring: "लाइव मॉनिटरिंग",
    district_name: "राज्य → जिला → ब्लॉक चुनें · लाइव ECMWF IFS आउटलुक",
    geo_state: "राज्य",
    geo_district: "जिला",

    // Hero / Landing
    hero_eyebrow: "अति-स्थानीय जलवायु बुद्धिमत्ता",
    hero_title_1: "मानसून को",
    hero_title_em: "आगमन से पहले",
    hero_title_2: "सटीकता से जानें।",
    hero_desc: "आपके चुने गए ब्लॉक के लिए लाइव 16-दिवसीय ECMWF IFS वर्षा पूर्वानुमान, 17–30 दिवसीय जलवायु आउटलुक सहित।",
    hero_cta: "किसान पोर्टल खोलें",
    hero_secondary_cta: "जोखिम नक्शा देखें",
    hero_badge: "हर खेत, हर मौसम के लिए तैयार",
    hero_card_kicker: "सारथी · लाइव ब्लॉक आउटलुक",
    hero_card_signal: "इस सप्ताह का मानसूनी संकेत",
    hero_card_days: "दिन",
    hero_card_sub: "सूखे की पूर्व चेतावनी",
    risk_low: "LOW (<10.94 mm)",
    risk_mod: "NORMAL",
    risk_high: "HIGH (>34.66 mm)",

    // Stats
    stat_1_val: "7-दिवसीय",
    stat_1_lbl: "सत्यापित वर्षा पूर्वानुमान",
    stat_2_val: "D+1–D+16",
    stat_2_lbl: "चुने गए ब्लॉक हेतु लाइव अवधि",
    stat_3_val: "6 ब्लॉक",
    stat_3_lbl: "सत्यापित भूवन सीमाएँ",
    stat_4_val: "19.54 mm",
    stat_4_lbl: "ऐतिहासिक टेस्ट MAE",

    // Feature Cards
    portal_features_title: "सारथी प्लेटफॉर्म का अन्वेषण करें",
    portal_features_sub: "किसानों और कृषि समुदायों के लिए निर्णय सहायता पोर्टल।",
    card_farmer_title: "किसान परामर्श पोर्टल",
    card_farmer_desc: "व्यक्तिगत बुवाई निर्णय, 4-स्तंभ जोखिम विश्लेषण और मिट्टी की नमी का मीटर।",
    card_map_title: "ब्लॉक-स्तरीय दृष्टिकोण मानचित्र",
    card_map_desc: "संगरूर बहुभुजों और चुने गए ब्लॉक के लिए लाइव वर्षा श्रेणियों वाला इंटरएक्टिव मानचित्र।",
    card_timeline_title: "7-दिवसीय पूर्वानुमान",
    card_timeline_desc: "चुने गए ब्लॉक के लिए लाइव दैनिक वर्षा, संभावनाएँ और तालिका।",

    // Landing Outlook Section
    outlook_heading: "आपके ब्लॉक का पूर्वानुमान",
    outlook_title_1: "एक चयन।",
    outlook_title_em: "स्पष्ट निर्णय।",
    outlook_desc: "राज्य → जिला → ब्लॉक चुनें। सारथी 3/7/15-दिवसीय योग सहित लाइव ECMWF IFS वर्षा पूर्वानुमान दिखाता है।",
    choose_block: "अपना ब्लॉक चुनें",
    latest_block_analysis: "नवीनतम ब्लॉक विश्लेषण",
    rain_7d: "7-दिवसीय कुल वर्षा",
    dry_14d: "सूखे / गीले दिन",
    expected_rain: "सर्वाधिक वर्षा दिवस",
    rain_trend: "वर्षा का रुझान",
    dry_spell_prob_label: "सूखे की संभावना",
    dry_spell_caption: "कैलिब्रेटेड संभावनाओं सहित LOW / NORMAL / HIGH 7-दिवसीय वर्षा श्रेणी।",
    sowing_rec: "बुवाई की सिफारिश",

    // Farmer Portal
    farmer_title: "किसान परामर्श पोर्टल",
    farmer_subtitle: "आपके चुने गए ब्लॉक के लिए अति-स्थानीय बुवाई निर्णय।",
    farm_profile: "खेत की प्रोफाइल",
    lbl_block: "ब्लॉक",
    lbl_panchayat: "पंचायत",
    lbl_crop: "फसल किस्म",
    lbl_soil: "मिट्टी का प्रकार",
    lbl_sowing_date: "योजनाबद्ध बुवाई तिथि",
    lbl_irrigation: "सिंचाई का साधन",
    btn_update_advisory: "सलाह अपडेट करें",
    lbl_sowing_decision: "बुवाई का निर्णय",
    lbl_recommended_window: "अनुशंसित बुवाई अवधि",
    lbl_model_confidence: "मॉडल स्रोत",
    pillar_weather: "मौसम जोखिम",
    pillar_soil: "मिट्टी नमी जोखिम",
    pillar_crop: "फसल संवेदनशीलता",
    pillar_dry_spell: "सूखे का अनुमानित जोखिम",
    lbl_root_moisture: "जड़-क्षेत्र मिट्टी की नमी",
    lbl_root_moisture_sub: "सक्रिय जड़ क्षेत्र (0–30 सेमी) में पानी की मात्रा।",
    btn_copy_whatsapp: "व्हाट्सएप सलाह कॉपी करें",
    btn_copied: "सलाह क्लिपबोर्ड पर कॉपी हो गई ✓",

    // Map
    map_title: "ब्लॉक-स्तरीय दृष्टिकोण मानचित्र",
    map_subtitle: "लाइव वर्षा श्रेणियों वाला इंटरएक्टिव ब्लॉक मानचित्र।",
    map_filter_block: "ब्लॉक के अनुसार फ़िल्टर करें",
    map_filter_risk: "श्रेणी अनुसार फ़िल्टर करें",
    map_all_blocks: "सभी ब्लॉक",
    map_all_risks: "सभी श्रेणियाँ",
    map_panchayats_active: "निगरानी में पंचायतें",

    // Timeline / Forecast
    timeline_title: "7-दिवसीय मौसम पूर्वानुमान",
    timeline_subtitle: "चुने गए ब्लॉक के लिए लाइव दैनिक वर्षा और तालिका।",
    timeline_horizon: "पूर्वानुमान अवधि",
    timeline_chart_label: "संभाव्य संचयी वर्षा बनाम मिट्टी की नमी ह्रास वक्र",
    th_day: "दिन",
    th_date: "दिनांक",
    th_rain: "अनुमानित वर्षा",
    th_temp: "तापमान",
    th_moisture: "मिट्टी की नमी",
    th_risk: "जोखिम स्थिति",
    th_wetdry: "गीला / सूखा (≥1 मिमी)",

    // Footer
    footer_text: "मजबूत ग्रामीण भविष्य के लिए सटीक मौसम बुद्धिमत्ता।",
    footer_copy: "© 2026 · SIH26086 अति-स्थानीय मानसूनी बुद्धिमत्ता प्रणाली"
  },

  pa: {
    // Navigation
    nav_home: "ਮੁੱਖ ਪੰਨਾ",
    nav_farmer: "ਕਿਸਾਨ ਪੋਰਟਲ",
    nav_map: "ਜੋਖਮ ਨਕਸ਼ਾ",
    nav_timeline: "ਮੌਸਮ ਭਵਿੱਖਬਾਣੀ",
    nav_check_block: "ਆਪਣਾ ਬਲਾਕ ਵੇਖੋ",
    live_monitoring: "ਲਾਈਵ ਨਿਗਰਾਨੀ",
    district_name: "ਰਾਜ → ਜ਼ਿਲ੍ਹਾ → ਬਲਾਕ ਚੁਣੋ · ਲਾਈਵ ECMWF IFS ਆਉਟਲੁੱਕ",
    geo_state: "ਰਾਜ",
    geo_district: "ਜ਼ਿਲ੍ਹਾ",

    // Hero / Landing
    hero_eyebrow: "ਹਾਈਪਰਲੋਕਲ ਮੌਸਮੀ ਸੂਝ-ਬੂਝ",
    hero_title_1: "ਮੌਨਸੂਨ ਨੂੰ",
    hero_title_em: "ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ",
    hero_title_2: "ਚੰਗੀ ਤਰ੍ਹਾਂ ਜਾਣੋ।",
    hero_desc: "ਤੁਹਾਡੇ ਚੁਣੇ ਬਲਾਕ ਲਈ ਲਾਈਵ 16-ਦਿਨਾਂ ECMWF IFS ਮੀਂਹ ਦਾ ਅਨੁਮਾਨ, 17–30 ਦਿਨਾਂ ਜਲਵਾਯੂ ਆਉਟਲੁੱਕ ਸਮੇਤ।",
    hero_cta: "ਕਿਸਾਨ ਪੋਰਟਲ ਖੋਲ੍ਹੋ",
    hero_secondary_cta: "ਜੋਖਮ ਨਕਸ਼ਾ ਵੇਖੋ",
    hero_badge: "ਹਰ ਖੇਤ, ਹਰ ਮੌਸਮ ਲਈ ਤਿਆਰ",
    hero_card_kicker: "ਸਾਰਥੀ · ਲਾਈਵ ਬਲਾਕ ਆਉਟਲੁੱਕ",
    hero_card_signal: "ਇਸ ਹਫ਼ਤੇ ਦਾ ਮੌਨਸੂਨੀ ਸੰਕੇਤ",
    hero_card_days: "ਦਿਨ",
    hero_card_sub: "ਸੋਕੇ ਦੀ ਅਗੇਤੀ ਚੇਤਾਵਨੀ",
    risk_low: "LOW (<10.94 mm)",
    risk_mod: "NORMAL",
    risk_high: "HIGH (>34.66 mm)",

    // Stats
    stat_1_val: "7-ਦਿਨਾਂ",
    stat_1_lbl: "ਪ੍ਰਮਾਣਿਤ ਮੀਂਹ ਅਨੁਮਾਨ",
    stat_2_val: "D+1–D+16",
    stat_2_lbl: "ਚੁਣੇ ਬਲਾਕ ਲਈ ਲਾਈਵ ਮਿਆਦ",
    stat_3_val: "6 ਬਲਾਕ",
    stat_3_lbl: "ਪ੍ਰਮਾਣਿਤ ਭੁਵਨ ਹੱਦਾਂ",
    stat_4_val: "19.54 mm",
    stat_4_lbl: "ਇਤਿਹਾਸਕ ਟੈਸਟ MAE",

    // Feature Cards
    portal_features_title: "ਸਾਰਥੀ ਪਲੇਟਫਾਰਮ ਦੀਆਂ ਸੇਵਾਵਾਂ",
    portal_features_sub: "ਕਿਸਾਨਾਂ ਅਤੇ ਖੇਤੀਬਾੜੀ ਲਈ ਫ਼ੈਸਲਾ-ਸਹਾਇਤਾ ਪੋਰਟਲ।",
    card_farmer_title: "ਕਿਸਾਨ ਸਲਾਹਕਾਰ ਪੋਰਟਲ",
    card_farmer_desc: "ਖੇਤ ਮੁਤਾਬਕ ਬੀਜਾਈ ਦੇ ਫ਼ੈਸਲੇ, 4-ਥੰਮ੍ਹ ਜੋਖਮ ਵੇਰਵੇ ਅਤੇ ਜ਼ਮੀਨੀ ਨਮੀ ਦਾ ਮੀਟਰ।",
    card_map_title: "ਬਲਾਕ ਪੱਧਰੀ ਨਕਸ਼ਾ",
    card_map_desc: "ਸੰਗਰੂਰ ਬਹੁਭੁਜਾਂ ਅਤੇ ਚੁਣੇ ਬਲਾਕ ਲਈ ਲਾਈਵ ਮੀਂਹ ਸ਼੍ਰੇਣੀਆਂ ਵਾਲਾ ਇੰਟਰਐਕਟਿਵ ਨਕਸ਼ਾ।",
    card_timeline_title: "7-ਦਿਨਾਂ ਮੌਸਮ ਅਨੁਮਾਨ",
    card_timeline_desc: "ਚੁਣੇ ਬਲਾਕ ਲਈ ਲਾਈਵ ਰੋਜ਼ਾਨਾ ਮੀਂਹ, ਸੰਭਾਵਨਾਵਾਂ ਅਤੇ ਸਾਰਣੀ।",

    // Landing Outlook Section
    outlook_heading: "ਤੁਹਾਡੇ ਬਲਾਕ ਦਾ ਮੌਸਮ ਹਾਲ",
    outlook_title_1: "ਇੱਕ ਚੋਣ।",
    outlook_title_em: "ਸਪੱਸ਼ਟ ਫ਼ੈਸਲਾ।",
    outlook_desc: "ਰਾਜ → ਜ਼ਿਲ੍ਹਾ → ਬਲਾਕ ਚੁਣੋ। ਸਾਰਥੀ 3/7/15-ਦਿਨਾਂ ਜੋੜ ਸਮੇਤ ਲਾਈਵ ECMWF IFS ਮੀਂਹ ਦਾ ਅਨੁਮਾਨ ਦਿਖਾਉਂਦਾ ਹੈ।",
    choose_block: "ਆਪਣਾ ਬਲਾਕ ਚੁਣੋ",
    latest_block_analysis: "ਤਾਜ਼ਾ ਬਲਾਕ ਵਿਸ਼ਲੇਸ਼ਣ",
    rain_7d: "7-ਦਿਨਾਂ ਕੁੱਲ ਮੀਂਹ",
    dry_14d: "ਸੁੱਕੇ / ਗਿੱਲੇ ਦਿਨ",
    expected_rain: "ਸਭ ਤੋਂ ਵੱਧ ਮੀਂਹ ਵਾਲਾ ਦਿਨ",
    rain_trend: "ਮੀਂਹ ਦਾ ਰੁਝਾਨ",
    dry_spell_prob_label: "ਸੋਕੇ ਦੀ ਸੰਭਾਵਨਾ",
    dry_spell_caption: "ਕੈਲੀਬਰੇਟਡ ਸੰਭਾਵਨਾਵਾਂ ਸਮੇਤ LOW / NORMAL / HIGH 7-ਦਿਨਾਂ ਮੀਂਹ ਸ਼੍ਰੇਣੀ।",
    sowing_rec: "ਬੀਜਾਈ ਦੀ ਸਿਫ਼ਾਰਸ਼",

    // Farmer Portal
    farmer_title: "ਕਿਸਾਨ ਸਲਾਹਕਾਰ ਪੋਰਟਲ",
    farmer_subtitle: "ਤੁਹਾਡੇ ਚੁਣੇ ਬਲਾਕ ਲਈ ਹਾਈਪਰਲੋਕਲ ਬੀਜਾਈ ਫ਼ੈਸਲੇ।",
    farm_profile: "ਖੇਤ ਦਾ ਵੇਰਵਾ",
    lbl_block: "ਬਲਾਕ",
    lbl_panchayat: "ਪੰਚਾਇਤ",
    lbl_crop: "ਫ਼ਸਲ ਦੀ ਕਿਸਮ",
    lbl_soil: "ਮਿੱਟੀ ਦੀ ਕਿਸਮ",
    lbl_sowing_date: "ਬੀਜਾਈ ਦੀ ਮਿਤੀ",
    lbl_irrigation: "ਸਿੰਚਾਈ ਦਾ ਸਾਧਨ",
    btn_update_advisory: "ਸਲਾਹ ਤਾਜ਼ਾ ਕਰੋ",
    lbl_sowing_decision: "ਬੀਜਾਈ ਦਾ ਫ਼ੈਸਲਾ",
    lbl_recommended_window: "ਸਿਫ਼ਾਰਸ਼ੀ ਸਮਾਂ",
    lbl_model_confidence: "ਮਾਡਲ ਸਰੋਤ",
    pillar_weather: "ਮੌਸਮ ਜੋਖਮ",
    pillar_soil: "ਮਿੱਟੀ ਨਮੀ ਜੋਖਮ",
    pillar_crop: "ਫ਼ਸਲ ਸੰਵੇਦਨਸ਼ੀਲਤਾ",
    pillar_dry_spell: "ਸੋਕੇ ਦਾ ਅਨੁਮਾਨਿਤ ਖ਼ਤਰਾ",
    lbl_root_moisture: "ਜੜ੍ਹ-ਖੇਤਰ ਮਿੱਟੀ ਦੀ ਨਮੀ",
    lbl_root_moisture_sub: "ਜੜ੍ਹ-ਖੇਤਰ (0–30 ਸੈਂਟੀਮੀਟਰ) ਵਿੱਚ ਪਾਣੀ ਦੀ ਮਾਤਰਾ।",
    btn_copy_whatsapp: "ਵਟਸਐਪ ਸਲਾਹ ਕਾਪੀ ਕਰੋ",
    btn_copied: "ਸਲਾਹ ਕਲਿੱਪਬੋਰਡ 'ਤੇ ਕਾਪੀ ਹੋ ਗਈ ✓",

    // Map
    map_title: "ਬਲਾਕ ਪੱਧਰੀ ਨਕਸ਼ਾ",
    map_subtitle: "ਲਾਈਵ ਮੀਂਹ ਸ਼੍ਰੇਣੀਆਂ ਵਾਲਾ ਇੰਟਰਐਕਟਿਵ ਬਲਾਕ ਨਕਸ਼ਾ।",
    map_filter_block: "ਬਲਾਕ ਅਨੁਸਾਰ ਫ਼ਿਲਟਰ",
    map_filter_risk: "ਸ਼੍ਰੇਣੀ ਅਨੁਸਾਰ ਫ਼ਿਲਟਰ",
    map_all_blocks: "ਸਾਰੇ ਬਲਾਕ",
    map_all_risks: "ਸਾਰੀਆਂ ਸ਼੍ਰੇਣੀਆਂ",
    map_panchayats_active: "ਨਿਗਰਾਨੀ ਅਧੀਨ ਪੰਚਾਇਤਾਂ",

    // Timeline / Forecast
    timeline_title: "7-ਦਿਨਾਂ ਮੌਸਮ ਅਨੁਮਾਨ",
    timeline_subtitle: "ਚੁਣੇ ਬਲਾਕ ਲਈ ਲਾਈਵ ਰੋਜ਼ਾਨਾ ਮੀਂਹ ਅਤੇ ਸਾਰਣੀ।",
    timeline_horizon: "ਅਨੁਮਾਨ ਸਮਾਂ",
    timeline_chart_label: "ਸੰਭਾਵੀ ਮੀਂਹ ਬਨਾਮ ਮਿੱਟੀ ਨਮੀ ਗਿਰਾਵਟ ਗ੍ਰਾਫ਼",
    th_day: "ਦਿਨ",
    th_date: "ਮਿਤੀ",
    th_rain: "ਅਨੁਮਾਨਿਤ ਮੀਂਹ",
    th_temp: "ਤਾਪਮਾਨ",
    th_moisture: "ਮਿੱਟੀ ਨਮੀ",
    th_risk: "ਜੋਖਮ ਹਾਲਤ",
    th_wetdry: "ਗਿੱਲਾ / ਸੁੱਕਾ (≥1 ਮਿਮੀ)",

    // Footer
    footer_text: "ਖੇਤੀਬਾੜੀ ਭਵਿੱਖ ਲਈ ਸਟੀਕ ਮੌਸਮੀ ਜਾਣਕਾਰੀ।",
    footer_copy: "© 2026 · SIH26086 ਹਾਈਪਰਲੋਕਲ ਮੌਨਸੂਨ ਸੂਚਨਾ ਪ੍ਰਣਾਲੀ"
  }
};

let currentLanguage = localStorage.getItem("saarthi_lang") || "en";

function getTranslation(key, lang = currentLanguage) {
  if (I18N_DICTIONARY[lang] && I18N_DICTIONARY[lang][key]) {
    return I18N_DICTIONARY[lang][key];
  }
  if (I18N_DICTIONARY.en[key]) {
    return I18N_DICTIONARY.en[key];
  }
  return key;
}

function setLanguage(lang) {
  if (!["en", "hi", "pa"].includes(lang)) lang = "en";
  currentLanguage = lang;
  localStorage.setItem("saarthi_lang", lang);
  applyTranslations();
  
  // Trigger custom event for reactive components
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: { language: lang } }));
}

function applyTranslations() {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const trans = getTranslation(key);
    if (trans) {
      if (el.tagName === "INPUT" && el.getAttribute("type") === "button") {
        el.value = trans;
      } else if (el.hasAttribute("data-i18n-placeholder")) {
        el.placeholder = trans;
      } else {
        el.innerHTML = trans;
      }
    }
  });

  // Update active states on trilingual buttons
  document.querySelectorAll(".lang-btn, .lang-switcher button").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLanguage);
  });

  // Update HTML lang attribute
  document.documentElement.lang = currentLanguage;
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  
  // Bind click handlers to language buttons
  document.querySelectorAll(".lang-btn, .lang-switcher button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const chosen = btn.getAttribute("data-lang");
      if (chosen) setLanguage(chosen);
    });
  });
});
