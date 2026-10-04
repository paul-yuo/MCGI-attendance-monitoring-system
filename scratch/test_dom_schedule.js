const assert = require('assert');
const EventSchedule = require('../js/event_schedule.js');

// Mock a lightweight browser DOM environment to test the exact UI flow
class MockElement {
  constructor(tag, id = '', name = '', value = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.name = name;
    this.value = value;
    this.checked = false;
    this._innerHTML = '';
    this.children = [];
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(html) {
    this._innerHTML = html;
    this.parseChildren(html);
  }
  parseChildren(html) {
    this.children = [];
    // Match input radio tags
    const inputRegex = /<input[^>]+>/g;
    let match;
    while ((match = inputRegex.exec(html)) !== null) {
      const tagStr = match[0];
      const nameMatch = tagStr.match(/name="([^"]+)"/);
      const valMatch = tagStr.match(/value="([^"]+)"/);
      const isChecked = tagStr.includes('checked');
      const el = new MockElement('input', '', nameMatch ? nameMatch[1] : '', valMatch ? valMatch[1] : '');
      el.checked = isChecked;
      this.children.push(el);
    }
  }
  querySelector(sel) {
    // Match input[name="..."][value="..."]
    const m = sel.match(/input\[name="([^"]+)"\]\[value="([^"]+)"\]/);
    if (m) {
      return this.children.find(c => c.name === m[1] && c.value === m[2]) || null;
    }
    return null;
  }
  querySelectorAll(sel) {
    const m = sel.match(/input\[name="([^"]+)"\]/);
    if (m) {
      return this.children.filter(c => c.name === m[1]);
    }
    return [];
  }
}

// Global mocks
const elements = {
  selectEventType: new MockElement('select', 'selectEventType', '', 'PM'),
  inputEventDate: new MockElement('input', 'inputEventDate', '', '2026-10-04'),
  dynamicEventFieldsContainer: new MockElement('div', 'dynamicEventFieldsContainer')
};

global.document = {
  getElementById: (id) => elements[id] || null,
  querySelector: (sel) => elements.dynamicEventFieldsContainer.querySelector(sel),
  querySelectorAll: (sel) => elements.dynamicEventFieldsContainer.querySelectorAll(sel)
};
global.window = { EventSchedule };
global.AppState = { selectedDate: '2026-10-04', eventEntries: [] };

// App controller methods under test
const App = {
  _scheduleManual: false,

  createRadioPill(name, value, isChecked = false, onchangeAttr = '') {
    const onchangeStr = onchangeAttr ? `onchange="${onchangeAttr}"` : '';
    return `<label class="custom-pill-checkbox"><input type="radio" name="${name}" value="${value}" ${isChecked ? 'checked' : ''} ${onchangeStr}><span>${value}</span></label>`;
  },

  applyAutoDetectedSchedule(eventType, now = new Date()) {
    if (!EventSchedule.hasFixedSchedule(eventType)) return;
    const det = EventSchedule.detect(eventType, now);
    if (det.status === 'detected') {
      const cfg = EventSchedule.getConfig(eventType);
      const radio = document.querySelector(`input[name="${cfg.field}"][value="${det.slot.label}"]`);
      if (radio) radio.checked = true;
    }
  },

  handleEventDropdownChange(eventType, now = new Date()) {
    const container = document.getElementById('dynamicEventFieldsContainer');
    this._scheduleManual = false;

    const det = EventSchedule.detect(eventType, now);
    const detectedSlotLabel = (det && det.status === 'detected') ? det.slot.label : '';

    let html = '';
    switch (eventType) {
      case 'PM':
        html = `
          <div class="grid">
            ${this.createRadioPill('eventSchedule', '3:30AM/WED - LIVE', detectedSlotLabel === '3:30AM/WED - LIVE')}
            ${this.createRadioPill('eventSchedule', '2:30PM/WED - VIEWING', detectedSlotLabel === '2:30PM/WED - VIEWING')}
            ${this.createRadioPill('eventSchedule', '5:30PM/WED - VIEWING', detectedSlotLabel === '5:30PM/WED - VIEWING')}
            ${this.createRadioPill('eventSchedule', '7:00AM/THU - VIEWING', detectedSlotLabel === '7:00AM/THU - VIEWING')}
            ${this.createRadioPill('eventSchedule', '7:00PM/THU - VIEWING', detectedSlotLabel === '7:00PM/THU - VIEWING')}
          </div>
        `;
        break;
      case 'WS':
        html = `
          <div class="grid">
            ${this.createRadioPill('eventSchedule', '3:30AM/SAT - LIVE', detectedSlotLabel === '3:30AM/SAT - LIVE')}
            ${this.createRadioPill('eventSchedule', '11:30AM/SAT - VIEWING', detectedSlotLabel === '11:30AM/SAT - VIEWING')}
            ${this.createRadioPill('eventSchedule', '1:30PM/SUN - VIEWING', detectedSlotLabel === '1:30PM/SUN - VIEWING')}
            ${this.createRadioPill('eventSchedule', '5:30PM/SUN - VIEWING', detectedSlotLabel === '5:30PM/SUN - VIEWING')}
          </div>
        `;
        break;
    }

    container.innerHTML = html;
    this.applyAutoDetectedSchedule(eventType, now);
  },

  initEventEntryForm(now = new Date()) {
    const eventSelect = document.getElementById('selectEventType');
    if (eventSelect) {
      this._scheduleManual = false;
      const detectedEvent = EventSchedule.detectApplicableEvent(now, eventSelect.value);
      eventSelect.value = detectedEvent;
      this.handleEventDropdownChange(detectedEvent, now);
    }
  }
};

