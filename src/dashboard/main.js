// OpenWhale Dashboard - Complete Redesign
// Setup Wizard + Chat + Channels + Configuration

const API_BASE = '/dashboard/api';

// ============================================
// Lucide Icons (SVG) - Professional Icon System
// ============================================
const ICONS = {
  // Navigation
  layoutDashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
  messageSquare: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  radio: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>',
  bot: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  wrench: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  tool: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-1.375a1 1 0 0 1 0-1.414L18 9"/><path d="m2.293 15.707 5.586 5.586a1 1 0 0 0 1.414 0l1.586-1.586a1 1 0 0 0 0-1.414L5.293 12.707a1 1 0 0 0-1.414 0L2.293 14.293a1 1 0 0 0 0 1.414z"/><path d="m6 9 1.375 1.375a1 1 0 0 1 0 1.414L6 13"/><path d="m21.854 2.146a.5.5 0 0 0-.708 0l-5.297 5.297"/><path d="M8.56 5.854 3.91 1.207a.5.5 0 0 0-.708 0l-.499.5a.5.5 0 0 0 0 .708l4.647 4.647"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',

  // Channels
  smartphone: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  send: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  globe: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',

  // Stats
  messageCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  ticket: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>',
  cpu: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
  zap: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',

  // Providers
  sparkles: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
  brain: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>',

  // Skills
  github: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>',
  music: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  cloud: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  database: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
  key: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>',
  twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>',


  // Tools
  terminal: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
  camera: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  image: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
  file: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  fileText: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  clock: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  volume2: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  code: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  palette: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>',
  mapPin: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',

  // Status
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  alertCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  loader: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  externalLink: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',

  // Misc
  whale: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.5c.5-.5 1-1.3 1.3-2.3.3-1 .3-2.2-.3-3.2-.6-1-1.6-1.8-2.9-2-1.3-.3-2.7 0-3.9.6-1.2.7-2.2 1.8-2.7 3.1-.5 1.3-.5 2.7 0 4 .5 1.3 1.5 2.4 2.8 3 1.3.6 2.7.7 4 .3 1.3-.4 2.3-1.3 2.9-2.4"/><path d="M2 12c-1 2 0 5 3 6l1-2"/><path d="M5 18c1 1 3 1 4 0"/><path d="M3 12c0-5 4-7 8-7 6 0 6 5 6 5s1-2 4-2c1.5 0 2 1 2 2"/><circle cx="14" cy="10" r="1"/></svg>',
  activity: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  arrowUp: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/><path d="M12 21V9"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',

  // Additional tool icons
  video: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',
  monitor: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
  puzzle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.878.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>',
  gitBranch: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  penTool: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  folder: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  code: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  search: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',

  // New tool icons
  qrCode: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>',
  table: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
  clipboardCopy: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  wand: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>',
  hardDrive: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>',
  archive: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>',
  mail: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  gitCommit: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="3" x2="9" y1="12" y2="12"/><line x1="15" x2="21" y1="12" y2="12"/></svg>',
  container: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  server: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  databaseZap: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 12 22"/><path d="M21 5v6"/><path d="M3 12A9 3 0 0 0 14.59 14.87"/><path d="M21 15l-2.5 5H19l-2.5-5"/></svg>',
};

// Icon helper function
function icon(name, size = 20) {
  const svg = ICONS[name];
  if (!svg) return '';
  // Adjust size if needed
  if (size !== 20) {
    return svg.replace(/width="20"/g, `width="${size}"`).replace(/height="20"/g, `height="${size}"`);
  }
  return svg;
}

// State
let state = {
  view: 'overview',
  setupComplete: false,
  setupStep: 0,
  stats: {},
  messages: [],
  channels: [],
  providers: [],
  skills: [],
  tools: [],
  config: {},
  isLoading: false,
  isSending: false,
  currentModel: 'claude-sonnet-4-20250514',
  whatsappQR: null,
  prerequisites: {},
  // Auth
  isAuthenticated: false,
  user: null,
  sessionId: localStorage.getItem('owSessionId') || null,
  users: [], // For admin user management
  extensions: [], // For self-extension system
  mdSkills: [], // Markdown-based skills from ~/.openwhale/skills/
  mdSkillsLoading: false,
  mdSkillsSearch: '',
  mdSkillsPage: 0,
  skillsTab: 'api', // 'api' or 'markdown'
  editingSkillDir: null,
  editingSkillPath: null,
  editingSkillContent: null,
  editingSkillTree: [],
  editingSkillLoading: false,
  showCreateSkillModal: false
};

// ============================================
// Custom Dialog System (replaces alert/confirm/prompt)
// ============================================

