/**
 * MCGI Attendance Management System - Supabase Client & Sync Manager
 * Connects MPRO, GCOS, and Teatro Kristiano to Supabase PostgreSQL with
 * real-time WebSocket broadcasting and local-first offline queueing.
 */

(function (window) {
  'use strict';

  const SUPABASE_URL = 'https://zywmlbqrwdorijqrntgf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_FoXnPreTlfvWizbBZbonLw_MMf_-Kur';
  const QUEUE_KEY = 'mcgi_pending_sync_queue';

  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function isUUID(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  }

  async function computeHash(str) {
    if (!str) return '';
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
        const msgBuffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {}
    return computeHashSync(str);
  }

  function computeHashSync(str) {
    if (!str) return '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }

  let _client = null;
  let _realtimeChannel = null;

  function initClient() {
    if (_client) return _client;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
      } catch (err) {
        console.warn('[SupabaseClient] Error initializing client:', err);
      }
    }
    return _client;
  }

  const SupabaseClient = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,

    getClient() {
      return initClient();
    },

    isConfigured() {
      return !!this.getClient();
    },

    isOnline() {
      return navigator.onLine && !!this.getClient();
    },

    // ─────────────────────────────────────────────────────────────
    // Offline Queue Helpers
    // ─────────────────────────────────────────────────────────────
    getPendingQueue() {
      try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    addToPendingQueue(action, table, payload) {
      try {
        const queue = this.getPendingQueue();
        queue.push({
          id: 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          action, // 'insert' | 'upsert'
          table,
          payload,
          queuedAt: new Date().toISOString()
        });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('mcgi_sync_queue_updated', {
            detail: { pending: queue.length }
          }));
        }
      } catch (e) {
        console.warn('[SupabaseClient] Failed to add to offline queue:', e);
      }
    },

    async syncPendingQueue() {
      if (!this.isOnline()) return { synced: 0, pending: this.getPendingQueue().length };
      const queue = this.getPendingQueue();
      if (!queue.length) return { synced: 0, pending: 0 };

      const client = this.getClient();
      const remaining = [];
      let syncedCount = 0;

      for (const item of queue) {
        try {
          if (item.action === 'insert' || item.action === 'upsert') {
            let { error } = await client.from(item.table).upsert([item.payload], { onConflict: 'id' });
            if (error && (error.code === '42703' || error.code === 'PGRST204' || /column.*does not exist/i.test(error.message || ''))) {
              const stripped = Object.assign({}, item.payload);
              delete stripped.scheduled_time;
              delete stripped.schedule_day;
              delete stripped.session_type;
              delete stripped.schedule_slot;
              delete stripped.schedule_auto_detected;
              const retry = await client.from(item.table).upsert([stripped], { onConflict: 'id' });
              error = retry.error;
            }
            if (error) {
              console.warn('[SupabaseClient] Failed item sync, retaining:', item, error);
              remaining.push(item);
            } else {
              syncedCount++;
            }
          } else if (item.action === 'delete') {
            let query = client.from(item.table).delete();
            const p = item.payload || {};
            if (p.id && isUUID(p.id)) {
              query = query.eq('id', p.id);
            } else if (p.member_code) {
              query = query.eq('member_code', p.member_code);
              if (p.ministry_id) query = query.eq('ministry_id', p.ministry_id);
            } else if (p.full_name) {
              query = query.eq('full_name', p.full_name);
              if (p.ministry_id) query = query.eq('ministry_id', p.ministry_id);
            }
            const { error } = await query;
            if (error) {
              console.warn('[SupabaseClient] Failed item delete sync, retaining:', item, error);
              remaining.push(item);
            } else {
              syncedCount++;
            }
          }
        } catch (err) {
          remaining.push(item);
        }
      }

      localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('mcgi_sync_queue_updated', {
          detail: { synced: syncedCount, pending: remaining.length }
        }));
      }
      return { synced: syncedCount, pending: remaining.length };
    },

    // ─────────────────────────────────────────────────────────────
    // Authentication (Login & Duty Verification)
    // ─────────────────────────────────────────────────────────────
    async login(usernameOrEmail, password, selectedDuty) {
      const client = this.getClient();
      const term = (usernameOrEmail || '').trim().toLowerCase();
      const sDuty = (selectedDuty || 'MPRO').toUpperCase();

      // Bro. Paul administrator verification
      const isPaulTerm = (term === 'admin' || term === 'paul' || term === 'bro. paul' || term === 'paul@mcgiprod.org' || term === 'prod001');
      const adminSavedPw = (typeof localStorage !== 'undefined' && localStorage.getItem('mcgi_admin_password')) || 'admin123';
      if (isPaulTerm && password === adminSavedPw) {
        const adminUser = {
          id: 'PROD001',
          name: 'Bro. Paul',
          username: 'paul',
          email: 'paul@mcgiprod.org',
          locale: 'Naic',
          level: 'ADMINISTRATOR',
          role: 'admin',
          isAdmin: true,
          isGlobalAdmin: true,
          duty: sDuty
        };
        return { success: true, user: adminUser, isSuperadmin: true, source: 'superadmin' };
      }

      if (!client || !navigator.onLine) {
        // Fallback to cached local users if offline
        return this._loginLocalFallback(term, password, sDuty);
      }

      try {
        const queryPromise = client
          .from('auth_users')
          .select('*')
          .or(`username.ilike.${term},full_name.ilike.${term}`);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cloud login timeout')), 2500)
        );

        const { data: users, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (error) {
          console.warn('[SupabaseClient] Remote login error, trying local fallback:', error);
          return this._loginLocalFallback(term, password, sDuty);
        }

        if (!users || users.length === 0) {
          // Check local fallback before giving up
          const localCheck = this._loginLocalFallback(term, password, sDuty);
          if (localCheck.success) return localCheck;
          return { success: false, error: 'Account not found. Please check your username or register.' };
        }

        const user = users[0];

        // Validate password securely (supports plain or SHA-256 hash)
        const inputHash = await computeHash(password);
        const passMatch = (user.password_hash === password) || (user.password_hash === inputHash) || (user.password === password);
        if (!passMatch) {
          return { success: false, error: 'Incorrect password. Please try again.' };
        }

        // Verify system / ministry boundaries
        const userMinistry = (user.ministry_id || 'MPRO').toUpperCase();
        const isSuperadmin = user.is_superadmin === true;

        if (!isSuperadmin && userMinistry !== sDuty) {
          return {
            success: false,
            error: `Access Denied: This account is registered under ${userMinistry} and cannot sign in to ${sDuty}. Please return to Duty Selection and choose ${userMinistry}.`
          };
        }

        const authenticatedUser = {
          id: user.id,
          name: user.full_name,
          username: user.username,
          locale: user.locale || 'Naic',
          role: user.role || 'member',
          isAdmin: user.role === 'admin' || isSuperadmin,
          isGlobalAdmin: isSuperadmin,
          duty: isSuperadmin ? sDuty : userMinistry
        };

        return { success: true, user: authenticatedUser, isSuperadmin, source: 'supabase' };
      } catch (err) {
        console.warn('[SupabaseClient] Login exception or timeout, using local fallback:', err);
        return this._loginLocalFallback(term, password, sDuty);
      }
    },

    _loginLocalFallback(term, password, sDuty) {
      const localKey = `mcgi_${sDuty.toLowerCase()}_auth_users`;
      let localUsers = [];
      try {
        const raw = localStorage.getItem(localKey) || localStorage.getItem('mcgi_auth_users');
        localUsers = raw ? JSON.parse(raw) : [];
      } catch (e) {}

      // If localUsers is empty, also seed from DutySelection if available
      if (!localUsers.length && window.DutySelection && window.DutySelection.DUTIES && window.DutySelection.DUTIES[sDuty]) {
        localUsers = window.DutySelection.DUTIES[sDuty].seedAuthUsers || [];
      }

      const found = localUsers.find(u =>
        (u.username && u.username.toLowerCase() === term) ||
        (u.email && u.email.toLowerCase() === term) ||
        (u.name && u.name.toLowerCase() === term) ||
        (u.id && u.id.toLowerCase() === term) ||
        (u.rollNo && u.rollNo.toLowerCase() === term)
      );

      if (!found) {
        // Check members roster as secondary offline fallback
        const membersKey = `mcgi_${sDuty.toLowerCase()}_members`;
        let members = [];
        try {
          const rawM = localStorage.getItem(membersKey) || localStorage.getItem('mcgi_members');
          members = rawM ? JSON.parse(rawM) : [];
        } catch (e) {}

        const memFound = members.find(m =>
          (m.email && m.email.toLowerCase() === term) ||
          (m.rollNo && m.rollNo.toLowerCase() === term) ||
          (m.name && m.name.toLowerCase() === term) ||
          (m.id && m.id.toLowerCase() === term)
        );

        return { success: false, error: 'User not found in local cache. Please check credentials or connect to internet.' };
      }

      const inputHash = computeHashSync(password);
      const passMatch = (found.password === password) || (found.password_hash === password) || (found.password_hash === inputHash);
      if (!passMatch) {
        return { success: false, error: 'Incorrect password.' };
      }

      return {
        success: true,
        user: {
          id: found.id || 'LOC_' + Date.now(),
          name: found.name || found.full_name || 'Member',
          username: found.username || term,
          locale: found.locale || 'Naic',
          role: found.role || 'member',
          isAdmin: found.role === 'admin' || found.isAdmin === true,
          isGlobalAdmin: found.isGlobalAdmin === true,
          duty: sDuty
        },
        source: 'local_cache'
      };
    },

    // ─────────────────────────────────────────────────────────────
    // Members Directory Management
    // ─────────────────────────────────────────────────────────────
    async getMembers(ministryId) {
      const duty = (ministryId || 'MPRO').toUpperCase();
      const localKey = `mcgi_${duty.toLowerCase()}_members`;
      const client = this.getClient();

      if (!client || !navigator.onLine) {
        try {
          const raw = localStorage.getItem(localKey) || localStorage.getItem('mcgi_members');
          return raw ? JSON.parse(raw) : [];
        } catch (e) {
          return [];
        }
      }

      try {
        const { data, error } = await client
          .from('members')
          .select('*')
          .eq('ministry_id', duty)
          .order('full_name', { ascending: true });

        if (error) {
          console.warn('[SupabaseClient] getMembers error, fallback to local:', error);
          const raw = localStorage.getItem(localKey);
          return raw ? JSON.parse(raw) : [];
        }

        // Map to app format
        const mapped = (data || []).map(m => ({
          id: m.member_code || m.id,
          dbId: m.id,
          name: m.full_name,
          locale: m.locale,
          level: m.level || 'Regular',
          contact: m.contact_number || '',
          status: m.status || 'Active',
          duty: m.ministry_id
        }));

        // Cache locally for offline resilience
        localStorage.setItem(localKey, JSON.stringify(mapped));
        if (duty === 'MPRO') localStorage.setItem('mcgi_members', JSON.stringify(mapped));

        return mapped;
      } catch (err) {
        console.warn('[SupabaseClient] Error fetching members:', err);
        const raw = localStorage.getItem(localKey);
        return raw ? JSON.parse(raw) : [];
      }
    },

    async saveMember(member, ministryId) {
      const duty = (ministryId || member.duty || 'MPRO').toUpperCase();
      const client = this.getClient();

      const payload = {
        member_code: member.id || member.member_code || ('MEM-' + Date.now().toString().slice(-4)),
        full_name: member.name || member.full_name,
        ministry_id: duty,
        locale: member.locale || 'Naic',
        level: member.level || 'Regular',
        contact_number: member.contact || member.contact_number || '',
        status: member.status || 'Active'
      };

      if (member.dbId) {
        payload.id = member.dbId;
      }

      if (!client || !navigator.onLine) {
        this.addToPendingQueue('upsert', 'members', payload);
        return { success: true, offline: true, payload };
      }

      try {
        const { data, error } = await client
          .from('members')
          .upsert([payload], { onConflict: 'ministry_id, member_code' })
          .select();

        if (error) {
          console.warn('[SupabaseClient] saveMember error, queuing:', error);
          this.addToPendingQueue('upsert', 'members', payload);
          return { success: true, offline: true, payload };
        }
        return { success: true, data: data ? data[0] : payload };
      } catch (err) {
        this.addToPendingQueue('upsert', 'members', payload);
        return { success: true, offline: true, payload };
      }
    },

    // ─────────────────────────────────────────────────────────────
    // Attendance & QR Check-In Logging
    // ─────────────────────────────────────────────────────────────
    async recordAttendance(entry) {
      const duty = (entry.duty || entry.ministry_id || 'MPRO').toUpperCase();
      const client = this.getClient();

      const recordId = (entry.cloudId && isUUID(entry.cloudId)) ? entry.cloudId : 
                       (isUUID(entry.id) ? entry.id : generateUUID());

      const payload = {
        id: recordId,
        member_code: entry.memberId || entry.member_code || entry.id || 'GUEST',
        full_name: entry.fullName || entry.name || entry.full_name || 'Anonymous',
        ministry_id: duty,
        event_type: entry.eventType || entry.event_type || 'PM',
        status: entry.status || 'Present',
        check_in_time: entry.timestamp || entry.check_in_time || new Date().toISOString(),
        check_in_date: (entry.timestamp ? new Date(entry.timestamp) : new Date()).toISOString().split('T')[0],
        scanned_by: entry.scannedBy || entry.scanned_by || 'System',
        device_source: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile Phone' : 'Desktop/Laptop',
        locale: entry.locale || 'Naic',
        notes: entry.notes || ''
      };

      if (entry.member_id) payload.member_id = entry.member_id;
      entry.cloudId = recordId;

      // Optional schedule metadata columns
      const scheduleFields = {};
      if (entry.scheduledTime || entry.scheduled_time) {
        scheduleFields.scheduled_time = entry.scheduledTime || entry.scheduled_time;
      }
      if (entry.scheduleDay || entry.schedule_day) {
        scheduleFields.schedule_day = entry.scheduleDay || entry.schedule_day;
      }
      if (entry.sessionType || entry.session_type) {
        scheduleFields.session_type = entry.sessionType || entry.session_type;
      }
      const slotVal = entry.scheduleSlot || entry.schedule_slot || (Array.isArray(entry.schedules) ? entry.schedules[0] : (entry.schedule || ''));
      if (slotVal) {
        scheduleFields.schedule_slot = slotVal;
      }
      if (typeof entry.scheduleAutoDetected === 'boolean') {
        scheduleFields.schedule_auto_detected = entry.scheduleAutoDetected;
      } else if (typeof entry.schedule_auto_detected === 'boolean') {
        scheduleFields.schedule_auto_detected = entry.schedule_auto_detected;
      }

      const fullPayload = Object.assign({}, payload, scheduleFields);

      if (!client || !navigator.onLine) {
        this.addToPendingQueue('insert', 'attendance_records', fullPayload);
        return { success: true, offline: true, payload: fullPayload };
      }

      try {
        const queryPromise = client
          .from('attendance_records')
          .insert([fullPayload])
          .select();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cloud record attendance timeout')), 3000)
        );

        let { data, error } = await Promise.race([queryPromise, timeoutPromise]);

        // If insert failed because columns do not exist yet in older Supabase table schemas:
        if (error && (error.code === '42703' || error.code === 'PGRST204' || /column.*does not exist/i.test(error.message || ''))) {
          console.warn('[SupabaseClient] Schedule columns missing in table schema, falling back to core payload:', error.message);
          const fallbackPayload = Object.assign({}, payload);
          if (slotVal || scheduleFields.scheduled_time) {
            const schedTag = `[Sched: ${slotVal || ''} | ${scheduleFields.scheduled_time || ''} | ${scheduleFields.session_type || ''}]`;
            fallbackPayload.notes = fallbackPayload.notes ? `${schedTag} ${fallbackPayload.notes}` : schedTag;
          }
          const retryRes = await client.from('attendance_records').insert([fallbackPayload]).select();
          if (!retryRes.error) {
            return { success: true, data: retryRes.data ? retryRes.data[0] : fallbackPayload, legacySchema: true };
          }
        }

        if (error) {
          console.warn('[SupabaseClient] recordAttendance error, queuing:', error);
          this.addToPendingQueue('insert', 'attendance_records', fullPayload);
          return { success: true, offline: true, payload: fullPayload };
        }
        return { success: true, data: data ? data[0] : fullPayload };
      } catch (err) {
        console.warn('[SupabaseClient] recordAttendance exception/timeout, queuing:', err);
        this.addToPendingQueue('insert', 'attendance_records', fullPayload);
        return { success: true, offline: true, payload: fullPayload };
      }
    },

    /**
     * Deletes an attendance record from Supabase Cloud Database with offline queue fallback
     */
    async deleteAttendanceRecord(target, ministryId) {
      const client = this.getClient();
      const duty = (ministryId || (typeof target === 'object' && target ? target.duty || target.ministry_id : null) || 'MPRO').toUpperCase();

      let targetId = null;
      let targetMemberCode = null;
      let targetFullName = null;

      if (typeof target === 'object' && target !== null) {
        targetId = target.cloudId || (isUUID(target.id) ? target.id : null);
        targetMemberCode = target.memberId || target.member_code || (!isUUID(target.id) ? target.id : null);
        targetFullName = target.fullName || target.full_name || null;
      } else if (typeof target === 'string') {
        if (isUUID(target)) {
          targetId = target;
        } else {
          targetMemberCode = target;
        }
      }

      const payload = {
        id: targetId,
        member_code: targetMemberCode,
        full_name: targetFullName,
        ministry_id: duty
      };

      if (!client || !navigator.onLine) {
        this.addToPendingQueue('delete', 'attendance_records', payload);
        return { success: true, offline: true, payload };
      }

      try {
        let query = client.from('attendance_records').delete();
        if (targetId) {
          query = query.eq('id', targetId);
        } else if (targetMemberCode) {
          query = query.eq('member_code', targetMemberCode).eq('ministry_id', duty);
        } else if (targetFullName) {
          query = query.eq('full_name', targetFullName).eq('ministry_id', duty);
        } else {
          console.warn('[SupabaseClient] Cannot delete: missing valid id or member_code', target);
          return { success: false, error: 'Missing identifier' };
        }

        const { error } = await query;
        if (error) {
          console.warn('[SupabaseClient] deleteAttendanceRecord error, queuing:', error);
          this.addToPendingQueue('delete', 'attendance_records', payload);
          return { success: false, error: error.message };
        }

        console.log('[SupabaseClient] Attendance record deleted from cloud database:', payload);
        return { success: true };
      } catch (err) {
        console.warn('[SupabaseClient] deleteAttendanceRecord exception, queuing:', err);
        this.addToPendingQueue('delete', 'attendance_records', payload);
        return { success: false, error: err.message };
      }
    },

    async getAttendanceRecords(ministryId, filterDate, filterEventType) {
      const duty = (ministryId || 'MPRO').toUpperCase();
      const localKey = `mcgi_${duty.toLowerCase()}_event_entries`;
      const client = this.getClient();

      if (!client || !navigator.onLine) {
        try {
          const raw = localStorage.getItem(localKey) || localStorage.getItem('mcgi_prod_event_entries');
          return raw ? JSON.parse(raw) : [];
        } catch (e) {
          return [];
        }
      }

      try {
        let query = client
          .from('attendance_records')
          .select('*')
          .eq('ministry_id', duty)
          .order('check_in_time', { ascending: false })
          .limit(500);

        if (filterDate) {
          query = query.eq('check_in_date', filterDate);
        }
        if (filterEventType && filterEventType !== 'all') {
          query = query.eq('event_type', filterEventType);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('[SupabaseClient] getAttendanceRecords error:', error);
          const raw = localStorage.getItem(localKey);
          return raw ? JSON.parse(raw) : [];
        }

        // Map to app format
        const mapped = (data || []).map(r => ({
          id: r.id,
          memberId: r.member_code,
          fullName: r.full_name,
          duty: r.ministry_id,
          eventType: r.event_type,
          status: r.status,
          timestamp: r.check_in_time,
          date: r.check_in_date,
          scannedBy: r.scanned_by,
          device: r.device_source,
          locale: r.locale,
          notes: r.notes,
          scheduledTime: r.scheduled_time || '',
          scheduleDay: r.schedule_day || '',
          sessionType: r.session_type || '',
          schedules: r.schedule_slot ? [r.schedule_slot] : [],
          scheduleAutoDetected: !!r.schedule_auto_detected
        }));

        localStorage.setItem(localKey, JSON.stringify(mapped));
        return mapped;
      } catch (err) {
        console.warn('[SupabaseClient] Error fetching attendance:', err);
        const raw = localStorage.getItem(localKey);
        return raw ? JSON.parse(raw) : [];
      }
    },

    // ─────────────────────────────────────────────────────────────
    // Realtime WebSocket Subscription (Live Updates Across Devices)
    // ─────────────────────────────────────────────────────────────
    subscribeToLiveAttendance(ministryId, onInsertCallback, onDeleteCallback) {
      const client = this.getClient();
      if (!client) return null;

      const duty = (ministryId || 'MPRO').toUpperCase();

      if (_realtimeChannel) {
        try { client.removeChannel(_realtimeChannel); } catch (e) {}
      }

      try {
        _realtimeChannel = client
          .channel(`public:attendance_records:${duty}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'attendance_records',
              filter: `ministry_id=eq.${duty}`
            },
            (payload) => {
              if (typeof onInsertCallback === 'function' && payload && payload.new) {
                const r = payload.new;
                onInsertCallback({
                  id: r.id,
                  cloudId: r.id,
                  memberId: r.member_code,
                  fullName: r.full_name,
                  duty: r.ministry_id,
                  eventType: r.event_type,
                  status: r.status,
                  timestamp: r.check_in_time,
                  locale: r.locale,
                  scheduledTime: r.scheduled_time || '',
                  scheduleDay: r.schedule_day || '',
                  sessionType: r.session_type || '',
                  schedules: r.schedule_slot ? [r.schedule_slot] : [],
                  scheduleAutoDetected: !!r.schedule_auto_detected
                });
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'attendance_records'
            },
            (payload) => {
              if (typeof onDeleteCallback === 'function' && payload && payload.old) {
                onDeleteCallback(payload.old);
              }
            }
          )
          .subscribe((status) => {
            console.log(`[SupabaseClient] Realtime status (${duty}):`, status);
          });

        return _realtimeChannel;
      } catch (err) {
        console.warn('[SupabaseClient] Failed to subscribe to Realtime:', err);
        return null;
      }
    },

    // ─────────────────────────────────────────────────────────────
    // One-Click Migration: Sync Local Browser Data to Cloud
    // ─────────────────────────────────────────────────────────────
    async migrateLocalDataToCloud(ministryId) {
      const duty = (ministryId || 'MPRO').toUpperCase();
      const client = this.getClient();
      if (!client || !navigator.onLine) {
        return { success: false, error: 'Database is offline or not connected' };
      }

      let membersCount = 0;
      let attendanceCount = 0;

      try {
        // 1. Sync Local Members
        const memKey = `mcgi_${duty.toLowerCase()}_members`;
        const localMembers = JSON.parse(localStorage.getItem(memKey) || localStorage.getItem('mcgi_members') || '[]');
        if (localMembers.length) {
          const formatted = localMembers.map(m => ({
            member_code: m.id || m.member_code || ('MEM-' + Date.now().toString().slice(-4)),
            full_name: m.name || m.full_name || 'Member',
            ministry_id: duty,
            locale: m.locale || 'Naic',
            level: m.level || 'Regular',
            status: m.status || 'Active'
          }));

          const { error: memErr } = await client
            .from('members')
            .upsert(formatted, { onConflict: 'ministry_id, member_code' });
          if (!memErr) membersCount = formatted.length;
        }

        // 2. Sync Local Attendance Entries
        const attKey = `mcgi_${duty.toLowerCase()}_event_entries`;
        const localAtt = JSON.parse(localStorage.getItem(attKey) || localStorage.getItem('mcgi_prod_event_entries') || '[]');
        if (localAtt.length) {
          const formattedAtt = localAtt.map(a => ({
            member_code: a.memberId || a.member_code || 'GUEST',
            full_name: a.fullName || a.name || 'Member',
            ministry_id: duty,
            event_type: a.eventType || a.event_type || 'PM',
            status: a.status || 'Present',
            check_in_time: a.timestamp || new Date().toISOString(),
            check_in_date: (a.timestamp ? new Date(a.timestamp) : new Date()).toISOString().split('T')[0],
            locale: a.locale || 'Naic'
          }));

          const { error: attErr } = await client
            .from('attendance_records')
            .insert(formattedAtt);
          if (!attErr) attendanceCount = formattedAtt.length;
        }

        return { success: true, membersCount, attendanceCount };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  };

  // Auto-sync pending offline queue when connection is restored
  window.addEventListener('online', () => {
    console.log('[SupabaseClient] Network back online, flushing offline queue...');
    SupabaseClient.syncPendingQueue();
  });

  // Export to global scope
  window.SupabaseClient = SupabaseClient;

})(window);
