module.exports = {
  apps: [{
    name: 'travel-bot',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Ограничение памяти для Node.js (подходит для VPS с 1-2GB RAM)
      NODE_OPTIONS: '--max-old-space-size=512'
    },
    instances: 1, // Для начала используем 1 процесс
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    
    // Дополнительные настройки для стабильности
    kill_timeout: 3000,
    listen_timeout: 3000,
    
    // Экспоненциальная задержка при перезапуске
    exp_backoff_restart_delay: 100,
    
    // Настройки для health checks
    min_uptime: '10s',
    max_restarts: 10,
    
    // Интеграция с системой мониторинга
    instance_var: 'INSTANCE_ID',
    merge_logs: true,
    
    // Автоматический перезапуск при изменении памяти
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }],

  // Настройки для деплоя (опционально)
  deploy: {
    production: {
      user: 'www-data',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/travel-bot.git',
      path: '/var/www/travel-bot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};