function createDialogOverlay() {
  const existing = document.getElementById('dialog-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dialog-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.15s ease-out;
  `;
  return overlay;
}

function createDialogBox(title, content, buttons) {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-secondary, #12121a);
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    border-radius: 12px;
    padding: 24px;
    min-width: 320px;
    max-width: 450px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    animation: slideIn 0.2s ease-out;
  `;

  const titleEl = document.createElement('div');
  titleEl.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #f1f1f1);
    margin-bottom: 12px;
  `;
  titleEl.textContent = title;

  const contentEl = document.createElement('div');
  contentEl.style.cssText = `
    color: var(--text-secondary, #a0a0a0);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 20px;
    white-space: pre-wrap;
  `;
  if (typeof content === 'string') {
    contentEl.textContent = content;
  } else {
    contentEl.appendChild(content);
  }

  const buttonsEl = document.createElement('div');
  buttonsEl.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  `;
  buttons.forEach(btn => buttonsEl.appendChild(btn));

  dialog.appendChild(titleEl);
  dialog.appendChild(contentEl);
  dialog.appendChild(buttonsEl);
  return dialog;
}

function createButton(text, primary = false) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    ${primary ? `
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
    ` : `
      background: var(--bg-tertiary, #1a1a25);
      color: var(--text-secondary, #a0a0a0);
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    `}
  `;
  btn.onmouseenter = () => btn.style.opacity = '0.85';
  btn.onmouseleave = () => btn.style.opacity = '1';
  return btn;
}

// Custom alert dialog
function showAlert(message, title = 'Notice') {
  return new Promise(resolve => {
    const overlay = createDialogOverlay();
    const okBtn = createButton('OK', true);
    okBtn.onclick = () => {
      overlay.remove();
      resolve();
    };
    const dialog = createDialogBox(title, message, [okBtn]);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

// Custom confirm dialog
function showConfirm(message, title = 'Confirm') {
  return new Promise(resolve => {
    const overlay = createDialogOverlay();
    const cancelBtn = createButton('Cancel');
    const confirmBtn = createButton('Confirm', true);

    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(false);
    };
    confirmBtn.onclick = () => {
      overlay.remove();
      resolve(true);
    };

    const dialog = createDialogBox(title, message, [cancelBtn, confirmBtn]);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}

// Custom prompt dialog
function showPrompt(message, defaultValue = '', title = 'Input') {
  return new Promise(resolve => {
    const overlay = createDialogOverlay();

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.placeholder = 'Enter value...';
    input.style.cssText = `
      width: 100%;
      padding: 12px;
      background: var(--bg-tertiary, #1a1a25);
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 8px;
      color: var(--text-primary, #f1f1f1);
      font-size: 14px;
      margin-top: 8px;
      outline: none;
    `;
    input.onfocus = () => input.style.borderColor = 'var(--accent, #6366f1)';
    input.onblur = () => input.style.borderColor = 'var(--border-color, rgba(255,255,255,0.08))';

    const wrapper = document.createElement('div');
    wrapper.textContent = message;
    wrapper.appendChild(input);

    const cancelBtn = createButton('Cancel');
    const okBtn = createButton('OK', true);

    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(null);
    };
    okBtn.onclick = () => {
      overlay.remove();
      resolve(input.value);
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') okBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    };

    const dialog = createDialogBox(title, wrapper, [cancelBtn, okBtn]);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  const isAuth = await checkAuth();

  if (isAuth) {
    await checkSetupStatus();
    if (!state.setupComplete) {
      state.view = 'setup';
    } else {
      state.view = location.hash.slice(1) || 'chat';
      await loadConfig();
      await loadData();
    }
  }
  render();

  window.addEventListener('hashchange', async () => {
    if (state.isAuthenticated) {
      state.view = location.hash.slice(1) || 'chat';
      await loadData();
      render();
    }
  });
});

// API Helpers
async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.sessionId) {
    headers['Authorization'] = `Bearer ${state.sessionId}`;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    ...options
  });
  const data = await res.json();
  if (!res.ok && !data.error) {
    data.error = `HTTP ${res.status}`;
  }
  return data;
}

// Auth Functions
async function login(username, password) {
  try {
    const result = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await result.json();
    if (data.ok) {
      state.sessionId = data.sessionId;
      state.user = data.user;
      state.isAuthenticated = true;
      localStorage.setItem('owSessionId', data.sessionId);
      return { ok: true };
    }
    return { ok: false, error: data.error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch { }
  state.sessionId = null;
  state.user = null;
  state.isAuthenticated = false;
  localStorage.removeItem('owSessionId');
  render();
}

async function checkAuth() {
  if (!state.sessionId) {
    state.isAuthenticated = false;
    return false;
  }
  try {
    const data = await api('/auth/me');
    if (data.ok) {
      state.user = data.user;
      state.isAuthenticated = true;
      return true;
    }
  } catch { }
  state.sessionId = null;
  state.isAuthenticated = false;
  localStorage.removeItem('owSessionId');
  return false;
}

// Data Loading
async function checkSetupStatus() {
  try {
    const data = await api('/setup/status');
    state.setupComplete = data.completed;
    state.setupStep = data.currentStep || 0;
    state.config = data.config || {};
  } catch (e) {
    console.log('Setup check failed, showing wizard');
    state.setupComplete = false;
  }
}

async function loadData() {
  switch (state.view) {
    case 'chat':
      await loadMessages();
      await loadProviders();
      break;
    case 'channels':
      await loadChannels();
      break;
    case 'providers':
      await loadProviders();
      break;
    case 'skills':
      await loadSkills();
      break;
    case 'tools':
      await loadTools();
      break;
    case 'extensions':
      await loadExtensions();
      break;
    case 'settings':
      await loadProviders();
      await loadUsers();
      break;
    case 'overview':
      await loadStats();
      await loadChannels();
      await loadProviders();
      await loadTools();
      break;
  }
}

async function loadStats() {
  try {
    state.stats = await api('/stats');
  } catch (e) { console.error(e); }
}

async function loadMessages() {
  try {
    const data = await api('/chat/history');
    state.messages = data.messages || [];
  } catch (e) { console.error(e); }
}

async function loadChannels() {
  try {
    const data = await api('/channels');
    state.channels = data.channels || [];
  } catch (e) { console.error(e); }
}

async function loadProviders() {
  try {
    const data = await api('/providers');
    state.providers = data.providers || [];

    // Set currentModel from the enabled provider
    const enabledProvider = state.providers.find(p => p.enabled && p.hasKey);
    if (enabledProvider && enabledProvider.models && enabledProvider.models.length > 0) {
      // Use the first model from the enabled provider as default
      state.currentModel = enabledProvider.models[0];
      console.log('[Dashboard] Using model from enabled provider:', state.currentModel);
    }
  } catch (e) { console.error(e); }
}

async function loadSkills() {
  try {
    const data = await api('/skills');
    state.skills = data.skills || [];
    // Also load markdown skills
    state.mdSkillsLoading = true;
    const mdData = await api('/md-skills');
    state.mdSkills = mdData.mdSkills || [];
    state.mdSkillsLoading = false;
  } catch (e) {
    state.mdSkillsLoading = false;
    console.error(e);
  }
}

async function loadTools() {
  try {
    const data = await api('/tools');
    state.tools = data.tools || [];
  } catch (e) { console.error(e); }
}

async function loadConfig() {
  try {
    const config = await api('/config');
    if (config.defaultModel) {
      state.currentModel = config.defaultModel;
    }
    state.config = config;
  } catch (e) { console.error(e); }
}

async function loadExtensions() {
  try {
    const data = await api('/extensions');
    if (data.ok) {
      state.extensions = data.extensions || [];
    }
  } catch (e) {
    console.error('Failed to load extensions:', e);
  }
}

async function loadUsers() {
  if (state.user?.role !== 'admin') return;
  try {
    const data = await api('/users');
    if (data.ok) {
      state.users = data.users;
    }
  } catch (e) {
    console.error('Failed to load users:', e);
  }
}

// Chat Functions
async function sendMessage(content) {
  if (!content.trim() || state.isSending) return;

  state.messages.push({
    id: Date.now().toString(),
    role: 'user',
    content: content.trim(),
    createdAt: new Date().toISOString()
  });

  state.isSending = true;
  // Track streaming state for progressive rendering
  state.streamingSteps = [];
  state.streamingContent = '';
  state.streamingDone = false;
  updateChatMessages();
  scrollToBottom();

  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content.trim(),
        model: state.currentModel
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const { event, data } = JSON.parse(line.slice(6));
          handleStreamEvent(event, data);
        } catch { /* skip malformed lines */ }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const { event, data } = JSON.parse(buffer.slice(6));
        handleStreamEvent(event, data);
      } catch { }
    }

  } catch (e) {
    state.messages.push({
      id: Date.now().toString(),
      role: 'system',
      content: `Error: ${e.message}`,
      createdAt: new Date().toISOString()
    });
  }

  state.isSending = false;
  state.streamingSteps = [];
  state.streamingContent = '';
  state.streamingDone = false;
  updateChatMessages();
  scrollToBottom();
}

function handleStreamEvent(event, data) {
  switch (event) {
    case 'thinking':
      // Update or add thinking step
      const existingThinking = state.streamingSteps.find(s => s.type === 'thinking');
      if (existingThinking) {
        existingThinking.iteration = data.iteration;
      } else {
        state.streamingSteps.push({ type: 'thinking', iteration: data.iteration, maxIterations: data.maxIterations });
      }
      break;

    case 'content':
      state.streamingContent = data.text;
      // Mark thinking as done
      const thinkingStep = state.streamingSteps.find(s => s.type === 'thinking');
      if (thinkingStep) thinkingStep.done = true;
      break;

    case 'tool_start':
      state.streamingSteps.push({
        type: 'tool',
        id: data.id,
        name: data.name,
        arguments: data.arguments,
        status: 'running',
      });
      break;

    case 'tool_end':
      const step = state.streamingSteps.find(s => s.id === data.id);
      if (step) {
        step.status = data.status;
        step.result = data.result;
        step.metadata = data.metadata;
      }
      break;

    case 'done':
      state.streamingDone = true;
      if (data.message) {
        // Replace any existing assistant message from content events
        state.messages.push({
          id: data.message.id || Date.now().toString(),
          role: 'assistant',
          content: data.message.content,
          toolCalls: data.message.toolCalls,
          model: data.message.model,
          createdAt: data.message.createdAt || new Date().toISOString()
        });
      }
      break;

    case 'error':
      state.streamingSteps.push({
        type: 'error',
        message: data.message,
      });
      break;
  }

  updateStreamingUI();
  scrollToBottom();
}

function updateStreamingUI() {
  const messagesInner = document.querySelector('.chat-messages-inner');
  if (!messagesInner) return;

  // Find or create streaming container
  let streamEl = document.getElementById('streaming-container');
  if (!streamEl) {
    // Re-render messages first, then append streaming container
    let messagesHtml = state.messages.map(renderMessage).join('');
    messagesHtml += '<div id="streaming-container" class="message assistant stream-message"></div>';
    messagesInner.innerHTML = messagesHtml;
    streamEl = document.getElementById('streaming-container');
  }

  if (!streamEl) return;

  // Build streaming steps HTML
  let html = '<div class="message-avatar" style="font-size: 18px;">🐋</div><div class="message-body">';

  // Render steps — group tool steps together
  const toolSteps = state.streamingSteps.filter(s => s.type === 'tool');
  const nonToolSteps = state.streamingSteps.filter(s => s.type !== 'tool');

  // Render non-tool steps (thinking, error)
  for (const step of nonToolSteps) {
    if (step.type === 'thinking' && !step.done) {
      html += `
        <div class="stream-step thinking">
          <div class="stream-step-header">
            <span class="stream-step-icon spinning">${icon('loader', 14)}</span>
            <span class="stream-step-label">Thinking${step.iteration > 1 ? ` (round ${step.iteration})` : ''}...</span>
          </div>
        </div>`;
    } else if (step.type === 'error') {
      html += `
        <div class="stream-step error">
          <div class="stream-step-header">
            <span class="stream-step-icon error">${icon('x', 14)}</span>
            <span class="stream-step-label">${escapeHtml(step.message)}</span>
          </div>
        </div>`;
    }
  }

  // Render tool steps as compact grouped chips
  if (toolSteps.length > 0) {
    const toolChipsHtml = toolSteps.map((step, idx) => {
      const si = state.streamingSteps.indexOf(step);
      const statusIcon = step.status === 'running'
        ? `<span class="tc-status-icon running spinning">${icon('loader', 12)}</span>`
        : step.status === 'completed'
          ? `<span class="tc-status-icon done">${icon('check', 12)}</span>`
          : `<span class="tc-status-icon error">${icon('x', 12)}</span>`;

      const toolLabel = getToolLabel(step.name, step.arguments);
      const isExpanded = step.expanded ? ' expanded' : '';

      return `
        <div class="tool-call-chip stream-chip${isExpanded}" data-step-index="${si}">
          <div class="tool-call-chip-header" onclick="toggleStreamStep(${si})">
            ${statusIcon}
            <span class="tool-call-chip-name">${escapeHtml(toolLabel)}</span>
            ${step.status !== 'running' ? `<span class="tool-call-chip-chevron">${icon('chevronDown', 10)}</span>` : ''}
          </div>
          ${step.result ? `
            <div class="tool-call-chip-body${step.expanded ? ' show' : ''}">
              <div class="tool-call-result">${typeof step.result === 'string' ? escapeHtml(step.result).substring(0, 500) : JSON.stringify(step.result, null, 2).substring(0, 500)}</div>
              ${renderFileChip(step.metadata)}
            </div>
          ` : ''}
        </div>`;
    }).join('');

    if (toolSteps.length > 1) {
      const completed = toolSteps.filter(s => s.status === 'completed').length;
      const running = toolSteps.filter(s => s.status === 'running').length;
      const errored = toolSteps.filter(s => s.status === 'error').length;
      const parts = [];
      if (running) parts.push(`${running} running`);
      if (completed) parts.push(`${completed} done`);
      if (errored) parts.push(`${errored} failed`);

      html += `
        <div class="tool-call-group">
          <details class="tool-call-group-details" open>
            <summary class="tool-call-group-summary">
              ${icon('wrench', 12)}
              <span>${toolSteps.length} tool calls</span>
              <span class="tool-call-group-meta">${parts.join(', ')}</span>
            </summary>
            <div class="tool-call-group-list">
              ${toolChipsHtml}
            </div>
          </details>
        </div>`;
    } else {
      html += `<div class="tool-call-group-single">${toolChipsHtml}</div>`;
    }
  }

  // Show streaming content (final answer) with markdown
  if (state.streamingContent) {
    html += `<div class="message-content">${formatMarkdown(state.streamingContent)}</div>`;
  }

  // Show persistent working indicator while agent is still processing
  if (!state.streamingDone) {
    let workingLabel = 'Thinking...';
    const runningTool = state.streamingSteps.filter(s => s.type === 'tool' && s.status === 'running').pop();
    if (runningTool) {
      const label = getToolLabel(runningTool.name, runningTool.arguments);
      workingLabel = `Running: ${label}`;
    } else if (state.streamingContent) {
      workingLabel = 'Generating response...';
    } else if (state.streamingSteps.some(s => s.type === 'thinking' && !s.done)) {
      const thinkStep = state.streamingSteps.find(s => s.type === 'thinking');
      workingLabel = thinkStep && thinkStep.iteration > 1 ? `Thinking (round ${thinkStep.iteration})...` : 'Thinking...';
    } else if (toolSteps.length > 0) {
      workingLabel = 'Processing results...';
    }
    html += `
      <div class="agent-working-bar">
        <div class="agent-working-dot"></div>
        <span class="agent-working-text">${escapeHtml(workingLabel)}</span>
        <div class="agent-working-spinner"></div>
      </div>`;
  }

  html += '</div>';
  streamEl.innerHTML = html;
}

// Global function for toggling step expansion (called from onclick)
window.toggleStreamStep = function (stepIndex) {
  const step = state.streamingSteps[stepIndex];
  if (step) {
    step.expanded = !step.expanded;
    // Update DOM directly without full re-render
    const stepEl = document.querySelector(`[data-step-index="${stepIndex}"]`);
    if (stepEl) {
      stepEl.classList.toggle('expanded');
    }
  }
};

function getToolLabel(name, args) {
  // Generate human-readable labels for tool calls
  const labels = {
    file: () => {
      const action = args?.action || 'file';
      if (action === 'write') return `Writing file: ${(args?.path || '').split('/').pop()}`;
      if (action === 'read') return `Reading file: ${(args?.path || '').split('/').pop()}`;
      if (action === 'list') return `Listing directory: ${(args?.path || '').split('/').pop()}`;
      if (action === 'mkdir') return `Creating directory: ${(args?.path || '').split('/').pop()}`;
      if (action === 'delete') return `Deleting: ${(args?.path || '').split('/').pop()}`;
      return `File: ${action}`;
    },
    exec: () => `Running: ${(args?.command || '').substring(0, 60)}`,
    web_fetch: () => `Fetching: ${(args?.url || '').substring(0, 50)}`,
    browser: () => `Browser: ${args?.action || 'navigate'}`,
    pdf: () => {
      const action = args?.action || 'pdf';
      return `PDF: ${action}${args?.outputPath ? ' → ' + args.outputPath.split('/').pop() : ''}`;
    },
    plan: () => `Plan: ${args?.action || 'create'}`,
    image: () => `Generating image`,
    screenshot: () => `Taking screenshot`,
    memory: () => `Memory: ${args?.action || 'recall'}`,
    code_exec: () => `Executing code`,
    tts: () => `Text to speech`,
  };

  if (labels[name]) return labels[name]();
  return `${name}${args?.action ? `: ${args.action}` : ''}`;
}

function renderFileChip(metadata) {
  if (!metadata?.path) return '';
  const filePath = metadata.path;
  const fileName = filePath.split('/').pop() || filePath;
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const fileIcon = ext === 'pdf' ? icon('fileText', 16) : icon('file', 16);
  const downloadUrl = `${API_BASE}/files/download?path=${encodeURIComponent(filePath)}`;
  return `
    <div class="tool-file-chip">
      <span class="file-icon">${fileIcon}</span>
      <span class="file-name" title="${escapeHtml(filePath)}">${escapeHtml(fileName)}</span>
      <a href="${downloadUrl}" class="file-download-btn" target="_blank" download="${escapeHtml(fileName)}">
        ${icon('download', 12)} Download
      </a>
    </div>`;
}

function formatMarkdown(text) {
  let html = escapeHtml(text);
  // Code blocks first (protect from other replacements)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Headings (must come before line-break replacement)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Inline formatting
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Targeted update for chat messages only (avoids full re-render flicker)
function updateChatMessages() {
  const messagesInner = document.querySelector('.chat-messages-inner');
  if (!messagesInner) {
    // Fall back to full render if element not found
    render();
    return;
  }

  // Build the messages HTML
  let messagesHtml = '';
  if (state.messages.length === 0) {
    messagesHtml = `
      <div class="empty-state">
        <div class="empty-state-icon" style="font-size: 64px;">🐋</div>
        <div class="empty-state-title">How can I help you today?</div>
        <p>I can help you manage your channels, write code, or just chat.</p>
      </div>
    `;
  } else {
    messagesHtml = state.messages.map(renderMessage).join('');
  }

  // Add thinking indicator if sending
  if (state.isSending) {
    messagesHtml += `
      <div class="message assistant thinking-message" id="thinking-indicator">
        <div class="message-avatar" style="font-size: 18px;">🐋</div>
        <div class="message-body">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;
  }

  messagesInner.innerHTML = messagesHtml;

  // Update send button state
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.disabled = state.isSending;
  }
}

function scrollToBottom() {
  setTimeout(() => {
    const container = document.querySelector('.chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }, 100);
}

// Clear chat history
async function clearChat() {
  const confirmed = await showConfirm('Clear all messages in this conversation?', 'Clear Chat');
  if (!confirmed) return;

  try {
    await api('/chat/history', { method: 'DELETE' });
    state.messages = [];
    render();
    await showAlert('Conversation cleared!', 'Success');
  } catch (e) {
    await showAlert(`Failed to clear chat: ${e.message}`, 'Error');
  }
}

// Setup Wizard Functions
async function loadPrerequisites() {
  try {
    const data = await api('/setup/prerequisites');
    state.prerequisites = data;
  } catch (e) { console.error(e); }
}

async function installPrerequisite(name) {
  const descriptions = {
    ffmpeg: 'FFmpeg - for audio/video processing and screen recording',
    imagesnap: 'ImageSnap - for camera capture on macOS'
  };

  const confirmed = await showConfirm(
    `This will run: brew install ${name}\n\nClick Confirm to proceed with installation.`,
    `Install ${descriptions[name] || name}?`
  );

  if (!confirmed) return;

  // Show installing state
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Installing...';
  }

  try {
    await api(`/setup/install/${name}`, { method: 'POST' });
    await loadPrerequisites();
    render();
    await showAlert(`${name} installed successfully!`, '✅ Success');
  } catch (e) {
    await showAlert(`Failed to install ${name}: ${e.message}\n\nYou can install manually: brew install ${name}`, '❌ Error');
  }
}

async function saveSetupStep(step, data) {
  try {
    await api(`/setup/step/${step}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    state.setupStep = step + 1;
    if (step >= 5) {
      state.setupComplete = true;
      state.view = 'chat';
      await loadData();
    }
    render();
  } catch (e) {
    await showAlert(`Failed to save: ${e.message}`, '❌ Error');
  }
}

// Channel Functions
async function toggleChannel(type, enabled) {
  try {
    await api(`/channels/${type}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
    await loadChannels();
    render();
  } catch (e) {
    await showAlert(`Failed to toggle channel: ${e.message}`, '❌ Error');
  }
}

async function connectWhatsApp() {
  try {
    const data = await api('/channels/whatsapp/connect', { method: 'POST' });
    state.whatsappQR = data.qr;
    render();
    // Poll for connection
    const checkConnection = setInterval(async () => {
      const status = await api('/channels/whatsapp/status');
      if (status.connected) {
        clearInterval(checkConnection);
        state.whatsappQR = null;
        await loadChannels();
        render();
      }
    }, 2000);
  } catch (e) {
    await showAlert(`Failed to connect: ${e.message}`, '❌ Error');
  }
}

async function connectTelegram() {
  const token = await showPrompt(
    'Enter your Telegram Bot Token (from @BotFather):',
    '',
    '🤖 Telegram Setup'
  );

  if (!token) return;

  try {
    const result = await api('/channels/telegram/connect', {
      method: 'POST',
      body: JSON.stringify({ telegramBotToken: token })
    });

    if (result.ok) {
      await showAlert(`Telegram bot @${result.botUsername} connected!`, '✅ Success');
      await loadChannels();
      render();
    } else {
      await showAlert(`Failed: ${result.error}`, '❌ Error');
    }
  } catch (e) {
    await showAlert(`Failed to connect: ${e.message}`, '❌ Error');
  }
}

async function connectDiscord() {
  const token = await showPrompt(
    'Enter your Discord Bot Token:',
    '',
    '🎮 Discord Setup'
  );

  if (!token) return;

  try {
    const result = await api('/channels/discord/connect', {
      method: 'POST',
      body: JSON.stringify({ discordBotToken: token })
    });

    if (result.ok) {
      await showAlert(`Discord bot ${result.botUsername} connected!`, '✅ Success');
      await loadChannels();
      render();
    } else {
      await showAlert(`Failed: ${result.error}`, '❌ Error');
    }
  } catch (e) {
    await showAlert(`Failed to connect: ${e.message}`, '❌ Error');
  }
}

async function checkBirdCLI() {
  try {
    const result = await api('/skills/twitter/check-bird');

    if (result.ok && result.installed) {
      if (result.authenticated) {
        await showAlert(`✅ bird CLI is installed and authenticated as @${result.username}!\n\nYou can now enable Twitter/X and start using it.`, '🐦 Twitter/X Ready');
      } else {
        await showAlert(`⚠️ bird CLI is installed but not authenticated.\n\nRun this command in terminal:\n\n  bird check\n\nThen authenticate with your Twitter/X cookies.`, '🔑 Authentication Required');
      }
    } else if (result.ok && !result.installed) {
      await showAlert(`❌ bird CLI is not installed.\n\nInstall it with:\n\n  npm install -g @steipete/bird\n\nThen run 'bird check' to authenticate.`, '📦 Installation Required');
    } else {
      await showAlert(`Error: ${result.error || 'Unknown error'}`, '❌ Error');
    }
  } catch (e) {
    await showAlert(`Failed to check bird CLI: ${e.message}`, '❌ Error');
  }
}

async function loadBirdConfig() {
  try {
    const result = await api('/skills/twitter/bird-config');

    if (result.ok && result.config) {
      const authInput = document.getElementById('skill-twitter-auth-token');
      const ct0Input = document.getElementById('skill-twitter-ct0');

      if (authInput && result.config.auth_token) {
        authInput.value = result.config.auth_token;
      }
      if (ct0Input && result.config.ct0) {
        ct0Input.value = result.config.ct0;
      }

      if (result.config.auth_token && result.config.ct0) {
        await showAlert(`Loaded existing Twitter cookies!\n\n@${result.username || 'Unknown user'}`, '✅ Config Loaded');
      } else {
        await showAlert('No existing Twitter cookies found.\n\nFollow the instructions to get them from your browser.', 'ℹ️ No Config');
      }
    } else {
      await showAlert('No bird config found. Enter your cookies manually.', 'ℹ️ No Config');
    }
  } catch (e) {
    await showAlert(`Failed to load config: ${e.message}`, '❌ Error');
  }
}

async function saveTwitterCookies() {
  const authToken = document.getElementById('skill-twitter-auth-token')?.value?.trim();
  const ct0 = document.getElementById('skill-twitter-ct0')?.value?.trim();

  if (!authToken || !ct0) {
    await showAlert('Please enter both auth_token and ct0 values.', '⚠️ Missing Fields');
    return;
  }

  // Validate lengths
  if (authToken.length < 30) {
    await showAlert('auth_token seems too short. It should be ~40 characters.', '⚠️ Invalid');
    return;
  }
  if (ct0.length < 50) {
    await showAlert('ct0 seems too short. It should be ~160 characters.', '⚠️ Invalid');
    return;
  }

  try {
    const result = await api('/skills/twitter/bird-config', {
      method: 'POST',
      body: JSON.stringify({ auth_token: authToken, ct0 })
    });

    if (result.ok) {
      await showAlert(`Twitter cookies saved!\n\n${result.username ? `Authenticated as @${result.username}` : 'Saved to ~/.config/bird/config.json5'}`, '✅ Success');
      // Enable the Twitter skill
      await saveSkillConfig('twitter', { enabled: true });
    } else {
      await showAlert(`Failed: ${result.error}`, '❌ Error');
    }
  } catch (e) {
    await showAlert(`Failed to save cookies: ${e.message}`, '❌ Error');
  }
}

// Provider/Skill Config Functions
async function saveProviderConfig(id, config) {
  try {
    await api(`/providers/${id}/config`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    await loadProviders();
    render();
  } catch (e) {
    await showAlert(`Failed to save: ${e.message}`, '❌ Error');
  }
}

async function saveSkillConfig(id, config) {
  try {
    await api(`/skills/${id}/config`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    await loadSkills();
    render();
  } catch (e) {
    await showAlert(`Failed to save: ${e.message}`, '❌ Error');
  }
}

// Render Functions
function render() {
  const root = document.getElementById('root');

  // Check authentication first
  if (!state.isAuthenticated) {
    root.innerHTML = renderLoginPage();
    bindLoginEvents();
    return;
  }

  if (state.view === 'setup') {
    root.innerHTML = renderSetupWizard();
    bindSetupEvents();
  } else {
    root.innerHTML = renderApp();
    bindEvents();
  }
}

function renderLoginPage() {
  return `
    <div class="login-container">
      <div class="login-box">
        <div class="login-header">
          <div class="login-logo">🐋</div>
          <h1>OpenWhale</h1>
          <p>Sign in to your dashboard</p>
        </div>
        <form id="login-form">
          <div class="login-field">
            <label for="login-username">Username</label>
            <input type="text" id="login-username" placeholder="Enter username" required autofocus>
          </div>
          <div class="login-field">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" placeholder="Enter password" required>
          </div>
          <div id="login-error" class="login-error"></div>
          <button type="submit" class="login-btn">
            <span>Sign In</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </form>
        <div class="login-footer">
          <span>Default credentials:</span>
          <code>admin / admin</code>
        </div>
      </div>
      <div class="login-version">OpenWhale v0.1.0</div>
    </div>
    <style>
      .login-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0a0a12 0%, #12121a 50%, #0d0d15 100%);
        padding: 20px;
        position: relative;
      }
      .login-container::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(88, 101, 242, 0.1) 0%, transparent 70%);
        pointer-events: none;
      }
      .login-box {
        position: relative;
        background: linear-gradient(145deg, rgba(30, 30, 45, 0.9), rgba(20, 20, 32, 0.95));
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 48px 40px;
        width: 100%;
        max-width: 420px;
        box-shadow: 
          0 25px 50px -12px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.05),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
      }
      .login-box::before {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: 21px;
        padding: 1px;
        background: linear-gradient(135deg, rgba(88, 101, 242, 0.5), rgba(255, 255, 255, 0.1), rgba(88, 101, 242, 0.3));
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
      .login-header {
        text-align: center;
        margin-bottom: 32px;
      }
      .login-logo {
        font-size: 56px;
        margin-bottom: 16px;
        filter: drop-shadow(0 4px 12px rgba(88, 101, 242, 0.3));
      }
      .login-header h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 8px;
        background: linear-gradient(135deg, #fff, #a0a0b0);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .login-header p {
        color: #6b6b80;
        margin: 0;
        font-size: 15px;
      }
      #login-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .login-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .login-field label {
        font-size: 13px;
        font-weight: 500;
        color: #9090a0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .login-field input {
        width: 100%;
        padding: 14px 16px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: #fff;
        font-size: 16px;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }
      .login-field input::placeholder {
        color: #4a4a5a;
      }
      .login-field input:focus {
        outline: none;
        border-color: rgba(88, 101, 242, 0.6);
        box-shadow: 0 0 0 3px rgba(88, 101, 242, 0.15);
        background: rgba(0, 0, 0, 0.4);
      }
      .login-error {
        display: none;
        padding: 12px 16px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 10px;
        color: #ef4444;
        font-size: 14px;
        text-align: center;
      }
      .login-error.show {
        display: block;
      }
      .login-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 16px 24px;
        margin-top: 8px;
        background: linear-gradient(135deg, #5865f2, #4752c4);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
      }
      .login-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(88, 101, 242, 0.4);
        background: linear-gradient(135deg, #6875f5, #5865f2);
      }
      .login-btn:active {
        transform: translateY(0);
      }
      .login-footer {
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        text-align: center;
        font-size: 13px;
        color: #5a5a6a;
      }
      .login-footer code {
        display: inline-block;
        margin-left: 6px;
        padding: 4px 10px;
        background: rgba(88, 101, 242, 0.15);
        border-radius: 6px;
        color: #8890f2;
        font-family: monospace;
        font-size: 12px;
      }
      .login-version {
        margin-top: 24px;
        font-size: 12px;
        color: #3a3a4a;
      }
    </style>
  `;
}

function bindLoginEvents() {
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const errorDiv = document.getElementById('login-error');

      // Hide any previous error
      errorDiv.classList.remove('show');

      const result = await login(username, password);
      if (result.ok) {
        await checkSetupStatus();
        await loadData();
        render();
      } else {
        errorDiv.textContent = result.error || 'Invalid username or password';
        errorDiv.classList.add('show');
      }
    });
  }
}

function renderApp() {
  return `
    <div class="app-container">
      ${renderSidebar()}
      <main class="main-content">
        ${renderHeader()}
        <div class="content-area">
          ${renderContent()}
        </div>
      </main>
    </div>
  `;
}

function renderSidebar() {
  const navItems = [
    { id: 'chat', iconName: 'messageSquare', label: 'Chat' },
    { id: 'overview', iconName: 'layoutDashboard', label: 'Overview' },
    { id: 'channels', iconName: 'radio', label: 'Channels' },
    { id: 'providers', iconName: 'bot', label: 'Providers' },
    { id: 'skills', iconName: 'sparkles', label: 'Skills' },
    { id: 'tools', iconName: 'zap', label: 'Tools' },
    { id: 'extensions', iconName: 'puzzle', label: 'Extensions' },
    { id: 'settings', iconName: 'settings', label: 'Settings' },
  ];

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="logo" style="font-size: 28px;">🐋</span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">
          ${navItems.map(item => `
            <a href="#${item.id}" class="nav-item ${state.view === item.id ? 'active' : ''}" title="${item.label}">
              <span class="nav-icon">${icon(item.iconName)}</span>
            </a>
          `).join('')}
        </div>
      </nav>
      <div class="sidebar-footer">
        <button class="nav-item" onclick="logout()" title="Logout (${state.user?.username || 'User'})">
          <span class="nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </span>
        </button>
      </div>
    </aside>
  `;
}

function renderHeader() {
  const titles = {
    chat: 'AI Assistant',
    overview: 'Dashboard',
    channels: 'Channels',
    providers: 'AI Providers',
    skills: 'Skills',
    tools: 'Tools',
    settings: 'Settings'
  };

  const enabledProviders = state.providers.filter(p => p.enabled);

  // Only show header for chat view
  if (state.view !== 'chat') {
    return '';
  }
  return `
    <header class="header">
      <div></div>
      <button class="btn btn-ghost" onclick="clearChat()" title="Clear conversation">
        ${icon('trash', 16)}
        <span style="margin-left: 4px;">Clear Chat</span>
      </button>
    </header>
  `;
}

function renderContent() {
  switch (state.view) {
    case 'chat': return renderChat();
    case 'overview': return renderOverview();
    case 'channels': return renderChannels();
    case 'providers': return renderProviders();
    case 'skills': return renderSkills();
    case 'tools': return renderTools();
    case 'extensions': return renderExtensions();
    case 'settings': return renderSettings();
    default: return renderChat();
  }
}

function renderChat() {
  return `
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-messages-inner">
          ${state.messages.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon" style="font-size: 64px;">🐋</div>
              <div class="empty-state-title">How can I help you today?</div>
              <p>I can help you manage your channels, write code, or just chat.</p>
            </div>
          ` : state.messages.map(renderMessage).join('')}
          ${state.isSending ? `
            <div class="message assistant thinking-message">
              <div class="message-avatar" style="font-size: 18px;">🐋</div>
              <div class="message-body">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      <div class="chat-input-container">
        <div class="chat-input-wrapper">
          <textarea 
            class="chat-input" 
            id="chat-input"
            placeholder="Type your message..." 
            rows="1"
            onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }"
          ></textarea>
          <button class="send-btn" id="send-btn" onclick="sendMessage()" ${state.isSending ? 'disabled' : ''}>
            ${icon('arrowUp', 20)}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderMessage(msg) {
  const roleClass = msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'assistant';
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  // Format time
  const date = msg.createdAt ? new Date(msg.createdAt) : new Date();
  const timeStr = date.toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  let content = escapeHtml(msg.content);
  // Simple markdown rendering
  content = content.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Headings
  content = content.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rules
  content = content.replace(/^---$/gm, '<hr>');
  // Lists
  content = content.replace(/^- (.+)$/gm, '<li>$1</li>');
  content = content.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Inline
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\n/g, '<br>');

  let toolCallsHtml = '';
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    const toolChips = msg.toolCalls.map((tc, i) => {
      // Check for image in result metadata (supports multiple formats)
      let imageSrc = null;
      const resultMeta = typeof tc.result === 'object' ? tc.result?.metadata : null;
      const tcMeta = tc.metadata;

      // Check for direct image data URL
      if (tcMeta?.image) {
        imageSrc = tcMeta.image;
      } else if (resultMeta?.image) {
        imageSrc = resultMeta.image;
      }
      // Check for base64 (screenshot tool format)
      else if (tcMeta?.base64) {
        const mimeType = tcMeta.mimeType || 'image/png';
        imageSrc = `data:${mimeType};base64,${tcMeta.base64}`;
      } else if (resultMeta?.base64) {
        const mimeType = resultMeta.mimeType || 'image/png';
        imageSrc = `data:${mimeType};base64,${resultMeta.base64}`;
      }

      // Check for created file path in metadata
      let fileChipHtml = '';
      const filePath = tcMeta?.path || resultMeta?.path;
      if (filePath && tc.status === 'completed') {
        const fileName = filePath.split('/').pop() || filePath;
        const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
        const fileIcon = ext === 'pdf' ? icon('fileText', 16) : icon('file', 16);
        const downloadUrl = `${API_BASE}/files/download?path=${encodeURIComponent(filePath)}`;
        fileChipHtml = `
          <div class="tool-file-chip">
            <span class="file-icon">${fileIcon}</span>
            <span class="file-name" title="${escapeHtml(filePath)}">${escapeHtml(fileName)}</span>
            <a href="${downloadUrl}" class="file-download-btn" target="_blank" download="${escapeHtml(fileName)}">
              ${icon('download', 12)} Download
            </a>
          </div>
        `;
      }

      const statusIcon = tc.status === 'completed'
        ? `<span class="tc-status-icon done">${icon('check', 12)}</span>`
        : tc.status === 'error'
          ? `<span class="tc-status-icon error">${icon('x', 12)}</span>`
          : `<span class="tc-status-icon running">${icon('loader', 12)}</span>`;

      const toolLabel = getToolLabel(tc.name, tc.arguments);

      return `
      <div class="tool-call-chip" onclick="toggleToolCall('${msg.id}', ${i})">
        <div class="tool-call-chip-header">
          ${statusIcon}
          <span class="tool-call-chip-name">${escapeHtml(toolLabel)}</span>
          <span class="tool-call-chip-chevron">${icon('chevronDown', 10)}</span>
        </div>
        <div class="tool-call-chip-body" id="tool-${msg.id}-${i}">
          <div class="tool-call-args">${JSON.stringify(tc.arguments, null, 2)}</div>
          ${tc.result ? `
            ${imageSrc ? `
              <div class="tool-call-result-image">
                <img src="${imageSrc}" alt="Tool Result" style="max-width: 100%; border-radius: 6px; margin-top: 6px;">
              </div>
            ` : ''}
            <div class="tool-call-result">${typeof tc.result === 'string' ? escapeHtml(tc.result).substring(0, 500) : JSON.stringify(tc.result, null, 2).substring(0, 500)}</div>
            ${fileChipHtml}
          ` : ''}
        </div>
      </div>
    `}).join('');

    // Group tool calls if more than one
    if (msg.toolCalls.length > 1) {
      const completed = msg.toolCalls.filter(tc => tc.status === 'completed').length;
      const errored = msg.toolCalls.filter(tc => tc.status === 'error').length;
      const total = msg.toolCalls.length;
      const summaryParts = [];
      if (completed) summaryParts.push(`${completed} completed`);
      if (errored) summaryParts.push(`${errored} failed`);
      const summaryText = summaryParts.join(', ') || `${total} tools`;

      toolCallsHtml = `
        <div class="tool-call-group">
          <details class="tool-call-group-details">
            <summary class="tool-call-group-summary">
              ${icon('wrench', 12)}
              <span>${total} tool calls</span>
              <span class="tool-call-group-meta">${summaryText}</span>
            </summary>
            <div class="tool-call-group-list">
              ${toolChips}
            </div>
          </details>
        </div>
      `;
    } else {
      toolCallsHtml = `<div class="tool-call-group-single">${toolChips}</div>`;
    }
  }

  // Icons
  let avatarIcon = '<span style="font-size: 20px;">🐋</span>'; // OpenWhale Icon
  if (isSystem) avatarIcon = icon('alertCircle', 18);

  return `
    <div class="message ${roleClass}">
      ${isUser ? '' : `<div class="message-avatar">
        ${avatarIcon}
      </div>`}
      <div class="message-body">
        <div class="message-header">
          <span class="message-author">${isUser ? '' : isSystem ? 'System' : 'OpenWhale'}</span>
          <span class="message-time">${timeStr}</span>
        </div>
        <div class="message-content">${content}</div>
        ${toolCallsHtml}
      </div>
    </div>
  `;
}

function renderOverview() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const connectedChannels = state.channels.filter(c => c.connected).length;
  const totalChannels = state.channels.length;
  const healthPercent = totalChannels > 0 ? Math.round((connectedChannels / totalChannels) * 100) : 0;
  const strokeOffset = 339.292 - (339.292 * healthPercent / 100);

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Overview of your OpenWhale instance</p>
      </div>
      <div class="header-actions">
        <div class="status-indicator">
          <span class="status-dot online"></span>
          <span>System Online</span>
        </div>
      </div>
    </div>

    <div class="bento-grid">
      <!-- Welcome Widget -->
      <div class="bento-item bento-md bento-short widget-welcome">
        <div class="welcome-greeting">${greeting}</div>
        <div class="welcome-title">🐋 OpenWhale</div>
        <div class="welcome-time">${timeStr}</div>
        <div class="welcome-date">${dateStr}</div>
      </div>

      <!-- Active Sessions -->
      <div class="bento-item bento-sm bento-short widget-stat">
        <div class="stat-header">
          <div class="stat-icon green">${icon('activity')}</div>
        </div>
        <div class="stat-value">${state.stats.sessions || 0}</div>
        <div class="stat-label">Active Sessions</div>
      </div>

      <!-- Messages Stat -->
      <div class="bento-item bento-sm bento-short widget-stat">
        <div class="stat-header">
          <div class="stat-icon blue">${icon('messageCircle')}</div>
          <span class="stat-trend up">+12%</span>
        </div>
        <div class="stat-value">${formatNumber(state.stats.messages || 0)}</div>
        <div class="stat-label">Total Messages</div>
      </div>


      <!-- Providers Stat -->
      <div class="bento-item bento-sm bento-short widget-stat">
        <div class="stat-header">
          <div class="stat-icon green">${icon('bot')}</div>
        </div>
        <div class="stat-value">${state.providers.filter(p => p.enabled).length}</div>
        <div class="stat-label">Active Providers</div>
      </div>

      <!-- Channels List -->
      <div class="bento-item bento-md bento-tall widget-channels">
        <div class="channels-header">
          <h3 class="channels-title">Channels</h3>
          <a href="#channels" class="btn btn-ghost">View All</a>
        </div>
        <div class="channel-list">
          ${state.channels.map(ch => `
            <div class="channel-row">
              <div class="channel-icon">${getChannelIcon(ch.type)}</div>
              <div class="channel-info">
                <div class="channel-name">${ch.name}</div>
                <div class="channel-desc">${ch.type === 'whatsapp' ? 'WhatsApp Messaging' : ch.type === 'telegram' ? 'Telegram Bot' : 'Web Interface'}</div>
              </div>
              <div class="channel-status">
                <span class="status-dot ${ch.connected ? 'online' : 'offline'}"></span>
                ${ch.connected ? 'Online' : 'Offline'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Tools Count -->
      <div class="bento-item bento-sm bento-short widget-stat">
        <div class="stat-header">
          <div class="stat-icon orange">${icon('tool')}</div>
        </div>
        <div class="stat-value">${state.tools?.length || 0}</div>
        <div class="stat-label">Available Tools</div>
      </div>
    </div>
  `;
}

function renderChannels() {
  return `
    <div class="channel-grid">
      ${state.channels.map(ch => `
        <div class="channel-card">
          <div class="channel-header">
            <span class="channel-icon">${getChannelIcon(ch.type)}</span>
            <div style="flex: 1">
              <div class="channel-name">${ch.name}</div>
              <div class="channel-status ${ch.connected ? 'connected' : 'disconnected'}">
                ${ch.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            <label class="toggle">
              <input type="checkbox" ${ch.enabled ? 'checked' : ''} 
                     onchange="toggleChannel('${ch.type}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          ${ch.type === 'whatsapp' && !ch.connected && ch.enabled ? `
            <button class="btn btn-primary" onclick="connectWhatsApp()" style="margin-top: 16px">
              📲 Connect WhatsApp
            </button>
            ${state.whatsappQR ? `
              <div class="qr-container">
                <div class="qr-code">
                  <img src="${state.whatsappQR}" alt="Scan QR Code" width="200">
                </div>
                <p>Scan with WhatsApp to connect</p>
              </div>
            ` : ''}
          ` : ''}
          
          ${ch.type === 'telegram' && !ch.connected && ch.enabled ? `
            <button class="btn btn-primary" onclick="connectTelegram()" style="margin-top: 16px; width: 100%">
              🤖 Connect Telegram Bot
            </button>
          ` : ''}
          
          ${ch.type === 'discord' && !ch.connected && ch.enabled ? `
            <button class="btn btn-primary" onclick="connectDiscord()" style="margin-top: 16px; width: 100%">
              🎮 Connect Discord Bot
            </button>
          ` : ''}
          
          ${ch.type === 'imessage' ? `
            ${!ch.available ? `
              <div style="margin-top: 16px; padding: 12px; background: var(--surface-2); border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">🚫</div>
                <div style="color: var(--text-muted); font-size: 13px;">iMessage is only available on macOS</div>
              </div>
            ` : !ch.connected ? `
              <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                <button class="btn btn-secondary" onclick="installImsg()" style="width: 100%" id="btn-install-imsg">
                  ⬇️ Install imsg CLI
                </button>
                <button class="btn btn-primary" onclick="connectIMessage()" style="width: 100%" id="btn-connect-imsg">
                  📱 Connect iMessage
                </button>
              </div>
              <div id="imessage-status" style="margin-top: 8px; font-size: 12px; color: var(--text-muted); text-align: center;"></div>
            ` : ''}
          ` : ''}
          
          <div class="channel-stats">
            <div class="channel-stat">
              <div class="channel-stat-value">${ch.messagesSent || 0}</div>
              <div class="channel-stat-label">Sent</div>
            </div>
            <div class="channel-stat">
              <div class="channel-stat-value">${ch.messagesReceived || 0}</div>
              <div class="channel-stat-label">Received</div>
            </div>
          </div>
          
          ${ch.connected ? `
            <button class="btn btn-secondary" style="margin-top: 16px; width: 100%"
                    onclick="viewChannelMessages('${ch.type}')">
              View Messages
            </button>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderProviders() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">AI Providers</h1>
        <p class="page-subtitle">Configure models and API keys</p>
      </div>
    </div>
    
    <div class="bento-grid">
      ${state.providers.map(p => `
        <div class="bento-item bento-md" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="stat-icon ${p.enabled ? 'blue' : 'gray'}">${getProviderIcon(p.type)}</span>
              <div>
                <h3 class="card-title">${p.name}</h3>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  ${p.models.length} Models
                </div>
              </div>
            </div>
            <label class="toggle">
              <input type="checkbox" ${p.enabled ? 'checked' : ''} 
                     onchange="toggleProvider('${p.type}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="form-group" style="margin-bottom: 12px;">
            <input type="password" class="form-input" 
                   placeholder="${p.enabled ? '••••••••' : 'Enter API Key'}"
                   id="apikey-${p.type}"
                   style="font-size: 13px; height: 36px;">
          </div>
          
          <div class="form-group" style="margin-bottom: 12px;">
            <select class="form-input" id="model-${p.type}">
              ${p.models.map(m => `
                <option value="${m}" ${state.currentModel === m ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
          </div>
          
          <button class="btn btn-secondary" onclick="saveProvider('${p.type}')" style="width: 100%; justify-content: center;">
            Save
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSkills() {
  const skillList = [
    {
      id: 'github',
      name: 'GitHub',
      iconName: 'github',
      desc: 'Repositories, Issues, PRs',
      placeholder: 'ghp_xxxx...',
      helpUrl: 'https://github.com/settings/tokens',
      helpText: 'Create a Personal Access Token at Settings → Developer settings → Personal access tokens → Generate new token. Select repo, issues, and workflow scopes.'
    },
    {
      id: 'weather',
      name: 'OpenWeatherMap',
      iconName: 'cloud',
      desc: 'Current Weather & Forecasts',
      placeholder: 'API Key',
      helpUrl: 'https://openweathermap.org/api',
      helpText: 'Sign up free at openweathermap.org → API Keys tab → Generate key. Free tier includes 1000 calls/day.'
    },
    {
      id: 'notion',
      name: 'Notion',
      iconName: 'file',
      desc: 'Pages & Databases',
      placeholder: 'secret_xxxx...',
      helpUrl: 'https://www.notion.so/profile/integrations/form/new-integration',
      helpText: 'Create an integration at notion.so/profile/integrations → New integration. Give it a name and select Read, Update, Insert capabilities.'
    },
    {
      id: 'google',
      name: 'Google Services',
      iconName: 'mail',
      desc: 'Calendar, Gmail, Drive',
      placeholder: 'Google API credentials',
      helpUrl: 'https://console.cloud.google.com/apis/credentials',
      helpText: 'Create OAuth 2.0 credentials in Google Cloud Console. Enable Gmail, Calendar, and Drive APIs for your project.'
    },
    {
      id: 'onepassword',
      name: '1Password',
      iconName: 'key',
      desc: 'Secure Credential Access',
      placeholder: 'op connect token...',
      helpUrl: 'https://developer.1password.com/docs/connect',
      helpText: '1Password Connect lets you access credentials securely. Set up a Connect server and generate an access token.'
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      iconName: 'twitter',
      desc: 'Post tweets, read timeline, mentions',
      placeholder: '', // No API key needed
      helpUrl: 'https://github.com/steipete/bird',
      helpText: 'Uses bird CLI with cookie auth. Install: npm i -g @steipete/bird, then run "bird check" to authenticate.',
      noCreds: true // Flag indicating no credentials input needed
    }
  ];

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Skills</h1>
        <p class="page-subtitle">Connect external services to extend capabilities</p>
      </div>
    </div>

    <div class="tabs" style="margin-bottom: 24px;">
      <button class="tab-btn ${state.skillsTab === 'api' ? 'active' : ''}" onclick="switchSkillsTab('api')">
        ${icon('key', 16)} API Skills
      </button>
      <button class="tab-btn ${state.skillsTab === 'markdown' ? 'active' : ''}" onclick="switchSkillsTab('markdown')">
        ${icon('file', 16)} MD Skills <span class="badge">${state.mdSkills.length}</span>
      </button>
    </div>

    ${state.skillsTab === 'api' ? `
      <div class="skills-grid">
        ${skillList.map(s => {
    const skillData = state.skills.find(sk => sk.id === s.id);
    const isEnabled = skillData?.enabled || false;
    const hasKey = skillData?.hasKey || false;

    return `
            <div class="skill-card ${isEnabled ? 'enabled' : ''} ${hasKey ? 'configured' : ''}">
              <div class="skill-header">
                <div class="skill-icon-wrap">
                  <span class="skill-icon">${icon(s.iconName, 24)}</span>
                </div>
                <div class="skill-info">
                  <h3 class="skill-name">${s.name}</h3>
                  <div class="skill-desc">${s.desc}</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" ${isEnabled ? 'checked' : ''}
                         onchange="toggleSkill('${s.id}', this.checked)">
                  <span class="toggle-slider"></span>
                </label>
              </div>
              
              <div class="skill-body">
                <div class="skill-status">
                  ${hasKey ? `
                    <span class="status-badge success">✓ Configured</span>
                  ` : `
                    <span class="status-badge warning">Not configured</span>
                  `}
                </div>
                
                <div class="skill-help">
                  <p>${s.helpText}</p>
                  <a href="${s.helpUrl}" target="_blank" rel="noopener" class="skill-link">
                    ${icon('externalLink', 14)} ${s.noCreds ? 'View Documentation' : 'Get API Key'}
                  </a>
                </div>
                
                ${s.noCreds ? `
                  <div class="skill-help" style="margin-bottom: 16px;">
                    <details style="cursor: pointer;">
                      <summary style="font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">
                        📋 How to get Twitter cookies
                      </summary>
                      <ol style="margin: 12px 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                        <li>Open <a href="https://x.com" target="_blank" style="color: var(--accent);">x.com</a> and log in</li>
                        <li>Open DevTools (F12 or Cmd+Option+I)</li>
                        <li>Go to <strong>Application</strong> → <strong>Cookies</strong> → <strong>https://x.com</strong></li>
                        <li>Find <code>auth_token</code> and <code>ct0</code></li>
                        <li>Copy their values and paste below</li>
                      </ol>
                    </details>
                  </div>
                  <div class="skill-form" style="flex-direction: column; gap: 8px;">
                    <input type="password" class="form-input" 
                           placeholder="auth_token (40 chars)"
                           id="skill-twitter-auth-token"
                           style="font-family: monospace; font-size: 12px;">
                    <input type="password" class="form-input" 
                           placeholder="ct0 (160 chars)"
                           id="skill-twitter-ct0"
                           style="font-family: monospace; font-size: 12px;">
                    <div style="display: flex; gap: 8px; margin-top: 4px;">
                      <button class="btn btn-secondary" onclick="loadBirdConfig()" style="flex: 1;">
                        ${icon('refresh', 14)} Load Existing
                      </button>
                      <button class="btn btn-primary" onclick="saveTwitterCookies()" style="flex: 1;">
                        ${icon('check', 14)} Save Cookies
                      </button>
                    </div>
                  </div>
                ` : `
                  <div class="skill-form">
                    <input type="password" class="form-input" 
                           placeholder="${s.placeholder}"
                           id="skill-${s.id}">
                    <button class="btn btn-primary" onclick="saveSkill('${s.id}')">
                      ${hasKey ? 'Update' : 'Connect'}
                    </button>
                  </div>
                `}
              </div>
            </div>
          `;
  }).join('')}
      </div>
    ` : `
      <!-- Search and Create Header -->
      <div style="display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px; position: relative;">
          <input type="text" 
                 id="md-skills-search"
                 placeholder="Search skills..." 
                 value="${state.mdSkillsSearch}"
                 oninput="handleMdSkillsSearch(this)"
                 style="width: 100%; padding: 10px 12px 10px 36px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); color: var(--text-primary); font-size: 14px;"
          />
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
            ${icon('search', 16)}
          </span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="color: var(--text-secondary); font-size: 13px;">${state.mdSkills.length} skills</span>
          <button class="btn btn-primary" onclick="showCreateSkillModal()">
            ${icon('plus', 16)} Create Skill
          </button>
        </div>
      </div>
      
      ${state.mdSkillsLoading ? `
        <div style="display: flex; align-items: center; justify-content: center; padding: 60px; color: var(--text-secondary);">
          <div class="spinner" style="margin-right: 12px;"></div>
          Loading skills...
        </div>
      ` : `
        ${renderMdSkillsGrid()}
      `}
      
      ${state.showCreateSkillModal ? `
        <div class="skill-editor-overlay" onclick="event.target === this && closeCreateSkillModal()">
          <div class="create-skill-modal">
            <div class="skill-editor-header">
              <h3 style="margin: 0;">${icon('plus', 18)} Create New Skill</h3>
              <button class="btn btn-ghost" onclick="closeCreateSkillModal()">
                ${icon('x', 16)}
              </button>
            </div>
            <div style="padding: 24px;">
              <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 500;">Skill Name *</label>
                <input type="text" id="new-skill-name" placeholder="e.g., My Custom Tool" 
                       style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-base); color: var(--text-primary);"/>
              </div>
              <div style="margin-bottom: 24px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 500;">Description</label>
                <textarea id="new-skill-desc" placeholder="What does this skill do?" rows="3"
                          style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-base); color: var(--text-primary); resize: vertical;"></textarea>
              </div>
              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-ghost" onclick="closeCreateSkillModal()">Cancel</button>
                <button class="btn btn-primary" onclick="createNewSkill()">
                  ${icon('check', 14)} Create Skill
                </button>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
      
      ${state.editingSkillPath ? `
        <div class="skill-editor-overlay" onclick="event.target === this && closeMdSkillEditor()">
          <div class="skill-editor-modal">
            <div class="skill-editor-header">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                ${icon('file', 18)} ${state.editingSkillPath.split('/').pop()}
              </h3>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" onclick="saveMdSkill()">
                  ${icon('check', 14)} Save
                </button>
                <button class="btn btn-ghost" onclick="closeMdSkillEditor()">
                  ${icon('x', 14)} Close
                </button>
              </div>
            </div>
            <div class="skill-editor-body">
              <div class="skill-editor-sidebar">
                <div class="skill-tree-header">
                  <span>Files</span>
                  <div style="display: flex; gap: 4px;">
                    <button class="btn btn-ghost btn-icon" onclick="promptNewFile()" title="New File">
                      ${icon('plus', 14)}
                    </button>
                    <button class="btn btn-ghost btn-icon" onclick="promptNewFolder()" title="New Folder">
                      ${icon('folder', 14)}
                    </button>
                  </div>
                </div>
                <div class="skill-tree">
                  ${renderFileTree(state.editingSkillTree, state.editingSkillPath)}
                </div>
              </div>
              <div class="skill-editor-content">
                ${state.editingSkillLoading ? `
                  <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
                    <div class="spinner" style="margin-right: 12px;"></div>
                    Loading...
                  </div>
                ` : `
                  <textarea id="skill-editor-content" class="skill-editor-textarea" spellcheck="false">${escapeHtml(state.editingSkillContent || '')}</textarea>
                `}
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    `}
  `;
}

// Render MD skills grid with pagination and search
function renderMdSkillsGrid() {
  const searchTerm = state.mdSkillsSearch.toLowerCase();
  const filtered = state.mdSkills.filter(s =>
    s.name.toLowerCase().includes(searchTerm) ||
    (s.description || '').toLowerCase().includes(searchTerm)
  );
  const perPage = 12;
  const totalPages = Math.ceil(filtered.length / perPage);
  const page = Math.min(Math.max(0, state.mdSkillsPage), Math.max(0, totalPages - 1));
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);

  if (filtered.length === 0) {
    return `
      <div class="empty-state" style="text-align: center; padding: 60px;">
        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
        <h3>No skills found</h3>
        <p style="color: var(--text-secondary);">${searchTerm ? 'Try a different search term' : 'Create your first skill to get started'}</p>
      </div>
    `;
  }

  let html = `<div class="md-skills-grid">`;

  for (const skill of paginated) {
    const safePath = skill.path.replace(/'/g, "\\'");
    html += `
      <div class="md-skill-card" onclick="editMdSkill('${safePath}')">
        <div class="md-skill-header">
          <div class="md-skill-icon">${icon('file', 24)}</div>
          <div class="md-skill-meta">
            <h3>${escapeHtml(skill.name)}</h3>
            <span class="status-badge success">Active</span>
          </div>
        </div>
        <p class="md-skill-desc">${escapeHtml(skill.description || 'No description provided')}</p>
        <div class="md-skill-footer">
          <span style="color: var(--text-tertiary); font-size: 12px;">${skill.path.split('/').pop()}</span>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editMdSkill('${safePath}')">
            ${icon('penTool', 14)} Edit
          </button>
        </div>
      </div>
    `;
  }

  html += `</div>`;

  if (totalPages > 1) {
    html += `
      <div class="pagination" style="display: flex; justify-content: center; gap: 8px; margin-top: 24px; align-items: center;">
        <button class="btn btn-ghost" ${page === 0 ? 'disabled' : ''} onclick="setMdSkillsPage(${page - 1})">
          ${icon('arrowLeft', 16)} Prev
        </button>
        <span style="color: var(--text-secondary); font-size: 14px; padding: 0 12px;">
          Page ${page + 1} of ${totalPages}
        </span>
        <button class="btn btn-ghost" ${page >= totalPages - 1 ? 'disabled' : ''} onclick="setMdSkillsPage(${page + 1})">
          Next ${icon('arrowRight', 16)}
        </button>
      </div>
    `;
  }

  return html;
}

// Helper to escape HTML in content
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Render skill file tree recursively
function renderFileTree(nodes, currentPath, depth = 0) {
  if (!nodes || nodes.length === 0) return '';

  return nodes.map(node => {
    const isActive = node.path === currentPath;
    const indent = depth * 16;
    const safePath = node.path.replace(/'/g, "\\'");

    if (node.type === 'directory') {
      return `
        <div class="skill-tree-folder" style="padding-left: ${indent}px;">
          <div class="skill-tree-item folder">
            <span>${icon('folder', 14)} ${node.name}</span>
            <button class="btn-tree-action" onclick="event.stopPropagation(); promptNewFileInFolder('${safePath}')" title="Add file in ${node.name}">
              ${icon('plus', 12)}
            </button>
          </div>
          ${renderFileTree(node.children, currentPath, depth + 1)}
        </div>
      `;
    } else {
      const fileIcon = node.name.endsWith('.md') ? 'file' :
        node.name.endsWith('.py') ? 'code' :
          node.name.endsWith('.js') || node.name.endsWith('.ts') ? 'code' :
            node.name.endsWith('.sh') ? 'terminal' : 'file';
      return `
        <div class="skill-tree-item file ${isActive ? 'active' : ''}" 
             style="padding-left: ${indent + 8}px;"
             onclick="selectSkillFile('${safePath}')">
          ${icon(fileIcon, 14)} ${node.name}
        </div>
      `;
    }
  }).join('');
}

function switchSkillsTab(tab) {
  state.skillsTab = tab;
  render();
}


function renderTools() {
  const toolIcons = {
    exec: 'terminal',
    browser: 'globe',
    web_fetch: 'download',
    image: 'image',
    cron: 'clock',
    tts: 'volume2',
    file: 'file',
    canvas: 'penTool',
    nodes: 'gitBranch',
    memory: 'database',
    code_exec: 'code',
    screenshot: 'camera',
    extend: 'puzzle',
    camera_snap: 'camera',
    camera_record: 'video',
    screen_record: 'monitor',
    pdf: 'fileText',
    skill_creator: 'sparkles',
    imessage: 'messageSquare',
    planning: 'brain',
    // New tools
    qr_code: 'qrCode',
    spreadsheet: 'table',
    calendar_event: 'calendar',
    clipboard: 'clipboardCopy',
    shortcuts: 'wand',
    system_info: 'hardDrive',
    zip: 'archive',
    email_send: 'mail',
    git: 'gitCommit',
    docker: 'container',
    ssh: 'server',
    db_query: 'databaseZap'
  };

  const categoryColors = {
    system: 'orange',
    utility: 'blue',
    web: 'purple',
    media: 'green',
    communication: 'purple',
    device: 'green'
  };

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Tools</h1>
        <p class="page-subtitle">${state.tools.length} tools available for AI operations</p>
      </div>
    </div>

    <div class="bento-grid">
      ${state.tools.map(t => `
        <div class="bento-item bento-sm" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="stat-icon ${categoryColors[t.category] || 'blue'}" style="width: 40px; height: 40px;">
                ${icon(toolIcons[t.name] || 'tool', 18)}
              </span>
              <div>
                <div style="font-weight: 600; font-size: 15px;">${t.name}</div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                  ${t.category}
                </div>
              </div>
            </div>
            <span style="display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px; border-radius: 12px; background: ${t.disabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'}; color: ${t.disabled ? 'var(--error)' : 'var(--success)'};">
              ${t.disabled ? icon('x', 10) : icon('check', 10)}
              ${t.disabled ? 'Off' : 'On'}
            </span>
          </div>
          <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; flex: 1;">
            ${t.description}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border);">
            <span style="font-size: 11px; color: var(--text-muted);">
              ${t.requiresApproval ? '🔐 Approval required' : '⚡ Auto-execute'}
            </span>
            <label class="toggle" style="transform: scale(0.8);">
              <input type="checkbox" ${!t.disabled ? 'checked' : ''} onchange="toggleTool('${t.name}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderExtensions() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Extensions</h1>
        <p class="page-subtitle">AI-created extensions that run on schedules or on-demand</p>
      </div>
    </div>

    ${state.extensions.length === 0 ? `
      <div class="empty-state" style="text-align: center; padding: 60px 20px;">
        <span style="font-size: 64px; margin-bottom: 20px; display: block;">🧩</span>
        <h3 style="color: var(--text-primary); margin-bottom: 8px;">No Extensions Yet</h3>
        <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
          Ask the AI to create an extension! For example:<br>
          <em>"Create an extension that sends me a daily weather report"</em>
        </p>
      </div>
    ` : `
      <div class="bento-grid">
        ${state.extensions.map(ext => `
          <div class="bento-item bento-md" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span class="stat-icon purple" style="width: 44px; height: 44px;">
                  ${icon('puzzle', 20)}
                </span>
                <div>
                  <div style="font-weight: 600; font-size: 16px;">${ext.name}</div>
                  ${ext.schedule ? `
                    <div style="font-size: 11px; color: var(--accent-purple); display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                      ${icon('clock', 12)} ${ext.schedule}
                    </div>
                  ` : ''}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${ext.running ? `
                  <span style="display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px; border-radius: 12px; background: rgba(34, 197, 94, 0.15); color: var(--success);">
                    ${icon('activity', 10)} Running
                  </span>
                ` : ''}
                <label class="toggle" style="transform: scale(0.8);">
                  <input type="checkbox" ${ext.enabled ? 'checked' : ''} onchange="toggleExtension('${ext.name}')">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; flex: 1;">
              ${ext.description || 'No description'}
            </div>
            
            ${ext.channels?.length ? `
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${ext.channels.map(ch => `
                  <span style="font-size: 10px; padding: 3px 8px; border-radius: 10px; background: var(--surface-hover); color: var(--text-muted);">
                    ${ch}
                  </span>
                `).join('')}
              </div>
            ` : ''}
            
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--border);">
              <span style="font-size: 11px; color: var(--text-muted);">
                Updated: ${new Date(ext.updatedAt).toLocaleDateString()}
              </span>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-secondary" onclick="viewExtensionCode('${ext.name}')" title="View Code">
                  ${icon('code', 14)}
                </button>
                <button class="btn btn-sm btn-primary" onclick="runExtension('${ext.name}')" title="Run Now">
                  ${icon('zap', 14)}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteExtension('${ext.name}')" title="Delete">
                  ${icon('x', 14)}
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function renderSettings() {
  const isAdmin = state.user?.role === 'admin';

  return `
    <!-- Account Section -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Account</h3>
      </div>
      
      <div class="user-item" style="margin-bottom: 20px;">
        <div class="user-item-avatar">${(state.user?.username || 'U')[0].toUpperCase()}</div>
        <div class="user-item-info">
          <div class="user-item-name">${state.user?.username || 'User'}</div>
          <div class="user-item-meta">
            <span class="role-badge ${state.user?.role}">${state.user?.role || 'user'}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="showChangePasswordModal()">
          Change Password
        </button>
      </div>
    </div>
    
    <!-- General Settings -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">General Settings</h3>
      </div>
      
      <div class="form-group">
        <label class="form-label">Default Model</label>
        <select class="form-input" id="default-model">
          ${state.providers.map(p =>
    p.models.map(m => `<option value="${m}" ${state.currentModel === m ? 'selected' : ''}>${p.name}: ${m}</option>`).join('')
  ).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Owner Phone Number</label>
        <input type="text" class="form-input" placeholder="+1234567890" id="owner-phone">
        <div class="form-hint">Your phone number for WhatsApp pairing approval</div>
      </div>
      
      <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
    </div>
    
    <!-- Browser Automation Settings -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Browser Automation</h3>
      </div>
      
      <div class="form-group">
        <label class="form-label">Browser Backend</label>
        <select class="form-input" id="browser-backend" onchange="updateBrowserBackend()">
          <option value="playwright">Playwright (Headless Chrome)</option>
          <option value="browseros" id="browseros-option" disabled>BrowserOS (Not Available)</option>
        </select>
        <div class="form-hint">Choose which browser engine to use for automation</div>
      </div>
      
      <div id="browseros-status" style="margin-top: 12px; padding: 12px; border-radius: 8px; background: var(--bg-tertiary);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="browseros-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted);"></span>
          <span id="browseros-status-text" style="color: var(--text-secondary); font-size: 13px;">Checking BrowserOS...</span>
        </div>
        <div id="browseros-tools" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);"></div>
      </div>
    </div>
    
    ${isAdmin ? `
    <!-- User Management (Admin Only) -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">User Management</h3>
      </div>
      
      <div class="user-list" id="user-list">
        ${state.users.map(u => `
          <div class="user-item">
            <div class="user-item-avatar">${(u.username || 'U')[0].toUpperCase()}</div>
            <div class="user-item-info">
              <div class="user-item-name">${u.username}</div>
              <div class="user-item-meta">
                <span class="role-badge ${u.role}">${u.role}</span>
                <span>Created: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
            <div class="user-item-actions">
              ${u.id !== state.user?.userId ? `
                <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}', '${u.username}')">
                  Delete
                </button>
              ` : '<span style="color: var(--text-muted); font-size: 12px;">You</span>'}
            </div>
          </div>
        `).join('')}
      </div>
      
      <h4 style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary);">Add New User</h4>
      <div class="add-user-form">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" id="new-username" placeholder="username">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" id="new-password" placeholder="password">
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-input" id="new-role">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="addUser()">Add User</button>
      </div>
    </div>
    ` : ''}
    
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Danger Zone</h3>
      </div>
      <button class="btn btn-danger" onclick="resetSetup()">Reset Setup Wizard</button>
    </div>
  `;
}

// Setup Wizard
function renderSetupWizard() {
  const steps = ['Welcome', 'Prerequisites', 'AI Providers', 'Channels', 'Skills', 'Complete'];

  return `
    <div class="wizard-container">
      <div class="wizard-header">
        <div class="wizard-logo">🐋</div>
        <h1 class="wizard-title">Welcome to OpenWhale</h1>
        <p class="wizard-subtitle">Let's set up your AI assistant</p>
      </div>
      
      <div class="wizard-steps">
        ${steps.map((s, i) => `
          ${i > 0 ? `<div class="wizard-step-line ${i <= state.setupStep ? 'completed' : ''}"></div>` : ''}
          <div class="wizard-step ${i === state.setupStep ? 'active' : ''} ${i < state.setupStep ? 'completed' : ''}">
            ${i < state.setupStep ? '✓' : i + 1}
          </div>
        `).join('')}
      </div>
      
      <div class="wizard-content">
        ${renderSetupStep()}
      </div>
    </div>
  `;
}

function renderSetupStep() {
  switch (state.setupStep) {
    case 0: return renderWelcomeStep();
    case 1: return renderPrereqStep();
    case 2: return renderProvidersStep();
    case 3: return renderChannelsStep();
    case 4: return renderSkillsStep();
    case 5: return renderCompleteStep();
    default: return renderWelcomeStep();
  }
}

function renderWelcomeStep() {
  return `
    <div class="wizard-section-title">Welcome to OpenWhale!</div>
    <p class="wizard-section-desc">
      OpenWhale is your personal AI assistant that can control your computer, manage your calendar,
      send messages, and much more - all through a simple chat interface.
    </p>
    
    <div style="background: var(--bg-secondary); padding: 20px; border-radius: var(--radius-sm); margin-bottom: 20px">
      <h4 style="margin-bottom: 12px">What we'll set up:</h4>
      <ul style="color: var(--text-secondary); padding-left: 20px">
        <li>Check and install required software</li>
        <li>Configure AI providers (OpenAI, Anthropic, etc.)</li>
        <li>Set up messaging channels (WhatsApp, Telegram)</li>
        <li>Connect external services (GitHub, Spotify, etc.)</li>
      </ul>
    </div>
    
    <div class="wizard-actions">
      <div></div>
      <button class="btn btn-primary" onclick="saveSetupStep(0, {})">
        Get Started →
      </button>
    </div>
  `;
}

function renderPrereqStep() {
  // Core runtimes (info only)
  const corePrereqs = [
    { id: 'node', name: 'Node.js', desc: 'JavaScript runtime (required)', info: state.prerequisites?.node },
    { id: 'python', name: 'Python 3', desc: 'For code execution', info: state.prerequisites?.python },
    { id: 'homebrew', name: 'Homebrew', desc: 'Package manager', info: state.prerequisites?.homebrew },
  ];

  // Optional tools (can install)
  const optionalPrereqs = [
    { id: 'ffmpeg', name: 'FFmpeg', desc: 'Audio/video processing', info: state.prerequisites?.ffmpeg },
    { id: 'imagesnap', name: 'ImageSnap', desc: 'Camera capture (macOS)', info: state.prerequisites?.imagesnap },
  ];

  return `
    <div class="wizard-section-title">System Check</div>
    <p class="wizard-section-desc">
      Checking your system for required and optional tools that enhance OpenWhale's capabilities.
    </p>
    
    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">Core Requirements</div>
      <div class="prereq-list">
        ${corePrereqs.map(p => `
          <div class="prereq-item">
            <span class="prereq-icon">${p.info?.installed ? '✅' : '❌'}</span>
            <div class="prereq-info">
              <div class="prereq-name">${p.name}</div>
              <div class="prereq-desc">${p.desc}</div>
            </div>
            <div class="prereq-status ${p.info?.installed ? 'installed' : 'missing'}">
              ${p.info?.installed ? (p.info.version || 'Installed') : 'Not found'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div>
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">Optional Tools</div>
      <div class="prereq-list">
        ${optionalPrereqs.map(p => `
          <div class="prereq-item">
            <span class="prereq-icon">${p.info?.installed ? '✅' : '📦'}</span>
            <div class="prereq-info">
              <div class="prereq-name">${p.name}</div>
              <div class="prereq-desc">${p.desc}</div>
            </div>
            <div class="prereq-status ${p.info?.installed ? 'installed' : 'missing'}">
              ${p.info?.installed ? 'Installed' : `
                <button class="btn btn-secondary" onclick="installPrerequisite('${p.id}')">
                  Install
                </button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="wizard-actions">
      <button class="btn btn-secondary" onclick="goBack(0)">
        ← Back
      </button>
      <button class="btn btn-primary" onclick="saveSetupStep(1, {})">
        Continue →
      </button>
    </div>
  `;
}

function renderProvidersStep() {
  return `
    <div class="wizard-section-title">AI Providers</div>
    <p class="wizard-section-desc">
      Configure at least one AI provider to use OpenWhale. We recommend Anthropic's Claude for the best experience.
    </p>
    
    <div class="form-group">
      <label class="form-label">Anthropic API Key (Recommended)</label>
      <input type="password" class="form-input" id="setup-anthropic" placeholder="sk-ant-...">
      <div class="form-hint">Get your key from <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a></div>
    </div>
    
    <div class="form-group">
      <label class="form-label">OpenAI API Key (Optional)</label>
      <input type="password" class="form-input" id="setup-openai" placeholder="sk-...">
    </div>
    
    <div class="form-group">
      <label class="form-label">Google AI API Key (Optional)</label>
      <input type="password" class="form-input" id="setup-google" placeholder="AIza...">
    </div>
    
    <div style="background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 16px; border: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn btn-secondary" onclick="testAIProvider()" id="test-ai-btn">
          🧪 Test AI Connection
        </button>
        <span id="test-ai-status" style="color: var(--text-secondary); font-size: 13px;"></span>
      </div>
    </div>
    
    <div class="wizard-actions">
      <button class="btn btn-secondary" onclick="goBack(1)">
        ← Back
      </button>
      <button class="btn btn-primary" onclick="saveProviderSetup()">
        Continue →
      </button>
    </div>
  `;
}

function renderChannelsStep() {
  return `
    <div class="wizard-section-title">Communication Channels</div>
    <p class="wizard-section-desc">
      Choose how you want to interact with OpenWhale. Enable channels and connect them now.
    </p>
    
    <div class="prereq-list">
      <div class="prereq-item" style="flex-direction: column; align-items: stretch;">
        <div style="display: flex; align-items: center; gap: 16px; width: 100%;">
          <span class="prereq-icon">💬</span>
          <div class="prereq-info">
            <div class="prereq-name">WhatsApp</div>
            <div class="prereq-desc">Chat with OpenWhale via WhatsApp</div>
          </div>
          ${state.whatsappConnected ? `
            <span style="color: var(--success); font-weight: 600;">✅ Connected</span>
          ` : `
            <label class="toggle">
              <input type="checkbox" id="setup-whatsapp" checked onchange="render();">
              <span class="toggle-slider"></span>
            </label>
          `}
        </div>
        ${!state.whatsappConnected && document.getElementById?.('setup-whatsapp')?.checked !== false ? `
          <div style="margin-top: 16px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-sm);">
            ${state.whatsappQR ? `
              <div style="text-align: center;">
                <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">📱 Scan with WhatsApp to connect:</p>
                <img src="${state.whatsappQR}" alt="WhatsApp QR Code" style="max-width: 200px; border-radius: 8px; background: white; padding: 8px;">
                <p style="margin-top: 12px; color: var(--text-muted); font-size: 12px;">Open WhatsApp → Settings → Linked Devices → Link a Device</p>
              </div>
            ` : state.whatsappConnecting ? `
              <div style="text-align: center; padding: 20px;">
                <div class="spinner"></div>
                <p style="margin-top: 12px; color: var(--text-muted);">Generating QR code...</p>
              </div>
            ` : `
              <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">📱 Scan QR code with WhatsApp to connect</p>
              <button class="btn btn-primary" onclick="connectChannelInSetup('whatsapp')" style="width: 100%;">
                📲 Connect WhatsApp
              </button>
            `}
          </div>
        ` : ''}
      </div>
      
      <div class="prereq-item" style="flex-direction: column; align-items: stretch;">
        <div style="display: flex; align-items: center; gap: 16px; width: 100%;">
          <span class="prereq-icon">📱</span>
          <div class="prereq-info">
            <div class="prereq-name">Telegram</div>
            <div class="prereq-desc">Chat via Telegram bot</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="setup-telegram">
            <span class="toggle-slider"></span>
          </label>
        </div>
        ${document.getElementById?.('setup-telegram')?.checked ? `
          <div style="margin-top: 16px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-sm);">
            <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">🤖 Create a Telegram bot with @BotFather</p>
            <button class="btn btn-primary" onclick="connectChannelInSetup('telegram')" style="width: 100%;">
              🔑 Enter Bot Token
            </button>
          </div>
        ` : ''}
      </div>
      
      <div class="prereq-item" style="flex-direction: column; align-items: stretch;">
        <div style="display: flex; align-items: center; gap: 16px; width: 100%;">
          <span class="prereq-icon">🎮</span>
          <div class="prereq-info">
            <div class="prereq-name">Discord</div>
            <div class="prereq-desc">Chat via Discord bot</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="setup-discord">
            <span class="toggle-slider"></span>
          </label>
        </div>
        ${document.getElementById?.('setup-discord')?.checked ? `
          <div style="margin-top: 16px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-sm);">
            <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">🤖 Create a Discord bot at Discord Developer Portal</p>
            <button class="btn btn-primary" onclick="connectChannelInSetup('discord')" style="width: 100%;">
              🔑 Enter Bot Token
            </button>
          </div>
        ` : ''}
      </div>
      
      <div class="prereq-item">
        <span class="prereq-icon">🌐</span>
        <div class="prereq-info">
          <div class="prereq-name">Web Dashboard</div>
          <div class="prereq-desc">Chat from this dashboard (always enabled)</div>
        </div>
        <label class="toggle">
          <input type="checkbox" checked disabled>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    
    <div class="wizard-actions">
      <button class="btn btn-secondary" onclick="goBack(2)">
        ← Back
      </button>
      <button class="btn btn-primary" onclick="saveChannelSetup()">
        Continue →
      </button>
    </div>
  `;
}

function renderSkillsStep() {
  return `
    <div class="wizard-section-title">Skills & Integrations</div>
    <p class="wizard-section-desc">
      Connect external services to give OpenWhale more capabilities. All of these are optional - you can configure them later in Settings.
    </p>
    
    <!-- Google Services (OAuth) -->
    <div class="form-group" style="background: var(--bg-secondary); padding: 20px; border-radius: var(--radius-sm); margin-bottom: 16px; border: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <span style="font-size: 24px;">🌐</span>
        <div>
          <div style="font-weight: 600;">Google Services</div>
          <div style="color: var(--text-secondary); font-size: 13px;">Gmail, Calendar, Drive, Tasks</div>
        </div>
        <span id="google-status" style="margin-left: auto; font-size: 13px; color: var(--text-secondary);">Not connected</span>
      </div>
      <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">
        Connect your Google account to let OpenWhale read emails, manage calendar events, and access Drive files.
      </p>
      <button class="btn btn-primary" onclick="connectGoogleOAuth()" style="width: 100%;">
        🔗 Connect Google Account
      </button>
      <div style="margin-top: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm); font-size: 12px; color: var(--text-muted);">
        <strong>First time setup:</strong> Create OAuth 2.0 credentials at 
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a> → 
        Download credentials.json → Save to <code>~/.openwhale/google/credentials.json</code>
      </div>
    </div>
    
    <!-- GitHub -->
    <div class="form-group">
      <label class="form-label">🐙 GitHub Token</label>
      <input type="password" class="form-input" id="setup-github" placeholder="ghp_...">
      <div class="form-hint">
        Create at <a href="https://github.com/settings/tokens" target="_blank">github.com/settings/tokens</a> - enables repo access, issues, PRs
      </div>
    </div>
    
    <!-- Weather -->
    <div class="form-group">
      <label class="form-label">🌤️ OpenWeatherMap API Key</label>
      <input type="password" class="form-input" id="setup-weather" placeholder="...">
      <div class="form-hint">
        Free tier at <a href="https://openweathermap.org/api" target="_blank">openweathermap.org</a> - 1000 calls/day
      </div>
    </div>
    
    <!-- Notion -->
    <div class="form-group">
      <label class="form-label">📝 Notion API Key</label>
      <input type="password" class="form-input" id="setup-notion" placeholder="secret_...">
      <div class="form-hint">
        <a href="https://www.notion.so/profile/integrations/form/new-integration" target="_blank">Create new integration</a> → Copy "Internal Integration Secret" → Share pages with the integration
      </div>
    </div>
    
    <div class="wizard-actions">
      <button class="btn btn-secondary" onclick="goBack(3)">
        ← Back
      </button>
      <button class="btn btn-primary" onclick="saveSkillSetup()">
        Continue →
      </button>
    </div>
  `;
}

function renderCompleteStep() {
  return `
    <div style="text-align: center">
      <div style="font-size: 64px; margin-bottom: 20px">🎉</div>
      <div class="wizard-section-title">Setup Complete!</div>
      <p class="wizard-section-desc">
        OpenWhale is ready to use. You can now start chatting or configure additional settings.
      </p>
      
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 30px">
        <button class="btn btn-primary" onclick="completeSetup()">
          💬 Start Chatting
        </button>
        <button class="btn btn-secondary" onclick="state.view = 'settings'; state.setupComplete = true; render()">
          ⚙️ More Settings
        </button>
      </div>
    </div>
  `;
}

// Event Binding
function bindEvents() {
  // Chat input
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatInput.value);
        chatInput.value = '';
      }
    });

    // Auto-resize
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      sendMessage(chatInput.value);
      chatInput.value = '';
      chatInput.style.height = 'auto';
    });
  }

  // Model select
  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      state.currentModel = e.target.value;
    });
  }

  // Browser settings init (for settings page)
  if (state.view === 'settings') {
    initBrowserSettings();
  }
}

function bindSetupEvents() {
  loadPrerequisites();
}

// Wizard save functions
window.saveProviderSetup = async function () {
  const anthropic = document.getElementById('setup-anthropic')?.value;
  const openai = document.getElementById('setup-openai')?.value;
  const google = document.getElementById('setup-google')?.value;

  await saveSetupStep(2, {
    providers: {
      anthropic: { apiKey: anthropic, enabled: !!anthropic },
      openai: { apiKey: openai, enabled: !!openai },
      google: { apiKey: google, enabled: !!google }
    }
  });
};

window.saveChannelSetup = async function () {
  const whatsapp = document.getElementById('setup-whatsapp')?.checked;
  const telegram = document.getElementById('setup-telegram')?.checked;

  await saveSetupStep(3, {
    channels: { whatsapp, telegram, web: true }
  });
};

window.saveSkillSetup = async function () {
  const github = document.getElementById('setup-github')?.value;
  const weather = document.getElementById('setup-weather')?.value;
  const notion = document.getElementById('setup-notion')?.value;

  await saveSetupStep(4, {
    skills: {
      github: { apiKey: github, enabled: !!github },
      weather: { apiKey: weather, enabled: !!weather },
      notion: { apiKey: notion, enabled: !!notion }
    }
  });
};

window.completeSetup = async function () {
  await saveSetupStep(5, { completed: true });
};

// Global functions for onclick handlers
window.toggleChannel = toggleChannel;
window.connectWhatsApp = connectWhatsApp;
window.connectTelegram = connectTelegram;
window.connectDiscord = connectDiscord;
window.installPrerequisite = installPrerequisite;
window.saveSetupStep = saveSetupStep;
window.logout = logout;

// User Management Functions

async function addUser() {
  const username = document.getElementById('new-username')?.value;
  const password = document.getElementById('new-password')?.value;
  const role = document.getElementById('new-role')?.value || 'user';

  if (!username || !password) {
    await showDialog('Error', 'Username and password are required');
    return;
  }

  try {
    const result = await api('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });

    if (result.ok) {
      await loadUsers();
      render();
      await showDialog('Success', `User "${username}" created successfully`);
    } else {
      await showDialog('Error', result.error || 'Failed to create user');
    }
  } catch (e) {
    await showDialog('Error', e.message);
  }
}

async function deleteUser(userId, username) {
  const confirmed = await showConfirm('Delete User', `Are you sure you want to delete "${username}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const result = await api(`/users/${userId}`, { method: 'DELETE' });
    if (result.ok) {
      await loadUsers();
      render();
    } else {
      await showDialog('Error', result.error || 'Failed to delete user');
    }
  } catch (e) {
    await showDialog('Error', e.message);
  }
}

function showChangePasswordModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'password-modal';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 class="modal-title">Change Password</h3>
        <button class="modal-close" onclick="closeModal('password-modal')">✕</button>
      </div>
      <form id="change-password-form">
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input type="password" class="form-input" id="current-password" required>
        </div>
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input type="password" class="form-input" id="new-pw" required>
        </div>
        <div class="form-group">
          <label class="form-label">Confirm New Password</label>
          <input type="password" class="form-input" id="confirm-pw" required>
        </div>
        <div id="pw-error" style="color: var(--accent-red); margin-bottom: 16px; display: none;"></div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="closeModal('password-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">Change Password</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await changePassword();
  });
}

async function changePassword() {
  const currentPassword = document.getElementById('current-password')?.value;
  const newPassword = document.getElementById('new-pw')?.value;
  const confirmPassword = document.getElementById('confirm-pw')?.value;
  const errorDiv = document.getElementById('pw-error');

  if (newPassword !== confirmPassword) {
    errorDiv.textContent = 'New passwords do not match';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const result = await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (result.ok) {
      closeModal('password-modal');
      await showDialog('Success', 'Password changed successfully');
    } else {
      errorDiv.textContent = result.error || 'Failed to change password';
      errorDiv.style.display = 'block';
    }
  } catch (e) {
    errorDiv.textContent = e.message;
    errorDiv.style.display = 'block';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.remove();
}

function showDialog(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'dialog-modal';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="closeModal('dialog-modal')">✕</button>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">${message}</p>
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" id="dialog-ok-btn">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('dialog-ok-btn').addEventListener('click', () => {
      closeModal('dialog-modal');
      resolve();
    });
  });
}

window.addUser = addUser;
window.deleteUser = deleteUser;
window.showChangePasswordModal = showChangePasswordModal;
window.changePassword = changePassword;
window.closeModal = closeModal;
window.showDialog = showDialog;

// Test AI provider connection
window.testAIProvider = async function () {
  const statusEl = document.getElementById('test-ai-status');
  const btn = document.getElementById('test-ai-btn');

  const anthropicKey = document.getElementById('setup-anthropic')?.value;
  const openaiKey = document.getElementById('setup-openai')?.value;

  if (!anthropicKey && !openaiKey) {
    if (statusEl) statusEl.textContent = '⚠️ Enter an API key first';
    return;
  }

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = '🔄 Testing...';

  try {
    // Try Anthropic first, then OpenAI
    const provider = anthropicKey ? 'anthropic' : 'openai';
    const apiKey = anthropicKey || openaiKey;

    const res = await api('/setup/test-ai', 'POST', { provider, apiKey });

    if (res.ok) {
      if (statusEl) {
        statusEl.textContent = '✅ ' + (res.message || 'AI is working!');
        statusEl.style.color = 'var(--success)';
      }
    } else {
      if (statusEl) {
        statusEl.textContent = '❌ ' + (res.error || 'Test failed');
        statusEl.style.color = 'var(--error)';
      }
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = '❌ Error: ' + e.message;
      statusEl.style.color = 'var(--error)';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
};

// Connect Google OAuth
window.connectGoogleOAuth = async function () {
  const statusEl = document.getElementById('google-status');
  if (statusEl) statusEl.textContent = 'Connecting...';

  try {
    const res = await api('/google/auth-url');
    if (res.ok && res.authUrl) {
      // Open in new window for OAuth flow
      const popup = window.open(res.authUrl, 'google-auth', 'width=500,height=700');

      // Check for completion periodically
      const checkInterval = setInterval(async () => {
        try {
          if (popup?.closed) {
            clearInterval(checkInterval);
            // Check if authentication succeeded
            const status = await api('/google/status');
            if (status.authenticated) {
              if (statusEl) {
                statusEl.textContent = '✅ Connected!';
                statusEl.style.color = 'var(--success)';
              }
            } else {
              if (statusEl) statusEl.textContent = 'Not connected';
            }
          }
        } catch (e) {
          clearInterval(checkInterval);
        }
      }, 1000);
    } else {
      showDialog('Google OAuth Not Configured',
        `Please copy your Google OAuth credentials JSON file to:\n\n${res.credentialsPath || '~/.openwhale/google/credentials.json'}\n\nYou can get credentials from the Google Cloud Console.`);
      if (statusEl) statusEl.textContent = 'Not configured';
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Error';
    showDialog('Error', 'Failed to connect to Google: ' + e.message);
  }
};

// Back button handler
window.goBack = function (step) {
  state.setupStep = step;
  render();
};

// Connect channel during setup
window.connectChannelInSetup = async function (type) {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Connecting...';
  }

  try {
    if (type === 'whatsapp') {
      // Trigger connection
      await api('/channels/whatsapp/connect', { method: 'POST' });
      state.whatsappConnecting = true;
      render();

      // Poll for QR code and connection status
      const pollInterval = setInterval(async () => {
        try {
          const status = await api('/channels/whatsapp/status');

          if (status.connected) {
            // Connected!
            clearInterval(pollInterval);
            state.whatsappConnecting = false;
            state.whatsappConnected = true;
            state.whatsappQR = null;
            render();
          } else if (status.qrCode) {
            // Got QR code
            state.whatsappQR = status.qrCode;
            render();
          }
        } catch (e) {
          console.error('WhatsApp poll error:', e);
        }
      }, 2000); // Poll every 2 seconds

      // Stop polling after 3 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (state.whatsappConnecting && !state.whatsappConnected) {
          state.whatsappConnecting = false;
          showAlert('WhatsApp connection timed out. Please try again.', '⏰ Timeout');
          render();
        }
      }, 180000);

    } else if (type === 'telegram') {
      // Telegram bot token input
      const token = await showPrompt('Enter your Telegram Bot Token (from @BotFather):', '', '📱 Telegram Setup');
      if (token) {
        const result = await api('/channels/telegram/connect', {
          method: 'POST',
          body: JSON.stringify({ telegramBotToken: token })
        });
        if (result.ok) {
          await showAlert(`Telegram bot @${result.botUsername} connected!`, '✅ Success');
        } else {
          await showAlert(`Failed: ${result.error}`, '❌ Error');
        }
      }
      render();
    } else if (type === 'discord') {
      // Discord bot token input
      const token = await showPrompt('Enter your Discord Bot Token:', '', '🎮 Discord Setup');
      if (token) {
        const result = await api('/channels/discord/connect', {
          method: 'POST',
          body: JSON.stringify({ discordBotToken: token })
        });
        if (result.ok) {
          await showAlert(`Discord bot ${result.botUsername} connected!`, '✅ Success');
        } else {
          await showAlert(`Failed: ${result.error}`, '❌ Error');
        }
      }
      render();
    }
  } catch (e) {
    await showAlert(`Failed to connect ${type}: ${e.message}`, '❌ Error');
    state.whatsappConnecting = false;
    render();
  }
};

