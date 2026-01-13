/* global fetch */
'use strict';

const els = {
  basedir: document.getElementById('basedir'),
  refresh: document.getElementById('refresh'),
  command: document.getElementById('command'),
  commandLabel: document.getElementById('commandLabel'),
  args: document.getElementById('args'),
  run: document.getElementById('run'),
  runHint: document.getElementById('runHint'),
  output: document.getElementById('output'),
  passwordCard: document.getElementById('passwordCard'),
  passwordLabel: document.getElementById('passwordLabel'),
  passwordValue: document.getElementById('passwordValue'),
  passwordHint: document.getElementById('passwordHint'),
  copyPassword: document.getElementById('copyPassword')
};

let commandDefs = [];

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function setOutput(text) {
  els.output.textContent = text;
}

function hidePassword() {
  if (!els.passwordCard) return;
  els.passwordCard.hidden = true;
  els.passwordValue.value = '';
  els.passwordLabel.textContent = 'Password';
  els.passwordHint.textContent = 'This password is shown once by snac; store it safely.';
}

function showPassword({ label, value, hint }) {
  if (!els.passwordCard) return;
  els.passwordLabel.textContent = label;
  els.passwordValue.value = value;
  els.passwordHint.textContent = hint;
  els.passwordCard.hidden = false;
}

function extractPassword(command, stdout) {
  const s = String(stdout || '');

  if (command === 'adduser') {
    // snac prints: "User password is <pwd>"
    const m = s.match(/\bUser password is\s+([^\s]+)\b/);
    if (m) {
      return {
        label: 'New user password',
        value: m[1],
        hint: 'Store this password now; it may not be shown again.'
      };
    }
  }

  if (command === 'resetpwd') {
    // snac prints: "New password for user <uid> is <pwd>"
    const m = s.match(/\bNew password for user\s+[^\s]+\s+is\s+([^\s]+)\b/);
    if (m) {
      return {
        label: 'Reset password',
        value: m[1],
        hint: 'Store this password now; it may not be shown again.'
      };
    }
  }

  return null;
}

function renderArgs(def) {
  els.args.innerHTML = '';
  els.commandLabel.textContent = def.label || '';

  for (const arg of def.args) {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.style.marginTop = '10px';

    const col = document.createElement('div');
    col.className = 'grow';

    const label = document.createElement('label');
    label.className = 'label';
    label.textContent = `${arg.name}${arg.required ? ' *' : ''} (${arg.type})`;

    const input = document.createElement('input');
    input.id = `arg_${arg.name}`;
    input.placeholder = arg.type === 'uid' ? 'e.g. walter' : '';

    col.appendChild(label);
    col.appendChild(input);
    wrap.appendChild(col);
    els.args.appendChild(wrap);
  }

  if (def.name === 'deluser') {
    const warn = document.createElement('div');
    warn.className = 'hint';
    warn.style.color = 'var(--danger)';
    warn.style.marginTop = '8px';
    warn.textContent = 'Warning: deluser is destructive and unfollows accounts first.';
    els.args.appendChild(warn);
  }
}

async function loadCommands() {
  const res = await fetch('/api/commands');
  if (!res.ok) throw new Error(`Failed to load commands: ${res.status}`);
  const data = await res.json();

  els.basedir.textContent = data.basedir;

  commandDefs = data.commands;
  els.command.innerHTML = '';
  for (const cmd of commandDefs) {
    const opt = document.createElement('option');
    opt.value = cmd.name;
    opt.textContent = cmd.label ? `${cmd.name} — ${cmd.label}` : cmd.name;
    els.command.appendChild(opt);
  }

  const first = commandDefs[0];
  if (first) {
    els.command.value = first.name;
    renderArgs(first);
  }
}

function currentDef() {
  const name = els.command.value;
  return commandDefs.find((d) => d.name === name);
}

async function runCommand() {
  const def = currentDef();
  if (!def) return;

  const args = {};
  for (const arg of def.args) {
    const input = document.getElementById(`arg_${arg.name}`);
    args[arg.name] = input ? input.value : '';
  }

  els.run.disabled = true;
  els.runHint.textContent = 'Running…';
  setOutput('(running…)');
  hidePassword();

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command: def.name, args })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setOutput(`HTTP ${res.status}\n\n${escapeHtml(data.error || 'Request failed')}`);
      return;
    }

    const header = [
      `ok: ${data.ok}`,
      `exit: ${data.code}${data.signal ? ` (signal ${data.signal})` : ''}`,
      `argv: ${Array.isArray(data.argv) ? data.argv.join(' ') : ''}`
    ].join('\n');

    const out = [
      header,
      '',
      '--- stdout ---',
      data.stdout || '(empty)',
      '',
      '--- stderr ---',
      data.stderr || '(empty)'
    ].join('\n');

    setOutput(out);

    const pw = extractPassword(def.name, data.stdout);
    if (pw && data.ok) showPassword(pw);
  } finally {
    els.run.disabled = false;
    els.runHint.textContent = '';
  }
}

els.copyPassword?.addEventListener('click', async () => {
  const value = els.passwordValue?.value || '';
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    els.passwordHint.textContent = 'Copied to clipboard.';
  } catch {
    // Fallback for older browsers / non-secure contexts
    els.passwordValue.focus();
    els.passwordValue.select();
    document.execCommand('copy');
    els.passwordHint.textContent = 'Copied (fallback).';
  }
});

els.refresh.addEventListener('click', () => {
  loadCommands().catch((e) => setOutput(String(e)));
});

els.command.addEventListener('change', () => {
  const def = currentDef();
  if (def) renderArgs(def);
  hidePassword();
});

els.run.addEventListener('click', () => {
  runCommand().catch((e) => setOutput(String(e)));
});

loadCommands().catch((e) => setOutput(String(e)));
