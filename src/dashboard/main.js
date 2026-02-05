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

  // Tools
  terminal: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
  camera: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  image: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
  file: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
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
  externalLink: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',

  // Misc
  whale: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.5c.5-.5 1-1.3 1.3-2.3.3-1 .3-2.2-.3-3.2-.6-1-1.6-1.8-2.9-2-1.3-.3-2.7 0-3.9.6-1.2.7-2.2 1.8-2.7 3.1-.5 1.3-.5 2.7 0 4 .5 1.3 1.5 2.4 2.8 3 1.3.6 2.7.7 4 .3 1.3-.4 2.3-1.3 2.9-2.4"/><path d="M2 12c-1 2 0 5 3 6l1-2"/><path d="M5 18c1 1 3 1 4 0"/><path d="M3 12c0-5 4-7 8-7 6 0 6 5 6 5s1-2 4-2c1.5 0 2 1 2 2"/><circle cx="14" cy="10" r="1"/></svg>',
  activity: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',

  // Additional tool icons
  video: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',
  monitor: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
  puzzle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.878.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>',
  gitBranch: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  penTool: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
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
  prerequisites: {}
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
  await checkSetupStatus();
  if (!state.setupComplete) {
    state.view = 'setup';
  } else {
    state.view = location.hash.slice(1) || 'chat';
    await loadData();
  }
  render();

  window.addEventListener('hashchange', async () => {
    state.view = location.hash.slice(1) || 'chat';
    await loadData();
    render();
  });
});

// API Helpers
async function api(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  } catch (e) { console.error(e); }
}

async function loadSkills() {
  try {
    const data = await api('/skills');
    state.skills = data.skills || [];
  } catch (e) { console.error(e); }
}

async function loadTools() {
  try {
    const data = await api('/tools');
    state.tools = data.tools || [];
  } catch (e) { console.error(e); }
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
  render();
  scrollToBottom();

  try {
    const response = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: content.trim(),
        model: state.currentModel
      })
    });

    state.messages.push({
      id: response.id || Date.now().toString(),
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
      model: response.model,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    state.messages.push({
      id: Date.now().toString(),
      role: 'system',
      content: `Error: ${e.message}`,
      createdAt: new Date().toISOString()
    });
  }

  state.isSending = false;
  render();
  scrollToBottom();
}

