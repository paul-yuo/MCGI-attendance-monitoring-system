/**
 * MCGI PRODUCTION MONITORING SYSTEM
 * Core Application Controller, Auth & State Engine
 */

// Initial Default Dataset customized for MCGI Productions (Locales: Naic, Calubcob, Acacia)
const DEFAULT_MEMBERS = [
  { id: 'PROD001', name: 'Bro. Paul', rollNo: 'PROD-NAIC-01', department: 'Naic', role: 'MUNICIPAL PROD', email: 'paul@mcgiprod.org', avatarColor: '#fbbf24' },
  { id: 'PROD002', name: 'Sis. Maria Santos', rollNo: 'PROD-NAIC-02', department: 'Naic', role: 'LOCALE PROD', email: 'maria.s@mcgiprod.org', avatarColor: '#38bdf8' },
  { id: 'PROD003', name: 'Bro. Daniel Cruz', rollNo: 'PROD-CAL-01', department: 'Calubcob', role: 'MUNICIPAL PROD', email: 'daniel.cruz@mcgiprod.org', avatarColor: '#a855f7' },
  { id: 'PROD004', name: 'Bro. Joshua Reyes', rollNo: 'PROD-CAL-02', department: 'Calubcob', role: 'LOCALE PROD', email: 'joshua.r@mcgiprod.org', avatarColor: '#34d399' },
  { id: 'PROD005', name: 'Sis. Sarah Dela Cruz', rollNo: 'PROD-ACA-01', department: 'Acacia', role: 'MUNICIPAL PROD', email: 'sarah.dc@mcgiprod.org', avatarColor: '#f43f5e' },
  { id: 'PROD006', name: 'Bro. Kenneth Ramos', rollNo: 'PROD-ACA-02', department: 'Acacia', role: 'TRAINEE', email: 'kenneth.r@mcgiprod.org', avatarColor: '#fb923c' },
  { id: 'PROD007', name: 'Bro. Mark Anthony Flores', rollNo: 'PROD-NAIC-03', department: 'Naic', role: 'TRAINEE', email: 'mark.flores@mcgiprod.org', avatarColor: '#eab308' },
  { id: 'PROD008', name: 'Sis. Rachel Gomez', rollNo: 'PROD-CAL-03', department: 'Calubcob', role: 'TRAINEE', email: 'rachel.g@mcgiprod.org', avatarColor: '#ec4899' },
  { id: 'PROD009', name: 'Bro. Joseph Bautista', rollNo: 'PROD-ACA-03', department: 'Acacia', role: 'LOCALE PROD', email: 'joseph.b@mcgiprod.org', avatarColor: '#06b6d4' },
  { id: 'PROD010', name: 'Bro. Timothy Villanueva', rollNo: 'PROD-NAIC-04', department: 'Naic', role: 'LOCALE PROD', email: 'timothy.v@mcgiprod.org', avatarColor: '#8b5cf6' },
  { id: 'PROD011', name: 'Sis. Hannah Mendoza', rollNo: 'PROD-CAL-04', department: 'Calubcob', role: 'LOCALE PROD', email: 'hannah.m@mcgiprod.org', avatarColor: '#84cc16' },
  { id: 'PROD012', name: 'Bro. Gabriel Soriano', rollNo: 'PROD-ACA-04', department: 'Acacia', role: 'TRAINEE', email: 'gabriel.s@mcgiprod.org', avatarColor: '#f97316' }
];

// Initial Auth User Accounts
const DEFAULT_AUTH_USERS = [
  {
    id: 'PROD001',
    name: 'Bro. Paul',
    username: 'paul',
    email: 'paul@mcgiprod.org',
    password: '123!',
    locale: 'Naic',
    level: 'MUNICIPAL PROD',
    role: 'admin',
    isAdmin: true,
    isGlobalAdmin: true,
    duty: 'MPRO',
    qrCode: ''
  },
  {
    id: 'PROD002',
    name: 'Sis. Maria Santos',
    username: 'maria',
    email: 'maria.s@mcgiprod.org',
    password: '123!',
    locale: 'Naic',
    level: 'LOCALE PROD',
    role: 'member',
    isAdmin: false,
    duty: 'MPRO',
    qrCode: ''
  }
];

// Helper to get formatted dates (YYYY-MM-DD)
function getPastDateString(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Generate rich initial historical attendance
function generateInitialAttendance(membersList = DEFAULT_MEMBERS, dutyCode = 'MPRO') {
  const attendance = {};
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(getPastDateString(i));
  }

  dates.forEach((dateStr, dIndex) => {
    attendance[dateStr] = {};
    (membersList || DEFAULT_MEMBERS).forEach((m, mIndex) => {
      const seed = (dIndex * 19 + mIndex * 17) % 100;
      let status = 'present';
      let time = '07:45 AM';
      let remarks = '';

      if (seed > 88) {
        status = 'absent';
        time = '-';
      } else if (seed > 75) {
        status = 'late';
        time = '08:22 AM';
        remarks = 'Duty call delay';
      } else if (seed > 70 && dIndex === 2) {
        status = 'excused';
        time = '-';
        remarks = 'Official duty';
      } else {
        const min = 30 + ((seed * 3) % 25);
        time = `07:${min < 10 ? '0' + min : min} AM`;
      }

      if (dIndex === 6) { // today
        if (seed > 90) {
          status = 'absent';
          time = '-';
        } else if (seed > 78) {
          status = 'late';
          time = '08:18 AM';
          remarks = 'Traffic';
        } else {
          status = 'present';
          time = '07:50 AM';
        }
      }

      attendance[dateStr][m.id] = { status, time, remarks, duty: dutyCode };
    });
  });

  return attendance;
}

