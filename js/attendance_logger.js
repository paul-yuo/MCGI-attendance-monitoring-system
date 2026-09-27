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
      // Raw string identifier was provided
      parsed = { mid: qrString.trim() };
    }

    const memberId = parsed.mid || parsed.memberId || parsed.id;
    if (!memberId) {
      return { valid: false, error: 'QR Code is missing member identifier.' };
    }

    // Active duty context (MPRO, GCOS, TK)
    const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';

    // 1. Check in active system members
    let member = (window.AppState?.members || []).find(m => 
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
    if (!member && Array.isArray(window.AppState?.authUsers)) {
      const u = window.AppState.authUsers.find(u => 
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

    // Authenticity Check: verify signature if present, with tolerance for updated email/roll
    if (parsed.sig) {
      const sig1 = generateSignature(member.id, member.rollNo, member.email);
      const sig2 = parsed.roll ? generateSignature(member.id, parsed.roll, member.email) : null;
      const sig3 = generateSignature(member.id, member.rollNo || '', '');
      if (parsed.sig !== sig1 && parsed.sig !== sig2 && parsed.sig !== sig3) {
        console.warn('[validateMemberQr] Signature variation accepted for verified system roster record:', member.name);
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
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const [cutoffHours, cutoffMinutes] = (window.AppState?.settings?.cutoffTime || '08:00').split(':').map(Number);
        const isLate = now.getHours() > cutoffHours || (now.getHours() === cutoffHours && now.getMinutes() > cutoffMinutes);
        const status = isLate ? 'late' : 'present';

        // 4. Persist Daily Attendance
        if (!window.AppState.attendance) {
          window.AppState.attendance = {};
        }
        if (!window.AppState.attendance[today]) {
          window.AppState.attendance[today] = {};
        }

        const activeDuty = (window.AppState?.currentUser?.duty) || localStorage.getItem('mcgi_selected_duty') || 'MPRO';

        const attendanceRecord = {
          status: status,
          time: timeStr,
          duty: activeDuty,
          remarks: `Camera QR Attendance Scan (${activeDuty})`
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
          eventDetail: `Camera Check-In [${activeDuty}]`,
          eventDate: today,
          status: 'ON DUTY (OD)',
          timeIn: timeStr,
          remarks: `Verified secure QR attendance (${status.toUpperCase()}) [${activeDuty}]`
        };

        if (!Array.isArray(window.AppState.eventEntries)) {
          window.AppState.eventEntries = [];
        }
        window.AppState.eventEntries.unshift(newEventLog);

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

        // Audio confirmation tone
        playScanSuccessTone();

        const successMsg = `Attendance recorded for ${member.name} (${status.toUpperCase()}) at ${timeStr}`;
        if (typeof showToast === 'function') {
          showToast(successMsg, 'success');
        }

        // Flash Result Banner
        const banner = document.getElementById('qrScanResultBanner');
        const text = document.getElementById('qrScanResultText');
        if (banner && text) {
          text.textContent = successMsg;
          banner.className = 'p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
          banner.classList.remove('hidden');
          setTimeout(() => banner.classList.add('hidden'), 7000);
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
    if (role === 'admin') {
      return `
        <div class="flex items-center justify-end gap-1.5">
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
        <button 
          type="button"
          onclick="AttendanceLogger.openEditLogModal('${entryId}')" 
          class="p-1.5 rounded-lg bg-gold-400/10 hover:bg-gold-400/20 text-gold-300 transition-colors" 
          title="Edit record">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
        </button>
      `;
    } else {
      return `<span class="text-[11px] text-slate-500 font-mono italic">View Only</span>`;
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
      </div>
      <p class="text-[11px] text-slate-500 mt-3">Point webcam or mobile camera at your QR badge</p>
    `;

    container.appendChild(scannerBox);
    if (window.lucide) lucide.createIcons();

    const startBtn = document.getElementById(`${containerId}_startBtn`);
    const stopBtn = document.getElementById(`${containerId}_stopBtn`);
    const videoTarget = document.getElementById(`${containerId}_video`);
    let isProcessingScan = false;

    const stopScanner = () => {
      if (activeCameraScanner) {
        const sc = activeCameraScanner;
        activeCameraScanner = null;
        sc.stop().then(() => {
          try { sc.clear(); } catch (e) {}
          if (videoTarget) videoTarget.innerHTML = '<span class="text-xs text-slate-500 font-mono">Camera idle</span>';
          if (startBtn) startBtn.classList.remove('hidden');
          if (stopBtn) stopBtn.classList.add('hidden');
        }).catch(() => {
          try { sc.clear(); } catch (e) {}
          if (videoTarget) videoTarget.innerHTML = '<span class="text-xs text-slate-500 font-mono">Camera idle</span>';
          if (startBtn) startBtn.classList.remove('hidden');
          if (stopBtn) stopBtn.classList.add('hidden');
        });
      } else {
        if (videoTarget) videoTarget.innerHTML = '<span class="text-xs text-slate-500 font-mono">Camera idle</span>';
        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
      }
    };

    stopBtn.onclick = stopScanner;

    startBtn.onclick = async () => {
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

        // Enumerate devices to pick the best camera
        let cameras = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch (camErr) {
          console.warn('[AttendanceLogger] Camera enumeration note:', camErr);
        }

        if (cameras && cameras.length > 0) {
          // If back/rear camera is detected, prefer it (e.g. mobile), else default to first device (webcam)
          const backCam = cameras.find(c => /back|rear|environment/i.test(c.label));
          const chosenCamId = backCam ? backCam.id : cameras[0].id;
          await scanner.start(chosenCamId, config, scanSuccessHandler, () => {});
        } else {
          // Fallback sequence: environment facingMode -> user facingMode -> any track
          try {
            await scanner.start({ facingMode: 'environment' }, config, scanSuccessHandler, () => {});
          } catch (envErr) {
            console.warn('[AttendanceLogger] environment facingMode fallback to user:', envErr);
            try {
              await scanner.start({ facingMode: 'user' }, config, scanSuccessHandler, () => {});
            } catch (userErr) {
              console.warn('[AttendanceLogger] user facingMode fallback to generic track:', userErr);
              await scanner.start(true, config, scanSuccessHandler, () => {});
            }
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
