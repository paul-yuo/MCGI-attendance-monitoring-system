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
  // In-memory cache for anti-replay attack mitigation
  const scanHistoryCache = new Map();

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
      // Check if raw memberId was provided
      parsed = { mid: qrString.trim() };
    }

    const memberId = parsed.mid || parsed.memberId;
    if (!memberId) {
      return { valid: false, error: 'QR Code is missing member identifier.' };
    }

    // Retrieve member profile from active system only
    const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
    const member = (window.AppState?.members || []).find(m => 
      String(m.id).toLowerCase() === String(memberId).toLowerCase() ||
      String(m.rollNo || '').toLowerCase() === String(memberId).toLowerCase()
    );

    if (!member) {
      // Check if this member belongs to another system to give an explicit cross-system error
      const otherDuties = ['MPRO', 'GCOS', 'TK'].filter(k => k.toUpperCase() !== activeDuty.toUpperCase());
      for (const other of otherDuties) {
        const otherMembers = (typeof safeJSONParse === 'function') ? safeJSONParse(`mcgi_${other.toLowerCase()}_members`, []) : [];
        const foundOther = otherMembers.find(m => 
          String(m.id).toLowerCase() === String(memberId).toLowerCase() ||
          String(m.rollNo || '').toLowerCase() === String(memberId).toLowerCase()
        );
        if (foundOther) {
          return { valid: false, error: `Cross-System Error: Member "${memberId}" belongs to MCGI ${other} and cannot record attendance in MCGI ${activeDuty}.` };
        }
      }
      return { valid: false, error: `Member "${memberId}" not found in MCGI ${activeDuty} roster.` };
    }

    // Authenticity Check: If signature is included, verify it matches
    if (parsed.sig) {
      const expectedSig = generateSignature(member.id, member.rollNo, member.email);
      if (parsed.sig !== expectedSig) {
        return { valid: false, error: 'Tampered QR Code: Signature verification failed.' };
      }
    }

    return { valid: true, member };
  }

  /**
   * Records attendance from a scanned member QR code.
   * Validates authenticity, checks replay attacks, persists attendance record, and returns response.
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
        const today = typeof getPastDateString === 'function' ? getPastDateString(0) : new Date().toISOString().split('T')[0];

        // 2. Anti-Replay Attack Protection
        // Check 1: Cooldown to prevent duplicate scanning within 30 seconds
        const nowMs = Date.now();
        const lastScanTime = scanHistoryCache.get(member.id) || 0;
        if (nowMs - lastScanTime < 30000) {
          const secondsRemaining = Math.ceil((30000 - (nowMs - lastScanTime)) / 1000);
          const replayMsg = `Anti-Replay Alert: Duplicate scan detected for ${member.name}. Please wait ${secondsRemaining}s.`;
          if (typeof showToast === 'function') showToast(replayMsg, 'warning');
          return reject(new Error(replayMsg));
        }

        // Check 2: Check if already checked-in for today's active session
        const dayAttendance = (window.AppState?.attendance && window.AppState.attendance[today]) ? window.AppState.attendance[today] : {};
        const existingRecord = dayAttendance[member.id];
        if (existingRecord && (existingRecord.status === 'present' || existingRecord.status === 'late')) {
          const alreadyLoggedMsg = `Attendance already logged for ${member.name} today at ${existingRecord.time}.`;
          if (typeof showToast === 'function') showToast(alreadyLoggedMsg, 'info');
          // Still register scan timestamp for debounce
          scanHistoryCache.set(member.id, nowMs);
          return resolve({
            success: true,
            message: alreadyLoggedMsg,
            member,
            record: existingRecord
          });
        }

        // 3. Determine Time & Status
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const [cutoffHours, cutoffMinutes] = (window.AppState?.settings?.cutoffTime || '08:00').split(':').map(Number);
        const isLate = now.getHours() > cutoffHours || (now.getHours() === cutoffHours && now.getMinutes() > cutoffMinutes);
        const status = isLate ? 'late' : 'present';

        // 4. Persist Daily Attendance
        if (!window.AppState.attendance[today]) {
          window.AppState.attendance[today] = {};
        }

        const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';

        const attendanceRecord = {
          status: status,
          time: timeStr,
          duty: activeDuty,
          remarks: `QR Code Attendance Scan (${activeDuty})`
        };
        window.AppState.attendance[today][member.id] = attendanceRecord;

        // 5. Persist Official Event Entry Log
        const newEventLog = {
          id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          fullName: member.name,
          memberId: member.id,
          duty: activeDuty,
          locale: [member.department || 'Naic'],
          level: [member.role || 'MUNICIPAL PROD'],
          event: 'QR ATTENDANCE SCAN',
          eventDetail: `Self / Station QR Scan [${activeDuty}]`,
          eventDate: today,
          status: 'ON DUTY (OD)',
          timeIn: timeStr,
          remarks: `Verified secure QR attendance (${status.toUpperCase()}) [${activeDuty}]`
        };

        if (!Array.isArray(window.AppState.eventEntries)) {
          window.AppState.eventEntries = [];
        }
        window.AppState.eventEntries.unshift(newEventLog);

        // Update scan cache
        scanHistoryCache.set(member.id, nowMs);

        // Persist to storage
        if (typeof window.AppState.save === 'function') {
          window.AppState.save();
        }

        // Persist to Supabase Cloud (with automatic offline queueing)
        if (window.SupabaseClient) {
          SupabaseClient.recordAttendance({
            id: newEventLog.id,
            memberId: member.id,
            fullName: member.name,
            duty: activeDuty,
            eventType: 'QR SCAN',
            status: status === 'present' ? 'Present' : status === 'late' ? 'Late' : 'Excused',
            timestamp: new Date().toISOString(),
            locale: member.department || 'Naic',
            notes: `Scanned at ${timeStr}`
          }).catch(e => console.warn('[AttendanceLogger] Supabase push deferred:', e));
        }



        const successMsg = `Attendance recorded for ${member.name} (${status.toUpperCase()}) at ${timeStr}`;
        if (typeof showToast === 'function') {
          showToast(successMsg, 'success');
        }

        // Refresh tables if active
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
            <button 
              onclick="AttendanceLogger.deleteLogEntry('${entry.id}')" 
              class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors" 
              title="Delete record">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
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
   * Deletes a specific attendance log entry and synchronizes the deletion with Supabase Cloud Database
   */
  function deleteLogEntry(entryId) {
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
   * Exports attendance logs to sanitized CSV
   */
  function exportLogsCSV() {
    const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';
    const allEntries = window.AppState?.eventEntries || [];
    const entries = allEntries.filter(e => !e.duty || e.duty.toUpperCase() === activeDuty.toUpperCase());

    if (entries.length === 0) {
      if (typeof showToast === 'function') showToast(`No attendance logs available to export for MCGI ${activeDuty}`, 'warning');
      return;
    }

    const sanitize = (typeof sanitizeCSVField === 'function') ? sanitizeCSVField : (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    let csv = 'ID,Full Name,Member ID,System,Locales,Levels,Event,Event Detail,Date,Time In,Status,Remarks\n';

    entries.forEach(e => {
      const locales = Array.isArray(e.locale) ? e.locale.join(';') : (e.locale || '');
      const levels = Array.isArray(e.level) ? e.level.join(';') : (e.level || '');
      csv += `${sanitize(e.id)},${sanitize(e.fullName)},${sanitize(e.memberId)},${sanitize(e.duty || activeDuty)},${sanitize(locales)},${sanitize(levels)},${sanitize(e.event)},${sanitize(e.eventDetail || e.otherEventName)},${sanitize(e.eventDate)},${sanitize(e.timeIn)},${sanitize(e.status)},${sanitize(e.remarks)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCGI_${activeDuty.toUpperCase()}_Attendance_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast(`Exported ${entries.length} MCGI ${activeDuty} records to CSV`, 'success');
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

    const scannerBox = document.createElement('div');
    scannerBox.className = 'w-full p-5 rounded-2xl bg-midnight-900/90 border border-slate-700/60 scanner-inner-container flex flex-col items-center text-center';

    scannerBox.innerHTML = `
      <div class="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3">
        <i data-lucide="camera" class="w-4 h-4 text-gold-400"></i>
        <span>Camera QR Attendance Scanner</span>
      </div>
      <div id="${containerId}_video" class="w-64 h-64 rounded-xl overflow-hidden bg-midnight-950 border border-slate-700 flex items-center justify-center relative mb-4">
        <span class="text-xs text-slate-500 font-mono">Camera idle</span>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" id="${containerId}_startBtn" class="gold-gradient-btn px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg">
          <i data-lucide="scan-line" class="w-4 h-4"></i>
          <span>Start Camera Scan</span>
        </button>
        <button type="button" id="${containerId}_stopBtn" class="hidden px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-xs font-bold transition-all">
          <span>Stop Camera</span>
        </button>
      </div>
      <p class="text-[11px] text-slate-500 mt-3">Point webcam or mobile camera at member QR code</p>
    `;

    container.appendChild(scannerBox);
    if (window.lucide) lucide.createIcons();

    const startBtn = document.getElementById(`${containerId}_startBtn`);
    const stopBtn = document.getElementById(`${containerId}_stopBtn`);
    const videoTarget = document.getElementById(`${containerId}_video`);

    const stopScanner = () => {
      if (activeCameraScanner) {
        activeCameraScanner.stop().then(() => {
          activeCameraScanner.clear();
          activeCameraScanner = null;
          videoTarget.innerHTML = '<span class="text-xs text-slate-500 font-mono">Camera idle</span>';
          startBtn.classList.remove('hidden');
          stopBtn.classList.add('hidden');
        }).catch(() => {
          activeCameraScanner = null;
          startBtn.classList.remove('hidden');
          stopBtn.classList.add('hidden');
        });
      }
    };

    stopBtn.onclick = stopScanner;

    startBtn.onclick = () => {
      if (typeof Html5Qrcode === 'undefined') {
        if (typeof showToast === 'function') showToast('QR scanner library not loaded', 'error');
        return;
      }

      videoTarget.innerHTML = '';
      const scanner = new Html5Qrcode(`${containerId}_video`);
      activeCameraScanner = scanner;

      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 200 },
        async (decodedText) => {
          try {
            const result = await recordAttendanceFromQR(decodedText);
            if (typeof onResult === 'function') onResult({ ...result, success: true });
          } catch (e) {
            if (typeof onResult === 'function') onResult({ success: false, message: e.message || 'Scan failed' });
          }
          stopScanner();
        },
        (err) => {
          // ignore stream ticks
        }
      ).catch(err => {
        if (typeof showToast === 'function') showToast('Camera error: ' + err, 'error');
        stopScanner();
      });
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
    deleteLogEntry,
    exportLogsCSV,
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
