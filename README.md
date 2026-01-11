# AbbySocial

A snac fork with Chinese localization and minor improvements.

Aim to provide a better experience and less visual clutter when using snac. Richer features, no more js and cookies restrictions. (But still minimalistic and self-site scripts only.)

## Changes from snac 2.75
- instance timeline will hide delete button for non-authors
- also delete any attachments referenced by the deleted post, instead of current rolling back
- paste-image.js included, allowing image pasting from clipboard in post composition
- a sane style.css 
- zh_TW localization
- various private page xs_html structure fixes and improvements



Sponsor: https://ko-fi.com/abbychau





## Build flags

`snac` includes support for the Mastodon API; if you are not interested on it, you can compile it out by running

```sh
make CFLAGS=-DNO_MASTODON_API
```

If your compilation process complains about undefined references to `shm_open()` and `shm_unlink()` (it happens, for example, on Ubuntu 20.04.6 LTS), run it as:

```sh
make LDFLAGS=-lrt
```

If it still gives compilation errors (because your system does not implement the shared memory functions), you can fix it with

```sh
make CFLAGS=-DWITHOUT_SHM
```

From version 2.68, Linux Landlock sandboxing is included (not supported on Linux kernels older than 5.13.0). It's still a bit experimental, so you must compile it in explicitly with

```sh
make CFLAGS=-DWITH_LINUX_SANDBOX
```

From version 2.73, the language of the web UI can be configured; the `po/` source subdirectory includes a set of translation files, one per language. After initializing your instance, copy whatever language file you want to use to the `lang/` subdirectory of the base directory.

See the administrator manual on how to proceed from here.

Upstream: https://codeberg.org/grunfink/snac2