// PM2 설정 파일 - Lightsail에서 프로세스 관리용
module.exports = {
  apps: [{
    name: 'ai-leadership-lab',
    script: 'server.js',
    cwd: '/home/bitnami/ai-leadership-lab/server',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: '/home/bitnami/logs/app-error.log',
    out_file: '/home/bitnami/logs/app-out.log',
    log_file: '/home/bitnami/logs/app.log',
    time: true
  }]
};
