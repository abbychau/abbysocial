'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { COMMANDS } = require('./commands');

function getEnv(name, fallback) {
  const val = process.env[name];
  return (val === undefined || val === '') ? fallback : val;
}

function validateUid(uid) {
  return typeof uid === 'string' && uid.length > 0 && /^[A-Za-z0-9_]+$/.test(uid);
}

function validateArg(def, value) {
  if (value === undefined || value === null || value === '') {
    if (def.required) return { ok: false, error: `Missing ${def.name}` };
    return { ok: true, value: undefined };
  }

  if (typeof value !== 'string') return { ok: false, error: `${def.name} must be a string` };

  const trimmed = value.trim();
  if (def.maxLen && trimmed.length > def.maxLen) return { ok: false, error: `${def.name} too long` };

  if (def.type === 'uid') {
    if (!validateUid(trimmed)) return { ok: false, error: `${def.name} must match [A-Za-z0-9_]+` };
    return { ok: true, value: trimmed };
  }

  if (def.type === 'url') {
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: `${def.name} must be http(s)` };
      return { ok: true, value: trimmed };
    } catch {
      return { ok: false, error: `${def.name} must be a valid URL` };
    }
  }

  // string
  if (trimmed.length === 0) return { ok: false, error: `${def.name} must not be empty` };
  return { ok: true, value: trimmed };
}

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(String(a), 'utf8');
  const bBuf = Buffer.from(String(b), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64UrlDecode(str) {
  const s = String(str).replaceAll('-', '+').replaceAll('_', '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64');
}

function signSession(payloadJson, secret) {
  const h = crypto.createHmac('sha256', secret).update(payloadJson, 'utf8').digest();
  return base64UrlEncode(h);
}

function makeSessionCookie({ user, ttlMs, secret }) {
  const now = Date.now();
  const payload = { u: user, iat: now, exp: now + ttlMs };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadJson);
  const sig = signSession(payloadJson, secret);
  return `${payloadB64}.${sig}`;
}

function parseAndVerifySessionCookie(cookieValue, secret) {
  if (!cookieValue || typeof cookieValue !== 'string') return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;

  let payloadJson;
  try {
    payloadJson = base64UrlDecode(parts[0]).toString('utf8');
  } catch {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;
  if (!payload.u || !payload.exp) return null;
  if (Date.now() > payload.exp) return null;

  const expectedSig = signSession(payloadJson, secret);
  if (!timingSafeEqual(parts[1], expectedSig)) return null;
  return payload;
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveSnacBin() {
  const fromEnv = getEnv('SNAC_BIN', '');
  if (fromEnv) {
    // If it's a relative path, resolve it relative to this file's directory
    // (so it works even if the process is started from a different CWD).
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(__dirname, fromEnv);
  }

  // Convenient default for this repo: snac is usually built at ../snac
  const repoBin = path.resolve(__dirname, '..', 'snac');
  if (fs.existsSync(repoBin) && isExecutable(repoBin)) return repoBin;

  // Fallback to PATH.
  return 'snac';
}

function runSnac({ snacBin, basedir, command, argv, timeoutMs }) {
  return new Promise((resolve) => {
    // IMPORTANT: Do NOT set SNAC_BASEDIR in the child environment.
    // snac treats SNAC_BASEDIR as an override and will NOT consume the
    // positional basedir argument, shifting argv parsing (e.g. adduser would
    // interpret the basedir path as the uid, causing "only alphanumeric" errors).
    const env = { ...process.env };
    delete env.SNAC_BASEDIR;

    // Always pass basedir explicitly: `snac <cmd> <basedir> ...`
    const fullArgs = [command, basedir, ...argv];

    const child = spawn(snacBin, fullArgs, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const killTimer = setTimeout(() => {
      stderr += `\n[admin] Timeout after ${timeoutMs}ms; killing process.\n`;
      try { child.kill('SIGKILL'); } catch {}
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    child.on('close', (code, signal) => {
      clearTimeout(killTimer);
      resolve({ code, signal, stdout, stderr });
    });

    child.on('error', (err) => {
      clearTimeout(killTimer);
      resolve({ code: 127, signal: null, stdout, stderr: `${stderr}\n${String(err)}` });
    });
  });
}

const app = express();
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // This UI is same-origin only.
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:']
    }
  }
}));

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

