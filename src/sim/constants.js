// Every number the simulator uses lives here, with its source and an honesty label.
// Labels: PUBLISHED (value from a cited document), DERIVED (computed from cited values or physics),
// GAME ESTIMATE (chosen for play; plausible order of magnitude, not a design value).

export const C = {
  crew: { value: 4, unit: 'people', label: 'GAME ESTIMATE', source: 'Mission design choice' },

  // --- Life support (NASA OCHMO-TB-002 Rev B, Nov 2023, derived from NASA-STD-3001 Vol 2 Rev D) ---
  o2ActiveKgPerPersonDay: {
    value: 1.083, unit: 'kg/person/day', label: 'PUBLISHED',
    source: 'NASA OCHMO-TB-002 Rev B (2023): daily oxygen consumption with exercise',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf',
  },
  o2RestKgPerPersonDay: {
    value: 0.771, unit: 'kg/person/day', label: 'PUBLISHED',
    source: 'NASA OCHMO-TB-002 Rev B (2023): resting oxygen consumption',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf',
  },
  waterKgPerPersonDay: {
    value: 2.5, unit: 'kg/person/day', label: 'PUBLISHED',
    source: 'NASA-STD-3001 V2 6109 via OCHMO-TB-002: minimum 2.5 L drinking water per crewmember per day',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf',
  },
  foodKcalPerPersonDay: {
    value: 3035, unit: 'kcal/person/day', label: 'PUBLISHED',
    source: 'NASA-STD-3001 V2 7003 via OCHMO-TB-002: average 3,035 kcal per crewmember per day',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf',
  },
  foodKgPerPersonDay: { value: 1.0, unit: 'kg/person/day', label: 'GAME ESTIMATE', source: 'Packaged food incl. packaging, rounded' },
  rationFactor: { value: 0.75, unit: '×', label: 'GAME ESTIMATE', source: 'Reduced rations' },

  // --- Radiation ---
  moonSurfaceDoseMSvPerDay: {
    value: 1.369, unit: 'mSv/day', label: 'PUBLISHED',
    source: "Zhang et al. 2020, Science Advances 6:eaaz1334 — Chang'e-4 LND dose equivalent on the lunar surface",
    url: 'https://doi.org/10.1126/sciadv.aaz1334',
  },
  habitatShieldFactor: { value: 0.8, unit: '×', label: 'GAME ESTIMATE', source: 'Habitat walls give modest protection from galactic cosmic rays' },
  stormDoseMSvPerHour: { value: 1.0, unit: 'mSv/h (unshielded)', label: 'GAME ESTIMATE', source: 'DONKI gives event times only; storm strength chosen for play' },
  stormHours: { value: 24, unit: 'h', label: 'GAME ESTIMATE', source: 'Duration of the in-game storm pulse after each real DONKI SEP onset' },
  shelterFullWallKg: { value: 3000, unit: 'kg water', label: 'GAME ESTIMATE', source: 'Water mass at which the shelter reaches its best protection' },
  shelterBestFactor: { value: 0.3, unit: '×', label: 'GAME ESTIMATE', source: 'Water and hydrogen-rich materials cut storm protons strongly' },
  doseBudgetMSv: {
    value: 50, unit: 'mSv', label: 'GAME ESTIMATE',
    source: 'Mission budget set at about 8% of NASA\'s 600 mSv career limit (NASA-STD-3001 Vol 1)',
  },

  // --- Power ---
  batteryWhPerKg: { value: 150, unit: 'Wh/kg', label: 'GAME ESTIMATE', source: 'Typical lithium-ion pack-level specific energy' },
  chargeEfficiency: { value: 0.92, unit: '×', label: 'GAME ESTIMATE', source: 'Battery charge/discharge losses' },
  arrayKgPerKw: { value: 20, unit: 'kg/kW', label: 'GAME ESTIMATE', source: 'Sun-tracking array incl. mast' },
  sunDiscRadiusDeg: { value: 0.27, unit: 'deg', label: 'DERIVED', source: 'Apparent solar radius from the Moon (~0.27°)' },
  loadLifeSupportKw: { value: 1.0, unit: 'kW', label: 'GAME ESTIMATE', source: 'Air revitalization, fans, pumps for 4 crew' },
  loadCommsKw: { value: 0.15, unit: 'kW', label: 'GAME ESTIMATE', source: 'Direct-to-Earth radio' },
  loadScienceKw: { value: 0.6, unit: 'kW', label: 'GAME ESTIMATE', source: 'Science instruments and lab' },
  loadGreenhousePerModuleKw: { value: 1.5, unit: 'kW', label: 'GAME ESTIMATE', source: 'LED grow lights + climate control per module' },
  loadHeatDayKw: { value: 0.2, unit: 'kW', label: 'GAME ESTIMATE', source: 'Little heating needed in sunlight' },
  loadHeatNightKw: { value: 1.5, unit: 'kW', label: 'GAME ESTIMATE', source: 'Keeping the habitat comfortable through a polar lunar night' },
  loadHeatSurvivalKw: { value: 0.7, unit: 'kW', label: 'GAME ESTIMATE', source: 'Cold-but-safe survival heating' },

  // --- Food production ---
  greenhouseLitHoursToHarvest: { value: 240, unit: 'lit hours', label: 'GAME ESTIMATE', source: 'Fast salad crops; real crops take weeks' },
  greenhouseKcalPerModuleDay: { value: 2000, unit: 'kcal/day per module', label: 'GAME ESTIMATE', source: 'Output once established, while lights are on' },

  // --- Masses ---
  massBudgetKg: { value: 10000, unit: 'kg', label: 'GAME ESTIMATE', source: 'Cargo you can land' },
  greenhouseModuleKg: { value: 400, unit: 'kg', label: 'GAME ESTIMATE', source: 'One small growth module' },

  // --- Failure thresholds ---
  blackoutHoursToLoss: { value: 6, unit: 'h', label: 'GAME ESTIMATE', source: 'Without power, CO₂ builds up and the habitat freezes' },
  starvationHoursToLoss: { value: 72, unit: 'h', label: 'GAME ESTIMATE', source: 'Crew must abort after 3 days without food' },
};

export const v = (k) => C[k].value;