window.toggleToolCall = function (msgId, index) {
  const el = document.getElementById(`tool-${msgId}-${index}`);
  if (el) {
    el.classList.toggle('expanded');
    // Also toggle parent chip's expanded class for chevron rotation
    const chip = el.closest('.tool-call-chip');
    if (chip) chip.classList.toggle('expanded');
  }
};

window.toggleTool = function (name, enabled) {
  // Update tool state locally (for now - could add API endpoint)
  const tool = state.tools.find(t => t.name === name);
  if (tool) {
    tool.disabled = !enabled;
    render();
  }
};

window.toggleProvider = async function (type, enabled) {
  if (enabled) {
    // Disable all other providers first (radio button behavior)
    for (const p of state.providers) {
      if (p.type !== type && p.enabled) {
        await saveProviderConfig(p.type, { enabled: false });
      }
    }
  }
  await saveProviderConfig(type, { enabled });
  await loadProviders();
  render();
};

window.toggleSkill = async function (id, enabled) {
  await saveSkillConfig(id, { enabled });
};

// Extension actions
window.toggleExtension = async function (name) {
  try {
    const result = await api(`/extensions/${name}/toggle`, { method: 'POST' });
    if (result.ok) {
      await loadExtensions();
      render();
    } else {
      await showDialog('Error', result.error || 'Failed to toggle extension');
    }
  } catch (e) {
    await showDialog('Error', e.message);
  }
};

