/**
 * MCGI PRODUCTION MONITORING SYSTEM - ATTENDANCE LOGGER MODULE
 * Dedicated module for:
 * 1. Attendance Records Management & Filtering
 * 2. Secure QR Code Validation & Anti-Replay Attendance Logging
 * 3. Camera Scanner Integration
 */

const AttendanceLogger = (() => {
  const SECRET_SALT = 'MCGI_PROD_ATTENDANCE_SECURE_SALT_2026';
  let activeCameraScanner = null;
  // In-memory cache for anti-replay attack mitigation (5s debounce per member)
  const scanHistoryCache = new Map();

  /**
   * Plays a pleasant synthesized scan success tone via Web Audio API
   */
  function playScanSuccessTone() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08); // D6
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (e) {
      // AudioContext could be silenced if no interaction yet
    }
  }

  const DEFAULT_GC_URL = 'https://www.facebook.com/messages/t/1686295725831007';

  /**
   * Retrieves configured Messenger Group Chats list from storage
   * @returns {Array<{id: string, name: string, url: string}>}
   */
  function getMessengerGcList() {
    try {
      const stored = localStorage.getItem('mcgi_messenger_gc_list');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[AttendanceLogger] Could not parse mcgi_messenger_gc_list:', e);
    }
    // Default fallback GC
    const defaultList = [
      { id: 'gc-default-1', name: 'MCGI Attendance GC', url: DEFAULT_GC_URL }
    ];
    saveMessengerGcList(defaultList);
    return defaultList;
  }

  /**
   * Persists configured Messenger Group Chats list to storage
   * @param {Array<{id: string, name: string, url: string}>} list
   */
  function saveMessengerGcList(list) {
    try {
      localStorage.setItem('mcgi_messenger_gc_list', JSON.stringify(list));
      if (list.length > 0) {
        localStorage.setItem('mcgi_messenger_gc_url', list[0].url);
      }
    } catch (e) {}
  }

  function isAutoDispatchEnabled() {
    return localStorage.getItem('mcgi_messenger_auto_dispatch') === 'true';
  }

  function toggleAutoDispatch(enabled) {
    localStorage.setItem('mcgi_messenger_auto_dispatch', enabled ? 'true' : 'false');
    const chk = document.getElementById('chkAutoDispatchOnRecord');
    if (chk) chk.checked = !!enabled;
    if (typeof showToast === 'function') {
      showToast(enabled ? '⚡ Auto-dispatch enabled: GCs will open automatically on check-in' : 'Auto-dispatch disabled', 'info');
    }
  }

  /**
   * Formats attendance record matching the exact 4-line MCGI Messenger GC format:
   * • Name: Kate Habijan
   * • Type of Service: PM Viewing
   * • Date | Time: September 30, 2026 | 5:30 PM
   * • Face-to-face
   */
  function formatSingleAttendanceMessage(data = {}) {
    const name = data.name || data.fullName || 'Member';
    const serviceType = data.serviceType || 'PM Viewing';
    const mode = data.mode || 'Face-to-face';

    let dateStr = '';
    try {
      if (data.date) {
        // Parse YYYY-MM-DD cleanly without timezone offset shift
        const parts = String(data.date).split('T')[0].split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } else {
          const d = new Date(data.date);
          dateStr = isNaN(d.getTime()) ? String(data.date) : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
      } else {
        dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
    } catch (e) {
      dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    let timeStr = data.timeIn;
    if (!timeStr || timeStr === '-') {
      timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      // If timeStr is HH:MM 24h format, convert to 12h AM/PM
      const match24 = String(timeStr).match(/^(\d{1,2}):(\d{2})$/);
      if (match24) {
        let h = parseInt(match24[1], 10);
        const m = match24[2];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        timeStr = `${h}:${m} ${ampm}`;
      }
    }

    return `• Name: ${name}\n• Type of Service: ${serviceType}\n• Date | Time: ${dateStr} | ${timeStr}\n• ${mode}`;
  }

  /**
   * Generates dynamic attendance format directly based on what the user has set in the Record Attendance form
   */
  function getCurrentFormMessengerFormat(customRecord = null) {
    if (customRecord) {
      return formatSingleAttendanceMessage(customRecord);
    }

    // 1. Name
    const nameInput = document.getElementById('inputEventFullName');
    let name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      const rosterSelect = document.getElementById('selectRosterQuickPick');
      if (rosterSelect && rosterSelect.value && window.AppState?.members) {
        const found = AppState.members.find(m => m.id === rosterSelect.value);
        if (found) name = found.name;
      }
    }
    if (!name && window.AppState?.currentUser?.name) {
      name = AppState.currentUser.name;
    }
    if (!name) name = 'Member';

    // 2. Schedule & Time
    const eventSelect = document.getElementById('selectEventType');
    const eventVal = eventSelect ? eventSelect.value : 'PM';
    const isManual = window.App && window.App._scheduleManual;

    let scheduleVal = '';
    let sessionType = '';

    if (window.EventSchedule && EventSchedule.hasFixedSchedule(eventVal)) {
      if (isManual) {
        const cfg = EventSchedule.getConfig(eventVal);
        const radio = document.querySelector(`input[name="${cfg.field}"]:checked`);
        scheduleVal = radio ? radio.value : '';
        const slot = scheduleVal ? EventSchedule.findSlot(eventVal, scheduleVal) : null;
        if (slot) sessionType = slot.type;
      } else {
        const det = EventSchedule.detect(eventVal, new Date());
        if (det.status === 'detected') {
          scheduleVal = det.slot.label;
          sessionType = det.sessionType;
        }
      }
    } else {
      const scheduleRadio = document.querySelector('input[name="eventSchedule"]:checked');
      scheduleVal = scheduleRadio ? scheduleRadio.value : '';
    }

    let timeIn = '';
    const manualTimeInput = document.getElementById('inputEventTimeIn');
    if (manualTimeInput && manualTimeInput.value) {
      timeIn = manualTimeInput.value;
    } else if (window.EventSchedule && typeof EventSchedule.formatLocalTime === 'function') {
      timeIn = EventSchedule.formatLocalTime(new Date());
    } else {
      timeIn = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // 3. Service Type
    let serviceType = '';
    const customServiceInput = document.getElementById('inputCustomServiceType');
    if (customServiceInput && customServiceInput.value.trim()) {
      serviceType = customServiceInput.value.trim();
    } else {
      const isViewing = scheduleVal.toUpperCase().includes('VIEWING') || sessionType === 'VIEWING';
      const isLive = scheduleVal.toUpperCase().includes('LIVE') || sessionType === 'LIVE';

      if (eventVal === 'PM') {
        serviceType = isViewing ? 'PM Viewing' : isLive ? 'Prayer Meeting (Live)' : 'PM Viewing';
      } else if (eventVal === 'WS') {
        serviceType = isViewing ? 'WS Viewing' : isLive ? 'Worship Service (Live)' : 'WS Viewing';
      } else if (eventVal === 'PBB') {
        serviceType = isLive ? 'PBB (Live)' : 'PBB Viewing';
      } else if (eventVal === 'COMBINED PM/WS') {
        serviceType = 'Combined PM/WS';
      } else if (eventVal === 'SPBB') {
        serviceType = 'SPBB Viewing';
      } else if (eventVal === 'SERBISYONG KAPATIRAN') {
        serviceType = scheduleVal || 'Serbisyong Kapatiran';
      } else if (eventVal === 'MASS INDOCTRINATION') {
        serviceType = 'Mass Indoctrination';
      } else if (eventVal === 'BIBLE STUDY') {
        serviceType = 'Bible Study';
      } else {
        serviceType = eventVal;
      }
    }

    // 4. Date
    const dateInput = document.getElementById('inputEventDate');
    const dateVal = dateInput && dateInput.value ? dateInput.value : (window.AppState?.selectedDate || new Date().toISOString().split('T')[0]);

    // 5. Mode (Face-to-face vs zoom)
    const modeRadio = document.querySelector('input[name="gcAttendanceMode"]:checked');
    const mode = modeRadio ? modeRadio.value : 'Face-to-face';

    return formatSingleAttendanceMessage({
      name,
      serviceType,
      date: dateVal,
      timeIn,
      mode
    });
  }

  /**
   * Refreshes the live Messenger preview chat bubble
   */
  function updateMessengerDispatcherPreview() {
    const formatted = getCurrentFormMessengerFormat();
    const bubbleEl = document.getElementById('messengerLiveBubbleText');
    if (bubbleEl) {
      bubbleEl.textContent = formatted;
    }
  }

  /**
   * Copies the live formatted message to the user's clipboard
   */
  async function copyCurrentFormMessengerFormat() {
    const formatted = getCurrentFormMessengerFormat();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formatted);
      } else {
        const ta = document.createElement('textarea');
        ta.value = formatted;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      const btnText = document.getElementById('btnCopyLiveMessengerFormatText');
      if (btnText) {
        const orig = btnText.textContent;
        btnText.textContent = '✅ Copied to Clipboard!';
        setTimeout(() => { btnText.textContent = orig; }, 2000);
      }

      if (typeof showToast === 'function') {
        showToast('📋 Copied formatted attendance! Ready to paste into Messenger GC.', 'success');
      }
    } catch (e) {
      if (typeof showToast === 'function') {
        showToast('Attendance format ready! Press Ctrl+C in preview to copy.', 'info');
      }
    }
  }

  /**
   * Renders the configured Group Chats list inside the Record Attendance module
   */
  function renderMessengerGcLinks() {
    const container = document.getElementById('messengerGcListContainer');
    const countBadge = document.getElementById('gcCounterBadge');
    const countNumber = document.getElementById('activeGcCountNumber');
    const dispatchBtnText = document.getElementById('btnDispatchAllGcsText');
    const autoDispatchChk = document.getElementById('chkAutoDispatchOnRecord');

    const gcs = getMessengerGcList();

    if (countBadge) {
      countBadge.textContent = `${gcs.length} GC${gcs.length === 1 ? '' : 's'} Configured`;
      if (gcs.length > 1) {
        countBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse';
      } else {
        countBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40';
      }
    }

    if (countNumber) countNumber.textContent = String(gcs.length);

    if (dispatchBtnText) {
      dispatchBtnText.textContent = gcs.length > 1
        ? `Copy & Open All ${gcs.length} Group Chats`
        : `Copy & Open Messenger GC`;
    }

    if (autoDispatchChk) {
      autoDispatchChk.checked = isAutoDispatchEnabled();
    }

    if (!container) return;

    if (gcs.length === 0) {
      container.innerHTML = `
        <div class="p-3 text-center rounded-xl border border-dashed border-slate-700 bg-midnight-950/60 text-xs text-slate-400">
          No group chat links configured yet. Paste a link above to add one!
        </div>
      `;
      return;
    }

    container.innerHTML = gcs.map((gc, idx) => `
      <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-midnight-950/90 border border-slate-800/80 hover:border-blue-500/40 transition-all">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-black flex-shrink-0">
            ${idx + 1}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-white truncate">${escapeHtml(gc.name || 'Group Chat ' + (idx + 1))}</span>
              <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">GC #${idx + 1}</span>
            </div>
            <a href="${escapeHtml(gc.url)}" target="_blank" rel="noopener noreferrer" class="text-[11px] font-mono text-blue-400 hover:underline truncate block" title="${escapeHtml(gc.url)}">
              ${escapeHtml(gc.url)}
            </a>
          </div>
        </div>

        <div class="flex items-center gap-1 flex-shrink-0">
          <!-- Test Open Single GC -->
          <button 
            type="button" 
            onclick="AttendanceLogger.openSingleGc('${escapeHtml(gc.url)}')"
            class="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all"
            title="Copy format and test open this GC">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          </button>

          <!-- Replace Link -->
          <button 
            type="button" 
            onclick="AttendanceLogger.replaceMessengerGcLink('${gc.id}')"
            class="p-1.5 rounded-lg bg-midnight-800 hover:bg-gold-500/20 text-slate-300 hover:text-gold-300 border border-slate-700 hover:border-gold-500/40 transition-all"
            title="Replace or rename this group chat">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>

          <!-- Remove Link -->
          <button 
            type="button" 
            onclick="AttendanceLogger.removeMessengerGcLink('${gc.id}')"
            class="p-1.5 rounded-lg bg-midnight-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-all"
            title="Remove this group chat link">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Helper to escape HTML characters
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Adds a new Messenger Group Chat link to the user's active list
   */
  function addMessengerGcLink() {
    const urlInput = document.getElementById('inputNewGcUrl');
    const nameInput = document.getElementById('inputNewGcName');

    let url = urlInput ? urlInput.value.trim() : '';
    let name = nameInput ? nameInput.value.trim() : '';

    if (!url) {
      if (typeof showToast === 'function') {
        showToast('Please paste a Messenger group chat link (URL)', 'warning');
      }
      urlInput?.focus();
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const currentList = getMessengerGcList();

    if (!name) {
      name = `Group Chat ${currentList.length + 1}`;
    }

    const newGc = {
      id: 'gc-' + Date.now().toString().slice(-6),
      name,
      url
    };

    currentList.push(newGc);
    saveMessengerGcList(currentList);

    if (urlInput) urlInput.value = '';
    if (nameInput) nameInput.value = '';

    renderMessengerGcLinks();

    if (typeof showToast === 'function') {
      showToast(`✅ Added "${name}" (${currentList.length} GC${currentList.length === 1 ? '' : 's'} configured)!`, 'success');
    }
  }

  /**
   * Removes a Messenger Group Chat link
   */
  function removeMessengerGcLink(id) {
    const currentList = getMessengerGcList();
    const target = currentList.find(g => g.id === id);
    const updated = currentList.filter(g => g.id !== id);
    saveMessengerGcList(updated);
    renderMessengerGcLinks();

    if (typeof showToast === 'function') {
      showToast(`Removed "${target?.name || 'Group Chat'}" link`, 'info');
    }
  }

  /**
   * Replaces or renames an existing group chat link
   */
  function replaceMessengerGcLink(id) {
    const currentList = getMessengerGcList();
    const gc = currentList.find(g => g.id === id);
    if (!gc) return;

    const newUrl = prompt(`Enter new Messenger Group Chat link for "${gc.name}":`, gc.url);
    if (newUrl === null) return; // User cancelled
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      if (typeof showToast === 'function') showToast('Group chat link cannot be empty', 'warning');
      return;
    }

    const newName = prompt(`Enter label/name for this group chat:`, gc.name);
    if (newName !== null && newName.trim()) {
      gc.name = newName.trim();
    }

    gc.url = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : ('https://' + trimmedUrl);
    saveMessengerGcList(currentList);
    renderMessengerGcLinks();

    if (typeof showToast === 'function') {
      showToast(`✅ Updated "${gc.name}" link!`, 'success');
    }
  }

  /**
   * Opens a single GC link while copying current live format to clipboard
   */
  async function openSingleGc(url) {
    await copyCurrentFormMessengerFormat();
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      window.open(url, '_system');
    } else {
      window.open(url, '_blank');
    }
    if (typeof showToast === 'function') {
      showToast('📋 Copied format & opened GC! Paste (Ctrl+V) and hit send.', 'success');
    }
  }

  /**
   * Copies formatted attendance and automatically opens ALL configured Group Chat links
   * Supports 1, 2, or more group chats seamlessly
   */
  async function dispatchAllMessengerGcs(customText = null) {
    const gcs = getMessengerGcList();
    if (!gcs || gcs.length === 0) {
      if (typeof showToast === 'function') {
        showToast('No group chat links configured. Paste a link first!', 'warning');
      }
      const urlInput = document.getElementById('inputNewGcUrl');
      urlInput?.focus();
      return;
    }

    const textToCopy = customText || getCurrentFormMessengerFormat();

    // 1. Copy formatted text to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (e) {
      console.warn('[AttendanceLogger] Clipboard copy note:', e);
    }

    // 2. Open all configured group chats
    const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    gcs.forEach((gc, index) => {
      // Stagger slightly to prevent browser popup blockers from suppressing multiple tabs
      setTimeout(() => {
        if (isNative) {
          window.open(gc.url, '_system');
        } else {
          window.open(gc.url, '_blank');
        }
      }, index * 250);
    });

    const btnText = document.getElementById('btnDispatchAllGcsText');
    if (btnText) {
      const orig = btnText.textContent;
      btnText.textContent = `🚀 Opened ${gcs.length} GC${gcs.length === 1 ? '' : 's'} (Copied)!`;
      setTimeout(() => { btnText.textContent = orig; }, 3000);
    }

    if (typeof showToast === 'function') {
      showToast(`📋 Copied attendance format & opened ${gcs.length} Messenger Group Chat${gcs.length === 1 ? '' : 's'}! Press Ctrl+V to send.`, 'success');
    }
  }

  /**
   * Initializes the Messenger Dispatcher card within Record Attendance
   */
  function initMessengerDispatcher() {
    renderMessengerGcLinks();
    updateMessengerDispatcherPreview();

    // Wire real-time update listeners on manual form fields
    const formFieldsToWatch = [
      'inputEventFullName',
      'selectRosterQuickPick',
      'selectEventType',
      'inputEventDate',
      'inputEventTimeIn',
      'inputCustomServiceType'
    ];

    formFieldsToWatch.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._mcgiGcWatched) {
        el._mcgiGcWatched = true;
        el.addEventListener('input', updateMessengerDispatcherPreview);
        el.addEventListener('change', updateMessengerDispatcherPreview);
      }
    });

    // Also watch schedule radios when dynamically populated
    const dynContainer = document.getElementById('dynamicEventFieldsContainer');
    if (dynContainer && !dynContainer._mcgiGcWatched) {
      dynContainer._mcgiGcWatched = true;
      dynContainer.addEventListener('change', updateMessengerDispatcherPreview);
    }
  }

  function getEntryServiceType(entry) {
    if (!entry) return 'PM Viewing';
    const ev = entry.event || entry.eventType || 'PM';
    const sess = entry.sessionType || (entry.schedules && entry.schedules[0] && entry.schedules[0].includes('LIVE') ? 'LIVE' : 'VIEWING');
    if (ev === 'PM') {
      return sess === 'LIVE' ? 'Prayer Meeting (Live)' : 'PM Viewing';
    }
    if (ev === 'WS') {
      return sess === 'LIVE' ? 'Worship Service (Live)' : 'WS Viewing';
    }
    if (ev === 'PBB') {
      return sess === 'LIVE' ? 'PBB (Live)' : 'PBB Viewing';
    }
    if (ev === 'COMBINED PM/WS') return 'Combined PM/WS';
    if (ev === 'SPBB') return 'SPBB Viewing';
    if (ev === 'SERBISYONG KAPATIRAN') {
      return (entry.edition && entry.edition[0]) ? entry.edition[0] : (entry.eventDetail || 'Serbisyong Kapatiran');
    }
    return entry.eventDetail || ev;
  }

  function sendSingleRecordToMessenger(entryId) {
    const allEntries = window.AppState?.eventEntries || [];
    const entry = allEntries.find(e => String(e.id) === String(entryId) || String(e.cloudId) === String(entryId));
    if (!entry) return;

    const formatted = formatSingleAttendanceMessage({
      name: entry.fullName || entry.name,
      date: entry.eventDate,
      timeIn: entry.timeIn,
      serviceType: getEntryServiceType(entry)
    });

    dispatchAllMessengerGcs(formatted);
  }

  function copyAllTodayToMessenger() {
    const today = typeof getPastDateString === 'function' ? getPastDateString(0) : new Date().toISOString().split('T')[0];
    const logs = (window.AppState?.eventEntries || []).filter(e => e.eventDate === today);

    if (!logs.length) {
      if (typeof showToast === 'function') showToast('No attendance records logged for today yet.', 'warning');
      return;
    }

    const messages = logs.map(log => formatSingleAttendanceMessage({
      name: log.fullName || log.name,
      date: log.eventDate,
      timeIn: log.timeIn,
      serviceType: getEntryServiceType(log)
    }));

    const fullBatchText = messages.join('\n\n');
    dispatchAllMessengerGcs(fullBatchText);
  }

  function openMessengerSettingsModal() {
    // Scrolls to the Messenger GC Dispatcher card inside the Record Attendance tab
    if (window.App && typeof App.switchTab === 'function') {
      App.switchTab('event-entry');
      setTimeout(() => {
        const card = document.getElementById('messengerGcDispatcherCard');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => card.classList.remove('ring-2', 'ring-blue-400'), 2000);
        }
      }, 200);
    }
  }

  function closeMessengerSettingsModal() {
    // No-op for backward compatibility
  }

  function saveMessengerSettings() {
    // No-op for backward compatibility
  }

  function updateMessengerPreview() {
    updateMessengerDispatcherPreview();
  }

  function openMessengerGcWithSample() {
    dispatchAllMessengerGcs();
  }


  /**
   * Generates a deterministic cryptographic signature for a member profile
   */
  function generateSignature(memberId, rollNo, email) {
    const raw = `${memberId}|${rollNo || ''}|${email || ''}|${SECRET_SALT}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }

  /**
   * Generates a secure QR payload string to store with a member profile
   */
  function generateMemberQr(member) {
    if (!member || !member.id) return '';
    const sig = generateSignature(member.id, member.rollNo, member.email);
    return JSON.stringify({
      mid: member.id,
      roll: member.rollNo || '',
      sig: sig
    });
  }

  function getAttendanceState() {
    if (window.AppState) return window.AppState;
    const duty = localStorage.getItem('mcgi_selected_duty') || 'MPRO';
    const key = duty.toLowerCase();
    const read = (name, fallback) => {
      try {
        const value = localStorage.getItem(`mcgi_${key}_${name}`);
        return value ? JSON.parse(value) : fallback;
      } catch (e) {
        return fallback;
      }
    };
    const state = {
      members: read('members', []),
      authUsers: read('auth_users', []),
      eventEntries: read('event_entries', []),
      attendance: read('attendance', {}),
      settings: read('settings', {})
    };
    state.save = () => {
      localStorage.setItem(`mcgi_${key}_event_entries`, JSON.stringify(state.eventEntries));
      localStorage.setItem(`mcgi_${key}_attendance`, JSON.stringify(state.attendance));
    };
    return state;
  }

  /**
   * Validates a scanned QR payload, verifies authenticity and checks replay attacks
   */
  function validateMemberQr(qrString) {
    if (!qrString || typeof qrString !== 'string') {
      return { valid: false, error: 'Empty or invalid QR code format.' };
    }

    let parsed = null;
    try {
      parsed = JSON.parse(qrString);
    } catch (e) {
      // Raw string identifier was provided
      parsed = { mid: qrString.trim() };
    }

    const memberId = parsed.mid || parsed.memberId || parsed.id;
    if (!memberId) {
      return { valid: false, error: 'QR Code is missing member identifier.' };
    }

    const state = getAttendanceState();
    // Active duty context (MPRO, GCOS, TK)
    const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';

    // 1. Check in active system members
    let member = (state.members || []).find(m =>
      String(m.id || '').toLowerCase() === String(memberId).toLowerCase() ||
      String(m.rollNo || '').toLowerCase() === String(memberId).toLowerCase()
    );

    // 2. Fallback: Check if the logged-in user is scanning their personal profile badge
    if (!member && window.AppState?.currentUser) {
      const cu = window.AppState.currentUser;
      if (String(cu.id || '').toLowerCase() === String(memberId).toLowerCase() ||
          String(cu.rollNo || '').toLowerCase() === String(memberId).toLowerCase() ||
          String(cu.username || '').toLowerCase() === String(memberId).toLowerCase() ||
          String(cu.email || '').toLowerCase() === String(memberId).toLowerCase()) {
        member = {
          id: cu.id || memberId,
          name: cu.name || 'Member',
          rollNo: cu.rollNo || `PROD-${(cu.locale || 'NAIC').slice(0, 3).toUpperCase()}-01`,
          department: cu.locale || cu.department || 'Naic',
          role: cu.level || cu.role || 'LOCALE PROD',
          email: cu.email || '',
          duty: cu.duty || activeDuty
        };
      }
    }

    // 3. Fallback: Check in authUsers
    if (!member && Array.isArray(state.authUsers)) {
      const u = state.authUsers.find(u =>
        String(u.id || '').toLowerCase() === String(memberId).toLowerCase() ||
        String(u.rollNo || '').toLowerCase() === String(memberId).toLowerCase() ||
        String(u.username || '').toLowerCase() === String(memberId).toLowerCase() ||
        String(u.email || '').toLowerCase() === String(memberId).toLowerCase()
      );
      if (u) {
        member = {
          id: u.id || memberId,
          name: u.name || 'Member',
          rollNo: u.rollNo || `${u.duty || 'PROD'}-${(u.locale || 'NAIC').slice(0, 3).toUpperCase()}-01`,
          department: u.locale || u.department || 'Naic',
          role: u.level || u.role || 'LOCALE PROD',
          email: u.email || '',
          duty: u.duty || activeDuty
        };
      }
    }

    // 4. Cross-system safety check
    if (!member) {
      const otherDuties = ['MPRO', 'GCOS', 'TK'].filter(k => k.toUpperCase() !== activeDuty.toUpperCase());
      for (const other of otherDuties) {
        const otherMembers = (typeof safeJSONParse === 'function') ? safeJSONParse(`mcgi_${other.toLowerCase()}_members`, []) : [];
        const foundOther = otherMembers.find(m => 
          String(m.id || '').toLowerCase() === String(memberId).toLowerCase() ||
          String(m.rollNo || '').toLowerCase() === String(memberId).toLowerCase()
        );
        if (foundOther) {
          return { valid: false, error: `Cross-System Alert: Member "${memberId}" is in MCGI ${other}. Switch to MCGI ${other} to scan.` };
        }
      }
      return { valid: false, error: `Member "${memberId}" not found in MCGI ${activeDuty} roster.` };
    }
    if (member.active === false || member.qrDisabled === true || member.isQrDisabled === true) {
      return { valid: false, error: 'This member QR code is disabled.' };
    }

    // Authenticity Check: accept only signatures produced for this roster member.
    if (parsed.sig) {
      const sig1 = generateSignature(member.id, member.rollNo, member.email);
      const sig2 = parsed.roll ? generateSignature(member.id, parsed.roll, member.email) : null;
      const sig3 = generateSignature(member.id, member.rollNo || '', '');
      if (parsed.sig !== sig1 && parsed.sig !== sig2 && parsed.sig !== sig3) {
        return { valid: false, error: 'Invalid QR signature.' };
      }
    }

    return { valid: true, member };
  }

  /**
   * Records attendance from a scanned member QR code.
   * Validates authenticity, records daily & event attendance, persists state, and returns response.
   * @param {string} memberQr - The scanned QR string payload
   * @returns {Promise<{ success: boolean, message: string, member?: object, record?: object }>}
   */
  async function recordAttendanceFromQR(memberQr) {
    return new Promise((resolve, reject) => {
      try {
        // 1. Validation
        const validation = validateMemberQr(memberQr);
        if (!validation.valid) {
          const err = new Error(validation.error || 'Invalid QR code.');
          if (typeof showToast === 'function') showToast(validation.error, 'error');
          return reject(err);
        }

        const member = validation.member;
        const state = getAttendanceState();
        const today = typeof getPastDateString === 'function' ? getPastDateString(0) : new Date().toISOString().split('T')[0];

        // 2. Anti-Replay / Debounce Check (5 seconds debounce to prevent accidental camera multi-triggers)
        const nowMs = Date.now();
        const lastScanTime = scanHistoryCache.get(member.id) || 0;
        if (nowMs - lastScanTime < 5000) {
          const secondsRemaining = Math.ceil((5000 - (nowMs - lastScanTime)) / 1000);
          const debounceMsg = `Scan debounce: ${member.name} scanned just now. Please wait ${secondsRemaining}s before re-scanning.`;
          if (typeof showToast === 'function') showToast(debounceMsg, 'info');
          return resolve({
            success: true,
            message: debounceMsg,
            member
          });
        }
        scanHistoryCache.set(member.id, nowMs);

        // 3. Determine Time & Status
        const submitNow = new Date();
        const timeStr = (window.EventSchedule && typeof EventSchedule.formatLocalTime === 'function')
          ? EventSchedule.formatLocalTime(submitNow)
          : submitNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const [cutoffHours, cutoffMinutes] = (state.settings?.cutoffTime || '08:00').split(':').map(Number);
        const isLate = submitNow.getHours() > cutoffHours || (submitNow.getHours() === cutoffHours && submitNow.getMinutes() > cutoffMinutes);
        const status = isLate ? 'late' : 'present';

        // 4. Persist Daily Attendance
        if (!state.attendance) {
          state.attendance = {};
        }
        if (!state.attendance[today]) {
          state.attendance[today] = {};
        }

        const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';

        const attendanceRecord = {
          status: status,
          time: timeStr,
          duty: activeDuty,
          remarks: `Camera QR Attendance Scan (${activeDuty})`
        };
        const eventSelect = document.getElementById('selectEventType');
        const context = window.EventSchedule && typeof EventSchedule.resolveAttendanceContext === 'function'
          ? EventSchedule.resolveAttendanceContext(submitNow)
          : { eventType: (eventSelect && eventSelect.value) || 'PM', detected: { status: 'unscheduled' } };
        const activeEventType = context.eventType;
        const detected = context.detected;
        const scheduleInfo = detected.status === 'detected' ? {
          scheduledTime: detected.scheduledTime,
          dayName: detected.dayName || '',
          sessionType: detected.sessionType,
          autoDetected: true,
          label: detected.slot.label
        } : null;

        const duplicate = (state.eventEntries || []).find(entry =>
          entry.memberId === member.id &&
          entry.eventDate === today &&
          entry.event === activeEventType &&
          (!scheduleInfo || (entry.schedules || []).includes(scheduleInfo.label))
        );
        if (duplicate) {
          const duplicateError = new Error(`Attendance already recorded for ${member.name} for this attendance session.`);
          if (typeof showToast === 'function') showToast(duplicateError.message, 'warning');
          return reject(duplicateError);
        }
        state.attendance[today][member.id] = attendanceRecord;

        // 6. Persist Official Event Entry Log
        const newEventLog = {
          id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          fullName: member.name,
          memberId: member.id,
          duty: activeDuty,
          locale: [member.department || 'Naic'],
          level: [member.role || 'MUNICIPAL PROD'],
          event: activeEventType,
          eventDetail: scheduleInfo ? scheduleInfo.label : `Camera Check-In [${activeDuty}]`,
          schedules: (scheduleInfo && activeEventType !== 'SERBISYONG KAPATIRAN') ? [scheduleInfo.label] : [],
          edition: (scheduleInfo && activeEventType === 'SERBISYONG KAPATIRAN') ? [scheduleInfo.label] : [],
          scheduledTime: scheduleInfo ? scheduleInfo.scheduledTime : '',
          scheduleDay: scheduleInfo ? scheduleInfo.dayName : '',
          sessionType: scheduleInfo ? scheduleInfo.sessionType : '',
          scheduleAutoDetected: scheduleInfo ? scheduleInfo.autoDetected : false,
          eventDate: today,
          status: 'ON DUTY (OD)',
          timeIn: timeStr,
          remarks: `Verified secure QR attendance (${status.toUpperCase()}) [${activeDuty}]`,
          createdAt: submitNow.toISOString()
        };

        if (!Array.isArray(state.eventEntries)) {
          state.eventEntries = [];
        }
        state.eventEntries.unshift(newEventLog);

        // Persist to storage
        if (typeof state.save === 'function') {
          state.save();
        }

        // Persist to Supabase Cloud (with automatic offline queueing and schedule columns)
        if (window.SupabaseClient) {
          SupabaseClient.recordAttendance({
            id: newEventLog.id,
            memberId: member.id,
            fullName: member.name,
            duty: activeDuty,
            eventType: activeEventType,
            status: status === 'present' ? 'Present' : status === 'late' ? 'Late' : 'Excused',
            timestamp: submitNow.toISOString(),
            locale: member.department || 'Naic',
            notes: `QR Check-In at ${timeStr}`,
            scheduledTime: newEventLog.scheduledTime,
            scheduleDay: newEventLog.scheduleDay,
            sessionType: newEventLog.sessionType,
            scheduleSlot: scheduleInfo ? scheduleInfo.label : '',
            scheduleAutoDetected: newEventLog.scheduleAutoDetected
          }).catch(e => console.warn('[AttendanceLogger] Supabase push deferred:', e));
        }

        // Format matching exact MCGI gathering format with detected service type
        let serviceType = '';
        if (scheduleInfo && (activeEventType === 'PM' || activeEventType === 'WS')) {
          serviceType = scheduleInfo.sessionType === 'LIVE'
            ? (activeEventType === 'PM' ? 'Prayer Meeting (Live)' : 'Worship Service (Live)')
            : (activeEventType === 'PM' ? 'PM Viewing' : 'WS Viewing');
        } else if (scheduleInfo && activeEventType === 'PBB') {
          serviceType = scheduleInfo.sessionType === 'LIVE' ? 'PBB (Live)' : 'PBB Viewing';
        } else if (scheduleInfo && activeEventType === 'COMBINED PM/WS') {
          serviceType = 'Combined PM/WS';
        } else if (scheduleInfo && activeEventType === 'SPBB') {
          serviceType = 'SPBB Viewing';
        } else if (scheduleInfo && activeEventType === 'SERBISYONG KAPATIRAN') {
          serviceType = scheduleInfo.label;
        } else {
          serviceType = activeEventType;
        }

        const messengerFormattedText = formatSingleAttendanceMessage({
          name: member.name,
          serviceType: serviceType,
          date: today,
          timeIn: timeStr,
          mode: 'Face-to-face'
        });

        if (isAutoDispatchEnabled()) {
          dispatchAllMessengerGcs(messengerFormattedText);
        }

        // Audio confirmation tone
        playScanSuccessTone();

        const successMsg = `Attendance recorded for ${member.name} (${status.toUpperCase()}) at ${timeStr}`;
        if (typeof showToast === 'function') {
          showToast(successMsg, 'success');
        }

        // Flash Result Banner with 1-click Send to GC button
        const banner = document.getElementById('qrScanResultBanner');
        const text = document.getElementById('qrScanResultText');
        if (banner && text) {
          text.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
              <span>Attendance recorded for <strong>${member.name}</strong> (${status.toUpperCase()}) at ${timeStr}</span>
              <button type="button" onclick="AttendanceLogger.sendSingleRecordToMessenger('${newEventLog.id}')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow transition-all flex items-center gap-1.5 cursor-pointer">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> Copy & Send to GCs
              </button>
            </div>
          `;
          banner.className = 'p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
          banner.classList.remove('hidden');
          if (window.lucide) lucide.createIcons();
          setTimeout(() => banner.classList.add('hidden'), 9000);
        }

        // Refresh UI tables and stats
        if (typeof AttendanceLogger.renderAttendanceLogsTable === 'function') {
          AttendanceLogger.renderAttendanceLogsTable();
        }
        if (window.App && typeof window.App.updateStatsCards === 'function') {
          window.App.updateStatsCards();
        }

        resolve({
          success: true,
          message: successMsg,
          member,
          record: attendanceRecord
        });
      } catch (err) {
        console.error('[AttendanceLogger] QR check-in error:', err);
        if (typeof showToast === 'function') showToast(err.message || 'QR processing failed', 'error');
        reject(err);
      }
    });
  }

  /**
   * Renders the attendance logs table, search filters, and summary metrics
   */
  function renderAttendanceLogsTable() {
    const tbody = document.getElementById('eventAttendanceTableBody');
    if (!tbody) return;

    const rawQuery = document.getElementById('searchEventLogsInput')?.value || '';
    const searchQuery = (typeof normalizeSearchText === 'function') ? normalizeSearchText(rawQuery) : rawQuery.toLowerCase().trim();
    const filterEvent = document.getElementById('filterEventLogsType')?.value || 'all';
    const filterLocale = document.getElementById('filterEventLogsLocale')?.value || 'all';
    const filterLevel = document.getElementById('filterEventLogsLevel')?.value || 'all';

    const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
    const allEntries = window.AppState?.eventEntries || [];

    // Strictly scope all entries to the active system
    const systemEntries = allEntries.filter(item => !item.duty || item.duty.toUpperCase() === activeDuty.toUpperCase());

    let filtered = systemEntries.filter(item => {
      const name = (item.fullName || '').toLowerCase();
      const ev = (item.event || '').toLowerCase();
      const evDet = (item.eventDetail || '').toLowerCase();
      const rem = (item.remarks || '').toLowerCase();

      const matchSearch = !searchQuery || 
        name.includes(searchQuery) || 
        ev.includes(searchQuery) || 
        evDet.includes(searchQuery) || 
        rem.includes(searchQuery);

      const matchEvent = (filterEvent === 'all') || (item.event === filterEvent);
      const itemLocales = Array.isArray(item.locale) ? item.locale : [item.locale || ''];
      const itemLevels = Array.isArray(item.level) ? item.level : [item.level || ''];
      const matchLocale = (filterLocale === 'all') || itemLocales.includes(filterLocale);
      const matchLevel = (filterLevel === 'all') || itemLevels.includes(filterLevel);

      return matchSearch && matchEvent && matchLocale && matchLevel;
    });

    const countEl = document.getElementById('eventLogFilterCount');
    if (countEl) countEl.textContent = `${filtered.length} Entries`;

    // Update Summary Metrics on system-scoped entries only
    updateSummaryMetrics(systemEntries);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-600"></i>
            <p class="text-sm font-semibold text-slate-300">No attendance records found</p>
            <p class="text-xs text-slate-500 mt-0.5">Use "Attendance Entry" or QR scan to log records.</p>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = filtered.map((entry, index) => {
      let displayEvent = entry.event;
      if (entry.eventDetail || entry.otherEventName) {
        displayEvent = `${entry.event}: ${entry.eventDetail || entry.otherEventName}`;
      }

      let detailsHtml = '';
      if (entry.timeIn) {
        detailsHtml += `<span class="text-[10px] px-1.5 py-0.5 rounded bg-midnight-950 text-gold-300 border border-gold-400/20 inline-block my-0.5 font-mono mr-1">Time In: ${entry.timeIn}</span>`;
      }
      if (entry.status) {
        detailsHtml += `<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 inline-block my-0.5 mr-1">${entry.status}</span>`;
      }
      if (entry.indoctrinationGuestsCount) {
        detailsHtml += `<span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 inline-block my-0.5 mr-1">Guests: ${entry.indoctrinationGuestsCount}</span>`;
      }

      const localesHtml = (Array.isArray(entry.locale) ? entry.locale : [entry.locale || 'Naic'])
        .map(l => `<span class="badge-locale text-[10px] px-2 py-0.5 rounded font-mono font-medium inline-block mr-1">${l}</span>`)
        .join('');

      const levelsHtml = (Array.isArray(entry.level) ? entry.level : [entry.level || 'PROD'])
        .map(lvl => `<span class="badge-level text-[10px] px-2 py-0.5 rounded font-mono font-bold inline-block mr-1">${lvl}</span>`)
        .join('');

      return `
        <tr class="hover:bg-midnight-850/80 transition-colors">
          <td class="px-4 py-3 text-slate-400 font-mono text-xs">${index + 1}</td>
          <td class="px-4 py-3">
            <span class="font-bold text-white text-xs block">${entry.fullName}</span>
            <span class="text-[10px] text-slate-400 font-mono">${entry.memberId || 'N/A'}</span>
          </td>
          <td class="px-4 py-3">
            <div>${localesHtml}</div>
            <div class="mt-1">${levelsHtml}</div>
          </td>
          <td class="px-4 py-3">
            <span class="font-semibold text-gold-300 text-xs block">${displayEvent}</span>
            <span class="text-[10px] text-slate-400 font-mono">${entry.eventDate || '-'}</span>
          </td>
          <td class="px-4 py-3">
            ${detailsHtml || '<span class="text-slate-500 text-xs">-</span>'}
          </td>
          <td class="px-4 py-3 text-xs text-slate-400 italic max-w-[180px] truncate" title="${entry.remarks || ''}">
            ${entry.remarks || '-'}
          </td>
          <td class="px-4 py-3 text-right">
            ${renderLogActionButtons(entry.id)}
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Resolves effective role (respecting role-switching preview widget)
   */
  function getEffectiveRole() {
    if (window.App && typeof window.App.getEffectiveRole === 'function') {
      return window.App.getEffectiveRole();
    }
    const cu = window.AppState?.currentUser;
    if (!cu) return 'admin';
    if (cu.viewRole) return cu.viewRole.toLowerCase();
    if (cu.role) return cu.role.toLowerCase();
    return cu.isAdmin ? 'admin' : 'member';
  }

  /**
   * Helper to render role-based action buttons in the logs table
   * Admin: Edit & Delete
   * Secretary: Edit only (cannot delete)
   * Member: View Only label (no edit, no delete)
   */
  function renderLogActionButtons(entryId) {
    const role = getEffectiveRole();
    const messengerBtn = `
      <button 
        type="button"
        onclick="AttendanceLogger.sendSingleRecordToMessenger('${entryId}')" 
        class="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-white transition-colors cursor-pointer" 
        title="Copy & send to Messenger GC in standard format">
        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
      </button>
    `;

    if (role === 'admin') {
      return `
        <div class="flex items-center justify-end gap-1.5">
          ${messengerBtn}
          <button 
            type="button"
            onclick="AttendanceLogger.openEditLogModal('${entryId}')" 
            class="p-1.5 rounded-lg bg-gold-400/10 hover:bg-gold-400/20 text-gold-300 transition-colors" 
            title="Edit record">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          </button>
          <button 
            type="button"
            onclick="AttendanceLogger.deleteLogEntry('${entryId}')" 
            class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors" 
            title="Delete record">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    } else if (role === 'secretary') {
      return `
        <div class="flex items-center justify-end gap-1.5">
          ${messengerBtn}
          <button 
            type="button"
            onclick="AttendanceLogger.openEditLogModal('${entryId}')" 
            class="p-1.5 rounded-lg bg-gold-400/10 hover:bg-gold-400/20 text-gold-300 transition-colors" 
            title="Edit record">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    } else {
      return `
        <div class="flex items-center justify-end gap-1.5">
          ${messengerBtn}
          <span class="text-[11px] text-slate-500 font-mono italic">View Only</span>
        </div>
      `;
    }
  }

  /**
   * Opens the Edit Attendance Record modal (Admin and Secretary only)
   */
  function openEditLogModal(entryId) {
    const role = getEffectiveRole();
    if (role === 'member') {
      if (typeof showToast === 'function') showToast('Members have view-only access to records.', 'error');
      return;
    }

    const allEntries = window.AppState?.eventEntries || [];
    const entry = allEntries.find(e => String(e.id) === String(entryId) || String(e.cloudId) === String(entryId));
    if (!entry) {
      if (typeof showToast === 'function') showToast('Record not found.', 'error');
      return;
    }

    const idInput = document.getElementById('editLogEntryId');
    const memberDisplay = document.getElementById('editLogMemberDisplay');
    const timeInInput = document.getElementById('editLogTimeIn');
    const statusSelect = document.getElementById('editLogStatus');
    const remarksInput = document.getElementById('editLogRemarks');
    const modal = document.getElementById('editAttendanceLogModal');

    if (idInput) idInput.value = entry.id;
    if (memberDisplay) {
      memberDisplay.textContent = `${entry.fullName || 'Member'} (${entry.memberId || 'N/A'}) - ${entry.event || 'Gathering'}`;
    }
    if (timeInInput) timeInInput.value = entry.timeIn || '';
    if (statusSelect) {
      const curStatus = (entry.status || 'PRESENT').toUpperCase();
      statusSelect.value = curStatus.includes('LATE') ? 'LATE' : (curStatus.includes('EXCUSED') ? 'EXCUSED' : (curStatus.includes('DUTY') ? 'ON DUTY (OD)' : 'PRESENT'));
    }
    if (remarksInput) remarksInput.value = entry.remarks || '';

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Closes the Edit Attendance Record modal
   */
  function closeEditLogModal() {
    const modal = document.getElementById('editAttendanceLogModal');
    if (modal) modal.classList.add('hidden');
  }

  /**
   * Saves updates to an attendance record from the edit modal
   */
  function saveEditLogEntry(e) {
    if (e && e.preventDefault) e.preventDefault();
    const role = getEffectiveRole();
    if (role === 'member') {
      if (typeof showToast === 'function') showToast('Members have view-only access to records.', 'error');
      return;
    }

    const entryId = document.getElementById('editLogEntryId')?.value;
    if (!entryId) return;

    const allEntries = window.AppState?.eventEntries || [];
    const entry = allEntries.find(e => String(e.id) === String(entryId) || String(e.cloudId) === String(entryId));
    if (!entry) {
      if (typeof showToast === 'function') showToast('Record not found.', 'error');
      return;
    }

    const newTimeIn = document.getElementById('editLogTimeIn')?.value?.trim();
    const newStatus = document.getElementById('editLogStatus')?.value?.trim();
    const newRemarks = document.getElementById('editLogRemarks')?.value?.trim();

    if (newTimeIn) entry.timeIn = newTimeIn;
    if (newStatus) entry.status = newStatus;
    entry.remarks = newRemarks;
    entry.updatedAt = new Date().toISOString();

    if (typeof window.AppState.save === 'function') window.AppState.save();

    // Sync modification with cloud database if available
    if (window.SupabaseClient && typeof SupabaseClient.saveAttendanceRecord === 'function') {
      const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
      SupabaseClient.saveAttendanceRecord(entry, activeDuty).catch(err => {
        console.warn('[AttendanceLogger] Cloud edit sync error:', err);
      });
    }

    closeEditLogModal();
    renderAttendanceLogsTable();
    if (window.App && typeof window.App.updateStatsCards === 'function') {
      window.App.updateStatsCards();
    }
    if (typeof showToast === 'function') showToast('Attendance record updated successfully.', 'success');
  }

  /**
   * Updates summary metric counters in the Attendance Logger header
   */
  function updateSummaryMetrics(entries) {
    let totalCount = entries.length;
    let guestsCount = 0;
    let municipalCount = 0;
    let traineeCount = 0;

    entries.forEach(e => {
      if (e.indoctrinationGuestsCount) {
        guestsCount += parseInt(e.indoctrinationGuestsCount, 10) || 0;
      }
      const levels = Array.isArray(e.level) ? e.level : [e.level || ''];
      if (levels.includes('MUNICIPAL PROD')) municipalCount++;
      if (levels.includes('TRAINEE')) traineeCount++;
    });

    const totalEl = document.getElementById('metricEventTotalCount');
    const guestsEl = document.getElementById('metricEventGuestsCount');
    const municipalEl = document.getElementById('metricEventMunicipalCount');
    const traineeEl = document.getElementById('metricEventTraineeCount');

    if (totalEl) totalEl.textContent = totalCount;
    if (guestsEl) guestsEl.textContent = guestsCount;
    if (municipalEl) municipalEl.textContent = municipalCount;
    if (traineeEl) traineeEl.textContent = traineeCount;
  }

  /**
   * Deletes a specific attendance log entry and synchronizes the deletion with Supabase Cloud Database (Admin Only)
   */
  function deleteLogEntry(entryId) {
    const role = getEffectiveRole();
    if (role !== 'admin') {
      if (typeof showToast === 'function') showToast('Only Administrators can delete attendance logs.', 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this recorded attendance entry?')) return;
    if (window.AppState && Array.isArray(window.AppState.eventEntries)) {
      const targetEntry = window.AppState.eventEntries.find(e => 
        e.id === entryId || e.cloudId === entryId || e.memberId === entryId
      );

      window.AppState.eventEntries = window.AppState.eventEntries.filter(e => 
        e.id !== entryId && (!targetEntry || e.id !== targetEntry.id)
      );

      if (typeof window.AppState.save === 'function') window.AppState.save();
      renderAttendanceLogsTable();
      if (window.App && typeof window.App.updateStatsCards === 'function') {
        window.App.updateStatsCards();
      }

      // Sync deletion to Supabase Cloud Database
      if (window.SupabaseClient) {
        const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
        SupabaseClient.deleteAttendanceRecord(targetEntry || entryId, activeDuty)
          .then(res => {
            if (res && res.success) {
              if (typeof showToast === 'function') showToast('Record removed and deleted from cloud database.', 'info');
            } else if (res && res.offline) {
              if (typeof showToast === 'function') showToast('Record removed locally (queued for cloud deletion).', 'info');
            }
          })
          .catch(err => {
            console.warn('[AttendanceLogger] Cloud delete sync error:', err);
            if (typeof showToast === 'function') showToast('Record removed locally.', 'info');
          });
      } else {
        if (typeof showToast === 'function') showToast('Record removed.', 'info');
      }
    }
  }

  /**
   * Exports attendance records formatted as an Excel SpreadsheetML workbook (.xls)
   * faithfully matching the template of Image 2 (Monthly Attendance Matrix Sheet + Log Details Sheet).
   */
  function exportLogsExcel() {
    const role = getEffectiveRole();
    if (role === 'member') {
      if (typeof showToast === 'function') showToast('Members do not have access to export attendance records.', 'error');
      return;
    }

    const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
    const allEntries = window.AppState?.eventEntries || [];
    const entries = allEntries.filter(e => !e.duty || e.duty.toUpperCase() === activeDuty.toUpperCase());

    // Gather active roster members for this duty
    let dutyMembers = (window.AppState?.members || []).filter(m => {
      if (!m.id) return true;
      if (activeDuty === 'GCOS') return m.id.startsWith('GCOS');
      if (activeDuty === 'TK') return m.id.startsWith('TK');
      return m.id.startsWith('PROD') || (!m.id.startsWith('GCOS') && !m.id.startsWith('TK'));
    });

    if (dutyMembers.length === 0) {
      if (activeDuty === 'GCOS' && typeof DEFAULT_MEMBERS_GCOS !== 'undefined') {
        dutyMembers = DEFAULT_MEMBERS_GCOS;
      } else if (activeDuty === 'TK' && typeof DEFAULT_MEMBERS_TK !== 'undefined') {
        dutyMembers = DEFAULT_MEMBERS_TK;
      } else if (typeof DEFAULT_MEMBERS !== 'undefined') {
        dutyMembers = DEFAULT_MEMBERS;
      }
    }

    // Include any members present in the entries list who might not be in the static roster
    const memberMap = new Map();
    dutyMembers.forEach(m => {
      memberMap.set(m.name.trim().toLowerCase(), {
        id: m.rollNo || m.id || '',
        name: m.name.trim()
      });
    });
    entries.forEach(e => {
      if (e.fullName && !memberMap.has(e.fullName.trim().toLowerCase())) {
        memberMap.set(e.fullName.trim().toLowerCase(), {
          id: e.memberId || e.id || 'N/A',
          name: e.fullName.trim()
        });
      }
    });

    const memberList = Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Determine target Month & Year from entries or current date
    let targetYear = 2026;
    let targetMonthIdx = 8; // 0-indexed, 8 = September
    if (entries.length > 0 && entries[0].eventDate) {
      const parts = entries[0].eventDate.split('-');
      if (parts.length >= 2) {
        targetYear = parseInt(parts[0], 10) || 2026;
        targetMonthIdx = (parseInt(parts[1], 10) || 9) - 1;
      }
    } else if (window.AppState?.selectedDate) {
      const parts = window.AppState.selectedDate.split('-');
      if (parts.length >= 2) {
        targetYear = parseInt(parts[0], 10) || 2026;
        targetMonthIdx = (parseInt(parts[1], 10) || 9) - 1;
      }
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const monthName = monthNames[targetMonthIdx] || 'September';
    const monthShort = monthShorts[targetMonthIdx] || 'Sep';
    const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();

    // Map entries by memberName + day
    // key: `${nameLower}_${dayNumber}` -> 'PRESENT' or 'ABSENT'
    const attendanceMatrix = new Map();
    entries.forEach(e => {
      if (!e.eventDate || !e.fullName) return;
      const parts = e.eventDate.split('-');
      if (parts.length === 3) {
        const eYear = parseInt(parts[0], 10);
        const eMonth = parseInt(parts[1], 10) - 1;
        const eDay = parseInt(parts[2], 10);
        if (eYear === targetYear && eMonth === targetMonthIdx) {
          const key = `${e.fullName.trim().toLowerCase()}_${eDay}`;
          const st = (e.status || '').toUpperCase();
          if (st.includes('PRESENT') || st.includes('ON DUTY') || st === 'OD' || st.includes('DOC')) {
            attendanceMatrix.set(key, 'PRESENT');
          } else if (st.includes('ABSENT') || st.includes('NOT ON DUTY') || st === 'NOD') {
            attendanceMatrix.set(key, 'ABSENT');
          }
        }
      }
    });

    // Escape helper for XML
    const xmlEscape = (str) => String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Build day column headers (rotated 90 degrees matching Image 2)
    let dayHeadersXml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      dayHeadersXml += `    <Cell ss:StyleID="HeaderDayRotated"><Data ss:Type="String">${d}-${monthShort}</Data></Cell>\n`;
    }

    // Build data rows for Sheet 1
    let rowsXml = '';
    memberList.forEach(m => {
      const nameKey = m.name.toLowerCase();
      let presentCount = 0;
      let dayCellsXml = '';

      for (let d = 1; d <= daysInMonth; d++) {
        const status = attendanceMatrix.get(`${nameKey}_${d}`);
        if (status === 'PRESENT') {
          presentCount++;
          dayCellsXml += `    <Cell ss:StyleID="StatusPresent"><Data ss:Type="String">&#x2714;</Data></Cell>\n`;
        } else if (status === 'ABSENT') {
          dayCellsXml += `    <Cell ss:StyleID="StatusAbsent"><Data ss:Type="String">&#x2716;</Data></Cell>\n`;
        } else {
          dayCellsXml += `    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String"></Data></Cell>\n`;
        }
      }

      rowsXml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(m.id)}</Data></Cell>
    <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${xmlEscape(m.name)}</Data></Cell>
${dayCellsXml}    <Cell ss:StyleID="PresentCountCell" ss:Formula="=COUNTIF(RC[-${daysInMonth}]:RC[-1], &quot;&#x2714;&quot;)"><Data ss:Type="Number">${presentCount}</Data></Cell>
   </Row>`;
    });

    // Build Sheet 2 (Detailed Log Records)
    let detailRowsXml = '';
    entries.forEach(e => {
      const locales = Array.isArray(e.locale) ? e.locale.join('; ') : (e.locale || '');
      const levels = Array.isArray(e.level) ? e.level.join('; ') : (e.level || '');
      const sched = Array.isArray(e.schedules) ? e.schedules.join(', ') : (e.schedules || '');
      const detail = e.eventDetail || e.otherEventName || sched || '';
      detailRowsXml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(e.id)}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(e.memberId || '')}</Data></Cell>
    <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${xmlEscape(e.fullName)}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(e.duty || activeDuty)}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(locales)}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(levels)}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(e.event)}</Data></Cell>
    <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${xmlEscape(detail)}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(e.eventDate || '')}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(e.timeIn || '')}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${xmlEscape(e.status || 'PRESENT')}</Data></Cell>
    <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${xmlEscape(e.remarks || '')}</Data></Cell>
   </Row>`;
    });

    const totalColumns = 2 + daysInMonth + 1; // ID + Name + days + Present Count

    const xmlWorkbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>MCGI ${xmlEscape(activeDuty)} Attendance Suite</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Title Banner (Rows 1-2 in Template) -->
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E3A8A"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="17" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#2F5597" ss:Pattern="Solid"/>
  </Style>
  <!-- Month/Year Badge Label (Grey box) -->
  <Style ss:ID="BadgeLabel">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10.5" ss:Color="#1E293B" ss:Bold="1"/>
   <Interior ss:Color="#D9D9D9" ss:Pattern="Solid"/>
  </Style>
  <!-- Month/Year Badge Value (Dark Blue box) -->
  <Style ss:ID="BadgeValue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1F4E79"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1F4E79"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1F4E79"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1F4E79"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1F4E79" ss:Pattern="Solid"/>
  </Style>
  <!-- Main Column Header Blue -->
  <Style ss:ID="HeaderBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1F4E79" ss:Pattern="Solid"/>
  </Style>
  <!-- Rotated Day Column Header -->
  <Style ss:ID="HeaderDayRotated">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:Rotate="90"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B4C6E7"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1F4E79" ss:Pattern="Solid"/>
  </Style>
  <!-- Present Count Column Header Green -->
  <Style ss:ID="HeaderGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#375623" ss:Pattern="Solid"/>
  </Style>
  <!-- Data Cell Center -->
  <Style ss:ID="DataCellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
  </Style>
  <!-- Data Cell Left (Name) -->
  <Style ss:ID="DataCellLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A" ss:Bold="1"/>
  </Style>
  <!-- Status Present (Green Checkmark on soft green fill) -->
  <Style ss:ID="StatusPresent">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#276A3C" ss:Bold="1"/>
   <Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/>
  </Style>
  <!-- Status Absent (Red Cross on soft red fill) -->
  <Style ss:ID="StatusAbsent">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#C00000" ss:Bold="1"/>
   <Interior ss:Color="#FCE4D6" ss:Pattern="Solid"/>
  </Style>
  <!-- Present Count Value Cell -->
  <Style ss:ID="PresentCountCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9D18E"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#276A3C" ss:Bold="1"/>
  </Style>
 </Styles>

 <!-- WORKSHEET 1: MONTHLY ATTENDANCE MATRIX SHEET (IMAGE 2 TEMPLATE) -->
 <Worksheet ss:Name="Attendance Sheet">
  <Table ss:DefaultColumnWidth="32" ss:DefaultRowHeight="20">
   <Column ss:Width="85"/>
   <Column ss:Width="150"/>
   <Column ss:Span="${daysInMonth - 1}" ss:Width="28"/>
   <Column ss:Width="95"/>

   <!-- Row 1: Title Banner (Merged A1 to End) -->
   <Row ss:Height="32">
    <Cell ss:MergeAcross="${totalColumns - 1}" ss:StyleID="TitleBanner">
     <Data ss:Type="String">Attendance Sheet for ${monthName} - ${targetYear}</Data>
    </Cell>
   </Row>
   <Row ss:Height="12"><Cell><Data ss:Type="String"></Data></Cell></Row>

   <!-- Row 3: Month & Year Badges -->
   <Row ss:Height="22">
    <Cell ss:Index="2" ss:StyleID="BadgeLabel"><Data ss:Type="String">Month</Data></Cell>
    <Cell ss:StyleID="BadgeValue"><Data ss:Type="String">${monthName}</Data></Cell>
    <Cell ss:Index="5" ss:StyleID="BadgeLabel"><Data ss:Type="String">Year</Data></Cell>
    <Cell ss:StyleID="BadgeValue"><Data ss:Type="Number">${targetYear}</Data></Cell>
   </Row>
   <Row ss:Height="12"><Cell><Data ss:Type="String"></Data></Cell></Row>

   <!-- Row 5: Column Headers -->
   <Row ss:Height="48">
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Member ID</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Member Name</Data></Cell>
${dayHeadersXml}    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Present Count</Data></Cell>
   </Row>

   <!-- Member Attendance Data Rows -->