// Date helper: Sunday is 2026-10-04, Thursday is 2026-10-08
const at = (dowOffset, hh, mm) => new Date(2026, 9, 4 + dowOffset, hh, mm, 0);

console.log('=== RUNNING REAL UI / DOM AUTOMATIC SELECTION TESTS ===');

// Test 1: Sunday at 9:41 PM -> Event should be WS, radio 5:30PM/SUN should be checked
{
  const now = at(0, 21, 41); // Sunday 9:41 PM
  elements.selectEventType.value = 'PM'; // initial dropdown value in HTML
  App.initEventEntryForm(now);

  assert.strictEqual(elements.selectEventType.value, 'WS', 'Event dropdown must be automatically set to WS');
  const checkedRadio = elements.dynamicEventFieldsContainer.children.find(r => r.checked);
  assert.ok(checkedRadio, 'A schedule radio must be checked');
  assert.strictEqual(checkedRadio.value, '5:30PM/SUN - VIEWING', '5:30PM/SUN must be checked at 9:41 PM Sunday');
  console.log('[PASS] Sunday WS at 9:41 PM -> Event: WS, Checked: 5:30PM/SUN - VIEWING');
}

// Test 2: Sunday WS before 1:30 PM (e.g. 12:00 PM) -> 1:30PM/SUN should be checked
{
  const now = at(0, 12, 0); // Sunday 12:00 PM
  elements.selectEventType.value = 'WS';
  App.initEventEntryForm(now);

  const checkedRadio = elements.dynamicEventFieldsContainer.children.find(r => r.checked);
  assert.ok(checkedRadio, 'A schedule radio must be checked');
  assert.strictEqual(checkedRadio.value, '1:30PM/SUN - VIEWING', '1:30PM/SUN must be checked at 12:00 PM Sunday');
  console.log('[PASS] Sunday WS before 1:30 PM (12:00 PM) -> Checked: 1:30PM/SUN - VIEWING');
}

// Test 3: Sunday WS at 5:29 PM -> 1:30PM/SUN should be checked
{
  const now = at(0, 17, 29); // Sunday 5:29 PM
  elements.selectEventType.value = 'WS';
  App.initEventEntryForm(now);

  const checkedRadio = elements.dynamicEventFieldsContainer.children.find(r => r.checked);
  assert.strictEqual(checkedRadio.value, '1:30PM/SUN - VIEWING', '1:30PM/SUN must be checked at 5:29 PM Sunday');
  console.log('[PASS] Sunday WS at 5:29 PM -> Checked: 1:30PM/SUN - VIEWING');
}

// Test 4: Sunday WS at 5:30 PM -> 5:30PM/SUN should be checked
{
  const now = at(0, 17, 30); // Sunday 5:30 PM
  elements.selectEventType.value = 'WS';
  App.initEventEntryForm(now);

  const checkedRadio = elements.dynamicEventFieldsContainer.children.find(r => r.checked);
  assert.strictEqual(checkedRadio.value, '5:30PM/SUN - VIEWING', '5:30PM/SUN must be checked at 5:30 PM Sunday');
  console.log('[PASS] Sunday WS at 5:30 PM -> Checked: 5:30PM/SUN - VIEWING');
}

// Test 5: Thursday PM at 2:00 PM (dowOffset = 4) -> Event: PM, Checked: 7:00AM/THU - VIEWING
{
  const now = at(4, 14, 0); // Thursday 2:00 PM
  elements.selectEventType.value = 'WS'; // if previous day was WS
  App.initEventEntryForm(now);

  assert.strictEqual(elements.selectEventType.value, 'PM', 'Event dropdown must be automatically set to PM on Thursday');
  const checkedRadio = elements.dynamicEventFieldsContainer.children.find(r => r.checked);
  assert.strictEqual(checkedRadio.value, '7:00AM/THU - VIEWING', '7:00AM/THU must be checked at 2:00 PM Thursday');
  console.log('[PASS] Thursday PM at 2:00 PM -> Event: PM, Checked: 7:00AM/THU - VIEWING');
}

// Test 6: Thursday PM at 7:00 PM -> 7:00PM/THU - VIEWING
{
  const now = at(4, 19, 0); // Thursday 7:00 PM
  elements.selectEventType.value = 'PM';
  App.initEventEntryForm(now);

  const checkedRadio = elements.dynamicEventFieldsContainer.children.find(r => r.checked);
  assert.strictEqual(checkedRadio.value, '7:00PM/THU - VIEWING', '7:00PM/THU must be checked at 7:00 PM Thursday');
  console.log('[PASS] Thursday PM at 7:00 PM -> Checked: 7:00PM/THU - VIEWING');
}

console.log('=== ALL 6 REAL UI DOM TESTS PASSED SUCCESSFULLY! ===');
