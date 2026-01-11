module.exports = {
  apps: [{
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
  }]
};