window.runExtension = async function (name) {
  try {
    await showDialog('Running', `Executing extension "${name}"...`);
    const result = await api(`/extensions/${name}/run`, { method: 'POST' });
    if (result.ok) {
      await showDialog('Success', `Extension output:\n\n${result.output || 'No output'}`);
    } else {
      await showDialog('Error', result.error || 'Extension failed');
    }
  } catch (e) {
    await showDialog('Error', e.message);
  }
};

window.viewExtensionCode = async function (name) {
  try {
    const result = await api(`/extensions/${name}/code`);
    if (result.ok) {
      // Create a code viewer modal
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'code-modal';
      overlay.innerHTML = `
        <div class="modal-box" style="max-width: 800px; max-height: 80vh;">
          <div class="modal-header">
            <h3 class="modal-title">Extension: ${name}</h3>
            <button class="modal-close" onclick="closeModal('code-modal')">✕</button>
          </div>
          <pre style="background: var(--surface); padding: 16px; border-radius: 8px; overflow: auto; max-height: 60vh; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.5;"><code>${result.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px;">
            <button class="btn btn-secondary" onclick="closeModal('code-modal')">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      await showDialog('Error', result.error || 'Failed to load code');
    }
  } catch (e) {
    await showDialog('Error', e.message);
  }
};

window.deleteExtension = async function (name) {
  const confirmed = await showConfirm('Delete Extension', `Are you sure you want to delete "${name}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const result = await api(`/extensions/${name}`, { method: 'DELETE' });
    if (result.ok) {
      await loadExtensions();
      render();
      await showDialog('Success', `Extension "${name}" deleted`);
    } else {
      await showDialog('Error', result.error || 'Failed to delete extension');
    }
  } catch (e) {
    await showDialog('Error', e.message);
  }
};

window.saveProvider = async function (type) {
  const apiKey = document.getElementById(`apikey-${type}`)?.value;
  const baseUrl = document.getElementById(`baseurl-${type}`)?.value;
  const selectedModel = document.getElementById(`model-${type}`)?.value;

  // Save provider config with selected model
  await saveProviderConfig(type, { apiKey, baseUrl, enabled: true, selectedModel });

  // If a model was selected, update state
  if (selectedModel) {
    state.currentModel = selectedModel;
    await showAlert(`Saved! Using ${type} with model ${selectedModel}`, '✅ Success');
    render();
  }
};

window.saveSkill = async function (id) {
  const apiKey = document.getElementById(`skill-${id}`)?.value;
  await saveSkillConfig(id, { apiKey, enabled: !!apiKey });
};

window.switchSkillsTab = function (tab) {
  state.skillsTab = tab;
  render();
};

window.editMdSkill = async function (skillPath) {
  // skillPath is path to SKILL.md, get skill directory
  const skillDir = skillPath.replace(/\/SKILL\.md$/, '');
  state.editingSkillDir = skillDir;
  state.editingSkillPath = skillPath;
  state.editingSkillContent = null;
  state.editingSkillTree = [];
  state.editingSkillLoading = true;
  render();

  try {
    // Load file tree
    const treeRes = await api('/md-skills/tree?dir=' + encodeURIComponent(skillDir));
    state.editingSkillTree = treeRes.tree || [];

    // Load initial file content
    const contentRes = await api('/md-skills/content?path=' + encodeURIComponent(skillPath));
    state.editingSkillContent = contentRes.content;
  } catch (e) {
    state.editingSkillContent = '# Error loading skill\n\n' + e.message;
  }
  state.editingSkillLoading = false;
  render();
};

window.selectSkillFile = async function (filePath) {
  state.editingSkillPath = filePath;
  state.editingSkillLoading = true;
  render();

  try {
    const res = await api('/md-skills/content?path=' + encodeURIComponent(filePath));
    state.editingSkillContent = res.content;
  } catch (e) {
    state.editingSkillContent = '# Error loading file\n\n' + e.message;
  }
  state.editingSkillLoading = false;
  render();
};

window.closeMdSkillEditor = function () {
  state.editingSkillDir = null;
  state.editingSkillPath = null;
  state.editingSkillContent = null;
  state.editingSkillTree = [];
  state.editingSkillLoading = false;
  render();
};

window.showCreateSkillModal = function () {
  state.showCreateSkillModal = true;
  render();
};

// Handle search with focus preservation
window.handleMdSkillsSearch = function (input) {
  const cursorPos = input.selectionStart;
  state.mdSkillsSearch = input.value;
  state.mdSkillsPage = 0;
  render();
  // Restore focus and cursor after render
  setTimeout(() => {
    const searchInput = document.getElementById('md-skills-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(cursorPos, cursorPos);
    }
  }, 0);
};

window.setMdSkillsPage = function (page) {
  state.mdSkillsPage = page;
  render();
  // Scroll to top of skills section
  const skillsSection = document.querySelector('.skills-grid');
  if (skillsSection) {
    skillsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

window.closeCreateSkillModal = function () {
  state.showCreateSkillModal = false;
  render();
};

window.createNewSkill = async function () {
  const nameInput = document.getElementById('new-skill-name');
  const descInput = document.getElementById('new-skill-desc');

  const name = nameInput?.value?.trim();
  const description = descInput?.value?.trim();

  if (!name) {
    showAlert('Please enter a skill name', 'Validation Error');
    return;
  }

  try {
    const res = await api('/md-skills/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });

    if (res.error) {
      showAlert(res.error, 'Error');
      return;
    }

    state.showCreateSkillModal = false;
    await loadSkills(); // Reload skills list
    showAlert('Skill created successfully!', 'Success');

    // Open the new skill for editing
    if (res.path) {
      editMdSkill(res.path + '/SKILL.md');
    }
  } catch (e) {
    showAlert('Failed to create skill: ' + e.message, 'Error');
  }
};

window.promptNewFile = async function () {
  const fileName = await showPrompt('Enter file name (e.g., guide.md, config.json):', 'New File');
  if (!fileName) return;

  if (!state.editingSkillDir) {
    showAlert('No skill directory selected', 'Error');
    return;
  }

  try {
    const res = await api('/md-skills/create-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentDir: state.editingSkillDir,
        fileName: fileName
      })
    });

    if (res.error) {
      showAlert(res.error, 'Error');
      return;
    }

    // Reload tree and open the new file
    const treeRes = await api('/md-skills/tree?dir=' + encodeURIComponent(state.editingSkillDir));
    state.editingSkillTree = treeRes.tree || [];

    if (res.path) {
      await selectSkillFile(res.path);
    }
    render();
    showAlert('File created!', 'Success');
  } catch (e) {
    showAlert('Failed to create file: ' + e.message, 'Error');
  }
};

window.promptNewFolder = async function () {
  const folderName = await showPrompt('Enter folder name (e.g., reference, scripts):', 'New Folder');
  if (!folderName) return;

  if (!state.editingSkillDir) {
    showAlert('No skill directory selected', 'Error');
    return;
  }

  try {
    const res = await api('/md-skills/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillDir: state.editingSkillDir,
        folderName: folderName
      })
    });

    if (res.error) {
      showAlert(res.error, 'Error');
      return;
    }

    // Reload tree
    const treeRes = await api('/md-skills/tree?dir=' + encodeURIComponent(state.editingSkillDir));
    state.editingSkillTree = treeRes.tree || [];
    render();
    showAlert('Folder created!', 'Success');
  } catch (e) {
    showAlert('Failed to create folder: ' + e.message, 'Error');
  }
};

