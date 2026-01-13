module.exports = {
  apps: [
    {
      name: 'snac',
      cwd: '/home/abby/ghrepo/snac2',
      script: 'bash',
      args: '-c "make && ./snac httpd /home/abby/ghrepo/snac2/data"',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/snac-error.log',
      out_file: './logs/snac-out.log',
      log_file: './logs/snac-combined.log',
      time: true
    },
    {
      name: 'abbysocial-admin',
      cwd: '/home/abby/ghrepo/snac2/admin',
      script: 'node',
      args: 'server.js',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',

        // Bind to localhost by default; expose via your reverse proxy if needed.
        HOST: '127.0.0.1',
        PORT: '3939',

        // Point at your snac storage and binary.
        SNAC_BASEDIR: '/home/abby/ghrepo/snac2/data',
        SNAC_BIN: '/home/abby/ghrepo/snac2/snac',

        // Admin login (set strong values before using!).
        ADMIN_USER: 'admin',
        ADMIN_PASS: 'admin',
        ADMIN_SESSION_SECRET: 'CHANGE_ME_TOO'
      },
      error_file: '../logs/admin-error.log',
      out_file: '../logs/admin-out.log',
      log_file: '../logs/admin-combined.log',
      time: true
    }
  ]
};