// Initial Sample Event Attendance Entries
const DEFAULT_EVENT_ENTRIES = [
  {
    id: 'EVT-1001',
    fullName: 'Bro. Paul',
    locale: ['Naic'],
    level: ['MUNICIPAL PROD'],
    eventDate: getPastDateString(0),
    event: 'PM',
    schedules: ['3:30AM/WED - LIVE'],
    guestsCount: 0,
    edition: [],
    status: 'PRESENT',
    duty: 'MPRO',
    otherEventName: '',
    remarks: 'Main Camera Operator & Switcher',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-1002',
    fullName: 'Sis. Maria Santos',
    locale: ['Naic'],
    level: ['LOCALE PROD'],
    eventDate: getPastDateString(0),
    event: 'MASS INDOCTRINATION',
    schedules: ['DAY 1'],
    guestsCount: 8,
    edition: [],
    status: 'PRESENT',
    duty: 'MPRO',
    otherEventName: '',
    remarks: 'Guest Registration Coordinator',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-1003',
    fullName: 'Bro. Daniel Cruz',
    locale: ['Calubcob'],
    level: ['MUNICIPAL PROD'],
    eventDate: getPastDateString(1),
    event: 'SERBISYONG KAPATIRAN',
    schedules: [],
    guestsCount: 0,
    edition: ['AFTERNOON EDITION - 12:50PM'],
    status: 'PRESENT',
    duty: 'MPRO',
    otherEventName: '',
    remarks: 'Audio Engineer Lead',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-1004',
    fullName: 'Bro. Joshua Reyes',
    locale: ['Calubcob'],
    level: ['LOCALE PROD'],
    eventDate: getPastDateString(1),
    event: 'WS',
    schedules: ['3:30AM/SAT - LIVE'],
    guestsCount: 0,
    edition: [],
    status: 'PRESENT',
    duty: 'MPRO',
    otherEventName: '',
    remarks: 'Livestream Monitor',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-1005',
    fullName: 'Bro. Kenneth Ramos',
    locale: ['Acacia'],
    level: ['TRAINEE'],
    eventDate: getPastDateString(2),
    event: 'SPBB',
    schedules: ['DAY 1/FRI - 4:00PM'],
    guestsCount: 0,
    edition: [],
    status: 'PRESENT',
    duty: 'MPRO',
    otherEventName: '',
    remarks: 'OBS & Graphics Trainee',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_LEAVES = [
  { id: 'LV-101', memberId: 'PROD006', memberName: 'Bro. Kenneth Ramos', department: 'Acacia', date: getPastDateString(1), type: 'Medical', reason: 'Flu symptoms and fever.', status: 'approved', submittedAt: getPastDateString(2) },
  { id: 'LV-102', memberId: 'PROD008', memberName: 'Sis. Rachel Gomez', department: 'Calubcob', date: getPastDateString(0), type: 'Family/Personal', reason: 'Family gathering obligation.', status: 'approved', submittedAt: getPastDateString(1) }
];

const DEFAULT_SETTINGS = {
  orgName: 'MCGI Production Monitoring System',
  cutoffTime: '08:00',
  alertThreshold: 75,
  soundEffects: true
};

// =========================================================================
// SYSTEM B: MCGI GUEST COORDINATORS (GCOS) SEED DATASETS
// =========================================================================
const DEFAULT_MEMBERS_GCOS = [
  { id: 'GCOS001', name: 'Bro. Rodel Mangahas', rollNo: 'GCOS-NAIC-01', department: 'Naic', role: 'COORDINATOR HEAD', email: 'rodel.m@mcgigcos.org', avatarColor: '#3b82f6' },
  { id: 'GCOS002', name: 'Sis. Elena Cruz', rollNo: 'GCOS-NAIC-02', department: 'Naic', role: 'GUEST RECEPTIONIST', email: 'elena.c@mcgigcos.org', avatarColor: '#64748b' },
  { id: 'GCOS003', name: 'Bro. Gary Santos', rollNo: 'GCOS-CAL-01', department: 'Calubcob', role: 'INDOCTRINATION SUPPORT', email: 'gary.s@mcgigcos.org', avatarColor: '#0ea5e9' },
  { id: 'GCOS004', name: 'Sis. Michelle Ramos', rollNo: 'GCOS-CAL-02', department: 'Calubcob', role: 'LOCALE COORDINATOR', email: 'michelle.r@mcgigcos.org', avatarColor: '#10b981' },
  { id: 'GCOS005', name: 'Bro. Christian De Leon', rollNo: 'GCOS-ACA-01', department: 'Acacia', role: 'INDOCTRINATION SUPPORT', email: 'christian.dl@mcgigcos.org', avatarColor: '#6366f1' },
  { id: 'GCOS006', name: 'Sis. Jocelyn Flores', rollNo: 'GCOS-ACA-02', department: 'Acacia', role: 'GUEST RECEPTIONIST', email: 'jocelyn.f@mcgigcos.org', avatarColor: '#8b5cf6' },
  { id: 'GCOS007', name: 'Bro. Richard Reyes', rollNo: 'GCOS-NAIC-03', department: 'Naic', role: 'TRAINEE', email: 'richard.r@mcgigcos.org', avatarColor: '#94a3b8' },
  { id: 'GCOS008', name: 'Sis. Bernadette Gomez', rollNo: 'GCOS-CAL-03', department: 'Calubcob', role: 'TRAINEE', email: 'bernadette.g@mcgigcos.org', avatarColor: '#475569' }
];

const DEFAULT_AUTH_USERS_GCOS = [
  {
    id: 'GCOS001',
    name: 'Bro. Rodel Mangahas',
    username: 'rodel',
    email: 'rodel.m@mcgigcos.org',
    password: '123!',
    locale: 'Naic',
    level: 'COORDINATOR HEAD',
    role: 'admin',
    isAdmin: true,
    duty: 'GCOS',
    qrCode: ''
  },
  {
    id: 'GCOS002',
    name: 'Sis. Elena Cruz',
    username: 'elena',
    email: 'elena.c@mcgigcos.org',
    password: '123!',
    locale: 'Naic',
    level: 'GUEST RECEPTIONIST',
    role: 'member',
    isAdmin: false,
    duty: 'GCOS',
    qrCode: ''
  }
];

const DEFAULT_EVENT_ENTRIES_GCOS = [
  {
    id: 'EVT-GCOS-1001',
    fullName: 'Bro. Rodel Mangahas',
    locale: ['Naic'],
    level: ['COORDINATOR HEAD'],
    eventDate: getPastDateString(0),
    event: 'MASS INDOCTRINATION',
    schedules: ['DAY 1'],
    guestsCount: 15,
    edition: [],
    status: 'PRESENT',
    duty: 'GCOS',
    otherEventName: '',
    remarks: 'Main Guest Welcoming & Tally Lead',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-GCOS-1002',
    fullName: 'Sis. Elena Cruz',
    locale: ['Naic'],
    level: ['GUEST RECEPTIONIST'],
    eventDate: getPastDateString(0),
    event: 'MASS INDOCTRINATION',
    schedules: ['DAY 1'],
    guestsCount: 12,
    edition: [],
    status: 'PRESENT',
    duty: 'GCOS',
    otherEventName: '',
    remarks: 'Guest Registration & Assistance',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-GCOS-1003',
    fullName: 'Bro. Gary Santos',
    locale: ['Calubcob'],
    level: ['INDOCTRINATION SUPPORT'],
    eventDate: getPastDateString(1),
    event: 'BAPTISM',
    schedules: ['MORNING - 8:00AM'],
    guestsCount: 6,
    edition: [],
    status: 'PRESENT',
    duty: 'GCOS',
    otherEventName: '',
    remarks: 'Baptism Candidates Assistance',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_LEAVES_GCOS = [
  { id: 'LV-GCOS-101', memberId: 'GCOS007', memberName: 'Bro. Richard Reyes', department: 'Naic', date: getPastDateString(1), type: 'Medical', reason: 'Flu symptoms and fever.', status: 'approved', submittedAt: getPastDateString(2) }
];

const DEFAULT_SETTINGS_GCOS = {
  orgName: 'MCGI Guest Coordinators Monitoring System',
  cutoffTime: '08:00',
  alertThreshold: 75,
  soundEffects: true
};

// =========================================================================
// SYSTEM C: MCGI TEATRO KRISTIANO (TK) SEED DATASETS
// =========================================================================
const DEFAULT_MEMBERS_TK = [
  { id: 'TK001', name: 'Bro. Christian Perez', rollNo: 'TK-NAIC-01', department: 'Naic', role: 'TK DIRECTOR', email: 'christian.p@mcgitk.org', avatarColor: '#ec4899' },
  { id: 'TK002', name: 'Sis. Joy Bautista', rollNo: 'TK-NAIC-02', department: 'Naic', role: 'SENIOR PERFORMER', email: 'joy.b@mcgitk.org', avatarColor: '#f43f5e' },
  { id: 'TK003', name: 'Bro. Nathan Rivera', rollNo: 'TK-CAL-01', department: 'Calubcob', role: 'CHOREOGRAPHER', email: 'nathan.r@mcgitk.org', avatarColor: '#d946ef' },
  { id: 'TK004', name: 'Sis. Bea Villanueva', rollNo: 'TK-CAL-02', department: 'Calubcob', role: 'LOCALE PERFORMER', email: 'bea.v@mcgitk.org', avatarColor: '#db2777' },
  { id: 'TK005', name: 'Bro. Lance Soriano', rollNo: 'TK-ACA-01', department: 'Acacia', role: 'BACKSTAGE & PROPS', email: 'lance.s@mcgitk.org', avatarColor: '#be185d' },
  { id: 'TK006', name: 'Sis. Chloe Mendoza', rollNo: 'TK-ACA-02', department: 'Acacia', role: 'LOCALE PERFORMER', email: 'chloe.m@mcgitk.org', avatarColor: '#e11d48' },
  { id: 'TK007', name: 'Bro. Justin Castro', rollNo: 'TK-NAIC-03', department: 'Naic', role: 'TRAINEE', email: 'justin.c@mcgitk.org', avatarColor: '#f472b6' },
  { id: 'TK008', name: 'Sis. Nicole Santos', rollNo: 'TK-CAL-03', department: 'Calubcob', role: 'TRAINEE', email: 'nicole.s@mcgitk.org', avatarColor: '#fb7185' }
];

const DEFAULT_AUTH_USERS_TK = [
  {
    id: 'TK001',
    name: 'Bro. Christian Perez',
    username: 'christian',
    email: 'christian.p@mcgitk.org',
    password: '123!',
    locale: 'Naic',
    level: 'TK DIRECTOR',
    role: 'admin',
    isAdmin: true,
    duty: 'TK',
    qrCode: ''
  },
  {
    id: 'TK002',
    name: 'Sis. Joy Bautista',
    username: 'joy',
    email: 'joy.b@mcgitk.org',
    password: '123!',
    locale: 'Naic',
    level: 'SENIOR PERFORMER',
    role: 'member',
    isAdmin: false,
    duty: 'TK',
    qrCode: ''
  }
];

const DEFAULT_EVENT_ENTRIES_TK = [
  {
    id: 'EVT-TK-1001',
    fullName: 'Bro. Christian Perez',
    locale: ['Naic'],
    level: ['TK DIRECTOR'],
    eventDate: getPastDateString(0),
    event: 'SPBB',
    schedules: ['DAY 1/FRI - 4:00PM'],
    guestsCount: 0,
    edition: [],
    status: 'PRESENT',
    duty: 'TK',
    otherEventName: '',
    remarks: 'Stage Presentation Direction & Crew Lead',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-TK-1002',
    fullName: 'Sis. Joy Bautista',
    locale: ['Naic'],
    level: ['SENIOR PERFORMER'],
    eventDate: getPastDateString(0),
    event: 'SPBB',
    schedules: ['DAY 1/FRI - 4:00PM'],
    guestsCount: 0,
    edition: [],
    status: 'PRESENT',
    duty: 'TK',
    otherEventName: '',
    remarks: 'Choral & Musical Presentation Performer',
    createdAt: new Date().toISOString()
  },
  {
    id: 'EVT-TK-1003',
    fullName: 'Bro. Nathan Rivera',
    locale: ['Calubcob'],
    level: ['CHOREOGRAPHER'],
    eventDate: getPastDateString(1),
    event: 'THANKSGIVING',
    schedules: ['5:00PM/SAT - LIVE'],
    guestsCount: 0,
    edition: [],
    status: 'PRESENT',
    duty: 'TK',
    otherEventName: '',
    remarks: 'Opening Presentation Dance Lead',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_LEAVES_TK = [
  { id: 'LV-TK-101', memberId: 'TK007', memberName: 'Bro. Justin Castro', department: 'Naic', date: getPastDateString(1), type: 'Family/Personal', reason: 'Family gathering obligation.', status: 'approved', submittedAt: getPastDateString(2) }
];

const DEFAULT_SETTINGS_TK = {
  orgName: 'MCGI Teatro Kristiano Monitoring System',
  cutoffTime: '08:00',
  alertThreshold: 75,
  soundEffects: true
};

// =========================================================================
// SYSTEM METADATA REGISTRY
// =========================================================================
const SYSTEM_METADATA = {
  MPRO: {
    code: 'MPRO',
    systemName: 'MCGI PRODUCTION Monitoring System',
    titlePart1: 'PRODUCTION',
    titlePart2: 'MONITORING SYSTEM',
    rosterLabel: 'Production Members',
    themeClass: '',
    headerDutyBadgeText: 'DUTY: MPRO'
  },
  GCOS: {
    code: 'GCOS',
    systemName: 'MCGI GUEST COORDINATORS Monitoring System',
    titlePart1: 'GUEST COORDINATORS',
    titlePart2: 'MONITORING SYSTEM',
    rosterLabel: 'Guest Coordinator Members',
    themeClass: 'portal-theme-gcos',
    headerDutyBadgeText: 'DUTY: GCOS'
  },
  TK: {
    code: 'TK',
    systemName: 'MCGI TEATRO KRISTIANO Monitoring System',
    titlePart1: 'TEATRO KRISTIANO',
    titlePart2: 'MONITORING SYSTEM',
    rosterLabel: 'Teatro Kristiano Members',
    themeClass: 'portal-theme-tk',
    headerDutyBadgeText: 'DUTY: TK'
  }
};

// Apply System Identity (Document Title, Sidebar Emblem, Top Header, Theme)
function applySystemIdentity(systemCode) {
  const sys = (systemCode || getActiveDutyScope()).toUpperCase();
  const meta = SYSTEM_METADATA[sys] || SYSTEM_METADATA.MPRO;

  // 1. Document Title
  document.title = `${meta.systemName} - Attendance Suite`;

  // 2. Sidebar Logo Emblem & Titles
  const sidebarLogo = document.getElementById('sidebarLogoBadge');
  if (sidebarLogo) {
    if (sys === 'MPRO') {
      sidebarLogo.innerHTML = `
        <div class="duty-badge-container duty-badge-mpro !w-auto !py-1 !px-2.5 shadow-inner">
          <div class="duty-badge-brand text-lg leading-none">MCGI</div>
          <div class="duty-badge-bar">
            <div class="duty-badge-line duty-line-mpro my-0.5"></div>
            <div class="duty-badge-sub duty-sub-mpro text-[6.5px]">PRODUCTIONS</div>
            <div class="duty-badge-line duty-line-mpro my-0.5"></div>
          </div>
        </div>`;
    } else if (sys === 'GCOS') {
      sidebarLogo.innerHTML = `
        <div class="duty-badge-container duty-badge-gcos !w-auto !py-1 !px-2.5 shadow-inner">
          <div class="duty-badge-brand duty-brand-gcos text-lg leading-none">MCGI</div>
          <div class="duty-badge-bar">
            <div class="duty-badge-line duty-line-gcos my-0.5"></div>
            <div class="duty-badge-sub duty-sub-gcos text-[6px]">GUEST COORDINATORS</div>
            <div class="duty-badge-line duty-line-gcos my-0.5"></div>
          </div>
        </div>`;
    } else if (sys === 'TK') {
      sidebarLogo.innerHTML = `
        <div class="duty-badge-container duty-badge-tk !w-auto !py-1 !px-2.5 shadow-inner">
          <div class="duty-badge-brand duty-brand-tk text-lg leading-none">MCGI</div>
          <div class="duty-badge-bar">
            <div class="duty-badge-line duty-line-tk my-0.5"></div>
            <div class="duty-badge-sub duty-sub-tk text-[6px]">TEATRO KRISTIANO</div>
            <div class="duty-badge-line duty-line-tk my-0.5"></div>
          </div>
        </div>`;
    }
  }

  const nameP1 = document.getElementById('sidebarSystemNamePart1');
  const nameP2 = document.getElementById('sidebarSystemNamePart2');
  if (nameP1) nameP1.textContent = meta.titlePart1;
  if (nameP2) nameP2.textContent = meta.titlePart2;

  // 3. Top Header Titles & Badges
  const headTitle = document.getElementById('headerSystemTitleText');
  if (headTitle) headTitle.textContent = meta.systemName;

  const headBadge = document.getElementById('headerDutyBadge');
  if (headBadge) headBadge.textContent = meta.headerDutyBadgeText;

  // 4. Navigation Roster Label
  const navRoster = document.getElementById('navRosterLabel');
  if (navRoster) navRoster.textContent = meta.rosterLabel;

  // 5. Portal Theme on #appContainer & document.body
  const container = document.getElementById('appContainer');
  if (container) {
    container.classList.remove('portal-theme-gcos', 'portal-theme-tk');
    if (meta.themeClass) {
      container.classList.add(meta.themeClass);
    }
  }
  document.body.classList.remove('portal-theme-gcos', 'portal-theme-tk');
  if (meta.themeClass) {
    document.body.classList.add(meta.themeClass);
  }
}

// Defensive Storage Parser Helper
function safeJSONParse(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    return JSON.parse(item);
  } catch (err) {
    console.warn(`[AppState] Storage parse error for key "${key}":`, err);
    return fallback;
  }
}

// Text normalization helper for accent/diacritics-insensitive searching
function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Comprehensive CSV sanitizer to prevent formula injection and escape internal quotes
function sanitizeCSVField(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Neutralize CSV formula execution triggers (=, +, -, @)
  if (/^[=+@\-]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// Guarantee internal cryptographic QR payloads and RBAC roles are present across all profiles
function ensureMemberQrsAndRoles() {
  if (!window.AppState) return;
  const logger = window.AttendanceLogger;
  
  // Ensure members have internal qrCode
  (AppState.members || []).forEach(m => {
    if (!m.qrCode && logger) {
      m.qrCode = logger.generateMemberQr(m);
    }
  });

  // Ensure all auth users have roles and qrCodes
  (AppState.authUsers || []).forEach(u => {
    const isSpecialAdmin = u.isAdmin === true || u.role === 'admin' || 
      u.username === 'paul' || u.username === 'rodel' || u.username === 'christian' ||
      u.id === 'PROD001' || u.id === 'GCOS001' || u.id === 'TK001' || 
      (u.level && u.level.toUpperCase().includes('MUNICIPAL')) ||
      (u.level && u.level.toUpperCase().includes('COORDINATOR HEAD')) ||
      (u.level && u.level.toUpperCase().includes('DIRECTOR'));

    if (isSpecialAdmin) {
      u.isAdmin = true;
      u.role = 'admin';
    } else if (u.isAdmin === undefined) {
      u.isAdmin = false;
      u.role = 'member';
    }
    if (!u.qrCode && logger) {
      const prefix = u.id && u.id.startsWith('GCOS') ? 'GCOS' : u.id && u.id.startsWith('TK') ? 'TK' : 'PROD';
      u.qrCode = logger.generateMemberQr({
        id: u.id,
        rollNo: u.rollNo || `${prefix}-${(u.locale || 'NAIC').slice(0, 3).toUpperCase()}-01`,
        email: u.email
      });
    }
  });

  // Synchronize current user
  if (AppState.currentUser) {
    const matched = (AppState.authUsers || []).find(u => 
      (u.id && u.id === AppState.currentUser.id) || 
      (u.username && u.username === AppState.currentUser.username) ||
      (u.email && u.email === AppState.currentUser.email)
    );
    if (matched) {
      AppState.currentUser = { ...AppState.currentUser, ...matched };
    } else {
      const isSpecialAdmin = AppState.currentUser.isAdmin === true || AppState.currentUser.role === 'admin' || 
        AppState.currentUser.username === 'paul' || AppState.currentUser.username === 'rodel' || AppState.currentUser.username === 'christian' ||
        AppState.currentUser.id === 'PROD001' || AppState.currentUser.id === 'GCOS001' || AppState.currentUser.id === 'TK001';
      if (isSpecialAdmin) {
        AppState.currentUser.isAdmin = true;
        AppState.currentUser.role = 'admin';
      } else if (AppState.currentUser.isAdmin === undefined) {
        AppState.currentUser.isAdmin = false;
        AppState.currentUser.role = 'member';
      }
      if (!AppState.currentUser.qrCode && logger) {
        AppState.currentUser.qrCode = logger.generateMemberQr(AppState.currentUser);
      }
    }
    localStorage.setItem('mcgi_current_user', JSON.stringify(AppState.currentUser));
  }
  AppState.save();
}

// System Scope Record Isolation Loaders
function getActiveDutyScope() {
  const cu = safeJSONParse('mcgi_current_user', null);
  if (cu) {
    const isPaul = cu.isGlobalAdmin === true || (cu.username && cu.username.toLowerCase() === 'paul');
    if (isPaul) {
      const selected = sessionStorage.getItem('mcgi_selected_duty') || localStorage.getItem('mcgi_selected_duty') || cu.duty || 'MPRO';
      return selected.toUpperCase();
    }
    // Normal users are strictly tied to their registered duty
    return (cu.duty || 'MPRO').toUpperCase();
  }
  const selected = sessionStorage.getItem('mcgi_selected_duty') || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
  return selected.toUpperCase();
}

function loadSystemMembers(duty) {
  const d = (duty || getActiveDutyScope()).toLowerCase();
  if (d === 'gcos') {
    return safeJSONParse('mcgi_gcos_members', JSON.parse(JSON.stringify(DEFAULT_MEMBERS_GCOS)));
  } else if (d === 'tk') {
    return safeJSONParse('mcgi_tk_members', JSON.parse(JSON.stringify(DEFAULT_MEMBERS_TK)));
  } else {
    return safeJSONParse('mcgi_mpro_members', safeJSONParse('mcgi_members', JSON.parse(JSON.stringify(DEFAULT_MEMBERS))));
  }
}

function loadSystemAuthUsers(duty) {
  const d = (duty || getActiveDutyScope()).toLowerCase();
  if (d === 'gcos') {
    return safeJSONParse('mcgi_gcos_auth_users', JSON.parse(JSON.stringify(DEFAULT_AUTH_USERS_GCOS)));
  } else if (d === 'tk') {
    return safeJSONParse('mcgi_tk_auth_users', JSON.parse(JSON.stringify(DEFAULT_AUTH_USERS_TK)));
  } else {
    return safeJSONParse('mcgi_mpro_auth_users', safeJSONParse('mcgi_auth_users', JSON.parse(JSON.stringify(DEFAULT_AUTH_USERS))));
  }
}

function loadSystemAttendance(duty) {
  const d = (duty || getActiveDutyScope()).toLowerCase();
  let data = null;
  if (d === 'gcos') {
    data = safeJSONParse('mcgi_gcos_attendance', null);
    if (!data) data = safeJSONParse('mcgi_attendance_gcos', null);
    if (!data) data = generateInitialAttendance(DEFAULT_MEMBERS_GCOS, 'GCOS');
  } else if (d === 'tk') {
    data = safeJSONParse('mcgi_tk_attendance', null);
    if (!data) data = safeJSONParse('mcgi_attendance_tk', null);
    if (!data) data = generateInitialAttendance(DEFAULT_MEMBERS_TK, 'TK');
  } else {
    data = safeJSONParse('mcgi_mpro_attendance', null);
    if (!data) data = safeJSONParse('mcgi_attendance_mpro', null);
    if (!data) data = safeJSONParse('mcgi_attendance', null);
    if (!data) data = generateInitialAttendance(DEFAULT_MEMBERS, 'MPRO');
  }

  // Ensure every daily record is stamped with duty
  if (data && typeof data === 'object') {
    const dutyTag = d.toUpperCase();
    Object.keys(data).forEach(dateKey => {
      if (typeof data[dateKey] === 'object' && data[dateKey] !== null) {
        Object.keys(data[dateKey]).forEach(mId => {
          if (data[dateKey][mId] && !data[dateKey][mId].duty) {
            data[dateKey][mId].duty = dutyTag;
          }
        });
      }
    });
  }
  return data;
}

function loadSystemEventEntries(duty) {
  const d = (duty || getActiveDutyScope()).toLowerCase();
  let data = null;
  if (d === 'gcos') {
    data = safeJSONParse('mcgi_gcos_event_entries', null);
    if (!data) data = safeJSONParse('mcgi_prod_event_entries_gcos', null);
    if (!data) data = JSON.parse(JSON.stringify(DEFAULT_EVENT_ENTRIES_GCOS));
  } else if (d === 'tk') {
    data = safeJSONParse('mcgi_tk_event_entries', null);
    if (!data) data = safeJSONParse('mcgi_prod_event_entries_tk', null);
    if (!data) data = JSON.parse(JSON.stringify(DEFAULT_EVENT_ENTRIES_TK));
  } else {
    data = safeJSONParse('mcgi_mpro_event_entries', null);
    if (!data) data = safeJSONParse('mcgi_prod_event_entries_mpro', null);
    if (!data) data = safeJSONParse('mcgi_prod_event_entries', null);
    if (!data) data = JSON.parse(JSON.stringify(DEFAULT_EVENT_ENTRIES));
  }

  // Ensure every event entry is stamped with duty
  if (Array.isArray(data)) {
    const dutyTag = d.toUpperCase();
    data.forEach(entry => {
      if (entry && !entry.duty) entry.duty = dutyTag;
    });
  }
  return data;
}

function loadSystemLeaves(duty) {
  const d = (duty || getActiveDutyScope()).toLowerCase();
  if (d === 'gcos') {
    return safeJSONParse('mcgi_gcos_leaves', JSON.parse(JSON.stringify(DEFAULT_LEAVES_GCOS)));
  } else if (d === 'tk') {
    return safeJSONParse('mcgi_tk_leaves', JSON.parse(JSON.stringify(DEFAULT_LEAVES_TK)));
  } else {
    return safeJSONParse('mcgi_mpro_leaves', safeJSONParse('mcgi_leaves', JSON.parse(JSON.stringify(DEFAULT_LEAVES))));
  }
}

function loadSystemSettings(duty) {
  const d = (duty || getActiveDutyScope()).toLowerCase();
  if (d === 'gcos') {
    return safeJSONParse('mcgi_gcos_settings', JSON.parse(JSON.stringify(DEFAULT_SETTINGS_GCOS)));
  } else if (d === 'tk') {
    return safeJSONParse('mcgi_tk_settings', JSON.parse(JSON.stringify(DEFAULT_SETTINGS_TK)));
  } else {
    return safeJSONParse('mcgi_mpro_settings', safeJSONParse('mcgi_settings', JSON.parse(JSON.stringify(DEFAULT_SETTINGS))));
  }
}

// Backward-compatible aliases
const loadDutyAttendance = loadSystemAttendance;
const loadDutyEventEntries = loadSystemEventEntries;

// Global Application State (Strict Multi-System Scoping)
window.AppState = {
  members: loadSystemMembers(),
  authUsers: loadSystemAuthUsers(),
  currentUser: safeJSONParse('mcgi_current_user', null),
  attendance: loadSystemAttendance(),
  eventEntries: loadSystemEventEntries(),
  leaves: loadSystemLeaves(),
  settings: loadSystemSettings(),
  
  // Navigation & Filter states - default directly to the attendance-recording UI for chosen duty
  currentTab: 'event-entry',
  selectedDate: getPastDateString(0),
  selectedDept: 'all',
  searchQuery: '',
  editingMemberId: null,
  viewingMemberId: null,

  loadSystemData(duty) {
    const d = duty || getActiveDutyScope();
    this.members = loadSystemMembers(d);
    this.authUsers = loadSystemAuthUsers(d);
    this.attendance = loadSystemAttendance(d);
    this.eventEntries = loadSystemEventEntries(d);
    this.leaves = loadSystemLeaves(d);
    this.settings = loadSystemSettings(d);
  },

  reloadDutyScope() {
    this.loadSystemData();
  },

  save() {
    try {
      const duty = getActiveDutyScope().toLowerCase();
      // Scoped persistence for the active system
      localStorage.setItem(`mcgi_${duty}_members`, JSON.stringify(this.members));
      localStorage.setItem(`mcgi_${duty}_auth_users`, JSON.stringify(this.authUsers));
      localStorage.setItem(`mcgi_${duty}_attendance`, JSON.stringify(this.attendance));
      localStorage.setItem(`mcgi_${duty}_event_entries`, JSON.stringify(this.eventEntries));
      localStorage.setItem(`mcgi_${duty}_leaves`, JSON.stringify(this.leaves));
      localStorage.setItem(`mcgi_${duty}_settings`, JSON.stringify(this.settings));
      
      // Also write to duty-specific attendance/entries alias
      localStorage.setItem(`mcgi_attendance_${duty}`, JSON.stringify(this.attendance));
      localStorage.setItem(`mcgi_prod_event_entries_${duty}`, JSON.stringify(this.eventEntries));

      // Synchronize current user session
      localStorage.setItem('mcgi_current_user', JSON.stringify(this.currentUser));

      // Backward-compatible mirror for original Production system
      if (duty === 'mpro') {
        localStorage.setItem('mcgi_members', JSON.stringify(this.members));
        localStorage.setItem('mcgi_auth_users', JSON.stringify(this.authUsers));
        localStorage.setItem('mcgi_attendance', JSON.stringify(this.attendance));
        localStorage.setItem('mcgi_prod_event_entries', JSON.stringify(this.eventEntries));
        localStorage.setItem('mcgi_leaves', JSON.stringify(this.leaves));
        localStorage.setItem('mcgi_settings', JSON.stringify(this.settings));
      }
    } catch (e) {
      console.error('[AppState] Storage Quota Exceeded or write failed:', e);
      showToast('Storage quota warning: consider archiving old records', 'warning');
    }
  },

  resetDefaults() {
    const duty = getActiveDutyScope().toLowerCase();
    if (duty === 'gcos') {
      this.members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS_GCOS));
      this.authUsers = JSON.parse(JSON.stringify(DEFAULT_AUTH_USERS_GCOS));
      this.attendance = generateInitialAttendance(DEFAULT_MEMBERS_GCOS);
      this.eventEntries = JSON.parse(JSON.stringify(DEFAULT_EVENT_ENTRIES_GCOS));
      this.leaves = JSON.parse(JSON.stringify(DEFAULT_LEAVES_GCOS));
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS_GCOS));
    } else if (duty === 'tk') {
      this.members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS_TK));
      this.authUsers = JSON.parse(JSON.stringify(DEFAULT_AUTH_USERS_TK));
      this.attendance = generateInitialAttendance(DEFAULT_MEMBERS_TK);
      this.eventEntries = JSON.parse(JSON.stringify(DEFAULT_EVENT_ENTRIES_TK));
      this.leaves = JSON.parse(JSON.stringify(DEFAULT_LEAVES_TK));
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS_TK));
    } else {
      this.members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
      this.authUsers = JSON.parse(JSON.stringify(DEFAULT_AUTH_USERS));
      this.attendance = generateInitialAttendance(DEFAULT_MEMBERS);
      this.eventEntries = JSON.parse(JSON.stringify(DEFAULT_EVENT_ENTRIES));
      this.leaves = JSON.parse(JSON.stringify(DEFAULT_LEAVES));
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
    this.save();
    showToast(`Reset ${getActiveDutyScope()} records to defaults successfully`, 'info');
    App.render();
  }
};