window.promptNewFileInFolder = async function (folderPath) {
  const fileName = await showPrompt('Enter file name (e.g., guide.md, script.sh):', 'New File');
  if (!fileName) return;

  try {
    const res = await api('/md-skills/create-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentDir: folderPath,
        fileName: fileName
      })
    });

    if (res.error) {
      showAlert(res.error, 'Error');
      return;
    }

    // Reload tree and open the new file
    const treeRes = await api('/md-skills/tree?dir=' + encodeURIComponent(state.editingSkillDir));
    state.editingSkillTree = treeRes.tree || [];

    if (res.path) {
      await selectSkillFile(res.path);
    }
    render();
    showAlert('File created!', 'Success');
  } catch (e) {
    showAlert('Failed to create file: ' + e.message, 'Error');
  }
};

window.saveMdSkill = async function () {
  const textarea = document.getElementById('skill-editor-content');
  if (!textarea || !state.editingSkillPath) return;

  try {
    await api('/md-skills/save', {
      method: 'POST',
      body: JSON.stringify({ path: state.editingSkillPath, content: textarea.value })
    });
    await showAlert('Skill saved!', '✅ Success');
    state.editingSkillPath = null;
    state.editingSkillContent = null;
    await loadSkills();
    render();
  } catch (e) {
    await showAlert('Failed to save: ' + e.message, '❌ Error');
  }
};