app.use(rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

const adminUser = getEnv('ADMIN_USER', 'admin');
const adminPass = getEnv('ADMIN_PASS', '');
if (!adminPass) {
  // Fail fast: running unauthenticated is too risky.
  throw new Error('ADMIN_PASS is required');
}

const sessionSecret = getEnv('ADMIN_SESSION_SECRET', '') || crypto.createHash('sha256').update(`abbysocial-admin:${adminPass}`, 'utf8').digest('hex');
const sessionTtlMs = Number(getEnv('ADMIN_SESSION_TTL_MS', String(12 * 60 * 60 * 1000))); // 12h
const sessionCookieName = 'abbysocial_admin';

app.use(cookieParser());

function isAuthed(req) {
  const sess = parseAndVerifySessionCookie(req.cookies?.[sessionCookieName], sessionSecret);
  return !!sess && sess.u === adminUser;
}

function requireAuthApi(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(401).json({ ok: false, error: 'Not authenticated' });
}

function requireAuthPage(req, res, next) {
  if (isAuthed(req)) return next();
  return res.redirect('/login');
}

const basedir = getEnv('SNAC_BASEDIR', '');
if (!basedir) throw new Error('SNAC_BASEDIR is required');

// Refuse to start if it doesn't look like a snac basedir.
const serverJson = path.join(basedir, 'server.json');
if (!fs.existsSync(serverJson)) {
  throw new Error(`SNAC_BASEDIR does not contain server.json: ${serverJson}`);
}

const snacBin = resolveSnacBin();
const port = Number(getEnv('PORT', '3939'));
const host = getEnv('HOST', '127.0.0.1');
const timeoutMs = Number(getEnv('SNAC_TIMEOUT_MS', '60000'));

if (!snacBin) throw new Error('SNAC_BIN resolution failed');

app.get('/login', (req, res) => {
  if (isAuthed(req)) return res.redirect('/');

  // Inline HTML/CSS so login works even when static assets are protected.
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Abbysocial Admin - Login</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#0b0d10;color:#e7ebf0}
    .wrap{max-width:460px;margin:72px auto;padding:0 16px}
    .card{background:#12161c;border:1px solid #273141;border-radius:14px;padding:16px}
    .label{font-size:12px;color:#9aa6b2;margin:10px 0 6px}
    input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #273141;background:#0f1319;color:#e7ebf0}
    button{margin-top:14px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid #273141;background:rgba(110,168,254,.18);color:#e7ebf0;cursor:pointer}
    .muted{color:#9aa6b2;font-size:12px;margin-top:10px}
  </style>
</head>
<body>
  <div class="wrap">
    <h1 style="font-size:22px;margin:0 0 12px">Abbysocial Admin</h1>
    <div class="card">
      <form method="post" action="/login">
        <div class="label">Username</div>
        <input name="user" autocomplete="username" required />
        <div class="label">Password</div>
        <input name="pass" type="password" autocomplete="current-password" required />
        <button type="submit">Sign in</button>
      </form>
      <div class="muted">This admin is intended to be bound to localhost and used by you only.</div>
    </div>
  </div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  const user = String(req.body?.user || '');
  const pass = String(req.body?.pass || '');

  // Rate limiting is already applied globally.
  if (user !== adminUser || !timingSafeEqual(pass, adminPass)) {
    return res.status(401).type('html').send('Login failed');
  }

  const cookieVal = makeSessionCookie({ user: adminUser, ttlMs: sessionTtlMs, secret: sessionSecret });
  res.cookie(sessionCookieName, cookieVal, {
    httpOnly: true,
    sameSite: 'strict',
    secure: getEnv('COOKIE_SECURE', '0') === '1',
    maxAge: sessionTtlMs,
    path: '/'
  });
  return res.redirect('/');
});

app.get('/logout', (req, res) => {
  res.clearCookie(sessionCookieName, { path: '/' });
  res.redirect('/login');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/commands', (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  res.json({
    basedir,
    snacBin,
    commands: Object.entries(COMMANDS).map(([name, def]) => ({ name, ...def }))
  });
});

app.post('/api/run', async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  const body = req.body || {};
  const command = body.command;
  const args = body.args || {};

  if (typeof command !== 'string' || !(command in COMMANDS)) {
    return res.status(400).json({ ok: false, error: 'Command not allowed' });
  }

  const def = COMMANDS[command];
  /** @type {string[]} */
  const argv = [];

  for (const argDef of def.args) {
    const check = validateArg(argDef, args[argDef.name]);
    if (!check.ok) return res.status(400).json({ ok: false, error: check.error });
    if (check.value !== undefined) argv.push(check.value);
  }

  const result = await runSnac({ snacBin, basedir, command, argv, timeoutMs });

  res.json({
    ok: result.code === 0,
    command,
    argv: [command, basedir, ...argv],
    code: result.code,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr
  });
});

// Protect UI files behind the login.
app.use('/', requireAuthPage, express.static(path.join(__dirname, 'public'), { fallthrough: true }));

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Abbysocial admin listening on http://${host}:${port}`);
  console.log(`SNAC_BASEDIR=${basedir}`);
});
