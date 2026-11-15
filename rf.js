// Rustfall <-> Firebase bridge. Godot polls window.RF via JavaScriptBridge.eval (string in / string out).
(function () {
  const cfg = {apiKey: "AIzaSyCCLERSkV9-tbMs0Cwk88P0aqFV8U7bXXo", authDomain: "pizza-punch-65ec7.firebaseapp.com", projectId: "pizza-punch-65ec7",
    storageBucket: "pizza-punch-65ec7.firebasestorage.app", messagingSenderId: "856940383066", appId: "1:856940383066:web:2b800d1ae84e28dd51c163",
    databaseURL: "https://pizza-punch-65ec7-default-rtdb.firebaseio.com"};
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const NS = 'rustfall';
  const RF = window.RF = {ready: false, err: '', user: null, q: [], st: [], inq: [], room: null, role: '', peer: false, _unsubs: []};
  const push = (o) => { RF.q.push(o); if (RF.q.length > 200) RF.q.shift(); };
  RF.poll = () => { if (!RF.q.length) return ''; const s = JSON.stringify(RF.q); RF.q = []; return s; };
  RF.takeSt = () => { if (!RF.st.length) return ''; const s = JSON.stringify(RF.st); RF.st = []; return s; };
  RF.takeIn = () => { if (!RF.inq.length) return ''; const s = JSON.stringify(RF.inq); RF.inq = []; return s; };
  RF.safe = () => { const e = document.getElementById('safe'); if (!e) return '0,0,0,0'; const c = getComputedStyle(e);
    return [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map((v) => parseFloat(v) || 0).join(','); };
  RF.userJson = () => JSON.stringify(RF.user);
  const nameOf = (u) => {
    if (!u) return '';
    if (u.isAnonymous) return 'GUEST-' + u.uid.slice(0, 4).toUpperCase();
    let n = (u.displayName || (u.email || '').split('@')[0] || 'PLAYER').split(' ')[0];
    n = n.replace(/[^A-Za-z0-9_]/g, '').slice(0, 12);
    return (n || 'PLAYER').toUpperCase();
  };
  // ---------------------------------------------------------------- HTML dialogs
  const modal = () => document.getElementById('modal');
  const card = () => document.getElementById('mcard');
  RF.closeModal = () => { const m = modal(); if (m) { m.style.display = 'none'; card().innerHTML = ''; } const c = document.getElementById('canvas'); if (c) c.focus(); };
  const openModal = (html, wire) => {
    const m = modal(); card().innerHTML = html; m.style.display = 'flex';
    ['keydown', 'keyup', 'keypress'].forEach((ev) => m.addEventListener(ev, (e) => e.stopPropagation()));
    wire(card());
  };
  RF.openModal = openModal;
  // Google blocks its sign-in page inside app WebViews, so the Android wrapper app uses email sign-in only.
  const inWrapper = /RustfallApp\//.test(navigator.userAgent);
  const G_ICON = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.4 28.8c-.5-1.4-.8-3-.8-4.8s.3-3.3.8-4.8l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.7-4.1-13.6-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>';
  RF.openAccount = () => {
    if (!RF.ready) { openModal('<h2>ACCOUNT</h2><p>Online features are unavailable right now' + (RF.err ? ' (' + RF.err + ')' : '') + '. You can still play; progress saves on this device.</p><button class="alt" id="x">CLOSE</button>', (c) => { c.querySelector('#x').onclick = RF.closeModal; }); return; }
    const u = RF.user;
    if (u && !u.anon) {
      openModal('<h2>ACCOUNT</h2><p>Signed in as <b>' + u.name + '</b><br><span class="muted">' + (u.email || '') + '</span></p><p class="muted">Your unlocked areas, best scores and settings sync to the cloud. Your best run appears on the leaderboard as ' + u.name + '.</p><button class="alt" id="so">SIGN OUT</button><button id="x">CLOSE</button>',
        (c) => { c.querySelector('#x').onclick = RF.closeModal; c.querySelector('#so').onclick = () => { RF._A.signOut(RF._auth); RF.closeModal(); }; });
      return;
    }
    openModal('<h2>SIGN IN</h2><p class="muted">Save progress to the cloud, post leaderboard scores and play online co-op.</p>' +
      (inWrapper ? '<p class="muted">Google sign-in only works in a browser (Google blocks it inside apps). Use email here, or <a href="#" id="oc" style="color:#ffb35c">open Rustfall in Chrome</a> to use Google.</p>'
        : '<button class="g" id="gg">' + G_ICON + '<span>SIGN IN WITH GOOGLE</span></button>') +
      '<div class="muted" style="text-align:center;margin:8px 0">- OR EMAIL -</div>' +
      '<input id="em" type="email" placeholder="Email" autocomplete="email" autocapitalize="off"><input id="pw" type="password" placeholder="Password (6+ characters)" autocomplete="current-password">' +
      '<div class="row"><button id="si">SIGN IN</button><button id="su" class="alt">NEW ACCOUNT</button></div>' +
      '<div class="err" id="er"></div><button class="alt" id="rs" style="font-size:8px">FORGOT PASSWORD</button>' +
      '<button class="alt" id="x">' + (u ? 'CLOSE' : 'PLAY AS GUEST') + '</button>', (c) => {
      const er = c.querySelector('#er');
      const fail = (e) => { er.textContent = friendly(e); };
      c.querySelector('#x').onclick = RF.closeModal;
      const oc = c.querySelector('#oc');
      if (oc) oc.onclick = (e) => { e.preventDefault(); try { window.RustfallAndroid.openExternal(location.origin + location.pathname); } catch (_) { location.href = location.href; } };
      if (c.querySelector('#gg')) c.querySelector('#gg').onclick = () => {
        er.textContent = '';
        RF._A.signInWithPopup(RF._auth, new RF._A.GoogleAuthProvider()).then(() => RF.closeModal()).catch((e) => {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
            try { sessionStorage.setItem('rf_redir', '1'); } catch (_) {}
            RF._A.signInWithRedirect(RF._auth, new RF._A.GoogleAuthProvider()).catch(fail);
          } else fail(e);
        });
      };
      const em = () => c.querySelector('#em').value.trim(), pw = () => c.querySelector('#pw').value;
      c.querySelector('#si').onclick = () => RF._A.signInWithEmailAndPassword(RF._auth, em(), pw()).then(() => RF.closeModal()).catch(fail);
      c.querySelector('#su').onclick = () => RF._A.createUserWithEmailAndPassword(RF._auth, em(), pw()).then(() => RF.closeModal()).catch(fail);
      c.querySelector('#rs').onclick = () => { if (!em()) { er.textContent = 'Type your email first.'; return; }
        RF._A.sendPasswordResetEmail(RF._auth, em()).then(() => { er.textContent = 'Reset email sent.'; }).catch(fail); };
    });
  };
  const friendly = (e) => {
    const c = (e && e.code) || String(e);
    const m = {'auth/invalid-email': 'That email looks wrong.', 'auth/missing-password': 'Enter a password.', 'auth/weak-password': 'Password needs 6+ characters.',
      'auth/email-already-in-use': 'That email already has an account - tap SIGN IN.', 'auth/invalid-credential': 'Wrong email or password.',
      'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email.', 'auth/popup-closed-by-user': 'Sign-in window closed.',
      'auth/cancelled-popup-request': 'Sign-in window closed.', 'auth/network-request-failed': 'No connection.', 'auth/too-many-requests': 'Too many tries - wait a minute.',
      'auth/admin-restricted-operation': 'Guest online play is off - please sign in.', 'auth/unauthorized-domain': 'This site is not allowed to sign in yet.'};
    return m[c] || ('Sign-in failed (' + c + ')');
  };
  RF.openJoin = () => {
    openModal('<h2>JOIN CO-OP</h2><p class="muted">Type the 4-letter room code your partner sees.</p><input id="cd" class="code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text">' +
      '<div class="err" id="er"></div><div class="row"><button id="ok">JOIN</button><button class="alt" id="x">CANCEL</button></div>', (c) => {
      const inp = c.querySelector('#cd'), er = c.querySelector('#er');
      setTimeout(() => inp.focus(), 50);
      inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); };
      c.querySelector('#x').onclick = () => { RF.closeModal(); push({t: 'join_cancel'}); };
      const go = () => { const code = inp.value; if (code.length !== 4) { er.textContent = 'Codes are 4 letters.'; return; }
        er.textContent = 'Joining...'; RF.roomJoin(code).then(() => RF.closeModal()).catch((e) => { er.textContent = String(e && e.message || e); }); };
      c.querySelector('#ok').onclick = go;
      inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    });
  };
  // ---------------------------------------------------------------- Firebase
  const nofb = /[?&]nofb/.test(location.search);
  if (nofb) { RF.err = 'disabled'; push({t: 'fb', ok: false}); return; }
  Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')]).then(([AP, A, D]) => {
    const app = AP.initializeApp(cfg, 'rustfall');
    const auth = A.getAuth(app), db = D.getDatabase(app);
    RF._A = A; RF._D = D; RF._auth = auth; RF._db = db;
    const r = (p) => D.ref(db, NS + '/' + p);
    RF._r = r;
    A.getRedirectResult(auth).catch((e) => push({t: 'auth_err', msg: friendly(e)}));
    A.onAuthStateChanged(auth, (u) => {
      RF.user = u ? {uid: u.uid, name: nameOf(u), email: u.email || '', anon: !!u.isAnonymous} : null;
      push({t: 'user', user: RF.user});
    });
    D.onValue(D.ref(db, '.info/connected'), (s) => push({t: 'conn', on: !!s.val()}));
    RF.ready = true; push({t: 'fb', ok: true});
    // ---- cloud save
    RF.cloudLoad = () => { if (!RF.user) return; D.get(r('users/' + RF.user.uid)).then((s) => push({t: 'cloud', data: s.val() ? s.val().d : ''}))
      .catch((e) => push({t: 'cloud_err', msg: String(e.message || e)})); };
    RF.cloudSave = (json) => { if (!RF.user || RF.user.anon) return; D.set(r('users/' + RF.user.uid), {d: String(json).slice(0, 20000), t: Date.now()})
      .catch((e) => push({t: 'cloud_err', msg: String(e.message || e)})); };
    // ---- leaderboard (best total score per player)
    RF.lbSubmit = (score, area) => {
      if (!RF.user || RF.user.anon) return;
      const ref = r('lb/' + RF.user.uid);
      D.get(ref).then((s) => { const old = s.val(); if (old && old.s >= score) return;
        return D.set(ref, {n: RF.user.name, s: Math.floor(score), a: Math.max(1, Math.min(4, area | 0)), t: Date.now()}); })
        .then(() => push({t: 'lb_ok'})).catch((e) => push({t: 'lb_err', msg: String(e.message || e)}));
    };
    RF.lbTop = (n) => { D.get(D.query(r('lb'), D.orderByChild('s'), D.limitToLast(n || 20))).then((s) => {
      const a = []; s.forEach((c) => { a.push(Object.assign({me: !!(RF.user && c.key === RF.user.uid)}, c.val())); }); a.reverse(); push({t: 'lb', rows: a}); })
      .catch((e) => push({t: 'lb_err', msg: String(e.message || e)})); };
    // ---- co-op rooms
    const ensureAuth = () => RF.user ? Promise.resolve() : A.signInAnonymously(auth).then(() => new Promise((res) => {
      const w = () => RF.user ? res() : setTimeout(w, 50); w(); }));
    const clearSubs = () => { RF._unsubs.forEach((f) => { try { f(); } catch (e) {} }); RF._unsubs = []; };
    const LET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    RF.roomCreate = (meta) => ensureAuth().then(async () => {
      for (let tries = 0; tries < 6; tries++) {
        let code = ''; for (let i = 0; i < 4; i++) code += LET[Math.floor(Math.random() * LET.length)];
        try {
          await D.set(r('rooms/' + code), {host: RF.user.uid, hn: RF.user.name, t: Date.now(), meta: String(meta)});
        } catch (e) { continue; }
        RF.room = code; RF.role = 'host'; RF.peer = false;
        D.onDisconnect(r('rooms/' + code)).remove();
        clearSubs();
        RF._unsubs.push(D.onValue(r('rooms/' + code + '/guest'), (s) => { const on = !!s.val(); if (on !== RF.peer) { RF.peer = on; push({t: 'peer', on}); } }));
        RF._unsubs.push(D.onValue(r('rooms/' + code + '/gn'), (s) => { if (s.val()) push({t: 'peer_name', name: s.val()}); }));
        RF._unsubs.push(D.onValue(r('rooms/' + code + '/in'), (s) => { if (s.val()) { RF.nin = (RF.nin || 0) + 1; RF.inq.push(s.val()); if (RF.inq.length > 30) RF.inq.shift(); } }));
        push({t: 'room', role: 'host', code});
        return code;
      }
      throw new Error('Could not create a room - try again.');
    }).catch((e) => { push({t: 'room_err', msg: friendly(e)}); throw e; });
    RF.roomJoin = (code) => ensureAuth().then(async () => {
      code = String(code).toUpperCase();
      const hs = await D.get(r('rooms/' + code + '/host')).catch(() => null);
      if (!hs || !hs.val()) throw new Error('No room with code ' + code + '.');
      if (hs.val() === RF.user.uid) throw new Error('That is your own room.');
      try { await D.set(r('rooms/' + code + '/guest'), RF.user.uid); } catch (e) { throw new Error('Room is full.'); }
      await D.set(r('rooms/' + code + '/gn'), RF.user.name).catch(() => {});
      D.onDisconnect(r('rooms/' + code + '/in')).remove();
      D.onDisconnect(r('rooms/' + code + '/gn')).remove();
      D.onDisconnect(r('rooms/' + code + '/guest')).remove();
      RF.room = code; RF.role = 'guest'; RF.peer = true;
      clearSubs();
      let hostName = '';
      const hn = await D.get(r('rooms/' + code + '/hn')).catch(() => null); if (hn) hostName = hn.val() || '';
      RF._unsubs.push(D.onValue(r('rooms/' + code + '/meta'), (s) => { if (s.val() !== null) push({t: 'meta', meta: s.val()}); }));
      RF._unsubs.push(D.onValue(r('rooms/' + code + '/st'), (s) => { if (s.val()) { RF.nst = (RF.nst || 0) + 1; RF.stb = String(s.val()).length; RF.st.push(s.val()); if (RF.st.length > 30) RF.st.shift(); } }));
      RF._unsubs.push(D.onValue(r('rooms/' + code + '/host'), (s) => { if (!s.val() && RF.room === code) { push({t: 'closed'}); RF.leave(true); } }));
      push({t: 'room', role: 'guest', code, host: hostName});
    }).catch((e) => { throw e; });
    RF.setMeta = (m) => { if (RF.role === 'host' && RF.room) D.set(r('rooms/' + RF.room + '/meta'), String(m)).catch(() => {}); };
    RF.sendSt = (s) => { if (RF.role === 'host' && RF.room && RF.peer) D.set(r('rooms/' + RF.room + '/st'), String(s)).catch(() => {}); };
    RF.sendIn = (s) => { if (RF.role === 'guest' && RF.room) D.set(r('rooms/' + RF.room + '/in'), String(s)).catch(() => {}); };
    RF.kick = () => { if (RF.role === 'host' && RF.room) { D.remove(r('rooms/' + RF.room + '/guest')).catch(() => {}); D.remove(r('rooms/' + RF.room + '/in')).catch(() => {}); } };
    RF.leave = (quiet) => {
      const code = RF.room, role = RF.role; clearSubs(); RF.room = null; RF.role = ''; RF.peer = false; RF.st = []; RF.inq = [];
      if (!code || quiet === true) return;
      if (role === 'host') D.remove(r('rooms/' + code)).catch(() => {});
      else { D.remove(r('rooms/' + code + '/in')).catch(() => {}); D.remove(r('rooms/' + code + '/gn')).catch(() => {}); D.remove(r('rooms/' + code + '/guest')).catch(() => {}); }
    };
    addEventListener('pagehide', () => { if (RF.room) RF.leave(); });
  }).catch((e) => { RF.err = String(e && e.message || e); push({t: 'fb', ok: false}); });
})();
