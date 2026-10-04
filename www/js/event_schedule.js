/**
 * MCGI ATTENDANCE - EVENT SCHEDULE MODULE
 *
 * Single source of truth for fixed weekly event schedules and the logic that
 * detects the applicable slot from the user's current local day & time.
 *
 * Detection flow:  Active Event (chosen event) -> Current Day -> Current Time -> Slot
 * The clock is NEVER used to guess the event, because schedules overlap
 * (e.g. Sunday 5:30 PM exists under both WS and PBB).
 *
 * Scheduled time (which session was attended) is kept separate from the
 * actual Time In (when attendance was recorded).
 */
const EventSchedule = (() => {
  /**
   * SELECTION RULE (day-context based, no time window):
   *   1. Take only the slots of the chosen event that fall on TODAY's weekday
   *      (slots with day === null are available every day).
   *   2. Sort them from earliest to latest.
   *   3. Among the slots that have already started (start <= now), choose the LATEST.
   *      A slot therefore stays selected until the next slot actually begins.
   *   4. If none has started yet, choose the first upcoming slot.
   *   5. One slot today -> that slot for the whole day.
   *   6. No slot today  -> 'none' (never borrows another day's slot).
   */

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // day: 0=Sun..6=Sat, or null for "every day". time: 24h 'HH:MM'.
  // `label` is the value stored in records / used by radio pills (unchanged from before).
  const PM_SLOTS = [
    { label: '3:30AM/WED - LIVE',     day: 3, time: '03:30', type: 'LIVE' },
    { label: '2:30PM/WED - VIEWING',  day: 3, time: '14:30', type: 'VIEWING' },
    { label: '5:30PM/WED - VIEWING',  day: 3, time: '17:30', type: 'VIEWING' },
    { label: '7:00AM/THU - VIEWING',  day: 4, time: '07:00', type: 'VIEWING' },
    { label: '7:00PM/THU - VIEWING',  day: 4, time: '19:00', type: 'VIEWING' }
  ];

  const CONFIG = {
    'PM': {
      name: 'Prayer Meeting', field: 'eventSchedule', fieldTitle: 'PM Schedule / Viewing Slot',
      icon: 'clock', grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', slots: PM_SLOTS
    },
    'WS': {
      name: 'Worship Service', field: 'eventSchedule', fieldTitle: 'WS Schedule / Viewing Slot',
      icon: 'clock', grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      slots: [
        { label: '3:30AM/SAT - LIVE',     day: 6, time: '03:30', type: 'LIVE' },
        { label: '11:30AM/SAT - VIEWING', day: 6, time: '11:30', type: 'VIEWING' },
        { label: '1:30PM/SUN - VIEWING',  day: 0, time: '13:30', type: 'VIEWING' },
        { label: '5:30PM/SUN - VIEWING',  day: 0, time: '17:30', type: 'VIEWING' }
      ]
    },
    'PBB': {
      name: 'Pasalamat ng Buong Bayan', field: 'eventSchedule', fieldTitle: 'PBB Schedule / Viewing Slot',
      icon: 'clock', grid: 'grid-cols-1 sm:grid-cols-3',
      slots: [
        { label: '4:00PM/SAT - LIVE',     day: 6, time: '16:00', type: 'LIVE' },
        { label: '5:30AM/SUN - VIEWING',  day: 0, time: '05:30', type: 'VIEWING' },
        { label: '5:30PM/SUN - VIEWING',  day: 0, time: '17:30', type: 'VIEWING' }
      ]
    },
    'COMBINED PM/WS': {
      name: 'Combined PM/WS', field: 'eventSchedule', fieldTitle: 'Combined PM/WS Schedule Slot',
      icon: 'clock', grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', slots: PM_SLOTS
    },
    'SPBB': {
      name: 'Special Pasalamat ng Buong Bayan', field: 'eventSchedule', fieldTitle: 'SPBB Day Schedule',
      icon: 'star', grid: 'grid-cols-1 sm:grid-cols-3',
      slots: [
        { label: 'DAY 1/FRI - 4:00PM', day: 5, time: '16:00', type: 'SPBB DAY 1' },
        { label: 'DAY 2/SAT - 4:00PM', day: 6, time: '16:00', type: 'SPBB DAY 2' },
        { label: 'DAY 3/SUN - 4:00PM', day: 0, time: '16:00', type: 'SPBB DAY 3' }
      ]
    },
    'SERBISYONG KAPATIRAN': {
      name: 'Serbisyong Kapatiran', field: 'eventEdition', fieldTitle: 'EDITION',
      icon: 'tv', grid: 'grid-cols-1', slots: [
        { label: 'AFTERNOON EDITION - 12:50PM', day: null, time: '12:50', type: 'AFTERNOON EDITION' },
        { label: 'EVENING EDITION - 9:30PM',    day: null, time: '21:30', type: 'EVENING EDITION' }
      ]
    }
  };

  function getConfig(eventType) { return CONFIG[eventType] || null; }
  function hasFixedSchedule(eventType) { return !!CONFIG[eventType]; }

  function findSlot(eventType, label) {
    const cfg = CONFIG[eventType];
    return cfg ? (cfg.slots.find(s => s.label === label) || null) : null;
  }

  function formatTime12(time24) {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function describeSlot(slot) {
    return {
      scheduledTime: formatTime12(slot.time),
      dayName: slot.day === null ? null : DAY_NAMES[slot.day],
      sessionType: slot.type
    };
  }

  /**
   * Detects the applicable slot for `eventType` at `now` using today's schedule context
   * (latest slot already started, else first upcoming).
   * @returns {{status:'unscheduled'}|{status:'none'}|{status:'detected', slot, scheduledTime, dayName, sessionType, minutesFromStart}}
   *   minutesFromStart: negative = slot is upcoming, positive = slot already started.
   */
  function detect(eventType, now = new Date()) {
    const cfg = CONFIG[eventType];
    if (!cfg) return { status: 'unscheduled' };

    const today = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    // Steps 1-2: today's slots (day === null means "every day"), sorted by time
    const todays = cfg.slots
      .filter(slot => slot.day === null || slot.day === today)
      .sort((a, b) => toMin(a.time) - toMin(b.time));
    if (todays.length === 0) return { status: 'none' };

    // Latest slot that has already started (start <= now); otherwise the first upcoming one.
    let chosen = null;
    todays.forEach(slot => { if (toMin(slot.time) <= nowMin) chosen = slot; });
    if (!chosen) chosen = todays[0];

    return Object.assign(
      { status: 'detected', slot: chosen, minutesFromStart: Math.round(nowMin - toMin(chosen.time)) },
      describeSlot(chosen)
    );
  }

  function formatLocalTime(date = new Date()) {
    if (!(date instanceof Date) || isNaN(date.getTime())) date = new Date();
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const api = { DAY_NAMES, getConfig, hasFixedSchedule, findSlot, describeSlot, formatTime12, formatLocalTime, detect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