// Toast Notifications Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `p-4 rounded-xl shadow-2xl border text-sm font-semibold flex items-center justify-between pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0 animate-fade-in ${
    type === 'success' ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200' :
    type === 'error' ? 'bg-rose-950/95 border-rose-500/60 text-rose-200' :
    type === 'warning' ? 'bg-amber-950/95 border-amber-500/60 text-amber-200' :
    'bg-midnight-900/95 border-slate-700/80 text-slate-200'
  }`;

  const iconName = type === 'success' ? 'check-circle-2' : type === 'error' ? 'alert-octagon' : type === 'warning' ? 'alert-triangle' : 'info';
  
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <i data-lucide="${iconName}" class="w-5 h-5 flex-shrink-0"></i>
      <span>${message}</span>
    </div>
    <button onclick="this.parentElement.remove()" class="ml-3 text-slate-400 hover:text-white p-1">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/// Audio Cue Helper (Disabled per preference)
function playSuccessChime() {
  // Sounds and chimes disabled across the application
}

// Main Application Controller
const App = {
  init() {
    this.initAuth();
    this.initTheme();
    this.bindEvents();
    this.initResponsiveListeners();
    this.startLiveClock();
    this.initEventEntryForm();
    this.initCloudSync();
    if (window.lucide) {
      lucide.createIcons();
    }
  },

  // =========================================================================
  // THEME MANAGEMENT (DARK / LIGHT MODE)
  // =========================================================================
  initTheme() {
    const savedTheme = localStorage.getItem('mcgi_app_theme') || 'dark';
    this.applyTheme(savedTheme);
  },

  applyTheme(theme) {
    const isLight = theme === 'light';
    const root = document.documentElement;
    const body = document.body;
    const icon = document.getElementById('themeToggleIcon');
    const text = document.getElementById('themeToggleText');

    if (isLight) {
      root.classList.remove('dark');
      root.classList.add('light-mode');
      body.classList.add('light-mode');
      localStorage.setItem('mcgi_app_theme', 'light');
      if (icon) icon.setAttribute('data-lucide', 'moon');
      if (text) text.textContent = 'Dark';
    } else {
      root.classList.add('dark');
      root.classList.remove('light-mode');
      body.classList.remove('light-mode');
      localStorage.setItem('mcgi_app_theme', 'dark');
      if (icon) icon.setAttribute('data-lucide', 'sun');
      if (text) text.textContent = 'Light';
    }
    if (window.lucide) lucide.createIcons();
  },

  toggleTheme() {
    const currentTheme = localStorage.getItem('mcgi_app_theme') || 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme.toUpperCase()} mode`, 'info');
  },

  // =========================================================================
  // SUPABASE CLOUD DATABASE & REALTIME SYNCHRONIZATION
  // =========================================================================
  async initCloudSync(forceRefresh = false) {
    if (!window.SupabaseClient) return;

    const duty = getActiveDutyScope();
    const isOnline = SupabaseClient.isOnline();
    this.updateCloudStatusBadge(isOnline);

    window.addEventListener('online', () => {
      this.updateCloudStatusBadge(true);
      showToast('Internet reconnected. Live Cloud Sync active.', 'info');
      this.initCloudSync(true);
    });

    window.addEventListener('offline', () => {
      this.updateCloudStatusBadge(false);
      showToast('Internet offline. Check-ins will queue locally on this device.', 'warning');
    });

    if (!isOnline) return;

    try {
      // 1. Fetch live members from Supabase for this ministry
      const cloudMembers = await SupabaseClient.getMembers(duty);
      if (cloudMembers && cloudMembers.length) {
        AppState.members = cloudMembers;
        ensureMemberQrsAndRoles();
        this.populateRosterQuickPick();
        if (AppState.currentTab === 'roster') this.renderRoster();
      }

      // 2. Fetch today's attendance logs from Supabase
      const cloudAttendance = await SupabaseClient.getAttendanceRecords(duty);
      if (cloudAttendance && Array.isArray(cloudAttendance)) {
        if (forceRefresh) {
          AppState.eventEntries = cloudAttendance;
          AppState.save();
        } else {
          const existingIds = new Set((AppState.eventEntries || []).map(e => e.id));
          cloudAttendance.forEach(ca => {
            if (!existingIds.has(ca.id)) {
              AppState.eventEntries.unshift(ca);
              existingIds.add(ca.id);
            }
          });
        }
        if (AppState.currentTab === 'dashboard') this.renderDashboard();
        if (AppState.currentTab === 'attendance') this.renderAttendanceView();
      }

      // 3. Turn on Realtime live sync across devices (insert & delete)
      SupabaseClient.subscribeToLiveAttendance(
        duty, 
        (newRecord) => {
          this.handleRealtimeAttendanceRecord(newRecord);
        },
        (deletedRecord) => {
          this.handleRealtimeAttendanceDelete(deletedRecord);
        }
      );

      // 4. Flush any offline pending queue
      const queueRes = await SupabaseClient.syncPendingQueue();
      if (queueRes && queueRes.synced > 0) {
        showToast(`Synchronized ${queueRes.synced} offline check-ins to cloud!`, 'success');
      }

      this.updateCloudStatusBadge(true);
    } catch (err) {
      console.warn('[App] Cloud sync initialization notice:', err);
      this.updateCloudStatusBadge(false);
    }
  },

  updateCloudStatusBadge(isOnline) {
    const badge = document.getElementById('headerCloudSyncBadge');
    const dot = document.getElementById('headerCloudSyncDot');
    const text = document.getElementById('headerCloudSyncText');
    const pill = document.getElementById('settingsCloudStatusPill');

    if (badge && dot && text) {
      if (isOnline) {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
        text.textContent = 'CLOUD SYNC';
        badge.className = 'hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30';
        badge.title = 'Supabase PostgreSQL Cloud Database Connected (Singapore)';
      } else {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400';
        text.textContent = 'OFFLINE QUEUE';
        badge.className = 'hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30';
        badge.title = 'Offline mode. Check-ins are stored on this device and will sync upon reconnect.';
      }
    }

    if (pill) {
      pill.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
      pill.className = `text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`;
    }
  },

  handleRealtimeAttendanceRecord(newRecord) {
    if (!newRecord) return;
    // Deduplicate: check both the app-local id AND the Supabase cloudId so we don't
    // double-insert entries we already recorded locally (the Realtime event fires for
    // INSERTs we made ourselves too, not just other devices).
    const alreadyExists = (AppState.eventEntries || []).some(e =>
      e.id === newRecord.id ||
      (newRecord.cloudId && e.cloudId === newRecord.cloudId) ||
      (newRecord.id && e.cloudId === newRecord.id) ||
      (e.id && newRecord.cloudId && e.id === newRecord.cloudId)
    );
    if (alreadyExists) return;

    AppState.eventEntries.unshift(newRecord);
    AppState.save();

    showToast(`Live Check-In: ${newRecord.fullName} (${newRecord.status})`, 'info');

    if (AppState.currentTab === 'dashboard') {
      this.renderDashboard();
    } else if (AppState.currentTab === 'attendance' || AppState.currentTab === 'event-entry') {
      if (window.AttendanceLogger && typeof AttendanceLogger.renderAttendanceLogsTable === 'function') {
        AttendanceLogger.renderAttendanceLogsTable();
      }
    }
  },

  handleRealtimeAttendanceDelete(oldRecord) {
    if (!oldRecord) return;
    const deletedId = oldRecord.id;
    const deletedCode = oldRecord.member_code;

    const initialLen = (AppState.eventEntries || []).length;
    AppState.eventEntries = (AppState.eventEntries || []).filter(e => 
      e.id !== deletedId && 
      e.cloudId !== deletedId && 
      (!deletedCode || (e.memberId !== deletedCode && e.id !== deletedCode))
    );

    if (AppState.eventEntries.length !== initialLen) {
      AppState.save();
      if (window.AttendanceLogger && typeof AttendanceLogger.renderAttendanceLogsTable === 'function') {
        AttendanceLogger.renderAttendanceLogsTable();
      }
      this.updateStatsCards();
      showToast('A record was removed in cloud database', 'info');
    }
  },

  async syncLocalDataToCloud() {
    if (!window.SupabaseClient) {
      showToast('Supabase client is not initialized.', 'error');
      return;
    }
    const duty = getActiveDutyScope();
    showToast(`Uploading local ${duty} records to Supabase...`, 'info');

    const res = await SupabaseClient.migrateLocalDataToCloud(duty);
    if (res.success) {
      showToast(`Cloud Sync Complete! Synced ${res.membersCount} members and ${res.attendanceCount} attendance logs.`, 'success');
      this.initCloudSync(true);
    } else {
      showToast(`Cloud sync notice: ${res.error || 'Check internet connection.'}`, 'warning');
    }
  },

  async refreshFromCloud() {
    showToast('Refreshing latest data from Supabase Cloud...', 'info');
    await this.initCloudSync(true);
    showToast('Dashboard up to date with Cloud Database.', 'success');
  },

  // =========================================================================
  // AUTHENTICATION & ACCESS CONTROL
  // =========================================================================
  initAuth() {
    const token = sessionStorage.getItem('mcgi_portal_access_token');
    const dutyActive = sessionStorage.getItem('mcgi_duty_session_active');
    const selectedDuty = sessionStorage.getItem('mcgi_selected_duty') || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
    const saved = localStorage.getItem('mcgi_current_user');

    // Requirement: The duty-selection screen must be the very first view presented after the app starts
    if (!token || !dutyActive || !selectedDuty || !saved) {
      sessionStorage.removeItem('mcgi_portal_access_token');
      sessionStorage.removeItem('mcgi_duty_session_active');
      window.location.replace('login.html');
      return;
    }

    try {
      AppState.currentUser = JSON.parse(saved);
      if (!AppState.currentUser.duty) {
        AppState.currentUser.duty = selectedDuty;
      }
    } catch (e) {
      localStorage.removeItem('mcgi_current_user');
      window.location.replace('login.html');
      return;
    }

    const isPaul = AppState.currentUser.isGlobalAdmin === true || (AppState.currentUser.username && AppState.currentUser.username.toLowerCase() === 'paul');

    // Security & Data Boundary Guard:
    // If a regular user account belongs to a different system than selectedDuty, block session and redirect
    if (!isPaul && AppState.currentUser.duty.toUpperCase() !== selectedDuty.toUpperCase()) {
      console.warn('Unauthorized cross-system access attempt detected. Redirecting to login.');
      sessionStorage.clear();
      localStorage.removeItem('mcgi_current_user');
      window.location.replace('login.html');
      return;
    }

    // Paul has global administrator access across all systems: set active duty context
    if (isPaul) {
      AppState.currentUser.duty = selectedDuty.toUpperCase();
      localStorage.setItem('mcgi_current_user', JSON.stringify(AppState.currentUser));
    }

    const currentDuty = (AppState.currentUser.duty || selectedDuty).toUpperCase();

    // 1. Apply visual branding, logo, header badges, and portal theme
    applySystemIdentity(currentDuty);

    // 2. Load scoped data strictly for this independent system
    AppState.loadSystemData(currentDuty);

    ensureMemberQrsAndRoles();
    this.updateRoleBasedUI();
    this.updateHeaderUserInfo();
    this.render();
  },

  updateRoleBasedUI() {
    const user = AppState.currentUser;
    const isSpecialAdmin = u => !!(u && (
      u.isAdmin === true || 
      u.role === 'admin' || 
      u.username === 'paul' || 
      u.username === 'rodel' || 
      u.username === 'christian' ||
      u.id === 'PROD001' || 
      u.id === 'GCOS001' || 
      u.id === 'TK001' ||
      (u.level && u.level.toUpperCase().includes('MUNICIPAL')) ||
      (u.level && u.level.toUpperCase().includes('COORDINATOR HEAD')) ||
      (u.level && u.level.toUpperCase().includes('DIRECTOR'))
    ));

    // The 'real' admin check – never affected by view-role override.
    const realAdmin = !!(user && (user._realIsAdmin === true || isSpecialAdmin(user)));
    // The effective (possibly overridden) admin check for rendering.
    const isAdmin = !!(user && (user.isAdmin === true || user.role === 'admin' || isSpecialAdmin(user)));

    const adminNav = document.getElementById('navGroupAdmin');
    const memberNav = document.getElementById('navGroupMember');
    const adminProfileLink = document.getElementById('navAdminProfileLink');
    const headerRecordBtn = document.getElementById('headerRecordAttendanceBtn');
    const roleSwitcher = document.getElementById('roleSwitcherWidget');

    // Show / hide the role-switcher only for real admins
    if (roleSwitcher) {
      if (realAdmin) {
        roleSwitcher.classList.remove('hidden');
        // Highlight the active button
        const activeRole = user.role === 'admin' || user.isAdmin ? 'admin' : (user.role || 'member');
        document.querySelectorAll('#roleSwitcherWidget [data-role]').forEach(btn => {
          const isActive = btn.dataset.role === activeRole;
          btn.className = `flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
            isActive
              ? 'border-gold-400/30 bg-gold-400 text-midnight-950'
              : 'border-mcgiblue-700/50 text-slate-300 hover:bg-midnight-700'
          }`;
        });
      } else {
        roleSwitcher.classList.add('hidden');
      }
    }

    if (isAdmin) {
      if (adminNav) adminNav.classList.remove('hidden');
      if (memberNav) memberNav.classList.add('hidden');
      if (adminProfileLink) adminProfileLink.classList.remove('hidden');
      if (headerRecordBtn) {
        headerRecordBtn.innerHTML = `
          <i data-lucide="plus-circle" class="w-4 h-4 stroke-[3]"></i>
          <span class="hidden sm:inline">Record Attendance</span>
          <span class="sm:hidden">Record</span>
        `;
        headerRecordBtn.onclick = () => App.switchTab('event-entry');
        headerRecordBtn.classList.remove('hidden');
      }
    } else {
      if (adminNav) adminNav.classList.add('hidden');
      if (memberNav) memberNav.classList.remove('hidden');
      if (adminProfileLink) adminProfileLink.classList.add('hidden');
      if (headerRecordBtn) {
        headerRecordBtn.innerHTML = `
          <i data-lucide="camera" class="w-4 h-4 stroke-[2]"></i>
          <span class="hidden sm:inline">Scan QR to Log</span>
          <span class="sm:hidden">Scan</span>
        `;
        headerRecordBtn.onclick = () => App.switchTab('member-scan');
        headerRecordBtn.classList.remove('hidden');
      }

      // Member safety redirect: If currently on an administrative tab, redirect to personal profile
      const adminOnlyTabs = ['dashboard', 'event-entry', 'attendance-logger', 'attendance', 'roster', 'reports', 'settings'];
      if (adminOnlyTabs.includes(AppState.currentTab)) {
        AppState.currentTab = 'my-profile';
      }
    }

    if (window.lucide) lucide.createIcons();
  },

  /**
   * Temporarily overrides the rendered UI role for admin preview purposes.
   * Only real admins can call this (the widget is hidden for non-admins).
   * @param {'admin'|'member'|'secretary'} role
   */
  switchViewRole(role) {
    const user = AppState.currentUser;
    if (!user) return;

    // Preserve the original real-admin flag on first call
    if (user._realIsAdmin === undefined) {
      user._realIsAdmin = !!(user.isAdmin === true || user.role === 'admin' || user.username === 'paul' || user.username === 'rodel' || user.username === 'christian' || user.id === 'PROD001' || user.id === 'GCOS001' || user.id === 'TK001');
    }

    // Apply the override
    if (role === 'admin') {
      user.isAdmin = true;
      user.role = 'admin';
    } else if (role === 'secretary') {
      // Secretary: member-level access, treated as non-admin for nav purposes
      user.isAdmin = false;
      user.role = 'secretary';
    } else {
      user.isAdmin = false;
      user.role = 'member';
    }

    this.updateRoleBasedUI();
    this.updateHeaderUserInfo();
    this.render();

    const labels = { admin: 'Admin', member: 'Member', secretary: 'Secretary' };
    if (typeof showToast === 'function') showToast(`Viewing as: ${labels[role] || role}`, 'info');
  },

  logout() {
    // 1. Immediate UI feedback (< 10ms)
    const btn = document.querySelector('button[onclick*="logout"]');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';
      btn.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> <span>Signing out...</span>';
    }

    // 2. Clear all authentication & session tokens synchronously
    sessionStorage.removeItem('mcgi_portal_access_token');
    sessionStorage.removeItem('mcgi_duty_session_active');
    sessionStorage.removeItem('mcgi_selected_duty');
    localStorage.removeItem('mcgi_current_user');
    localStorage.removeItem('mcgi_selected_duty');
    AppState.currentUser = null;

    // 3. Stop camera scanner in background if active (non-blocking)
    if (window.AttendanceLogger && typeof AttendanceLogger.stopActiveScanner === 'function') {
      try {
        AttendanceLogger.stopActiveScanner().catch(() => {});
      } catch (e) {}
    }

    // 4. Instant navigation to login.html
    window.location.replace('login.html');
  },

  updateHeaderUserInfo() {
    const user = AppState.currentUser;
    if (!user) return;

    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const avatarEl = document.getElementById('headerUserAvatar');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) {
      const roleBadge = user.isAdmin ? 'ADMIN' : 'MEMBER';
      const dutyScope = user.duty || getActiveDutyScope();
      roleEl.textContent = `${user.level} • ${user.locale || 'Naic'} [${roleBadge} | ${dutyScope}]`;
    }
    if (avatarEl) {
      const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      avatarEl.textContent = initials || 'MC';
    }

    const dutyEl = document.getElementById('headerDutyBadge');
    if (dutyEl) {
      const dutyScope = (user.duty || getActiveDutyScope()).toUpperCase();
      dutyEl.textContent = `DUTY: ${dutyScope}`;
      if (dutyScope === 'GCOS') {
        dutyEl.className = 'hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/40 shadow-sm';
      } else if (dutyScope === 'TK') {
        dutyEl.className = 'hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-400/40 shadow-sm';
      } else {
        dutyEl.className = 'hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-gold-400/15 text-gold-300 border border-gold-400/30 shadow-sm';
      }
    }
  },

  // =========================================================================
  // MOBILE NAVIGATION DRAWER
  // =========================================================================
  toggleMobileSidebar(isOpen) {
    const sidebar = document.getElementById('mainSidebar');
    const backdrop = document.getElementById('mobileBackdrop');

    if (isOpen) {
      if (sidebar) sidebar.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('mobile-open');
    } else {
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('mobile-open');
    }
  },

  // =========================================================================
  // RESPONSIVE DISPLAY & WINDOW RESIZE ADAPTATION (NATURAL OS SIZING)
  // =========================================================================
  initResponsiveListeners() {
    // Window resize event to adapt Chart.js canvas without forcing fullscreen
    window.addEventListener('resize', () => {
      if (window.ChartsModule && typeof ChartsModule.resizeCharts === 'function') {
        ChartsModule.resizeCharts();
      }
    });

    // Handle orientation changes on mobile and tablets
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (window.ChartsModule && typeof ChartsModule.resizeCharts === 'function') {
          ChartsModule.resizeCharts();
        }
      }, 150);
    });
  },

  bindEvents() {
    // Navigation tab switching
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab-target');
        this.switchTab(tab);
        // Auto close mobile drawer when link clicked on mobile
        this.toggleMobileSidebar(false);
      });
    });

    // Attendance sheet date picker change
    const datePicker = document.getElementById('attendanceDatePicker');
    if (datePicker) {
      datePicker.value = AppState.selectedDate;
      datePicker.addEventListener('change', (e) => {
        AppState.selectedDate = e.target.value;
        this.renderAttendanceTable();
        this.updateStatsCards();
      });
    }

    // Search inputs across modules
    const searchInputs = document.querySelectorAll('.app-search-input');
    searchInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value.toLowerCase().trim();
        if (AppState.currentTab === 'attendance') {
          this.renderAttendanceTable();
        } else if (AppState.currentTab === 'roster') {
          this.renderRoster();
        }
      });
    });

    // Department / Locale filters
    const deptFilters = document.querySelectorAll('.app-dept-filter');
    deptFilters.forEach(select => {
      select.addEventListener('change', (e) => {
        AppState.selectedDept = e.target.value;
        if (AppState.currentTab === 'attendance') {
          this.renderAttendanceTable();
        } else if (AppState.currentTab === 'roster') {
          this.renderRoster();
        }
      });
    });

    // Global keyboard Escape key to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePersonnelSummaryModal();
        this.closeMemberProfile();
        this.closeMemberModal();
        this.closeSubmitLeaveModal();
      }
    });
  },

  switchTab(tabName) {
    const user = AppState.currentUser;
    const isAdmin = !!(user && (user.isAdmin === true || user.role === 'admin' || user.username === 'paul'));
    const adminOnlyTabs = ['dashboard', 'event-entry', 'attendance-logger', 'attendance', 'roster', 'reports', 'settings'];

    // Route Guard: prevent members from accessing administrative tabs or attendance records
    if (!isAdmin && adminOnlyTabs.includes(tabName)) {
      showToast('Access restricted: Members can only view their own profile and scan QR for attendance.', 'warning');
      tabName = 'my-profile';
    }

    AppState.currentTab = tabName;
    
    // Update nav button active classes
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
      const isCurrent = btn.getAttribute('data-tab-target') === tabName;
      if (isCurrent) {
        btn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all bg-gold-400 text-midnight-950 glow-gold-sm shadow-md';
      } else {
        btn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-midnight-800/80 transition-all';
      }
    });

    // Toggle tab panels
    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) {
      targetPanel.classList.remove('hidden');
    }

    // Trigger tab-specific renders
    if (tabName === 'dashboard') {
      this.renderDashboard();
    } else if (tabName === 'event-entry') {
      this.renderEventEntryView();
      // Initialise the QR scanner card at the top of the Record Attendance panel
      if (window.AttendanceLogger && typeof AttendanceLogger.attachCameraScanner === 'function') {
        AttendanceLogger.attachCameraScanner('qrScannerMountPoint', (result) => {
          // Show result banner after a successful scan
          const banner = document.getElementById('qrScanResultBanner');
          const text = document.getElementById('qrScanResultText');
          if (banner && text) {
            text.textContent = result.message || 'Attendance recorded.';
            banner.className = 'p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ' +
              (result.success ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/20 border-rose-500/40 text-rose-300');
            setTimeout(() => banner.classList.add('hidden'), 6000);
          }
          // Also refresh the attendance sheet log if the user navigates there
          if (window.AttendanceLogger && typeof AttendanceLogger.renderAttendanceLogsTable === 'function') {
            AttendanceLogger.renderAttendanceLogsTable();
          }
        });
      }
    } else if (tabName === 'attendance-logger') {
      // Deprecated tab – redirect to unified Attendance Sheet
      this.switchTab('attendance');
      return;
    } else if (tabName === 'attendance') {
      this.renderAttendanceView();
      // Also render the merged event log table below the marking sheet
      if (window.AttendanceLogger && typeof AttendanceLogger.renderAttendanceLogsTable === 'function') {
        AttendanceLogger.renderAttendanceLogsTable();
      }
    } else if (tabName === 'roster') {
      this.renderRoster();
    } else if (tabName === 'reports') {
      this.renderReports();
    } else if (tabName === 'leaves') {
      this.renderLeaves();
    } else if (tabName === 'settings') {
      this.renderSettings();
    } else if (tabName === 'my-profile') {
      this.renderMyProfile();
    } else if (tabName === 'member-scan') {
      if (window.AttendanceLogger && typeof AttendanceLogger.attachCameraScanner === 'function') {
        AttendanceLogger.attachCameraScanner('memberCameraScanWrapper');
      }
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  },

  startLiveClock() {
    const clockEl = document.getElementById('liveClockDisplay');
    const dateEl = document.getElementById('liveDateDisplay');
    let lastRecordedDay = getPastDateString(0);
    
    const tick = () => {
      const now = new Date();
      const currentDay = getPastDateString(0);
      
      // Auto-detect calendar midnight rollover for continuous 24/7 terminals
      if (currentDay !== lastRecordedDay) {
        lastRecordedDay = currentDay;
        AppState.selectedDate = currentDay;
        const picker = document.getElementById('attendanceDatePicker');
        if (picker) picker.value = currentDay;
        this.updateStatsCards();
      }

      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
    };
    tick();
    setInterval(tick, 1000);
  },

  render() {
    this.updateStatsCards();
    this.populateDepartmentDropdowns();
    this.populateRosterQuickPick();
    this.switchTab(AppState.currentTab);
  },

  populateDepartmentDropdowns() {
    const locales = ['all', 'Naic', 'Calubcob', 'Acacia', ...new Set(AppState.members.map(m => m.department))].filter((v, i, a) => a.indexOf(v) === i);
    const selects = document.querySelectorAll('.app-dept-filter');
    selects.forEach(select => {
      const currentVal = select.value || 'all';
      select.innerHTML = locales.map(d => `
        <option value="${d}">${d === 'all' ? 'All Locales / Units' : d}</option>
      `).join('');
      select.value = currentVal;
    });
  },

  populateRosterQuickPick() {
    const select = document.getElementById('selectRosterQuickPick');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Choose Member --</option>' + 
      AppState.members.map(m => `
        <option value="${m.id}">${m.name} (${m.department} • ${m.role})</option>
      `).join('');
  },

  handleRosterQuickSelect(memberId) {
    if (!memberId) return;
    const member = AppState.members.find(m => m.id === memberId);
    if (!member) return;

    const nameInput = document.getElementById('inputEventFullName');
    if (nameInput) nameInput.value = member.name;

    // Check corresponding Locale
    document.querySelectorAll('input[name="eventLocale"]').forEach(cb => {
      cb.checked = (cb.value === member.department);
    });

    // Check corresponding Level
    document.querySelectorAll('input[name="eventLevel"]').forEach(cb => {
      cb.checked = (cb.value === member.role);
    });

    showToast(`Autofilled details for ${member.name}`, 'info');
  },

  // =========================================================================
  // NEW MODULE: EVENT ATTENDANCE ENTRY LOGIC & DYNAMIC CONDITIONAL FIELDS
  // =========================================================================
  initEventEntryForm() {
    const dateInput = document.getElementById('inputEventDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = AppState.selectedDate;
    }

    const eventSelect = document.getElementById('selectEventType');
    if (eventSelect) {
      this.handleEventDropdownChange(eventSelect.value || 'PM');
    }
  },

  handleEventDropdownChange(eventType) {
    const container = document.getElementById('dynamicEventFieldsContainer');
    if (!container) return;

    let html = '';

    switch (eventType) {
      case 'PM':
        html = `
          <div class="space-y-2">
            <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-gold-400"></i>
              PM Schedule / Viewing Slot <span class="text-gold-400">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              ${this.createCheckboxPill('eventSchedule', '3:30AM/WED - LIVE', true)}
              ${this.createCheckboxPill('eventSchedule', '2:30PM/WED - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '5:30PM/WED - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '7:00AM/THU - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '7:00PM/THU - VIEWING')}
            </div>
          </div>
        `;
        break;

      case 'WS':
        html = `
          <div class="space-y-2">
            <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-gold-400"></i>
              WS Schedule / Viewing Slot <span class="text-gold-400">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              ${this.createCheckboxPill('eventSchedule', '3:30AM/SAT - LIVE', true)}
              ${this.createCheckboxPill('eventSchedule', '11:30AM/SAT - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '1:30PM/SUN - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '5:30PM/SUN - VIEWING')}
            </div>
          </div>
        `;
        break;

      case 'PBB':
        html = `
          <div class="space-y-2">
            <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-gold-400"></i>
              PBB Schedule / Viewing Slot <span class="text-gold-400">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              ${this.createCheckboxPill('eventSchedule', '4:00PM/SAT - LIVE', true)}
              ${this.createCheckboxPill('eventSchedule', '5:30AM/SUN - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '5:30PM/SUN - VIEWING')}
            </div>
          </div>
        `;
        break;

      case 'COMBINED PM/WS':
        html = `
          <div class="space-y-2">
            <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-gold-400"></i>
              Combined PM/WS Schedule Slot <span class="text-gold-400">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              ${this.createCheckboxPill('eventSchedule', '3:30AM/WED - LIVE', true)}
              ${this.createCheckboxPill('eventSchedule', '2:30PM/WED - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '5:30PM/WED - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '7:00AM/THU - VIEWING')}
              ${this.createCheckboxPill('eventSchedule', '7:00PM/THU - VIEWING')}
            </div>
          </div>
        `;
        break;

      case 'SPBB':
        html = `
          <div class="space-y-2">
            <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i data-lucide="star" class="w-3.5 h-3.5 text-gold-400"></i>
              SPBB Day Schedule <span class="text-gold-400">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              ${this.createCheckboxPill('eventSchedule', 'DAY 1/FRI - 4:00PM', true)}
              ${this.createCheckboxPill('eventSchedule', 'DAY 2/SAT - 4:00PM')}
              ${this.createCheckboxPill('eventSchedule', 'DAY 3/SUN - 4:00PM')}
            </div>
          </div>
        `;
        break;

      case 'MASS INDOCTRINATION':
        let dayCheckboxes = '';
        for (let day = 1; day <= 14; day++) {
          dayCheckboxes += this.createCheckboxPill('eventSchedule', `DAY ${day}`, day === 1);
        }
        html = `
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="book-open" class="w-3.5 h-3.5 text-gold-400"></i>
                Mass Indoctrination Session Days <span class="text-gold-400">*</span>
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                ${dayCheckboxes}
              </div>
            </div>

            <!-- Number of Guests Input -->
            <div class="p-3.5 rounded-xl bg-midnight-950/80 border border-gold-400/30">
              <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <i data-lucide="user-plus" class="w-4 h-4 text-mcgiblue-400"></i>
                NUMBER OF GUESTS *
              </label>
              <div class="flex items-center gap-3">
                <input 
                  type="number" 
                  id="inputGuestsCount" 
                  min="0" 
                  value="0" 
                  required 
                  class="w-36 bg-midnight-900 border-2 border-gold-400/40 focus:border-gold-400 rounded-xl px-4 py-2.5 text-base font-bold text-white font-mono focus:outline-none">
                <span class="text-xs text-slate-400">Enter count of invited guests/listeners attended for this session.</span>
              </div>
            </div>
          </div>
        `;
        break;

      case 'SERBISYONG KAPATIRAN':
        html = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- EDITION Section -->
            <div>
              <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="tv" class="w-3.5 h-3.5 text-gold-400"></i>
                EDITION <span class="text-gold-400">*</span>
              </label>
              <div class="flex flex-col gap-2">
                ${this.createCheckboxPill('eventEdition', 'AFTERNOON EDITION - 12:50PM', true)}
                ${this.createCheckboxPill('eventEdition', 'EVENING EDITION - 9:30PM')}
              </div>
            </div>

            <!-- STATUS Section -->
            <div>
              <label class="block text-xs font-bold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="check-square" class="w-3.5 h-3.5 text-gold-400"></i>
                STATUS <span class="text-gold-400">*</span>
              </label>
              <div class="flex gap-3">
                ${this.createCheckboxPill('eventStatus', 'PRESENT', true)}
                ${this.createCheckboxPill('eventStatus', 'ABSENT')}
              </div>
            </div>
          </div>
        `;
        break;

      case 'CHRISTIAN NEW YEAR':
      case "LORD'S SUPPER":
      case "SENIOR'S DAY":
      case "SENIORS' DAY":
      case 'OPLAN DALAW TUPA (HARANA SA KAPATID)':
      case 'MASS ORIENTATION':
      case 'FEEDING PROGRAM':
        html = `
          <div class="space-y-4">
            <div class="flex items-center justify-between text-xs text-gold-300 font-bold mb-1">
              <span class="flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-gold-400"></i> ${eventType} Attendance Status</span>
              <span class="text-mcgiblue-300 text-[11px] font-normal">Select Duty / Attendance Option</span>
            </div>
            ${this.renderBaseStatusOptions('ON DUTY (OD)')}
          </div>
        `;
        break;

      case 'MEDICAL MISSION':
        html = `
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="heart-pulse" class="w-3.5 h-3.5 text-gold-400"></i>
                TYPE OF MEDICAL MISSION <span class="text-gold-400">*</span>
              </label>
              <input 
                type="text" 
                id="inputMedicalMissionType" 
                placeholder="What type of Medical Mission?" 
                required 
                class="w-full bg-midnight-950 border-2 border-mcgiblue-800 focus:border-gold-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400/20 shadow-inner">
            </div>

            <div class="pt-2 border-t border-mcgiblue-900/60">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="check-circle" class="w-3.5 h-3.5 text-mcgiblue-400"></i>
                Attendance / Duty Status <span class="text-gold-400">*</span>
              </label>
              ${this.renderBaseStatusOptions('ON DUTY (OD)')}
            </div>
          </div>
        `;
        break;

      case 'BIBLE STUDY':
        html = `
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i data-lucide="calendar" class="w-3.5 h-3.5 text-gold-400"></i>
                  DATE <span class="text-gold-400">*</span>
                </label>
                <input 
                  type="date" 
                  id="inputBibleStudyDate" 
                  value="${AppState.selectedDate || getPastDateString(0)}" 
                  required 
                  class="w-full bg-midnight-950 border-2 border-mcgiblue-800 focus:border-gold-400 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none cursor-pointer shadow-inner">
              </div>

              <div>
                <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-gold-400"></i>
                  TIME IN <span class="text-gold-400">*</span>
                </label>
                <input 
                  type="time" 
                  id="inputBibleStudyTimeIn" 
                  required 
                  class="w-full bg-midnight-950 border-2 border-mcgiblue-800 focus:border-gold-400 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none shadow-inner">
              </div>

              <div>
                <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i data-lucide="users" class="w-3.5 h-3.5 text-gold-400"></i>
                  NUMBER OF GUEST/S <span class="text-gold-400">*</span>
                </label>
                <input 
                  type="number" 
                  id="inputBibleStudyGuests" 
                  min="0" 
                  value="0" 
                  placeholder="0" 
                  required 
                  class="w-full bg-midnight-950 border-2 border-mcgiblue-800 focus:border-gold-400 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none shadow-inner">
              </div>
            </div>

            <div class="pt-2 border-t border-mcgiblue-900/60">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="check-circle" class="w-3.5 h-3.5 text-mcgiblue-400"></i>
                Attendance / Duty Status <span class="text-gold-400">*</span>
              </label>
              ${this.renderBaseStatusOptions('ON DUTY (OD)')}
            </div>
          </div>
        `;
        break;

      case 'GENERAL ASSEMBLY':
        html = `
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="users-round" class="w-3.5 h-3.5 text-gold-400"></i>
                TYPE OF GENERAL ASSEMBLY <span class="text-gold-400">*</span>
              </label>
              <input 
                type="text" 
                id="inputGeneralAssemblyType" 
                placeholder="What type of GA?" 
                required 
                class="w-full bg-midnight-950 border-2 border-mcgiblue-800 focus:border-gold-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400/20 shadow-inner">
            </div>

            <div class="pt-2 border-t border-mcgiblue-900/60">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="check-circle" class="w-3.5 h-3.5 text-mcgiblue-400"></i>
                Attendance / Duty Status <span class="text-gold-400">*</span>
              </label>
              ${this.renderBaseStatusOptions('ON DUTY (OD)')}
            </div>
          </div>
        `;
        break;

      case 'MEETING':
        html = `
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="message-square" class="w-3.5 h-3.5 text-gold-400"></i>
                TYPE OF MEETING? <span class="text-gold-400">*</span>
              </label>
              <input 
                type="text" 
                id="inputMeetingType" 
                placeholder="What type of meeting?" 
                required 
                class="w-full bg-midnight-950 border-2 border-mcgiblue-800 focus:border-gold-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400/20 shadow-inner">
            </div>

            <div class="pt-2 border-t border-mcgiblue-900/60">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="check-circle" class="w-3.5 h-3.5 text-mcgiblue-400"></i>
                Attendance / Duty Status <span class="text-gold-400">*</span>
              </label>
              ${this.renderBaseStatusOptions('ON DUTY (OD)')}
            </div>
          </div>
        `;
        break;

      case 'OTHER EVENT':
        html = `
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="edit-3" class="w-3.5 h-3.5 text-gold-400"></i>
                Specify the name of the event <span class="text-gold-400">*</span>
              </label>
              <input 
                type="text" 
                id="inputOtherEventName" 
                placeholder="Specify the name of the event" 
                required 
                class="w-full bg-midnight-950 border-2 border-mcgiblue-800 focus:border-gold-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-gold-400/20 shadow-inner">
            </div>

            <div class="pt-2 border-t border-mcgiblue-900/60">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="check-circle" class="w-3.5 h-3.5 text-mcgiblue-400"></i>
                Attendance / Duty Status <span class="text-gold-400">*</span>
              </label>
              ${this.renderBaseStatusOptions('ON DUTY (OD)')}
            </div>
          </div>
        `;
        break;

      default:
        html = `
          <div class="space-y-4">
            <div class="flex items-center justify-between text-xs text-gold-300 font-bold mb-1">
              <span>Event: ${eventType}</span>
              <span class="text-mcgiblue-300 text-[11px] font-normal">Standard Gathering Attendance</span>
            </div>
            ${this.renderBaseStatusOptions('ON DUTY (OD)')}
          </div>
        `;
        break;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();

    // Default time in value if input exists
    const timeInInput = document.getElementById('inputEventTimeIn');
    if (timeInInput && !timeInInput.value) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      timeInInput.value = `${hours}:${mins}`;
    }
    const bsTimeIn = document.getElementById('inputBibleStudyTimeIn');
    if (bsTimeIn && !bsTimeIn.value) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      bsTimeIn.value = `${hours}:${mins}`;
    }
  },

  renderBaseStatusOptions(selectedStatus = 'ON DUTY (OD)') {
    return `
      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5" id="eventStatusOptionGroup">
          ${this.createRadioPill('eventStatusOption', 'ON DUTY (OD)', selectedStatus === 'ON DUTY (OD)', 'App.handleEventStatusOptionChange(this.value)')}
          ${this.createRadioPill('eventStatusOption', 'DUTY ON OTHER COMMITTEE (DOC)', selectedStatus === 'DUTY ON OTHER COMMITTEE (DOC)', 'App.handleEventStatusOptionChange(this.value)')}
          ${this.createRadioPill('eventStatusOption', 'NOT ON DUTY (NOD)', selectedStatus === 'NOT ON DUTY (NOD)', 'App.handleEventStatusOptionChange(this.value)')}
          ${this.createRadioPill('eventStatusOption', 'ABSENT', selectedStatus === 'ABSENT', 'App.handleEventStatusOptionChange(this.value)')}
        </div>
        <div id="statusConditionalFieldsContainer" class="p-3.5 rounded-xl bg-midnight-950/80 border border-gold-400/30 transition-all">
          ${this.renderStatusSubfield(selectedStatus)}
        </div>
      </div>
    `;
  },

  renderStatusSubfield(status) {
    if (status === 'ON DUTY (OD)') {
      const now = new Date();
      const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      return `
        <div class="space-y-1.5">
          <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="clock" class="w-3.5 h-3.5 text-gold-400"></i>
            TIME IN <span class="text-gold-400">*</span>
          </label>
          <div class="flex items-center gap-3">
            <input 
              type="time" 
              id="inputEventTimeIn" 
              value="${defaultTime}"
              required 
              class="w-full sm:w-48 bg-midnight-900 border-2 border-gold-400/50 focus:border-gold-400 rounded-xl px-4 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-gold-400/20 shadow-inner cursor-pointer">
            <span class="text-[11px] text-slate-400 hidden sm:inline">Set recorded time-in for On Duty member</span>
          </div>
        </div>
      `;
    } else if (status === 'DUTY ON OTHER COMMITTEE (DOC)') {
      return `
        <div class="space-y-1.5">
          <label class="block text-xs font-extrabold text-gold-300 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="briefcase" class="w-3.5 h-3.5 text-gold-400"></i>
            Committee <span class="text-gold-400">*</span>
          </label>
          <input 
            type="text" 
            id="inputEventCommittee" 
            placeholder="Specify Committee (e.g. Secretariat, Ushering, Music Ministry, Kitchen, Security...)" 
            required 
            class="w-full bg-midnight-900 border-2 border-gold-400/50 focus:border-gold-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-gold-400/20 shadow-inner">
        </div>
      `;
    } else if (status === 'NOT ON DUTY (NOD)') {
      return `
        <div class="space-y-1.5">
          <label class="block text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-400"></i>
            Reason <span class="text-amber-400">*</span>
          </label>
          <input 
            type="text" 
            id="inputEventReason" 
            placeholder="Specify reason for Not On Duty (e.g. Work conflict, Family matter, Sickness)..." 
            required 
            class="w-full bg-midnight-900 border-2 border-amber-500/50 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/20 shadow-inner">
        </div>
      `;
    } else if (status === 'ABSENT') {
      return `
        <div class="space-y-1.5">
          <label class="block text-xs font-extrabold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-400"></i>
            Reason <span class="text-rose-400">*</span>
          </label>
          <input 
            type="text" 
            id="inputEventReason" 
            placeholder="Specify reason for absence..." 
            required 
            class="w-full bg-midnight-900 border-2 border-rose-500/50 focus:border-rose-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-rose-400/20 shadow-inner">
        </div>
      `;
    }
    return '';
  },

  handleEventStatusOptionChange(status) {
    const container = document.getElementById('statusConditionalFieldsContainer');
    if (container) {
      container.innerHTML = this.renderStatusSubfield(status);
      if (window.lucide) lucide.createIcons();
    }
  },

  createCheckboxPill(name, value, isChecked = false) {
    return `
      <label class="custom-pill-checkbox">
        <input type="checkbox" name="${name}" value="${value}" ${isChecked ? 'checked' : ''}>
        <span class="custom-pill-box">
          <span class="custom-pill-indicator">
            <i data-lucide="check" class="w-3 h-3 text-midnight-950 stroke-[3]"></i>
          </span>
          <span class="truncate">${value}</span>
        </span>
      </label>
    `;
  },

  createRadioPill(name, value, isChecked = false, onchangeAttr = '') {
    const onchangeStr = onchangeAttr ? `onchange="${onchangeAttr}"` : '';
    return `
      <label class="custom-pill-checkbox">
        <input type="radio" name="${name}" value="${value}" ${isChecked ? 'checked' : ''} ${onchangeStr}>
        <span class="custom-pill-box">
          <span class="custom-pill-indicator">
            <i data-lucide="check" class="w-3 h-3 text-midnight-950 stroke-[3]"></i>
          </span>
          <span class="truncate text-xs font-bold">${value}</span>
        </span>
      </label>
    `;
  },

  handleEventAttendanceSubmit(e) {
    e.preventDefault();

    const fullName = document.getElementById('inputEventFullName').value.trim();
    if (!fullName) {
      showToast('Please enter full name', 'warning');
      return;
    }

    // Selected Locales
    const localeCheckboxes = document.querySelectorAll('input[name="eventLocale"]:checked');
    const locales = Array.from(localeCheckboxes).map(cb => cb.value);
    if (locales.length === 0) {
      showToast('Please select at least one Locale (Naic, Calubcob, Acacia)', 'warning');
      return;
    }

    // Selected Levels
    const levelCheckboxes = document.querySelectorAll('input[name="eventLevel"]:checked');
    const levels = Array.from(levelCheckboxes).map(cb => cb.value);
    if (levels.length === 0) {
      showToast('Please select at least one Level (MUNICIPAL PROD, LOCALE PROD, TRAINEE)', 'warning');
      return;
    }

    const eventDate = document.getElementById('inputEventDate').value || AppState.selectedDate;
    const eventType = document.getElementById('selectEventType').value;

    // Status option (OD, DOC, NOD, ABSENT) if present
    const statusRadio = document.querySelector('input[name="eventStatusOption"]:checked');
    const statusOption = statusRadio ? statusRadio.value : '';

    let timeIn = '';
    let committee = '';
    let reason = '';
    let eventDetail = '';
    let bibleStudyDate = '';
    let bibleStudyTimeIn = '';
    let guestsCount = 0;

    // Validate event-specific inputs
    if (eventType === 'GENERAL ASSEMBLY') {
      const gaInput = document.getElementById('inputGeneralAssemblyType');
      eventDetail = gaInput ? gaInput.value.trim() : '';
      if (!eventDetail) {
        showToast('Please enter the Type of General Assembly', 'warning');
        gaInput?.focus();
        return;
      }
    } else if (eventType === 'MEDICAL MISSION') {
      const mmInput = document.getElementById('inputMedicalMissionType');
      eventDetail = mmInput ? mmInput.value.trim() : '';
      if (!eventDetail) {
        showToast('Please enter the Type of Medical Mission', 'warning');
        mmInput?.focus();
        return;
      }
    } else if (eventType === 'MEETING') {
      const meetingInput = document.getElementById('inputMeetingType');
      eventDetail = meetingInput ? meetingInput.value.trim() : '';
      if (!eventDetail) {
        showToast('Please enter the Type of Meeting', 'warning');
        meetingInput?.focus();
        return;
      }
    } else if (eventType === 'OTHER EVENT') {
      const otherInput = document.getElementById('inputOtherEventName');
      eventDetail = otherInput ? otherInput.value.trim() : '';
      if (!eventDetail) {
        showToast('Please specify the name of the event', 'warning');
        otherInput?.focus();
        return;
      }
    } else if (eventType === 'BIBLE STUDY') {
      const bsDateInput = document.getElementById('inputBibleStudyDate');
      const bsTimeInput = document.getElementById('inputBibleStudyTimeIn');
      const bsGuestsInput = document.getElementById('inputBibleStudyGuests');

      bibleStudyDate = bsDateInput ? bsDateInput.value : eventDate;
      bibleStudyTimeIn = bsTimeInput ? bsTimeInput.value : '';
      guestsCount = bsGuestsInput ? parseInt(bsGuestsInput.value) || 0 : 0;

      if (!bibleStudyTimeIn) {
        showToast('Please enter TIME IN for Bible Study', 'warning');
        bsTimeInput?.focus();
        return;
      }
    } else if (eventType === 'MASS INDOCTRINATION') {
      const guestsInput = document.getElementById('inputGuestsCount');
      guestsCount = guestsInput ? parseInt(guestsInput.value) || 0 : 0;
    }

    // Validate status subfields for events using the Base Status Options
    if (statusOption) {
      if (statusOption === 'ON DUTY (OD)') {
        const timeInInput = document.getElementById('inputEventTimeIn');
        timeIn = timeInInput ? timeInInput.value.trim() : '';
        if (!timeIn) {
          const now = new Date();
          timeIn = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
      } else if (statusOption === 'DUTY ON OTHER COMMITTEE (DOC)') {
        const commInput = document.getElementById('inputEventCommittee');
        committee = commInput ? commInput.value.trim() : '';
        if (!committee) {
          showToast('Please specify the Committee name', 'warning');
          commInput?.focus();
          return;
        }
      } else if (statusOption === 'NOT ON DUTY (NOD)') {
        const reasonInput = document.getElementById('inputEventReason');
        reason = reasonInput ? reasonInput.value.trim() : '';
        if (!reason) {
          showToast('Please specify the Reason for Not On Duty', 'warning');
          reasonInput?.focus();
          return;
        }
      } else if (statusOption === 'ABSENT') {
        const reasonInput = document.getElementById('inputEventReason');
        reason = reasonInput ? reasonInput.value.trim() : '';
        if (!reason) {
          showToast('Please specify the Reason for Absence', 'warning');
          reasonInput?.focus();
          return;
        }
      }
    }

    // Selected Schedules
    const scheduleCheckboxes = document.querySelectorAll('input[name="eventSchedule"]:checked');
    const schedules = Array.from(scheduleCheckboxes).map(cb => cb.value);

    // Edition
    const editionCheckboxes = document.querySelectorAll('input[name="eventEdition"]:checked');
    const edition = Array.from(editionCheckboxes).map(cb => cb.value);

    // Fallback status if statusOption not used
    let status = statusOption;
    if (!status) {
      const statusCheckboxes = document.querySelectorAll('input[name="eventStatus"]:checked');
      const statusValues = Array.from(statusCheckboxes).map(cb => cb.value);
      status = statusValues.length > 0 ? statusValues.join(', ') : 'PRESENT';
    }

    const remarks = document.getElementById('inputEventRemarks').value.trim();

    // Create entry object
    const newEntry = {
      id: 'EVT-' + Date.now().toString().slice(-6),
      fullName,
      duty: getActiveDutyScope(),
      locale: locales,
      level: levels,
      eventDate,
      event: eventType,
      status: status || 'PRESENT',
      timeIn,
      committee,
      reason,
      eventDetail,
      schedules,
      guestsCount,
      edition,
      bibleStudyDate,
      bibleStudyTimeIn,
      otherEventName: eventDetail,
      remarks,
      createdAt: new Date().toISOString()
    };

    AppState.eventEntries.unshift(newEntry);
    AppState.save();

    // Persist to Supabase Cloud Database (with offline queue fallback)
    if (window.SupabaseClient) {
      // Pre-generate the UUID that Supabase will use so we can deduplicate the
      // Realtime INSERT event that fires back for OUR OWN INSERT (not just others).
      // supabase_client.js uses the same generateUUID() path when entry.id is not a UUID,
      // so we match by generating one now and passing it as cloudId.
      const preAssignedCloudId = crypto.randomUUID ? crypto.randomUUID() : ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }));
      newEntry.cloudId = preAssignedCloudId;

      SupabaseClient.recordAttendance({
        id: preAssignedCloudId,      // pass as UUID so Supabase uses exactly this id
        cloudId: preAssignedCloudId,
        memberId: newEntry.id,
        fullName: newEntry.fullName,
        duty: newEntry.duty,
        eventType: newEntry.event,
        status: newEntry.status,
        timestamp: newEntry.createdAt,
        locale: Array.isArray(newEntry.locale) ? newEntry.locale[0] : (newEntry.locale || 'Naic'),
        notes: newEntry.remarks || newEntry.eventDetail || ''
      }).then(res => {
        if (res && res.data && res.data.id) {
          newEntry.cloudId = res.data.id;
          AppState.save();
        }
      }).catch(err => console.warn('[App] Supabase attendance record deferred:', err));
    }



    showToast(`Recorded attendance for ${fullName} (${eventType})!`, 'success');

    this.resetEventEntryForm(false);
    if (window.AttendanceLogger && typeof AttendanceLogger.renderAttendanceLogsTable === 'function') {
      AttendanceLogger.renderAttendanceLogsTable();
    }
  },

  resetEventEntryForm(clearAll = true) {
    const nameInput = document.getElementById('inputEventFullName');
    if (nameInput) nameInput.value = '';
    const remarksInput = document.getElementById('inputEventRemarks');
    if (remarksInput) remarksInput.value = '';
    const quickPick = document.getElementById('selectRosterQuickPick');
    if (quickPick) quickPick.value = '';

    if (clearAll) {
      const defaultRadio = document.querySelector('input[name="eventStatusOption"][value="ON DUTY (OD)"]');
      if (defaultRadio) {
        defaultRadio.checked = true;
        this.handleEventStatusOptionChange('ON DUTY (OD)');
      }
    }
  },

  renderEventEntryView() {
    this.initEventEntryForm();
  },

  /**
   * QR-Code Attendance Logging Function
   * Inside Attendance Entry (or attendance_logger), recordAttendanceFromQR(memberQr: string): Promise<void>
   */
  async recordAttendanceFromQR(memberQr) {
    if (window.AttendanceLogger && typeof AttendanceLogger.recordAttendanceFromQR === 'function') {
      return AttendanceLogger.recordAttendanceFromQR(memberQr);
    }
    return Promise.reject(new Error('AttendanceLogger module is unavailable.'));
  },

  deleteEventEntry(id) {
    if (window.AttendanceLogger && typeof AttendanceLogger.deleteLogEntry === 'function') {
      AttendanceLogger.deleteLogEntry(id);
    }
  },

  exportEventEntriesCSV() {
    if (window.AttendanceLogger && typeof AttendanceLogger.exportLogsCSV === 'function') {
      AttendanceLogger.exportLogsCSV();
    }
  },

  // =========================================================================
  // MY PROFILE & CREDENTIAL MANAGEMENT (FOR ADMIN & MEMBER)
  // =========================================================================
  renderMyProfile() {
    const user = AppState.currentUser;
    if (!user) return;

    const isAdmin = !!(user.isAdmin === true || user.role === 'admin' || user.username === 'paul');
    const roleBadge = document.getElementById('profileRoleBadge');
    if (roleBadge) {
      roleBadge.textContent = isAdmin ? 'ROLE: ADMINISTRATOR' : 'ROLE: PRODUCTION MEMBER';
      roleBadge.className = isAdmin 
        ? 'px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-gold-300 font-mono text-xs font-bold'
        : 'px-3.5 py-1.5 rounded-full bg-mcgiblue-500/20 border border-mcgiblue-400/50 text-mcgiblue-300 font-mono text-xs font-bold';
    }

    const nameInput = document.getElementById('profFullName');
    const emailInput = document.getElementById('profEmail');
    const localeInput = document.getElementById('profLocale');
    const levelInput = document.getElementById('profLevel');
    const usernameInput = document.getElementById('profUsername');
    const passInput = document.getElementById('profNewPassword');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (localeInput) localeInput.value = user.locale || user.department || 'Naic';
    if (levelInput) levelInput.value = user.level || user.role || 'LOCALE PROD';
    if (usernameInput) usernameInput.value = user.username || (user.name ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'member');
    if (passInput) passInput.value = '';

    // Render personal stored QR code
    const qrContainer = document.getElementById('myProfileQrContainer');
    const qrDisplay = document.getElementById('profileQrCodeDisplay');
    if (qrContainer) {
      qrContainer.innerHTML = '';

      let qrPayload = user.qrCode;
      if (!qrPayload && window.AttendanceLogger) {
        qrPayload = AttendanceLogger.generateMemberQr({
          id: user.id,
          rollNo: user.rollNo || `PROD-${(user.locale || 'NAIC').slice(0, 3).toUpperCase()}-01`,
          email: user.email
        });
        user.qrCode = qrPayload;
        AppState.save();
      }

      if (qrPayload && window.QRCode) {
        new QRCode(qrContainer, {
          text: qrPayload,
          width: 170,
          height: 170,
          colorDark: '#0a0a0f',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    }

    if (qrDisplay) {
      qrDisplay.textContent = `${user.rollNo || user.id || 'PROD-ID'} (${user.locale || 'Naic'})`;
    }
  },

  saveProfileCredentials(e) {
    e.preventDefault();
    const user = AppState.currentUser;
    if (!user) return;

    const newName = document.getElementById('profFullName')?.value.trim();
    const newEmail = document.getElementById('profEmail')?.value.trim();
    const newUsername = document.getElementById('profUsername')?.value.trim();
    const newPass = document.getElementById('profNewPassword')?.value.trim();

    if (!newName || !newEmail || !newUsername) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }

    user.name = newName;
    user.email = newEmail;
    user.username = newUsername;
    if (newPass) {
      user.password = newPass;
    }

    // Refresh QR code to match updated details
    if (window.AttendanceLogger) {
      user.qrCode = AttendanceLogger.generateMemberQr({
        id: user.id,
        rollNo: user.rollNo || `PROD-${(user.locale || 'NAIC').slice(0, 3).toUpperCase()}-01`,
        email: user.email
      });
    }

    // Update in authUsers
    const authIdx = (AppState.authUsers || []).findIndex(u => u.id === user.id || u.username === user.username);
    if (authIdx !== -1) {
      AppState.authUsers[authIdx] = { ...AppState.authUsers[authIdx], ...user };
    }

    // Update in members roster
    const memberIdx = (AppState.members || []).findIndex(m => m.id === user.id || m.email === user.email);
    if (memberIdx !== -1) {
      AppState.members[memberIdx].name = newName;
      AppState.members[memberIdx].email = newEmail;
      AppState.members[memberIdx].qrCode = user.qrCode;
    }

    AppState.save();
    this.updateHeaderUserInfo();
    this.renderMyProfile();

    showToast('Profile credentials and personal QR updated successfully!', 'success');
  },

  // =========================================================================
  // STANDARD ATTENDANCE SHEET & STATS
  // =========================================================================
  calculateStats(dateStr = AppState.selectedDate) {
    const dayRecords = AppState.attendance[dateStr] || {};
    const activeDuty = getActiveDutyScope();
    let present = 0, late = 0, absent = 0, excused = 0, total = AppState.members.length;

    AppState.members.forEach(m => {
      const record = dayRecords[m.id];
      if (record && (!record.duty || record.duty.toUpperCase() === activeDuty.toUpperCase())) {
        if (record.status === 'present') present++;
        else if (record.status === 'late') late++;
        else if (record.status === 'absent') absent++;
        else if (record.status === 'excused') excused++;
      } else {
        absent++;
      }
    });

    const attendedCount = present + late;
    const rate = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    return { total, present, late, absent, excused, rate };
  },

  updateStatsCards() {
    const stats = this.calculateStats(AppState.selectedDate);
    
    const setElem = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElem('kpiTotalMembers', stats.total);
    setElem('kpiPresentCount', stats.present);
    setElem('kpiLateCount', stats.late);
    setElem('kpiAbsentCount', stats.absent);
    setElem('kpiExcusedCount', stats.excused);
    setElem('kpiAttendanceRate', `${stats.rate}%`);

    const rateProgress = document.getElementById('kpiAttendanceProgressBar');
    if (rateProgress) {
      rateProgress.style.width = `${stats.rate}%`;
      if (stats.rate >= 80) {
        rateProgress.className = 'h-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all duration-500';
      } else if (stats.rate >= 60) {
        rateProgress.className = 'h-full bg-yellow-500 transition-all duration-500';
      } else {
        rateProgress.className = 'h-full bg-red-500 transition-all duration-500';
      }
    }
  },

  renderDashboard() {
    this.updateStatsCards();
    if (window.ChartsModule) {
      window.ChartsModule.renderAll();
    }
    this.renderDashboardRecentActivity();
  },

  renderDashboardRecentActivity() {
    const listEl = document.getElementById('dashboardRecentCheckins');
    if (!listEl) return;

    const dayRecords = AppState.attendance[AppState.selectedDate] || {};
    const marked = [];

    AppState.members.forEach(m => {
      if (dayRecords[m.id] && dayRecords[m.id].status !== 'absent') {
        marked.push({
          member: m,
          record: dayRecords[m.id]
        });
      }
    });

    if (marked.length === 0) {
      listEl.innerHTML = `
        <div class="py-8 text-center text-slate-400">
          <i data-lucide="clock" class="w-8 h-8 mx-auto mb-2 text-slate-500"></i>
          <p class="text-sm">No check-in entries logged yet for ${AppState.selectedDate}</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = marked.slice(-6).reverse().map(item => `
      <div class="flex items-center justify-between p-3 rounded-lg bg-midnight-900 border border-mcgiblue-900/60 hover:border-gold-400/40 transition-all">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-midnight-950 text-xs shadow-sm" style="background-color: ${item.member.avatarColor};">
            ${item.member.name.split(' ').map(n=>n[0]).join('')}
          </div>
          <div>
            <h4 class="text-sm font-semibold text-slate-200">${item.member.name}</h4>
            <span class="text-xs text-slate-400">${item.member.department} • <span class="text-gold-400/90 font-mono">${item.member.role}</span></span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-gold-300 font-medium">${item.record.time}</span>
          ${this.getStatusBadgeHtml(item.record.status)}
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  getStatusBadgeHtml(status) {
    if (status === 'present') return '<span class="badge-present px-2.5 py-1 rounded-full text-xs font-bold">Present</span>';
    if (status === 'late') return '<span class="badge-late px-2.5 py-1 rounded-full text-xs font-bold">Late</span>';
    if (status === 'absent') return '<span class="badge-absent px-2.5 py-1 rounded-full text-xs font-bold">Absent</span>';
    if (status === 'excused') return '<span class="badge-excused px-2.5 py-1 rounded-full text-xs font-bold">Excused</span>';
    return '<span class="px-2.5 py-1 rounded-full text-xs font-medium text-slate-400">-</span>';
  },

  renderAttendanceView() {
    const datePicker = document.getElementById('attendanceDatePicker');
    if (datePicker) {
      datePicker.value = AppState.selectedDate;
    }
    this.renderAttendanceTable();
  },

  renderAttendanceTable() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    const dateStr = AppState.selectedDate;
    if (!AppState.attendance[dateStr]) {
      AppState.attendance[dateStr] = {};
    }

    let filtered = AppState.members.filter(m => {
      const matchDept = AppState.selectedDept === 'all' || m.department === AppState.selectedDept;
      const q = normalizeSearchText(AppState.searchQuery);
      const matchSearch = !q || 
        normalizeSearchText(m.name).includes(q) || 
        normalizeSearchText(m.rollNo).includes(q) ||
        normalizeSearchText(m.email).includes(q);
      return matchDept && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-400">
            <i data-lucide="users" class="w-10 h-10 mx-auto mb-2 text-slate-600"></i>
            <p class="text-base font-medium text-slate-300">No personnel match the current filter</p>
            <p class="text-xs text-slate-500 mt-1">Try clearing your search query or locale filter</p>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = filtered.map((m, index) => {
      const record = AppState.attendance[dateStr][m.id] || { status: 'absent', time: '-', remarks: '' };
      const status = record.status;

      return `
        <tr class="border-b border-slate-800/60 hover:bg-midnight-900/40 transition-colors">
          <td class="px-4 py-3 text-xs text-slate-500 font-mono">${index + 1}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-midnight-950 text-xs shadow-sm" style="background-color: ${m.avatarColor};">
                ${m.name.split(' ').map(n=>n[0]).join('')}
              </div>
              <div>
                <a href="#" onclick="App.openMemberProfile('${m.id}'); return false;" class="text-sm font-semibold text-slate-200 hover:text-gold-400 transition-colors">
                  ${m.name}
                </a>
                <div class="text-xs text-slate-400 font-mono">${m.rollNo}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <span class="text-xs px-2.5 py-1 rounded-md bg-midnight-900 text-slate-300 border border-mcgiblue-900/60">
              ${m.department} (${m.role})
            </span>
          </td>
          <td class="px-4 py-3 text-xs font-mono text-slate-400">
            ${record.time}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1.5">
              <button onclick="App.setStatus('${m.id}', 'present')" class="btn-status-present px-2.5 py-1 rounded text-xs font-bold transition-all ${status === 'present' ? 'active' : 'bg-midnight-900 text-slate-400 hover:text-emerald-300 border border-slate-700'}">P</button>
              <button onclick="App.setStatus('${m.id}', 'late')" class="btn-status-late px-2.5 py-1 rounded text-xs font-bold transition-all ${status === 'late' ? 'active' : 'bg-midnight-900 text-slate-400 hover:text-gold-300 border border-slate-700'}">L</button>
              <button onclick="App.setStatus('${m.id}', 'absent')" class="btn-status-absent px-2.5 py-1 rounded text-xs font-bold transition-all ${status === 'absent' ? 'active' : 'bg-midnight-900 text-slate-400 hover:text-rose-300 border border-slate-700'}">A</button>
              <button onclick="App.setStatus('${m.id}', 'excused')" class="btn-status-excused px-2.5 py-1 rounded text-xs font-bold transition-all ${status === 'excused' ? 'active' : 'bg-midnight-900 text-slate-400 hover:text-mcgiblue-300 border border-slate-700'}">E</button>
            </div>
          </td>
          <td class="px-4 py-3">
            <input 
              type="text" 
              placeholder="Add remark..." 
              value="${record.remarks || ''}" 
              onchange="App.setRemarks('${m.id}', this.value)"
              class="w-full bg-midnight-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-gold-400 focus:outline-none">
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  setStatus(memberId, status) {
    const dateStr = AppState.selectedDate;
    if (!AppState.attendance[dateStr]) {
      AppState.attendance[dateStr] = {};
    }

    const currentRecord = AppState.attendance[dateStr][memberId] || { remarks: '' };
    const now = new Date();
    const timeStr = (status === 'present' || status === 'late') ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
    const activeDuty = getActiveDutyScope();

    AppState.attendance[dateStr][memberId] = {
      status,
      time: timeStr,
      remarks: currentRecord.remarks || '',
      duty: activeDuty
    };

    AppState.save();
    this.renderAttendanceTable();
    this.updateStatsCards();
  },

  setRemarks(memberId, remarks) {
    const dateStr = AppState.selectedDate;
    const activeDuty = getActiveDutyScope();
    if (!AppState.attendance[dateStr]) AppState.attendance[dateStr] = {};
    if (!AppState.attendance[dateStr][memberId]) {
      AppState.attendance[dateStr][memberId] = { status: 'absent', time: '-', remarks: '', duty: activeDuty };
    }
    AppState.attendance[dateStr][memberId].remarks = remarks;
    AppState.attendance[dateStr][memberId].duty = activeDuty;
    AppState.save();
  },

  markAllStatus(status) {
    const dateStr = AppState.selectedDate;
    if (!AppState.attendance[dateStr]) AppState.attendance[dateStr] = {};

    const now = new Date();
    const timeStr = (status === 'present') ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
    const activeDuty = getActiveDutyScope();

    AppState.members.forEach(m => {
      AppState.attendance[dateStr][m.id] = {
        status,
        time: timeStr,
        remarks: `Bulk mark ${status}`,
        duty: activeDuty
      };
    });

    AppState.save();
    showToast(`Marked all personnel as ${status.toUpperCase()}`, 'success');
    this.renderAttendanceTable();
    this.updateStatsCards();
  },

  // =========================================================================
  // ROSTER / MEMBERS DIRECTORY
  // =========================================================================
  renderRoster() {
    const grid = document.getElementById('rosterCardsGrid');
    const countDisplay = document.getElementById('rosterCountDisplay');
    if (!grid) return;

    // Show or hide Admin Member Credentials Directory button
    const isAdm = !!(
      AppState.currentUser?.isAdmin || 
      AppState.currentUser?.role === 'admin' || 
      (AppState.currentUser?.username && AppState.currentUser.username.toLowerCase() === 'paul') ||
      AppState.currentUser?.isGlobalAdmin
    );
    const dirBtn = document.getElementById('btnAdminCredentialsDirectory');
    if (dirBtn) {
      if (isAdm) dirBtn.classList.remove('hidden');
      else dirBtn.classList.add('hidden');
    }

    let filtered = AppState.members.filter(m => {
      const matchDept = AppState.selectedDept === 'all' || m.department === AppState.selectedDept;
      const q = normalizeSearchText(AppState.searchQuery);
      const matchSearch = !q || 
        normalizeSearchText(m.name).includes(q) || 
        normalizeSearchText(m.rollNo).includes(q) ||
        normalizeSearchText(m.email).includes(q);
      return matchDept && matchSearch;
    });

    if (countDisplay) {
      countDisplay.textContent = `Showing ${filtered.length} of ${AppState.members.length} registered personnel`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400">
          <i data-lucide="user-x" class="w-12 h-12 mx-auto mb-2 text-slate-600"></i>
          <p class="text-base font-medium">No personnel found</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    grid.innerHTML = filtered.map(m => {
      let totalPresents = 0, totalPossible = 0;
      Object.keys(AppState.attendance).forEach(d => {
        totalPossible++;
        const rec = AppState.attendance[d][m.id];
        if (rec && (rec.status === 'present' || rec.status === 'late')) totalPresents++;
      });
      const rate = totalPossible > 0 ? Math.round((totalPresents / totalPossible) * 100) : 0;

      return `
        <div onclick="App.openMemberProfile('${m.id}')" class="glass-card p-5 glass-card-hover cursor-pointer border border-mcgiblue-900/50 relative group">
          <div class="flex items-start justify-between mb-3">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-midnight-950 text-base shadow-md" style="background-color: ${m.avatarColor};">
              ${m.name.split(' ').map(n=>n[0]).join('')}
            </div>
            <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-midnight-900 text-gold-300 border border-gold-400/30">
              ${rate}%
            </span>
          </div>
          <h3 class="font-bold text-white text-base group-hover:text-gold-400 transition-colors">${m.name}</h3>
          <p class="text-xs text-slate-400 font-mono mt-0.5">${m.rollNo}</p>
          <div class="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-800">
            <span class="text-slate-400">${m.department}</span>
            <span class="text-gold-400 font-medium">${m.role}</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  openAddMemberModal() {
    AppState.editingMemberId = null;
    document.getElementById('memberModalTitle').innerHTML = '<i data-lucide="user-plus" class="w-5 h-5 text-gold-400"></i> Add New Production Member';
    document.getElementById('inputMemberName').value = '';
    document.getElementById('inputMemberRoll').value = `PROD-${Date.now().toString().slice(-4)}`;
    document.getElementById('inputMemberEmail').value = '';
    document.getElementById('memberModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closeMemberModal() {
    document.getElementById('memberModal').classList.add('hidden');
  },

  saveMemberForm(e) {
    e.preventDefault();
    const name = document.getElementById('inputMemberName').value.trim();
    const rollNo = document.getElementById('inputMemberRoll').value.trim();
    const role = document.getElementById('inputMemberRole').value;
    const department = document.getElementById('inputMemberDept').value;
    const email = document.getElementById('inputMemberEmail').value.trim();

    if (AppState.editingMemberId) {
      const idx = AppState.members.findIndex(m => m.id === AppState.editingMemberId);
      if (idx !== -1) {
        const existing = AppState.members[idx];
        const updatedQr = window.AttendanceLogger ? AttendanceLogger.generateMemberQr({
          id: existing.id,
          rollNo: rollNo || existing.rollNo,
          email: email || existing.email
        }) : (existing.qrCode || '');

        AppState.members[idx] = { 
          ...AppState.members[idx], 
          name, 
          rollNo, 
          role, 
          department, 
          email,
          qrCode: updatedQr
        };
      }
      showToast('Updated member information', 'success');
    } else {
      const newId = `PROD${Date.now().toString().slice(-4)}`;
      const memberQr = window.AttendanceLogger ? AttendanceLogger.generateMemberQr({
        id: newId,
        rollNo,
        email
      }) : '';

      const newMember = {
        id: newId,
        name,
        rollNo,
        role,
        department,
        email,
        qrCode: memberQr,
        avatarColor: ['#fbbf24', '#38bdf8', '#a855f7', '#34d399', '#f43f5e', '#fb923c'][Math.floor(Math.random() * 6)]
      };
      AppState.members.push(newMember);

      // Synchronize with auth users so the new member can log in immediately
      const usernameCandidate = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      AppState.authUsers.push({
        id: newMember.id,
        name: newMember.name,
        username: usernameCandidate || newMember.id.toLowerCase(),
        email: newMember.email || `${usernameCandidate}@mcgiprod.org`,
        password: '123!',
        locale: newMember.department,
        level: newMember.role,
        role: 'member',
        isAdmin: false,
        qrCode: memberQr
      });

      showToast('Added new production personnel & login account', 'success');
    }

    AppState.save();

    // Persist to Supabase Cloud Database
    if (window.SupabaseClient) {
      const activeDuty = getActiveDutyScope();
      const memObj = AppState.editingMemberId 
        ? AppState.members.find(m => m.id === AppState.editingMemberId)
        : AppState.members[AppState.members.length - 1];
      if (memObj) {
        SupabaseClient.saveMember(memObj, activeDuty).catch(err => 
          console.warn('[App] Supabase saveMember deferred:', err)
        );
      }
    }

    this.closeMemberModal();
    this.populateRosterQuickPick();
    this.render();
  },

  openMemberProfile(memberId) {
    const member = AppState.members.find(m => m.id === memberId);
    if (!member) return;

    AppState.viewingMemberId = memberId;
    document.getElementById('profileModalAvatar').style.backgroundColor = member.avatarColor;
    document.getElementById('profileModalAvatar').textContent = member.name.split(' ').map(n=>n[0]).join('');
    document.getElementById('profileModalName').textContent = member.name;
    document.getElementById('profileModalRoll').textContent = member.rollNo;
    document.getElementById('profileModalDept').textContent = `${member.department} • ${member.role}`;
    document.getElementById('profileModalEmail').textContent = member.email || 'No email provided';

    let present = 0, late = 0, absent = 0, excused = 0, total = 0;
    const historyList = document.getElementById('profileHistoryList');
    const dates = Object.keys(AppState.attendance).sort().reverse();

    historyList.innerHTML = dates.map(d => {
      total++;
      const rec = AppState.attendance[d][member.id] || { status: 'absent', time: '-', remarks: '' };
      if (rec.status === 'present') present++;
      else if (rec.status === 'late') late++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'excused') excused++;

      return `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-midnight-900 border border-mcgiblue-900/40 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-mono text-slate-300 font-semibold">${d}</span>
            <span class="text-slate-500">•</span>
            <span class="text-slate-400 font-mono">${rec.time}</span>
          </div>
          <div class="flex items-center gap-2">
            ${rec.remarks ? `<span class="text-[10px] text-slate-400 italic">${rec.remarks}</span>` : ''}
            ${this.getStatusBadgeHtml(rec.status)}
          </div>
        </div>
      `;
    }).join('');

    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    document.getElementById('profileRateDisplay').textContent = `${rate}%`;
    document.getElementById('profilePresentDisplay').textContent = present;
    document.getElementById('profileLateDisplay').textContent = late;
    document.getElementById('profileAbsentDisplay').textContent = absent;
    document.getElementById('profileExcusedDisplay').textContent = excused;

    // Admin Credentials Visibility & Population (Admin / Bro. Paul Only)
    const isAdm = !!(
      AppState.currentUser?.isAdmin || 
      AppState.currentUser?.role === 'admin' || 
      (AppState.currentUser?.username && AppState.currentUser.username.toLowerCase() === 'paul') ||
      AppState.currentUser?.isGlobalAdmin
    );
    const credSection = document.getElementById('profileModalAdminCredentials');
    if (credSection) {
      if (isAdm) {
        credSection.classList.remove('hidden');
        const userObj = (AppState.authUsers || []).find(u => 
          (u.id && u.id === member.id) || 
          (u.email && member.email && u.email.toLowerCase() === member.email.toLowerCase()) ||
          (u.name && member.name && u.name.toLowerCase() === member.name.toLowerCase())
        );
        const uname = userObj?.username || member.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '');
        const pwd = userObj?.password || '123!';
        const unameEl = document.getElementById('profileModalUsername');
        const pwdEl = document.getElementById('profileModalPassword');
        const eyeIcon = document.getElementById('profileModalPasswordEyeIcon');
        if (unameEl) unameEl.textContent = uname;
        if (pwdEl) {
          pwdEl.setAttribute('data-actual-password', pwd);
          pwdEl.textContent = '••••••••';
        }
        if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
      } else {
        credSection.classList.add('hidden');
      }
    }

    document.getElementById('memberProfileModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closeMemberProfile() {
    document.getElementById('memberProfileModal').classList.add('hidden');
  },

  toggleProfilePasswordVisibility() {
    const pwdEl = document.getElementById('profileModalPassword');
    const eyeIcon = document.getElementById('profileModalPasswordEyeIcon');
    if (!pwdEl) return;
    const actual = pwdEl.getAttribute('data-actual-password') || '123!';
    const isMasked = pwdEl.textContent.includes('•');
    if (isMasked) {
      pwdEl.textContent = actual;
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      pwdEl.textContent = '••••••••';
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
  },

  copyMemberCredential(type) {
    let val = '';
    if (type === 'username') {
      const uEl = document.getElementById('profileModalUsername');
      val = uEl ? uEl.textContent.trim() : '';
    } else if (type === 'password') {
      const pwdEl = document.getElementById('profileModalPassword');
      val = pwdEl ? pwdEl.getAttribute('data-actual-password') : '';
    }
    if (val) {
      navigator.clipboard.writeText(val).then(() => {
        showToast(`Copied ${type} to clipboard!`, 'success');
      }).catch(() => {
        showToast(`Copied: ${val}`, 'info');
      });
    }
  },

  // =========================================================================
  // ADMIN CREDENTIALS DIRECTORY (PASSWORDS & USERNAMES)
  // =========================================================================
  openAdminCredentialsModal() {
    const modal = document.getElementById('adminCredentialsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.renderAdminCredentialsTable();
    if (window.lucide) lucide.createIcons();
  },

  closeAdminCredentialsModal() {
    const modal = document.getElementById('adminCredentialsModal');
    if (modal) modal.classList.add('hidden');
  },

  renderAdminCredentialsTable(filterQuery = '') {
    const tbody = document.getElementById('adminCredentialsTableBody');
    const footerCount = document.getElementById('adminCredsFooterCount');
    if (!tbody) return;

    const query = normalizeSearchText(filterQuery || '');
    const members = AppState.members || [];
    const authUsers = AppState.authUsers || [];

    const credList = members.map(m => {
      const u = authUsers.find(au => 
        (au.id && au.id === m.id) || 
        (au.email && m.email && au.email.toLowerCase() === m.email.toLowerCase()) ||
        (au.name && m.name && au.name.toLowerCase() === m.name.toLowerCase())
      );
      return {
        id: m.id,
        name: m.name,
        rollNo: m.rollNo,
        locale: m.department || 'Naic',
        level: m.role || 'LOCALE PROD',
        username: u?.username || m.rollNo.toLowerCase().replace(/[^a-z0-9]/g, ''),
        password: u?.password || '123!',
        avatarColor: m.avatarColor || '#fbbf24'
      };
    });

    const filtered = credList.filter(c => {
      if (!query) return true;
      return normalizeSearchText(c.name).includes(query) ||
             normalizeSearchText(c.username).includes(query) ||
             normalizeSearchText(c.rollNo).includes(query) ||
             normalizeSearchText(c.locale).includes(query);
    });

    if (footerCount) {
      footerCount.textContent = `Showing ${filtered.length} of ${credList.length} member credentials`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-400">
            No member credentials match your search.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((c, idx) => `
      <tr class="hover:bg-midnight-800/50 transition-colors">
        <td class="px-3.5 py-2.5">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] text-midnight-950 flex-shrink-0" style="background-color: ${c.avatarColor};">
              ${c.name.split(' ').map(n=>n[0]).join('')}
            </div>
            <div>
              <div class="font-bold text-white text-xs">${c.name}</div>
              <div class="text-[10px] text-slate-400 font-mono">${c.rollNo}</div>
            </div>
          </div>
        </td>
        <td class="px-3.5 py-2.5">
          <span class="text-slate-300 block font-semibold">${c.locale}</span>
          <span class="text-[10px] text-gold-400 font-mono">${c.level}</span>
        </td>
        <td class="px-3.5 py-2.5 font-mono text-xs">
          <div class="flex items-center gap-1.5">
            <span class="text-white font-semibold select-all">${c.username}</span>
            <button type="button" onclick="App.copySpecificCredential('${c.username}', 'Username')" class="text-slate-400 hover:text-gold-300 p-1" title="Copy Username">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
        <td class="px-3.5 py-2.5 font-mono text-xs">
          <div class="flex items-center gap-1.5">
            <span id="credPwdRow_${idx}" data-raw-pwd="${c.password}" class="text-gold-300 font-bold select-all">••••••••</span>
            <button type="button" onclick="App.toggleRowPasswordVisibility(${idx})" class="text-slate-400 hover:text-gold-300 p-1" title="Toggle Show/Hide">
              <i id="credEyeRow_${idx}" data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" onclick="App.copySpecificCredential('${c.password}', 'Password')" class="text-slate-400 hover:text-gold-300 p-1" title="Copy Password">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
        <td class="px-3.5 py-2.5 text-right">
          <button type="button" onclick="App.openMemberProfile('${c.id}'); App.closeAdminCredentialsModal();" class="px-2.5 py-1 rounded-lg bg-midnight-800 hover:bg-gold-400 hover:text-midnight-950 text-gold-300 border border-gold-400/30 text-[11px] font-bold transition-colors">
            Profile & Attendance
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  filterAdminCredentialsTable() {
    const input = document.getElementById('adminCredsSearchInput');
    this.renderAdminCredentialsTable(input ? input.value : '');
  },

  toggleRowPasswordVisibility(index) {
    const pwdEl = document.getElementById(`credPwdRow_${index}`);
    const eyeEl = document.getElementById(`credEyeRow_${index}`);
    if (!pwdEl) return;
    const raw = pwdEl.getAttribute('data-raw-pwd') || '123!';
    const isMasked = pwdEl.textContent.includes('•');
    if (isMasked) {
      pwdEl.textContent = raw;
      if (eyeEl) eyeEl.setAttribute('data-lucide', 'eye-off');
    } else {
      pwdEl.textContent = '••••••••';
      if (eyeEl) eyeEl.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
  },

  toggleAllCredentialsVisibility() {
    const btn = document.getElementById('btnToggleAllCreds');
    const icon = document.getElementById('iconToggleAllCreds');
    const text = document.getElementById('textToggleAllCreds');
    const allPwdSpans = document.querySelectorAll('[id^="credPwdRow_"]');
    
    const isCurrentlyShowing = text?.textContent.includes('Hide');
    
    allPwdSpans.forEach(span => {
      const idx = span.id.replace('credPwdRow_', '');
      const eye = document.getElementById(`credEyeRow_${idx}`);
      const raw = span.getAttribute('data-raw-pwd') || '123!';
      if (isCurrentlyShowing) {
        span.textContent = '••••••••';
        if (eye) eye.setAttribute('data-lucide', 'eye');
      } else {
        span.textContent = raw;
        if (eye) eye.setAttribute('data-lucide', 'eye-off');
      }
    });

    if (text) text.textContent = isCurrentlyShowing ? 'Show All Passwords' : 'Hide All Passwords';
    if (icon) icon.setAttribute('data-lucide', isCurrentlyShowing ? 'eye' : 'eye-off');
    if (window.lucide) lucide.createIcons();
  },

  copySpecificCredential(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied ${label} to clipboard!`, 'success');
    }).catch(() => {
      showToast(`Copied: ${text}`, 'info');
    });
  },

  exportCredentialsCSV() {
    const members = AppState.members || [];
    const authUsers = AppState.authUsers || [];
    const duty = getActiveDutyScope();

    const headers = ['ID', 'Full Name', 'Roll Number', 'Locale', 'Level / Role', 'Username', 'Password', 'Email', 'Ministry'];
    const rows = members.map(m => {
      const u = authUsers.find(au => 
        (au.id && au.id === m.id) || 
        (au.email && m.email && au.email.toLowerCase() === m.email.toLowerCase()) ||
        (au.name && m.name && au.name.toLowerCase() === m.name.toLowerCase())
      );
      const uname = u?.username || m.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pwd = u?.password || '123!';
      return [
        sanitizeCSVField(m.id),
        sanitizeCSVField(m.name),
        sanitizeCSVField(m.rollNo),
        sanitizeCSVField(m.department || 'Naic'),
        sanitizeCSVField(m.role || 'LOCALE PROD'),
        sanitizeCSVField(uname),
        sanitizeCSVField(pwd),
        sanitizeCSVField(m.email || ''),
        sanitizeCSVField(duty)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCGI_${duty}_Member_Credentials_${getPastDateString(0)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${members.length} credentials to CSV`, 'success');
  },

  // =========================================================================
  // LEAVES MODULE
  // =========================================================================
  renderLeaves() {
    const tbody = document.getElementById('leavesListBody');
    if (!tbody) return;

    if (AppState.leaves.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-400">
            <p>No leave requests found</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = AppState.leaves.map(lv => `
      <tr class="hover:bg-midnight-900/40 transition-colors">
        <td class="px-4 py-3 text-xs font-mono text-gold-300">${lv.id}</td>
        <td class="px-4 py-3 font-semibold text-white text-sm">${lv.memberName}</td>
        <td class="px-4 py-3 text-xs font-mono text-slate-300">${lv.date}</td>
        <td class="px-4 py-3 text-xs text-slate-300">
          <strong class="text-gold-400">${lv.type}</strong>: ${lv.reason}
        </td>
        <td class="px-4 py-3">
          <span class="text-xs px-2.5 py-1 rounded font-bold ${lv.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold-500/20 text-gold-300'}">
            ${lv.status.toUpperCase()}
          </span>
        </td>
        <td class="px-4 py-3 text-right">
          ${lv.status === 'pending' ? `
            <button onclick="App.approveLeave('${lv.id}')" class="px-2.5 py-1 rounded bg-emerald-500 text-midnight-950 font-bold text-xs">Approve</button>
          ` : '<span class="text-xs text-slate-500">Processed</span>'}
        </td>
      </tr>
    `).join('');
  },

  openSubmitLeaveModal() {
    const select = document.getElementById('leaveMemberSelect');
    if (select) {
      select.innerHTML = AppState.members.map(m => `<option value="${m.id}">${m.name} (${m.department})</option>`).join('');
    }
    document.getElementById('leaveDatePicker').value = getPastDateString(0);
    document.getElementById('leaveReasonInput').value = '';
    document.getElementById('leaveModal').classList.remove('hidden');
  },

  closeSubmitLeaveModal() {
    document.getElementById('leaveModal').classList.add('hidden');
  },

  saveLeaveForm(e) {
    e.preventDefault();
    const memberId = document.getElementById('leaveMemberSelect').value;
    const member = AppState.members.find(m => m.id === memberId);
    const date = document.getElementById('leaveDatePicker').value;
    const type = document.getElementById('leaveTypeSelect').value;
    const reason = document.getElementById('leaveReasonInput').value.trim();

    const newLeave = {
      id: `LV-${Date.now().toString().slice(-4)}`,
      memberId,
      memberName: member.name,
      department: member.department,
      date,
      type,
      reason,
      status: 'approved',
      submittedAt: getPastDateString(0)
    };

    AppState.leaves.unshift(newLeave);

    // Auto mark as excused on that date
    if (!AppState.attendance[date]) AppState.attendance[date] = {};
    AppState.attendance[date][memberId] = {
      status: 'excused',
      time: '-',
      remarks: `Leave: ${type}`
    };

    AppState.save();
    showToast('Leave request submitted & approved', 'success');
    this.closeSubmitLeaveModal();
    this.renderLeaves();
    this.updateStatsCards();
  },

  approveLeave(id) {
    const lv = AppState.leaves.find(l => l.id === id);
    if (!lv) return;
    lv.status = 'approved';
    if (!AppState.attendance[lv.date]) AppState.attendance[lv.date] = {};
    AppState.attendance[lv.date][lv.memberId] = {
      status: 'excused',
      time: '-',
      remarks: `Leave: ${lv.type}`
    };
    AppState.save();
    showToast('Approved leave request', 'success');
    this.renderLeaves();
    this.updateStatsCards();
  },

  // =========================================================================
  // REPORTS MODULE
  // =========================================================================
  renderReports() {
    const tbody = document.getElementById('reportsSummaryTableBody');
    if (!tbody) return;

    const dates = Object.keys(AppState.attendance);
    const totalDays = dates.length;

    tbody.innerHTML = AppState.members.map((m, idx) => {
      let present = 0, late = 0, absent = 0, excused = 0;
      dates.forEach(d => {
        const rec = AppState.attendance[d][m.id];
        if (rec) {
          if (rec.status === 'present') present++;
          else if (rec.status === 'late') late++;
          else if (rec.status === 'absent') absent++;
          else if (rec.status === 'excused') excused++;
        } else {
          absent++;
        }
      });

      const rate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;
      const isAtRisk = rate < (AppState.settings.alertThreshold || 75);

      return `
        <tr class="hover:bg-midnight-900/40 transition-colors">
          <td class="px-4 py-3 text-xs font-mono text-slate-500">${idx + 1}</td>
          <td class="px-4 py-3 font-semibold text-white text-sm">${m.name}</td>
          <td class="px-4 py-3 text-xs text-slate-300">${m.department}</td>
          <td class="px-4 py-3 text-xs font-mono text-emerald-400 font-bold">${present}</td>
          <td class="px-4 py-3 text-xs font-mono text-gold-400 font-bold">${late}</td>
          <td class="px-4 py-3 text-xs font-mono text-rose-400 font-bold">${absent}</td>
          <td class="px-4 py-3 text-xs font-mono text-mcgiblue-400 font-bold">${excused}</td>
          <td class="px-4 py-3 text-xs font-mono font-bold text-gold-300">${rate}%</td>
          <td class="px-4 py-3">
            ${isAtRisk ? `
              <span class="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                AT RISK
              </span>
            ` : `
              <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                GOOD
              </span>
            `}
          </td>
        </tr>
      `;
    }).join('');
  },

  // =========================================================================
  // SETTINGS & BACKUP
  // =========================================================================
  renderSettings() {
    const org = document.getElementById('settingOrgName');
    const cutoff = document.getElementById('settingCutoffTime');
    const alertT = document.getElementById('settingAlertThreshold');
    const sound = document.getElementById('settingSoundEffects');

    if (org) org.value = AppState.settings.orgName || 'MCGI Production Monitoring System';
    if (cutoff) cutoff.value = AppState.settings.cutoffTime || '08:00';
    if (alertT) alertT.value = AppState.settings.alertThreshold || 75;
    if (sound) sound.checked = false;
  },

  saveSettings(e) {
    e.preventDefault();
    AppState.settings.orgName = document.getElementById('settingOrgName').value.trim();
    AppState.settings.cutoffTime = document.getElementById('settingCutoffTime').value;
    AppState.settings.alertThreshold = parseInt(document.getElementById('settingAlertThreshold').value) || 75;
    const sound = document.getElementById('settingSoundEffects');
    AppState.settings.soundEffects = sound ? sound.checked : false;
    AppState.save();
    showToast('Saved system policy preferences', 'success');
  },

  exportBackupJSON() {
    const activeDuty = getActiveDutyScope();
    const systemNames = {
      'MPRO': 'MCGI PRODUCTION MONITORING SYSTEM',
      'GCOS': 'MCGI GUEST COORDINATORS MONITORING SYSTEM',
      'TK': 'MCGI TEATRO KRISTIANO MONITORING SYSTEM'
    };
    const data = {
      version: '2.0',
      duty: activeDuty,
      system: systemNames[activeDuty] || `MCGI ${activeDuty} MONITORING SYSTEM`,
      members: AppState.members,
      authUsers: AppState.authUsers,
      attendance: AppState.attendance,
      eventEntries: AppState.eventEntries,
      leaves: AppState.leaves,
      settings: AppState.settings,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MCGI_${activeDuty}_Backup_${getPastDateString(0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported complete ${activeDuty} JSON database backup`, 'success');
  },

  importBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.members) AppState.members = data.members;
        if (data.authUsers) AppState.authUsers = data.authUsers;
        if (data.attendance) AppState.attendance = data.attendance;
        if (data.eventEntries) AppState.eventEntries = data.eventEntries;
        if (data.leaves) AppState.leaves = data.leaves;
        if (data.settings) AppState.settings = data.settings;
        AppState.save();
        showToast('Backup restored successfully!', 'success');
        App.render();
      } catch (err) {
        showToast('Invalid backup JSON file', 'error');
      }
    };
    reader.readAsText(file);
  },

  exportCSV() {
    const activeDuty = getActiveDutyScope();
    let csv = 'ID,Name,Locale/Unit,Role,Date,Time,Status,Remarks\n';
    const dateStr = AppState.selectedDate;
    const records = AppState.attendance[dateStr] || {};

    AppState.members.forEach(m => {
      const rec = records[m.id] || { status: 'absent', time: '-', remarks: '' };
      csv += `${sanitizeCSVField(m.rollNo)},${sanitizeCSVField(m.name)},${sanitizeCSVField(m.department)},${sanitizeCSVField(m.role)},${sanitizeCSVField(dateStr)},${sanitizeCSVField(rec.time)},${sanitizeCSVField(rec.status)},${sanitizeCSVField(rec.remarks)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCGI_${activeDuty}_Attendance_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${activeDuty} Attendance Sheet CSV`, 'success');
  },

  // =========================================================================
  // PERSONNEL SUMMARY MODAL (CLICKABLE KPI STAT CARDS)
  // =========================================================================
  currentSummaryType: 'all',
  currentSummaryDeptFilter: '',
  currentSummarySearchQuery: '',

  showPersonnelSummaryModal(type = 'all') {
    this.currentSummaryType = type;
    this.currentSummaryDeptFilter = '';
    this.currentSummarySearchQuery = '';

    const searchInput = document.getElementById('summarySearchInput');
    if (searchInput) searchInput.value = '';

    const stats = this.calculateStats(AppState.selectedDate);
    const dateStr = AppState.selectedDate;

    // Configure Header details based on clicked status card
    const titleEl = document.getElementById('summaryModalTitle');
    const subEl = document.getElementById('summaryModalSubtitle');
    const iconBox = document.getElementById('summaryModalIconBox');
    const badgeEl = document.getElementById('summaryModalCountBadge');

    const config = {
      all: {
        title: 'Total Production Members',
        subtitle: `All registered personnel across production units (${dateStr})`,
        count: stats.total,
        badgeClass: 'bg-gold-400 text-midnight-950 font-bold',
        icon: 'users',
        boxClass: 'bg-gradient-to-tr from-gold-500 to-gold-400 text-midnight-950 glow-gold-sm'
      },
      present: {
        title: 'Present Personnel (On-Duty)',
        subtitle: `On-time check-ins recorded for session ${dateStr}`,
        count: stats.present,
        badgeClass: 'bg-emerald-500 text-white font-bold',
        icon: 'check-circle-2',
        boxClass: 'bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white'
      },
      late: {
        title: 'Late Arrivals',
        subtitle: `Checked in after call-time cutoff for session ${dateStr}`,
        count: stats.late,
        badgeClass: 'bg-gold-500 text-midnight-950 font-bold',
        icon: 'clock',
        boxClass: 'bg-gradient-to-tr from-amber-600 to-gold-400 text-midnight-950'
      },
      absent: {
        title: 'Absent Personnel',
        subtitle: `Unexcused personnel with no check-in record for session ${dateStr}`,
        count: stats.absent,
        badgeClass: 'bg-rose-500 text-white font-bold',
        icon: 'x-circle',
        boxClass: 'bg-gradient-to-tr from-rose-600 to-rose-400 text-white'
      },
      excused: {
        title: 'Excused Personnel & Leaves',
        subtitle: `Authorized leaves and duty exemptions for session ${dateStr}`,
        count: stats.excused,
        badgeClass: 'bg-zinc-700 text-slate-200 border border-zinc-600 font-bold',
        icon: 'badge-alert',
        boxClass: 'bg-gradient-to-tr from-zinc-700 to-zinc-500 text-white'
      }
    };

    const cfg = config[type] || config.all;
    if (titleEl) titleEl.textContent = cfg.title;
    if (subEl) subEl.textContent = cfg.subtitle;
    if (badgeEl) {
      badgeEl.textContent = `${cfg.count} ${type === 'all' ? 'Total' : type.toUpperCase()}`;
      badgeEl.className = `px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${cfg.badgeClass}`;
    }
    if (iconBox) {
      iconBox.className = `w-11 h-11 rounded-xl flex items-center justify-center shadow-lg text-midnight-950 font-black ${cfg.boxClass}`;
      iconBox.innerHTML = `<i data-lucide="${cfg.icon}" class="w-6 h-6 stroke-[2.5]"></i>`;
    }

    // Render 4-card Quick Metrics breakdown row
    this.renderPersonnelSummaryKPIs(type, stats);

    // Update filter buttons styling
    this.updatePersonnelSummaryDeptButtons();

    // Render list
    this.renderPersonnelSummaryList();

    const modal = document.getElementById('personnelSummaryModal');
    if (modal) {
      modal.classList.remove('hidden');
    }

    if (window.lucide) lucide.createIcons();
  },

  closePersonnelSummaryModal() {
    const modal = document.getElementById('personnelSummaryModal');
    if (modal) modal.classList.add('hidden');
  },

  renderPersonnelSummaryKPIs(type, stats) {
    const container = document.getElementById('summaryModalKpisRow');
    if (!container) return;

    const dateStr = AppState.selectedDate;
    const dayRecords = AppState.attendance[dateStr] || {};

    const subset = AppState.members.filter(m => {
      const rec = dayRecords[m.id];
      const status = rec ? rec.status : 'absent';
      if (type === 'all') return true;
      return status === type;
    });

    const totalInGroup = subset.length;
    const pct = stats.total > 0 ? Math.round((totalInGroup / stats.total) * 100) : 0;

    const byDept = { Naic: 0, Calubcob: 0, Acacia: 0 };
    const byRole = { 'MUNICIPAL PROD': 0, 'LOCALE PROD': 0, 'TRAINEE': 0 };

    subset.forEach(m => {
      if (byDept[m.department] !== undefined) byDept[m.department]++;
      if (byRole[m.role] !== undefined) byRole[m.role]++;
    });

    container.innerHTML = `
      <div class="p-2.5 rounded-xl bg-midnight-900 border border-mcgiblue-900/60 text-center">
        <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Count</span>
        <span class="text-lg font-black text-white font-mono">${totalInGroup}</span>
        <span class="text-[10px] text-gold-400 block font-semibold">${pct}% of Total</span>
      </div>
      <div class="p-2.5 rounded-xl bg-midnight-900 border border-mcgiblue-900/60 text-center">
        <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Attendance Rate</span>
        <span class="text-lg font-black text-emerald-400 font-mono">${stats.rate}%</span>
        <span class="text-[10px] text-slate-400 block">Overall Session</span>
      </div>
      <div class="p-2.5 rounded-xl bg-midnight-900 border border-mcgiblue-900/60 text-center">
        <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">By Locale</span>
        <div class="flex items-center justify-center gap-1.5 mt-1">
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-slate-200 border border-mcgiblue-800" title="Naic">N: <strong class="text-gold-300">${byDept.Naic}</strong></span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-slate-200 border border-mcgiblue-800" title="Calubcob">C: <strong class="text-gold-300">${byDept.Calubcob}</strong></span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-slate-200 border border-mcgiblue-800" title="Acacia">A: <strong class="text-gold-300">${byDept.Acacia}</strong></span>
        </div>
      </div>
      <div class="p-2.5 rounded-xl bg-midnight-900 border border-mcgiblue-900/60 text-center">
        <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">By Role</span>
        <div class="flex items-center justify-center gap-1.5 mt-1">
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-slate-200 border border-mcgiblue-800" title="Municipal Prod">Mun: <strong class="text-emerald-400">${byRole['MUNICIPAL PROD']}</strong></span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-slate-200 border border-mcgiblue-800" title="Locale Prod">Loc: <strong class="text-gold-300">${byRole['LOCALE PROD']}</strong></span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-slate-200 border border-mcgiblue-800" title="Trainee">Tr: <strong class="text-slate-300">${byRole['TRAINEE']}</strong></span>
        </div>
      </div>
    `;
  },

  setPersonnelSummaryDeptFilter(dept = '') {
    this.currentSummaryDeptFilter = dept;
    this.updatePersonnelSummaryDeptButtons();
    this.renderPersonnelSummaryList();
  },

  updatePersonnelSummaryDeptButtons() {
    const depts = ['', 'Naic', 'Calubcob', 'Acacia'];
    const ids = { '': 'summaryDeptBtnAll', 'Naic': 'summaryDeptBtnNaic', 'Calubcob': 'summaryDeptBtnCalubcob', 'Acacia': 'summaryDeptBtnAcacia' };
    
    depts.forEach(d => {
      const btn = document.getElementById(ids[d]);
      if (!btn) return;
      if (this.currentSummaryDeptFilter === d) {
        btn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-gold-400 text-midnight-950 transition-all shadow-sm';
      } else {
        btn.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all';
      }
    });
  },

  filterPersonnelSummaryList() {
    const input = document.getElementById('summarySearchInput');
    this.currentSummarySearchQuery = input ? input.value.toLowerCase().trim() : '';
    this.renderPersonnelSummaryList();
  },

  renderPersonnelSummaryList() {
    const container = document.getElementById('summaryModalListContainer');
    const footerCount = document.getElementById('summaryModalListFooterCount');
    if (!container) return;

    const dateStr = AppState.selectedDate;
    const dayRecords = AppState.attendance[dateStr] || {};
    const type = this.currentSummaryType || 'all';

    // Base members matching the status category
    const groupMembers = AppState.members.filter(m => {
      const rec = dayRecords[m.id];
      const status = rec ? rec.status : 'absent';
      if (type === 'all') return true;
      return status === type;
    });

    // Apply department and text search filters
    const filtered = groupMembers.filter(m => {
      if (this.currentSummaryDeptFilter && m.department !== this.currentSummaryDeptFilter) {
        return false;
      }
      if (this.currentSummarySearchQuery) {
        const q = this.currentSummarySearchQuery;
        const rec = dayRecords[m.id] || {};
        const remarks = (rec.remarks || '').toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesRoll = m.rollNo.toLowerCase().includes(q);
        const matchesDept = m.department.toLowerCase().includes(q);
        const matchesRole = m.role.toLowerCase().includes(q);
        const matchesRemarks = remarks.includes(q);
        return matchesName || matchesRoll || matchesDept || matchesRole || matchesRemarks;
      }
      return true;
    });

    if (footerCount) {
      footerCount.textContent = `Showing ${filtered.length} of ${groupMembers.length} personnel`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-midnight-900/60 rounded-xl border border-mcgiblue-900/50 my-2">
          <div class="w-12 h-12 rounded-full bg-midnight-800 text-slate-500 flex items-center justify-center mx-auto mb-2.5">
            <i data-lucide="users" class="w-6 h-6"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-300 mb-1">No Personnel Found</h4>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">No records match the current status category "${type}" or search criteria for ${dateStr}.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(m => {
      const rec = dayRecords[m.id] || { status: 'absent', time: '-', remarks: 'No check-in record' };
      const status = rec.status || 'absent';
      const initials = m.name.split(' ').filter(n => !n.startsWith('Bro.') && !n.startsWith('Sis.')).map(n => n[0]).join('') || m.name.slice(0, 2);

      let statusBadge = '';
      if (status === 'present') {
        statusBadge = `<span class="badge-present px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm"><i data-lucide="check" class="w-3 h-3 stroke-[3]"></i> Present</span>`;
      } else if (status === 'late') {
        statusBadge = `<span class="badge-late px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm"><i data-lucide="clock" class="w-3 h-3 stroke-[2.5]"></i> Late</span>`;
      } else if (status === 'absent') {
        statusBadge = `<span class="badge-absent px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm"><i data-lucide="x" class="w-3 h-3 stroke-[2.5]"></i> Absent</span>`;
      } else if (status === 'excused') {
        statusBadge = `<span class="badge-excused px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm"><i data-lucide="shield" class="w-3 h-3"></i> Excused</span>`;
      }

      return `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-midnight-900 hover:bg-midnight-800/90 border border-mcgiblue-900/60 transition-all gap-3 group">
          <!-- Member Avatar & Basic Info -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-midnight-950 shadow-md flex-shrink-0" style="background-color: ${m.avatarColor || '#fbbf24'}">
              ${initials}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <button 
                  onclick="App.closePersonnelSummaryModal(); App.openMemberProfile('${m.id}')" 
                  class="text-sm font-bold text-white hover:text-gold-300 transition-colors text-left truncate">
                  ${m.name}
                </button>
                <span class="badge-locale text-[10px] px-2 py-0.5 rounded font-mono font-semibold">${m.department}</span>
                <span class="text-[10px] px-2 py-0.5 rounded bg-midnight-800 text-slate-300 border border-mcgiblue-800 font-mono font-semibold">${m.role}</span>
              </div>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                <span>${m.rollNo}</span>
                ${m.email ? `<span>•</span><span class="text-slate-500">${m.email}</span>` : ''}
              </p>
            </div>
          </div>

          <!-- Status, Time In & Remarks Details -->
          <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
            <div class="text-left sm:text-right">
              <div class="flex items-center sm:justify-end gap-2">
                ${statusBadge}
                ${rec.time && rec.time !== '-' ? `<span class="text-xs font-mono font-bold text-gold-300 bg-midnight-950 px-2 py-0.5 rounded border border-mcgiblue-900">${rec.time}</span>` : ''}
              </div>
              ${rec.remarks ? `<p class="text-[11px] text-slate-400 italic mt-1 truncate max-w-[200px]" title="${rec.remarks}">${rec.remarks}</p>` : ''}
            </div>

            <!-- Inspect Profile Action -->
            <button 
              onclick="App.closePersonnelSummaryModal(); App.openMemberProfile('${m.id}')" 
              class="p-2 rounded-xl bg-midnight-800 hover:bg-midnight-700 text-slate-300 hover:text-gold-400 border border-mcgiblue-800 transition-colors flex-shrink-0" 
              title="Inspect Full History">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  exportPersonnelSummaryCSV() {
    const dateStr = AppState.selectedDate;
    const dayRecords = AppState.attendance[dateStr] || {};
    const type = this.currentSummaryType || 'all';

    const groupMembers = AppState.members.filter(m => {
      const rec = dayRecords[m.id];
      const status = rec ? rec.status : 'absent';
      if (type === 'all') return true;
      return status === type;
    });

    const filtered = groupMembers.filter(m => {
      if (this.currentSummaryDeptFilter && m.department !== this.currentSummaryDeptFilter) {
        return false;
      }
      return true;
    });

    let csv = 'Personnel ID,Full Name,Roll No,Locale / Unit,Role,Session Date,Status,Time In,Remarks / Reason\n';

    filtered.forEach(m => {
      const rec = dayRecords[m.id] || { status: 'absent', time: '-', remarks: 'No check-in record' };
      csv += `${sanitizeCSVField(m.id)},${sanitizeCSVField(m.name)},${sanitizeCSVField(m.rollNo)},${sanitizeCSVField(m.department)},${sanitizeCSVField(m.role)},${sanitizeCSVField(dateStr)},${sanitizeCSVField(rec.status)},${sanitizeCSVField(rec.time)},${sanitizeCSVField(rec.remarks)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCGI_Personnel_${type.toUpperCase()}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filtered.length} personnel records to CSV`, 'success');
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
