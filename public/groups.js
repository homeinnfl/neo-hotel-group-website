
/* ===== Settings: the only part you edit ===== */
const SETTINGS = {
  ENDPOINT: '', // paste the Apps Script web app URL (ends in /exec)
  HOTELS: [
    'SpringHill Suites Canton',
    'Comfort Inn & Suites Akron South',
    'Comfort Inn & Suites Cuyahoga Falls',
    'Home2 Suites Stow Akron',
  ],
  MIN_ROOMS: 5,
};
/* ============================================ */

(function () {
  const $ = id => document.getElementById(id);
  const form = $('gbr');
  const hotelSel = $('hotel');

  SETTINGS.HOTELS.forEach(h => { const o = document.createElement('option'); o.value = o.textContent = h; hotelSel.appendChild(o); });
  let preset = '';
  try { preset = new URLSearchParams(location.search).get('hotel') || ''; } catch (e) {}
  if (preset && SETTINGS.HOTELS.indexOf(preset) > -1) {
    hotelSel.value = preset;
    // Keep the hotel selector available to change.
    $('eyebrow').textContent = preset + ' · Groups';
  } else if (SETTINGS.HOTELS.length === 1) {
    hotelSel.value = SETTINGS.HOTELS[0];
    // Keep the hotel selector available to change.
  }

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const p = (s || '').split('-').map(Number); return p[0] ? new Date(p[0], p[1] - 1, p[2]) : null; };
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  $('checkIn').min = today;
  $('checkIn').addEventListener('change', () => {
    const a = parse($('checkIn').value);
    if (!a) return;
    const next = new Date(a); next.setDate(next.getDate() + 1);
    $('checkOut').min = ymd(next);
    if (!$('checkOut').value || $('checkOut').value <= $('checkIn').value) $('checkOut').value = ymd(next);
    tally();
  });
  $('checkOut').addEventListener('change', tally);

  /* Room calculator: total rooms is the anchor. Whichever bed type the guest
     sets last is kept, and the other one fills in the remaining rooms. */
  const num = id => Math.max(0, parseInt($(id).value, 10) || 0);
  let lastSet = 'kingRooms';
  function balance(changed) {
    const total = num('roomsPerNight');
    if (changed === 'kingRooms' || changed === 'queenRooms') lastSet = changed;
    const keep = lastSet, other = keep === 'kingRooms' ? 'queenRooms' : 'kingRooms';
    const k = Math.min(num(keep), total);
    $(keep).value = k;
    $(other).value = total - k;
    $(keep).max = $(other).max = total;
    const kings = num('kingRooms');
    $('splitK').style.width = total ? (kings / total * 100) + '%' : '0';
    $('splitQ').style.width = total ? ((total - kings) / total * 100) + '%' : '0';
    tally();
  }
  function step(id, by) {
    const max = id === 'roomsPerNight' ? 300 : num('roomsPerNight');
    const min = id === 'roomsPerNight' ? 1 : 0;
    $(id).value = Math.min(max, Math.max(min, num(id) + by));
    balance(id);
  }
  document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => step(b.dataset.target, Number(b.dataset.step))));
  ['roomsPerNight', 'kingRooms', 'queenRooms'].forEach(id => {
    $(id).addEventListener('input', () => { if ($(id).value !== '') balance(id); });
    $(id).addEventListener('blur', () => balance(id));
  });
  $('noPref').addEventListener('change', () => { $('mixField').classList.toggle('off', $('noPref').checked); $('mixField').querySelectorAll('input,button').forEach(el=>el.disabled=$('noPref').checked); tally(); });
  function roomSplit() {
    if ($('noPref').checked) return 'No preference';
    return num('kingRooms') + ' King, ' + num('queenRooms') + ' Two Queen';
  }

  function nights() {
    const a = parse($('checkIn').value), b = parse($('checkOut').value);
    return a && b ? Math.round((b - a) / 864e5) : 0;
  }
  function tally() {
    const r = parseInt($('roomsPerNight').value, 10) || 0;
    const n = nights();
    const t = $('tally');
    if (!n || n < 1) {
      t.innerHTML = '<span><b>' + r + '</b> rooms per night</span><span class="muted">Pick dates to see your total room nights</span>';
    } else {
      t.innerHTML = '<span><b>' + r + '</b> rooms × <b>' + n + '</b> night' + (n === 1 ? '' : 's') + ' = <b>' + (r * n) + '</b> room nights</span>';
    }
    if (!$('noPref').checked && r > 0) {
      t.innerHTML += '<span class="muted">' + num('kingRooms') + ' king · ' + num('queenRooms') + ' two-queen</span>';
    }
    if (r > 0 && r < SETTINGS.MIN_ROOMS) {
      t.innerHTML += '<span class="muted">Group rates start at ' + SETTINGS.MIN_ROOMS + ' rooms per night. For fewer rooms, book online or call the hotel.</span>';
    }
  }
  balance('roomsPerNight');

  function setErr(name, msg) {
    const box = form.querySelector('[data-for="' + name + '"]');
    if (box) box.textContent = msg || '';
    const f = $(name) && $(name).closest('.field');
    if (f) f.classList.toggle('invalid', !!msg); if($(name)){ $(name).setAttribute('aria-invalid',String(!!msg)); if(box){box.id=name+'-error';$(name).setAttribute('aria-describedby',box.id);} }
  }

  function validate() {
    const errs = {};
    if (!hotelSel.value) errs.hotel = 'Choose the hotel you want to stay at.';
    if (!$('groupName').value.trim()) errs.groupName = 'Add a name for your group or event.';
    if (!$('checkIn').value) errs.checkIn = 'Pick a check-in date.';
    else if ($('checkIn').value < today) errs.checkIn = 'Check-in can\'t be in the past.';
    if (!$('checkOut').value) errs.checkOut = 'Pick a check-out date.';
    else if ($('checkIn').value && $('checkOut').value <= $('checkIn').value) errs.checkOut = 'Check-out must be after check-in.';
    const r = parseInt($('roomsPerNight').value, 10) || 0;
    if (!Number.isInteger(Number($('roomsPerNight').value)) || r > 300) errs.roomsPerNight = 'Enter a whole number of rooms, up to 300.';
    if (r < SETTINGS.MIN_ROOMS) errs.roomsPerNight = 'Group blocks start at ' + SETTINGS.MIN_ROOMS + ' rooms per night.';
    if (!$('contactName').value.trim()) errs.contactName = 'Add your name.';
    if ($('phone').value.replace(/\D/g, '').length < 10) errs.phone = 'Add a phone number with area code.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('email').value.trim())) errs.email = 'Enter an email like name@example.com.';
    ['hotel', 'groupName', 'checkIn', 'checkOut', 'roomsPerNight', 'contactName', 'phone', 'email'].forEach(k => setErr(k, errs[k]));
    return errs;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    $('formErr').textContent = '';
    const errs = validate();
    const keys = Object.keys(errs);
    if (keys.length) {
      const first = $(keys[0]);
      if (first) first.focus();
      $('formErr').textContent = 'Please fix the ' + (keys.length === 1 ? 'highlighted field' : keys.length + ' highlighted fields') + ' above.';
      return;
    }
    const fd = new FormData(form);
    const data = {
      hotel: hotelSel.value,
      groupType: fd.get('groupType'),
      groupName: fd.get('groupName').trim(),
      organization: fd.get('organization').trim(),
      checkIn: fd.get('checkIn'),
      checkOut: fd.get('checkOut'),
      flexibleDates: $('flexibleDates').checked ? 'Yes' : 'No',
      roomsPerNight: parseInt(fd.get('roomsPerNight'), 10),
      guests: parseInt(fd.get('guests'), 10) || '',
      roomType: roomSplit(),
      kingRooms: $('noPref').checked ? '' : num('kingRooms'),
      queenRooms: $('noPref').checked ? '' : num('queenRooms'),
      targetRate: fd.get('targetRate'),
      payment: fd.get('payment'),
      needs: fd.getAll('needs'),
      contactName: fd.get('contactName').trim(),
      phone: fd.get('phone').trim(),
      email: fd.get('email').trim(),
      preferredContact: fd.get('preferredContact'),
      notes: fd.get('notes').trim(),
      website: fd.get('website'),
      sourcePage: (function () { try { return document.referrer || location.href; } catch (e) { return ''; } })(),
    };
    const btn = $('send');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      if (data.website) throw new Error('Please leave the website field blank.');
      if (!SETTINGS.ENDPOINT) {
        const lines = [
          'GROUP BLOCK REQUEST — NEO HOTEL GROUP', '',
          'Hotel: '+data.hotel, 'Group: '+data.groupName, 'Group type: '+data.groupType,
          'Organization: '+(data.organization||'Not specified'), '',
          'Check-in: '+data.checkIn, 'Check-out: '+data.checkOut, 'Flexible dates: '+data.flexibleDates,
          'Rooms per night: '+data.roomsPerNight, 'Nights: '+nights(), 'Total room nights: '+(data.roomsPerNight*nights()),
          'Bed preference: '+data.roomType, 'Guests: '+(data.guests||'Not specified'), '',
          'Target nightly rate: '+(data.targetRate?'$'+data.targetRate:'Please quote'), 'Payment: '+data.payment,
          'Additional needs: '+(data.needs.join(', ')||'None specified'), '',
          'Contact: '+data.contactName, 'Email: '+data.email, 'Phone: '+data.phone,
          'Preferred contact: '+data.preferredContact, '', 'Notes: '+(data.notes||'None'), '',
          'This is an inquiry, not a confirmed reservation.'
        ];
        const summary=lines.join('\n');
        $('requestSummary').value=summary;
        $('emailRequest').href='mailto:tbd@neohotelgroup.com?subject='+encodeURIComponent('Group block request — '+data.groupName+' — '+data.hotel)+'&body='+encodeURIComponent(summary);
        $('doneEmail').textContent='To: tbd@neohotelgroup.com';
      } else {
        const res=await fetch(SETTINGS.ENDPOINT,{method:'POST',body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
        const out=await res.json();
        if(!res.ok||!out.ok)throw new Error(out.error||'We couldn’t save your request.');
        $('doneTitle').textContent='Request received.';
        $('doneMessage').textContent='Our team will be in touch about your group stay at '+data.hotel+'.';
        $('doneEmail').textContent=out.id?'Reference: '+out.id:'';
        $('emailRequest').hidden=true;
        $('done').querySelector('details').hidden=true;
      }
      form.hidden=true;
      $('done').hidden=false;
      $('done').focus();
      $('done').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
      btn.disabled=false; btn.textContent=SETTINGS.ENDPOINT?'Send request':'Prepare email request ↗';
    } catch (err) {
      $('formErr').textContent = (err && err.message && !/fetch|network/i.test(err.message) ? err.message + ' ' : '') +
        'Your request was not sent. Check your connection and try again, or call the hotel directly.';
      btn.disabled = false; btn.textContent = SETTINGS.ENDPOINT?'Send request':'Prepare email request ↗';
    }
  });

  $('copyRequest').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('requestSummary').value);$('copyStatus').textContent='Copied. Paste into an email to tbd@neohotelgroup.com.';}
    catch{$('requestSummary').focus();$('requestSummary').select();$('copyStatus').textContent='Select and copy the request above.';}
  });
  $('editRequest').addEventListener('click',()=>{$('done').hidden=true;form.hidden=false;hotelSel.focus();});
  if(SETTINGS.ENDPOINT){$('send').textContent='Send request';form.querySelector('.fine').textContent='This is an inquiry, not a confirmed reservation. Our team will confirm availability and rates.';}
})();
