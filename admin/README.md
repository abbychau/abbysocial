# Abbysocial Admin (Node.js)

This is a minimal admin web UI for running a strict allowlist of `snac` CLI commands.

It is intentionally simple and intentionally restrictive: running arbitrary OS commands from a web server is dangerous.

## Setup

1) Install deps:

- `cd admin && npm install`

2) Set environment variables:

- `SNAC_BASEDIR` (required): the snac data directory (must contain `server.json`)
- `ADMIN_PASS` (required): login password (used by the /login form)
- `ADMIN_USER` (optional, default `admin`)
- `ADMIN_SESSION_SECRET` (optional): secret used to sign the session cookie (recommended)
- `ADMIN_SESSION_TTL_MS` (optional, default `43200000` / 12h)
- `COOKIE_SECURE` (optional, default `0`): set to `1` if you run behind HTTPS
- `HOST` (optional, default `127.0.0.1`)
- `PORT` (optional, default `3939`)
- `SNAC_BIN` (optional, default `snac`)
- `SNAC_TIMEOUT_MS` (optional, default `60000`)

Example:

- `export SNAC_BASEDIR=/home/abby/ghrepo/snac2/data`
- `export ADMIN_USER=admin`
- `export ADMIN_PASS='change-me-now'`
- If you built snac in this repo, you can point to it explicitly:
- If you built snac in this repo, you can point to it explicitly (absolute or relative paths are supported):
	- `export SNAC_BIN=/home/abby/ghrepo/snac2/snac`
- `cd admin && npm start`

Then open:

- `http://127.0.0.1:3939/`

## What it can run

The command allowlist is in [commands.js](commands.js). By default:

- `state`, `upgrade`, `purge`
- `adduser`, `resetpwd`, `deluser`, `verify_links`
- `block`, `unblock`

## Safety notes

- Bind it to localhost only (default) and put it behind your existing TLS proxy if you expose it.
- Run it as the same UNIX user that owns the snac basedir.
- Keep the allowlist tight; don’t add commands that accept file paths unless you really mean it.