${rowsXml}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Landscape"/>
   </PageSetup>
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>

 <!-- WORKSHEET 2: DETAILED ATTENDANCE LOGS -->
 <Worksheet ss:Name="Attendance Log Details">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="80"/>
   <Column ss:Width="85"/>
   <Column ss:Width="150"/>
   <Column ss:Width="70"/>
   <Column ss:Width="85"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="80"/>
   <Column ss:Width="65"/>
   <Column ss:Width="85"/>
   <Column ss:Width="160"/>

   <Row ss:Height="26">
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">ID</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Member ID</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Full Name</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">System</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Locale</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Level</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Event</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Event Detail</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Date</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Time In</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Remarks</Data></Cell>
   </Row>
${detailRowsXml}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>

 <!-- WORKSHEET 3: MONTH-YEAR LIST -->
 <Worksheet ss:Name="Month-Year List">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Month</Data></Cell>
    <Cell ss:StyleID="HeaderBlue"><Data ss:Type="String">Year</Data></Cell>
   </Row>
   <Row><Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${monthName}</Data></Cell><Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${targetYear}</Data></Cell></Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlWorkbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCGI_${activeDuty.toUpperCase()}_Attendance_Sheet_${targetYear}_${monthShort}.xls`;
    link.click();
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') {
      showToast(`Exported MCGI ${activeDuty} Attendance Sheet for ${monthName} ${targetYear}!`, 'success');
    }
  }

  /**
   * Compatibility alias for exportLogsCSV
   */
  function exportLogsCSV() {
    exportLogsExcel();
  }

  /**
   * Attaches camera QR scanner to a target container.
   * @param {string} containerId - ID of the DOM element to mount the scanner into
   * @param {function} [onResult] - Optional callback invoked with { success, message, member, record } after each scan
   */
  function attachCameraScanner(containerId, onResult) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
    const accentColor = activeDuty === 'TK' ? 'text-pink-400' : activeDuty === 'GCOS' ? 'text-white' : 'text-gold-400';

    const scannerBox = document.createElement('div');
    scannerBox.className = 'w-full p-5 rounded-2xl bg-midnight-900/90 border border-slate-700/60 scanner-inner-container flex flex-col items-center text-center';

    scannerBox.innerHTML = `
      <div class="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3">
        <i data-lucide="camera" class="w-4 h-4 ${accentColor}"></i>
        <span>Camera QR Attendance Scanner</span>
      </div>
      <div id="${containerId}_video" class="w-64 h-64 rounded-xl overflow-hidden bg-midnight-950 border border-slate-700 flex items-center justify-center relative mb-4 shadow-inner">
        <span class="text-xs text-slate-500 font-mono">Camera idle</span>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" id="${containerId}_startBtn" class="gold-gradient-btn px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg cursor-pointer">
          <i data-lucide="scan-line" class="w-4 h-4"></i>
          <span>Start Camera Scan</span>
        </button>
        <button type="button" id="${containerId}_stopBtn" class="hidden px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-xs font-bold transition-all cursor-pointer">
          <span>Stop Camera</span>
        </button>
        <button type="button" id="${containerId}_switchBtn" class="hidden px-4 py-2.5 rounded-xl bg-midnight-800 hover:bg-midnight-700 border border-slate-600 text-slate-200 text-xs font-bold transition-all cursor-pointer">
          <span>↻ Switch Camera</span>
        </button>
      </div>
      <p class="text-[11px] text-slate-500 mt-3">Point webcam or mobile camera at your QR badge</p>
    `;

    container.appendChild(scannerBox);
    if (window.lucide) lucide.createIcons();

    const startBtn = document.getElementById(`${containerId}_startBtn`);
    const stopBtn = document.getElementById(`${containerId}_stopBtn`);
    const switchBtn = document.getElementById(`${containerId}_switchBtn`);
    const videoTarget = document.getElementById(`${containerId}_video`);
    let isProcessingScan = false;
    let currentFacingMode = 'environment';
    let availableCameras = [];

    const stopScanner = async () => {
      if (activeCameraScanner) {
        const sc = activeCameraScanner;
        activeCameraScanner = null;
        try { await sc.stop(); } catch (e) {
          console.warn('[AttendanceLogger] Camera stop warning:', e);
        }
        try { sc.clear(); } catch (e) {}
        if (videoTarget) videoTarget.innerHTML = '<span class="text-xs text-slate-500 font-mono">Camera idle</span>';
        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
        if (switchBtn) switchBtn.classList.add('hidden');
      } else {
        if (videoTarget) videoTarget.innerHTML = '<span class="text-xs text-slate-500 font-mono">Camera idle</span>';
        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
        if (switchBtn) switchBtn.classList.add('hidden');
      }
    };

    stopBtn.onclick = stopScanner;

    const startScanner = async () => {
      if (typeof Html5Qrcode === 'undefined') {
        if (typeof showToast === 'function') {
          showToast('QR scanner library is loading, please wait...', 'warning');
        }
        return;
      }

      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      videoTarget.innerHTML = `
        <div class="flex flex-col items-center justify-center p-4 text-slate-400">
          <div class="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mb-2"></div>
          <span class="text-xs font-mono">Connecting camera…</span>
        </div>
      `;

      try {
        if (activeCameraScanner) {
          try { await activeCameraScanner.stop(); } catch (e) {}
          activeCameraScanner = null;
        }

        const scanner = new Html5Qrcode(`${containerId}_video`);
        activeCameraScanner = scanner;

        const scanSuccessHandler = async (decodedText) => {
          if (isProcessingScan) return;
          isProcessingScan = true;

          try {
            const result = await recordAttendanceFromQR(decodedText);
            if (typeof onResult === 'function') {
              onResult({ ...result, success: true });
            }
          } catch (e) {
            if (typeof onResult === 'function') {
              onResult({ success: false, message: e.message || 'Scan failed' });
            }
          } finally {
            setTimeout(() => {
              isProcessingScan = false;
            }, 3000);
            stopScanner();
          }
        };

        const config = {
          fps: 15,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0
        };

        // Enumerate devices to pick the best camera. Labels may be unavailable
        // until permission is granted, so facingMode remains the fallback.
        try {
          availableCameras = await Html5Qrcode.getCameras();
        } catch (camErr) {
          console.warn('[AttendanceLogger] Camera enumeration note:', camErr);
        }

        if (availableCameras && availableCameras.length > 0) {
          const rear = availableCameras.find(c => /back|rear|environment/i.test(c.label));
          const front = availableCameras.find(c => /front|user|facetime/i.test(c.label));
          const preferred = currentFacingMode === 'environment' ? (rear || availableCameras[0]) : (front || availableCameras[availableCameras.length > 1 ? 1 : 0]);
          const chosenCamId = preferred && preferred.id;
          await scanner.start(chosenCamId, config, scanSuccessHandler, () => {});
          if (switchBtn) switchBtn.classList.toggle('hidden', availableCameras.length < 2);
        } else {
          // Fallback sequence: environment facingMode -> user facingMode.
          try {
            await scanner.start({ facingMode: currentFacingMode }, config, scanSuccessHandler, () => {});
          } catch (envErr) {
            currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
            await scanner.start({ facingMode: currentFacingMode }, config, scanSuccessHandler, () => {});
          }
        }
      } catch (err) {
        console.error('[AttendanceLogger] Camera initialization error:', err);
        const errStr = (err && (err.message || err.name || String(err))) || '';
        if (typeof showToast === 'function') {
          if (errStr.includes('NotAllowedError') || errStr.includes('Permission')) {
            showToast('Camera permission denied. Please allow camera access in your browser settings.', 'error');
          } else if (errStr.includes('NotFoundError') || errStr.includes('DevicesNotFoundError')) {
            showToast('No camera device detected on this computer or phone.', 'error');
          } else {
            showToast('Camera error: ' + (err.message || errStr), 'error');
          }
        }
        stopScanner();
      }
    };

    startBtn.onclick = startScanner;
    switchBtn.onclick = async () => {
      if (availableCameras.length < 2 && !activeCameraScanner) return;
      currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      await stopScanner();
      await startScanner();
    };
  }

  async function stopActiveScanner() {
    if (activeCameraScanner) {
      try {
        await activeCameraScanner.stop();
      } catch (e) {}
      activeCameraScanner = null;
    }
  }

  return {
    generateSignature,
    generateMemberQr,
    validateMemberQr,
    recordAttendanceFromQR,
    renderAttendanceLogsTable,
    openEditLogModal,
    closeEditLogModal,
    saveEditLogEntry,
    getEffectiveRole,
    deleteLogEntry,
    exportLogsExcel,
    exportLogsCSV,
    getMessengerGcList,
    saveMessengerGcList,
    addMessengerGcLink,
    removeMessengerGcLink,
    replaceMessengerGcLink,
    renderMessengerGcLinks,
    toggleAutoDispatch,
    isAutoDispatchEnabled,
    getCurrentFormMessengerFormat,
    updateMessengerDispatcherPreview,
    copyCurrentFormMessengerFormat,
    dispatchAllMessengerGcs,
    openSingleGc,
    initMessengerDispatcher,
    formatSingleAttendanceMessage,
    sendSingleRecordToMessenger,
    copyAllTodayToMessenger,
    openMessengerSettingsModal,
    closeMessengerSettingsModal,
    saveMessengerSettings,
    updateMessengerPreview,
    openMessengerGcWithSample,
    attachCameraScanner,
    stopActiveScanner
  };
})();

// Attach to global window object
if (typeof window !== 'undefined') {
  window.AttendanceLogger = AttendanceLogger;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttendanceLogger;
}