window.saveSettings = async function () {
  const model = document.getElementById('default-model')?.value;
  const phone = document.getElementById('owner-phone')?.value;

  try {
    await api('/config', {
      method: 'POST',
      body: JSON.stringify({ defaultModel: model, ownerPhone: phone })
    });
    await showAlert('Settings saved!', '✅ Success');
  } catch (e) {
    await showAlert('Failed to save: ' + e.message, '❌ Error');
  }
};

// Browser automation settings
window.updateBrowserBackend = async function () {
  const backend = document.getElementById('browser-backend')?.value;

  try {
    await api('/settings/browser', {
      method: 'POST',
      body: JSON.stringify({ backend })
    });
    await showAlert(`Browser backend set to ${backend === 'browseros' ? 'BrowserOS' : 'Playwright'}`, '✅ Success');
  } catch (e) {
    await showAlert('Failed to update: ' + e.message, '❌ Error');
  }
};

window.checkBrowserOSStatus = async function () {
  const indicator = document.getElementById('browseros-indicator');
  const statusText = document.getElementById('browseros-status-text');
  const toolsDiv = document.getElementById('browseros-tools');
  const browserosOption = document.getElementById('browseros-option');
  const backendSelect = document.getElementById('browser-backend');

  if (!indicator) return; // Not on settings page

  try {
    const status = await api('/settings/browser/status');
    const settings = await api('/settings/browser');

    if (status.browseros?.available) {
      // Fully available - MCP enabled and responding
      indicator.style.background = '#10b981';
      statusText.textContent = `BrowserOS running at ${status.browseros.url}`;
      if (status.browseros.version) {
        statusText.textContent += ` (v${status.browseros.version})`;
      }
      const toolCount = status.browseros.toolCount || 42;
      toolsDiv.textContent = `${toolCount} browser automation tools available`;

      // Enable the BrowserOS option
      if (browserosOption) {
        browserosOption.disabled = false;
        browserosOption.textContent = 'BrowserOS (Full Browser)';
      }

      // Set current selection
      if (backendSelect && settings.backend) {
        backendSelect.value = settings.backend;
      }
    } else if (status.browseros?.running) {
      // Running but MCP not enabled
      indicator.style.background = '#f59e0b';
      statusText.textContent = 'BrowserOS running, but MCP server not enabled';
      toolsDiv.innerHTML = `<span style="color: #f59e0b;">⚠️ Enable MCP server:</span> Open BrowserOS → <code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">chrome://browseros/mcp</code> → Enable`;
    } else {
      // Not running
      indicator.style.background = '#6b7280';
      statusText.textContent = status.browseros?.error || 'BrowserOS not running';
      toolsDiv.innerHTML = '<a href="https://browseros.com" target="_blank" style="color: var(--primary);">Download BrowserOS</a> or run: npm run cli browser install';
    }
  } catch (e) {
    indicator.style.background = '#ef4444';
    statusText.textContent = 'Failed to check status';
    toolsDiv.textContent = e.message || '';
  }
};

