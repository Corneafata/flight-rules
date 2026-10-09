// Environment record for mission "The Long Night".
// Site: Chandrayaan-3 Vikram landing site (ISRO), approx. 69.37 S, 32.32 E.
// Every array value is OBSERVED/COMPUTED by an official service; see `meta.sources`.
// Retrieved 2026-10-09 by the Flight Rules pipeline (see /pipeline/README.md).

export const longNight = {
  id: 'long-night',
  name: 'The Long Night',
  body: 'Moon',
  site: {
    name: 'Shiv Shakti point (Chandrayaan-3 Vikram landing site)',
    lonE: 32.32,
    lat: -69.37,
    agency: 'ISRO',
  },
  // Hour 0 of every series below is this instant (UTC).
  epochUTC: '2023-08-20T00:00:00Z',
  // Horizons values are 6-hourly; the app interpolates linearly to hours.
  // Max interpolation error vs. the hourly Horizons output: 0.011 deg (checked 2026-10-09).
  stepHours: 6,
  // Mission window, in hours since epoch.
  missionStartHour: 84, // 2023-08-23 12:00 UT, landing day
  missionEndHour: 792, // 2023-09-22 00:00 UT (33 days after epoch), the day ISRO tried to wake Vikram
  sunElevDeg: [
    -6.17, -5.11, -4.04, -2.97, -1.89, -0.81, 0.27, 1.35, 2.42, 3.48, 4.52, 5.55, 6.56, 7.56, 8.53, 9.47,
    10.39, 11.27, 12.12, 12.94, 13.71, 14.45, 15.14, 15.79, 16.39, 16.94, 17.44, 17.89, 18.28, 18.61, 18.89,
    19.11, 19.27, 19.37, 19.41, 19.38, 19.3, 19.16, 18.96, 18.7, 18.38, 18.01, 17.58, 17.1, 16.57, 15.99,
    15.36, 14.68, 13.96, 13.2, 12.4, 11.57, 10.7, 9.8, 8.87, 7.92, 6.94, 5.94, 4.93, 3.89, 2.85, 1.79, 0.73,
    -0.34, -1.4, -2.47, -3.54, -4.6, -5.65, -6.69, -7.72, -8.73, -9.72, -10.69, -11.63, -12.55, -13.43,
    -14.29, -15.11, -15.88, -16.63, -17.32, -17.97, -18.58, -19.13, -19.63, -20.08, -20.47, -20.8, -21.08,
    -21.3, -21.45, -21.55, -21.58, -21.55, -21.46, -21.31, -21.1, -20.82, -20.49, -20.1, -19.66, -19.16,
    -18.6, -18, -17.35, -16.65, -15.91, -15.13, -14.31, -13.45, -12.56, -11.64, -10.69, -9.71, -8.72, -7.7,
    -6.67, -5.62, -4.55, -3.48, -2.41, -1.32, -0.24, 0.84, 1.91, 2.98, 4.04, 5.09, 6.12, 7.14, 8.13, 9.1,
    10.05, 10.97, 11.86, 12.71, 13.53, 14.31, 15.05, 15.74, 16.39, 17, 17.55, 18.05, 18.5, 18.9, 19.23,
    19.52, 19.74, 19.9, 20, 20.04, 20.03, 19.95, 19.81, 19.61, 19.35, 19.04, 18.67, 18.24, 17.76, 17.23,
    16.65, 16.02, 15.35, 14.63, 13.87, 13.07,
  ],
  earthElevDeg: [
    18.5, 18.1, 17.7, 17.3, 16.9, 16.5, 16.1, 15.7, 15.3, 14.9, 14.5, 14.2, 13.8, 13.4, 13, 12.7, 12.3, 12,
    11.7, 11.4, 11.1, 10.9, 10.6, 10.4, 10.2, 10, 9.9, 9.8, 9.7, 9.6, 9.6, 9.6, 9.6, 9.7, 9.8, 9.9, 10,
    10.2, 10.4, 10.7, 11, 11.3, 11.6, 11.9, 12.3, 12.7, 13.1, 13.5, 14, 14.4, 14.9, 15.3, 15.8, 16.3, 16.7,
    17.2, 17.7, 18.1, 18.6, 19, 19.4, 19.9, 20.3, 20.7, 21, 21.4, 21.7, 22.1, 22.4, 22.7, 22.9, 23.2, 23.4,
    23.6, 23.8, 24, 24.1, 24.3, 24.4, 24.5, 24.5, 24.6, 24.6, 24.6, 24.6, 24.5, 24.5, 24.4, 24.3, 24.2,
    24.1, 23.9, 23.7, 23.6, 23.4, 23.1, 22.9, 22.6, 22.4, 22.1, 21.8, 21.5, 21.2, 20.8, 20.5, 20.1, 19.8,
    19.4, 19, 18.6, 18.2, 17.8, 17.4, 17, 16.6, 16.2, 15.8, 15.4, 15, 14.6, 14.2, 13.8, 13.4, 13.1, 12.7,
    12.4, 12, 11.7, 11.4, 11.1, 10.8, 10.6, 10.4, 10.1, 10, 9.8, 9.7, 9.5, 9.5, 9.4, 9.4, 9.4, 9.4, 9.5,
    9.6, 9.7, 9.8, 10, 10.2, 10.5, 10.7, 11, 11.4, 11.7, 12.1, 12.5, 12.9, 13.3, 13.8, 14.2, 14.7, 15.2,
    15.7, 16.1, 16.6, 17.1, 17.6, 18.1, 18.6,
  ],
  // Real solar energetic particle (SEP) and strong flare events in the window (NASA DONKI).
  solarEvents: [
    { type: 'SEP', id: '2023-09-01T04:30:00-SEP-001', timeUTC: '2023-09-01T04:30Z', instrument: 'GOES-P: SEISS >10 MeV' },
    { type: 'SEP', id: '2023-09-01T05:05:00-SEP-001', timeUTC: '2023-09-01T05:05Z', instrument: 'SOHO: COSTEP 15.8-39.8 MeV' },
    { type: 'FLR', id: '2023-09-03T08:09:00-FLR-001', timeUTC: '2023-09-03T08:36Z', classType: 'M6.0' },
    { type: 'FLR', id: '2023-09-20T14:11:00-FLR-001', timeUTC: '2023-09-20T14:19Z', classType: 'M8.2' },
    { type: 'FLR', id: '2023-09-21T12:42:00-FLR-001', timeUTC: '2023-09-21T12:54Z', classType: 'M8.7' },
  ],
  // What really happened to the spacecraft at this site (ISRO announcements, as reported).
  ghost: [
    { timeUTC: '2023-08-23T12:33Z', label: 'Vikram lands', detail: 'Chandrayaan-3 lands near the lunar south pole. Design life: about 14 Earth days.' },
    { timeUTC: '2023-09-02T12:00Z', label: 'Pragyan sleeps', detail: 'ISRO puts the rover into sleep mode, batteries charged, before nightfall.' },
    { timeUTC: '2023-09-04T03:00Z', label: 'Vikram sleeps', detail: 'ISRO puts the lander into sleep mode ahead of the lunar night.' },
    { timeUTC: '2023-09-22T00:00Z', label: 'No answer', detail: 'ISRO tries to wake both craft after sunrise. No signal is received.' },
  ],
  meta: {
    retrievedUTC: '2026-10-09',
    checksums: { sunElevSum: 512.09, earthElevSum: 2682.6, n: 169 },
    sources: [
      {
        key: 'horizons',
        label: 'OBSERVED/COMPUTED',
        agency: 'NASA/JPL',
        name: 'JPL Horizons API (DE441), airless apparent elevation of Sun (10) and Earth (399) from a site on the Moon (coord@301)',
        url: 'https://ssd.jpl.nasa.gov/api/horizons.api',
        notes: 'Flat reference surface: local terrain is not modelled, so real sunrise at the site can come later than this record shows.',
      },
      {
        key: 'donki',
        label: 'OBSERVED',
        agency: 'NASA CCMC',
        name: 'DONKI Space Weather Database (SEP, FLR)',
        url: 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2023-08-20&endDate=2023-10-01',
        notes: 'Event times only. DONKI does not give a dose on the lunar surface; the in-game storm dose is a GAME ESTIMATE.',
      },
      {
        key: 'isro',
        label: 'REPORTED',
        agency: 'ISRO',
        name: 'Chandrayaan-3 mission updates (landing, sleep and wake-up attempt dates)',
        url: 'https://www.isro.gov.in/Chandrayaan3_Details.html',
        notes: 'Used for the ghost timeline only.',
      },
    ],
  },
};
