module.exports = {
  apps: [{
    name: 'mltrack-backend',
    script: 'dist/index.js',
    cwd: '/var/www/apps/mltrack/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3006
    },
    error_file: '/var/log/pm2/mltrack-error.log',
    out_file: '/var/log/pm2/mltrack-out.log',
    log_file: '/var/log/pm2/mltrack-combined.log',
    time: true,
    // Configuración específica para el scheduler
    kill_timeout: 5000,
    listen_timeout: 3000,
    // Variables de entorno
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