// Check BrowserOS status when settings page loads
window.initBrowserSettings = function () {
  setTimeout(checkBrowserOSStatus, 500);
};

window.resetSetup = async function () {
  const confirmed = await showConfirm('This will reset all configuration.', '⚠️ Reset Setup?');
  if (confirmed) {
    try {
      await api('/setup/reset', { method: 'POST' });
      state.setupComplete = false;
      state.setupStep = 0;
      state.view = 'setup';
      render();
    } catch (e) {
      await showAlert('Failed to reset: ' + e.message, '❌ Error');
    }
  }
};

window.viewChannelMessages = async function (type) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  const channelNames = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    discord: 'Discord',
    web: 'Web',
    imessage: 'iMessage'
  };

  overlay.innerHTML = `
    <div class="modal" style="max-width: 700px; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border);">
        <h2 style="margin: 0;">${channelNames[type] || type} Messages</h2>
        <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 24px;">&times;</button>
      </div>
      <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          Loading messages...
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Fetch messages
  try {
    const res = await fetch('/dashboard/api/channels/' + type + '/messages');
    const data = await res.json();

    const modalBody = overlay.querySelector('.modal-body');

    // Handle WhatsApp conversations format
    if (type === 'whatsapp' && data.conversations) {
      if (data.conversations.length === 0) {
        modalBody.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">' +
          '<div style="font-size: 48px; margin-bottom: 16px;">📱</div>' +
          '<div>No WhatsApp messages yet</div>' +
          '<div style="font-size: 12px; margin-top: 8px;">Messages will appear here after sending or receiving via WhatsApp</div>' +
          '</div>';
        return;
      }

      // Show stats summary
      let html = '<div style="display: flex; gap: 16px; margin-bottom: 20px; padding: 12px; background: var(--surface-2); border-radius: 8px;">' +
        '<div><strong>' + (data.stats?.sent || 0) + '</strong> <span style="color: var(--text-muted);">sent</span></div>' +
        '<div><strong>' + (data.stats?.received || 0) + '</strong> <span style="color: var(--text-muted);">received</span></div>' +
        '<div><strong>' + data.conversations.length + '</strong> <span style="color: var(--text-muted);">conversations</span></div>' +
        '</div>';

      // Render conversations
      for (const conv of data.conversations) {
        const displayName = conv.contactName || conv.contact;
        html += '<div style="margin-bottom: 24px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden;">' +
          '<div style="padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">' +
          '<div style="font-weight: 600;">📱 ' + escapeHtml(displayName) + '</div>' +
          '<div style="font-size: 11px; color: var(--text-muted);">' + conv.messages.length + ' messages</div>' +
          '</div>' +
          '<div style="padding: 16px; max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">';

        for (const msg of conv.messages) {
          const isOutbound = msg.direction === 'outbound';
          const bgColor = isOutbound ? 'var(--accent)' : 'var(--surface-2)';
          const align = isOutbound ? 'margin-left: auto;' : '';
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const date = new Date(msg.timestamp).toLocaleDateString();
          const content = msg.content ? escapeHtml(msg.content.slice(0, 300)) + (msg.content.length > 300 ? '...' : '') : '[media]';

          html += '<div style="padding: 10px 14px; border-radius: 12px; background: ' + bgColor + '; max-width: 80%; ' + align + '">' +
            '<div style="white-space: pre-wrap; word-break: break-word; font-size: 14px;">' + content + '</div>' +
            '<div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; text-align: right;">' + (isOutbound ? '✓ ' : '') + time + ' • ' + date + '</div>' +
            '</div>';
        }

        html += '</div></div>';
      }

      modalBody.innerHTML = html;
      return;
    }

    // Fallback for other channels (original format)
    if (!data.ok || !data.messages || data.messages.length === 0) {
      modalBody.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">' +
        '<div style="font-size: 48px; margin-bottom: 16px;">💬</div>' +
        '<div>No messages yet</div>' +
        '<div style="font-size: 12px; margin-top: 8px;">Messages will appear here when users interact via ' + (channelNames[type] || type) + '</div>' +
        '</div>';
      return;
    }

    // Render messages (original format for non-WhatsApp)
    let messagesHtml = '';
    for (const msg of data.messages) {
      const isUser = msg.role === 'user';
      const bgColor = isUser ? 'var(--accent)' : 'var(--surface-2)';
      const align = isUser ? 'margin-left: auto;' : '';
      const sender = isUser ? msg.userId : 'OpenWhale';
      const time = new Date(msg.timestamp).toLocaleString();
      const content = escapeHtml(msg.content.slice(0, 500)) + (msg.content.length > 500 ? '...' : '');

      messagesHtml += '<div class="chat-message ' + msg.role + '" style="margin-bottom: 12px; padding: 12px 16px; border-radius: 12px; background: ' + bgColor + '; max-width: 85%; ' + align + '">' +
        '<div style="font-size: 10px; color: var(--text-muted); margin-bottom: 4px;">' + sender + ' • ' + time + '</div>' +
        '<div style="white-space: pre-wrap; word-break: break-word;">' + content + '</div>' +
        '</div>';
    }
    modalBody.innerHTML = messagesHtml;

  } catch (err) {
    const modalBody = overlay.querySelector('.modal-body');
    modalBody.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--error);">Error loading messages: ' + err.message + '</div>';
  }
};

// Helpers

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getChannelIcon(type) {
  const iconMap = {
    whatsapp: 'smartphone',
    telegram: 'send',
    discord: 'messageSquare',
    slack: 'messageSquare',
    web: 'globe',
    websocket: 'globe',
    imessage: 'smartphone'
  };
  return icon(iconMap[type] || 'radio');
}

function getProviderIcon(type) {
  const iconMap = {
    anthropic: 'brain',
    openai: 'sparkles',
    google: 'sparkles',
    ollama: 'cpu',
    deepseek: 'brain',
    groq: 'zap',
    together: 'sparkles'
  };
  return icon(iconMap[type] || 'bot');
}

// Expose functions globally for inline onclick handlers (required for ES modules)
window.clearChat = clearChat;
window.loadBirdConfig = loadBirdConfig;
window.saveTwitterCookies = saveTwitterCookies;
window.checkBirdCLI = checkBirdCLI;

// iMessage handlers
window.installImsg = async function () {
  const btn = document.getElementById('btn-install-imsg');
  const statusEl = document.getElementById('imessage-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Installing...'; }
  if (statusEl) statusEl.textContent = 'Installing imsg CLI... this may take a minute.';

  try {
    const res = await api('/channels/imessage/install', { method: 'POST' });
    if (res.ok) {
      if (statusEl) { statusEl.textContent = '✅ ' + (res.message || 'imsg installed!'); statusEl.style.color = 'var(--success)'; }
      if (btn) { btn.textContent = '✅ Installed'; }
      if (res.alreadyInstalled) {
        await showAlert('imsg CLI is already installed!', '✅ Ready');
      } else {
        await showAlert('imsg CLI installed successfully! You can now connect iMessage.', '✅ Installed');
      }
    } else {
      if (statusEl) { statusEl.textContent = '❌ ' + (res.error || 'Install failed'); statusEl.style.color = 'var(--error)'; }
      if (btn) { btn.disabled = false; btn.textContent = '⬇️ Install imsg CLI'; }
      await showAlert(res.error || 'Installation failed', '❌ Error');
    }
  } catch (e) {
    if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--error)'; }
    if (btn) { btn.disabled = false; btn.textContent = '⬇️ Install imsg CLI'; }
    await showAlert('Installation failed: ' + e.message, '❌ Error');
  }
};

window.connectIMessage = async function () {
  const btn = document.getElementById('btn-connect-imsg');
  const statusEl = document.getElementById('imessage-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Connecting...'; }
  if (statusEl) statusEl.textContent = 'Connecting to iMessage...';

  try {
    const res = await api('/channels/imessage/connect', { method: 'POST' });
    if (res.ok) {
      if (statusEl) { statusEl.textContent = '✅ Connected!'; statusEl.style.color = 'var(--success)'; }
      await showAlert(res.message || 'iMessage connected!', '✅ Success');
      await loadChannels();
      render();
    } else {
      if (statusEl) { statusEl.textContent = '❌ ' + (res.error || 'Connection failed'); statusEl.style.color = 'var(--error)'; }
      if (btn) { btn.disabled = false; btn.textContent = '📱 Connect iMessage'; }
      await showAlert(res.error || 'Connection failed', '❌ Error');
    }
  } catch (e) {
    if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--error)'; }
    if (btn) { btn.disabled = false; btn.textContent = '📱 Connect iMessage'; }
    await showAlert('Failed to connect: ' + e.message, '❌ Error');
  }
};
