'use strict';

// Keep this allowlist tight. This admin runs OS commands.
// All commands automatically inject BASEDIR as argv[1].

/** @type {Record<string, {label: string, args: Array<{name: string, type: 'uid'|'url'|'string', required?: boolean, maxLen?: number}>}>} */
const COMMANDS = {
  state: {
    label: 'Server state',
    args: []
  },
  upgrade: {
    label: 'Upgrade storage layout',
    args: []
  },
  purge: {
    label: 'Purge old data',
    args: []
  },

  webfinger: {
    label: 'Resolve @user@host (or actor URL) via WebFinger',
    args: [{ name: 'account', type: 'string', required: true, maxLen: 2048 }]
  },

  actor: {
    label: 'Fetch actor JSON (optional uid for signed fetch)',
    args: [
      { name: 'uid', type: 'uid', required: false },
      { name: 'url', type: 'string', required: true, maxLen: 2048 }
    ]
  },
  adduser: {
    label: 'Add user (prints password)',
    args: [{ name: 'uid', type: 'uid', required: true }]
  },
  resetpwd: {
    label: 'Reset user password (prints new one)',
    args: [{ name: 'uid', type: 'uid', required: true }]
  },
  deluser: {
    label: 'Delete user',
    args: [{ name: 'uid', type: 'uid', required: true }]
  },
  update: {
    label: "Send user's updated profile to following instances",
    args: [{ name: 'uid', type: 'uid', required: true }]
  },
  verify_links: {
    label: 'Verify user links (rel="me")',
    args: [{ name: 'uid', type: 'uid', required: true }]
  },

  webfinger_s: {
    label: 'Signed WebFinger (requires uid)',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'account', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  request: {
    label: 'Fetch ActivityPub object JSON (signed, requires uid)',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'url', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  insert: {
    label: 'Fetch object and insert into user timeline',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'url', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  collect_replies: {
    label: 'Collect all replies from a post (enqueue job)',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'url', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  follow: {
    label: 'Follow an actor URL',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'actor', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  unfollow: {
    label: 'Unfollow an actor URL',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'actor', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  muted: {
    label: 'List muted actors for user',
    args: [{ name: 'uid', type: 'uid', required: true }]
  },

  unmute: {
    label: 'Unmute an actor URL',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'actor', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  limit: {
    label: 'Limit an actor (drops their announces; must be followed)',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'actor', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  unlimit: {
    label: 'Remove limit from an actor',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'actor', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  ping: {
    label: 'Ping an actor (actor URL or @user@host)',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'actor_or_account', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  search: {
    label: 'Search posts by content (regex)',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'regex', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  pin: {
    label: 'Pin a post URL',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'msg_url', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  unpin: {
    label: 'Unpin a post URL',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'msg_url', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  bookmark: {
    label: 'Bookmark a post URL',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'msg_url', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  unbookmark: {
    label: 'Remove bookmark for a post URL',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'msg_url', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  lists: {
    label: 'List user lists',
    args: [{ name: 'uid', type: 'uid', required: true }]
  },

  list_members: {
    label: 'List members in a list',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'name', type: 'string', required: true, maxLen: 256 }
    ]
  },

  list_create: {
    label: 'Create a new list',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'name', type: 'string', required: true, maxLen: 256 }
    ]
  },

  list_remove: {
    label: 'Remove a list',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'name', type: 'string', required: true, maxLen: 256 }
    ]
  },

  list_add: {
    label: 'Add account to list (@user@host or actor URL)',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'name', type: 'string', required: true, maxLen: 256 },
      { name: 'account', type: 'string', required: true, maxLen: 2048 }
    ]
  },

  list_del: {
    label: 'Delete actor URL from list',
    args: [
      { name: 'uid', type: 'uid', required: true },
      { name: 'name', type: 'string', required: true, maxLen: 256 },
      { name: 'actor', type: 'string', required: true, maxLen: 2048 }
    ]
  },
  block: {
    label: 'Block instance (URL or domain)',
    args: [{ name: 'instance_url', type: 'string', required: true, maxLen: 2048 }]
  },
  unblock: {
    label: 'Unblock instance (URL or domain)',
    args: [{ name: 'instance_url', type: 'string', required: true, maxLen: 2048 }]
  }
};

module.exports = { COMMANDS };