function scrollToBottom() {
  setTimeout(() => {
    const container = document.querySelector('.chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }, 100);
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

  if (state.view === 'setup') {
    root.innerHTML = renderSetupWizard();
    bindSetupEvents();
  } else {
    root.innerHTML = renderApp();
    bindEvents();
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
    { id: 'skills', iconName: 'wrench', label: 'Skills' },
    { id: 'tools', iconName: 'tool', label: 'Tools' },
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

  return `
    <header class="header">
      <h1 class="header-title">${titles[state.view] || 'Dashboard'}</h1>
      <div class="header-actions">
        ${state.view === 'chat' ? `
          <div class="model-selector">
            <span>${icon('bot', 16)}</span>
            <select id="model-select">
              ${enabledProviders.map(p => p.models.map(m => `
                <option value="${m}" ${state.currentModel === m ? 'selected' : ''}>${m}</option>
              `).join('')).join('')}
            </select>
          </div>
        ` : ''}
        <div class="status-indicator">
          <span class="status-dot${state.channels.some(c => c.connected) ? '' : ' offline'}"></span>
          <span>${state.channels.filter(c => c.connected).length} connected</span>
        </div>
      </div>
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
    case 'settings': return renderSettings();
    default: return renderChat();
  }
}

function renderChat() {
  return `
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        ${state.messages.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('whale', 64)}</div>
            <div class="empty-state-title">How can I help you today?</div>
            <p>I can help you manage your channels, write code, or just chat.</p>
          </div>
        ` : state.messages.map(renderMessage).join('')}
        ${state.isSending ? `
          <div class="message assistant">
            <div class="message-content">
              <span class="status-dot connecting" style="display:inline-block"></span> Thinking...
            </div>
          </div>
        ` : ''}
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
            <span>Send</span>
            ${icon('arrowRight', 18)}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderMessage(msg) {
  const roleClass = msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'assistant';

  let content = escapeHtml(msg.content);
  // Simple markdown rendering
  content = content.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\n/g, '<br>');

  let toolCallsHtml = '';
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    toolCallsHtml = msg.toolCalls.map((tc, i) => `
      <div class="tool-call">
        <div class="tool-call-header" onclick="toggleToolCall(${msg.id}, ${i})">
          <span class="tool-call-icon">${icon('wrench', 16)}</span>
          <span class="tool-call-name">${tc.name}</span>
          <span class="tool-call-status ${tc.status}">${tc.status}</span>
        </div>
        <div class="tool-call-body" id="tool-${msg.id}-${i}">
          <div>Arguments:</div>
          <div class="tool-call-args">${JSON.stringify(tc.arguments, null, 2)}</div>
          ${tc.result ? `
            <div style="margin-top: 12px">Result:</div>
            <div class="tool-call-result">${typeof tc.result === 'string' ? escapeHtml(tc.result) : JSON.stringify(tc.result, null, 2)}</div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  return `
    <div class="message ${roleClass}">
      <div class="message-content">${content}</div>
      ${toolCallsHtml}
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
        <div class="bento-item bento-md bento-short" style="display: flex; flex-direction: column; justify-content: space-between;">
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
      helpText: 'Create a new integration → Copy the "Internal Integration Secret" → Paste here. Then share pages/databases with your integration to grant access.'
    },
    {
      id: 'google',
      name: 'Google',
      iconName: 'globe',
      desc: 'Calendar, Gmail, Drive',
      placeholder: 'OAuth Credentials JSON',
      helpUrl: 'https://console.cloud.google.com/apis/credentials',
      helpText: 'Create OAuth 2.0 credentials in Google Cloud Console. Enable Calendar, Gmail, Drive APIs. Download credentials JSON.'
    },
    {
      id: 'onepassword',
      name: '1Password',
      iconName: 'key',
      desc: 'Secure Passwords',
      placeholder: 'API Token',
      helpUrl: 'https://developer.1password.com/docs/connect/',
      helpText: 'Requires 1Password Connect server. Generate an API token from your Connect server settings.'
    }
  ];

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Skills</h1>
        <p class="page-subtitle">Connect external services to extend capabilities</p>
      </div>
    </div>

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
                ${icon('externalLink', 14)} Get API Key
              </a>
            </div>
            
            <div class="skill-form">
              <input type="password" class="form-input" 
                     placeholder="${s.placeholder}"
                     id="skill-${s.id}">
              <button class="btn btn-primary" onclick="saveSkill('${s.id}')">
                ${hasKey ? 'Update' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      `;
  }).join('')}
    </div>
  `;
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
    screen_record: 'monitor'
  };

  const categoryColors = {
    system: 'orange',
    utility: 'blue',
    web: 'purple',
    media: 'green'
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

function renderSettings() {
  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">General Settings</h3>
      </div>
      
      <div class="form-group">
        <label class="form-label">Default Model</label>
        <select class="form-input" id="default-model">
          ${state.providers.filter(p => p.enabled).map(p =>
    p.models.map(m => `<option value="${m}" ${state.currentModel === m ? 'selected' : ''}>${m}</option>`).join('')
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
        await api('/config', {
          method: 'POST',
          body: JSON.stringify({ telegramBotToken: token })
        });
        await showAlert('Telegram bot token saved!', '✅ Success');
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
  if (el) el.classList.toggle('expanded');
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
  await saveProviderConfig(type, { enabled });
};

window.toggleSkill = async function (id, enabled) {
  await saveSkillConfig(id, { enabled });
};

window.saveProvider = async function (type) {
  const apiKey = document.getElementById(`apikey-${type}`)?.value;
  const baseUrl = document.getElementById(`baseurl-${type}`)?.value;
  await saveProviderConfig(type, { apiKey, baseUrl, enabled: true });
};

window.saveSkill = async function (id) {
  const apiKey = document.getElementById(`skill-${id}`)?.value;
  await saveSkillConfig(id, { apiKey, enabled: !!apiKey });
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
    web: 'Web'
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
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
    websocket: 'globe'
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
