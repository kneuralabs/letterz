/* ── Kneuralabs SSO guard ─────────────────────────────────────────────────────
 * Gates Letterz behind sso.kneuralabs.com. Runs synchronously in <head> so the
 * app never paints for an unauthenticated visitor.
 *
 * Flow (mirrors the SSO contract in sso.kneuralabs.com):
 *   1. sso.kneuralabs.com authenticates the employee, then redirects back here
 *      with ?kn-auth=<base64 JSON {id,name,role,apps}>.
 *   2. We decode that payload, persist it for the tab, and strip it from the URL.
 *   3. Access is granted only when the employee's SSO profile lists this app
 *      (admins bypass). Otherwise we bounce to login or back to the intranet.
 */
(function () {
  'use strict';

  var APP_ID       = 'letterz';
  var SSO_URL      = 'https://sso.kneuralabs.com/';
  var INTRANET_URL = 'https://intranet.kneuralabs.com/';
  var STORE_KEY    = 'kn-sso-session';

  // UTF-8-safe base64 decode (mirrors the SSO side's TextEncoder + btoa).
  function decodeAuth(raw) {
    var bin = atob(raw);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function gotoLogin() {
    var here = location.origin + location.pathname;
    location.replace(SSO_URL + '?redirect=' + encodeURIComponent(here));
  }

  function entitled(sess) {
    if (!sess || !sess.id) return false;
    if (sess.role === 'admin') return true;
    return Array.isArray(sess.apps) && sess.apps.indexOf(APP_ID) !== -1;
  }

  // 1. Consume an SSO redirect token, if one just arrived.
  var params = new URLSearchParams(location.search);
  var token  = params.get('kn-auth');
  if (token) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(decodeAuth(token))); }
    catch (e) { /* malformed token — falls through to the login redirect */ }
    // Never leave the token in the address bar / history.
    params.delete('kn-auth');
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  // 2. Enforce a valid, app-authorised session.
  var session = loadSession();
  if (!session)            { gotoLogin();                 return; }
  if (!entitled(session))  { location.replace(INTRANET_URL); return; }

  // 3. Expose the verified identity (read-only) for the app to use.
  window.KN_SSO = Object.freeze({
    id:   session.id,
    name: session.name,
    role: session.role,
    apps: session.apps || [],
    signOut: function () {
      sessionStorage.removeItem(STORE_KEY);
      gotoLogin();
    }
  });
})();
