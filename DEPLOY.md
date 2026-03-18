# AWS Lightsail 배포 가이드

## 1. Lightsail 인스턴스 생성

1. AWS Lightsail 콘솔 접속
2. **Create Instance** 클릭
3. 설정:
   - Platform: **Linux/Unix**
   - Blueprint: **Node.js** (Bitnami)
   - Instance Plan: **$5/month** (1GB RAM, 1 vCPU)
   - Instance name: `ai-leadership-lab`
4. **Create instance** 클릭

## 2. 고정 IP 할당

1. Networking 탭 → **Create static IP**
2. 인스턴스에 연결

## 3. 서버 접속 및 배포

```bash
# SSH 접속 (Lightsail 콘솔에서 SSH 버튼 클릭 또는)
ssh -i LightsailDefaultKey.pem bitnami@<고정IP>

# 프로젝트 클론
cd /home/bitnami
git clone <your-repo-url> ai-leadership-lab
cd ai-leadership-lab/server

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
nano .env  # SESSION_SECRET 변경!

# PM2로 서버 실행
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 부팅 시 자동 시작

# 로그 디렉토리 생성
mkdir -p /home/bitnami/logs
```

## 4. Nginx 리버스 프록시 설정

```bash
# Bitnami Nginx 설정 편집
sudo nano /opt/bitnami/nginx/conf/server_blocks/app.conf
```

아래 내용 추가:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Nginx 재시작
sudo /opt/bitnami/ctlscript.sh restart nginx
```

## 5. 도메인 연결 (선택)

1. Lightsail → Networking → **DNS Zone** 생성
2. 도메인 네임서버를 Lightsail DNS로 변경
3. A 레코드 → 고정 IP 연결

## 6. SSL 인증서 (HTTPS)

```bash
# Bitnami Let's Encrypt 설정
sudo /opt/bitnami/bncert-tool
# 화면 안내에 따라 도메인 입력 및 설정
```

SSL 설정 후 `.env`에서 `USE_HTTPS=true`로 변경

## 7. 데이터 백업

```bash
# SQLite DB 백업 (cron으로 자동화 권장)
cp /home/bitnami/ai-leadership-lab/server/data/app.db /home/bitnami/backups/app-$(date +%Y%m%d).db
```

## 기본 관리자 계정

- 이메일: `admin@aileadershiplab.com`
- 비밀번호: `admin1234`
- **반드시 로그인 후 비밀번호를 변경하세요!**

## 포트 방화벽

Lightsail → Networking → IPv4 Firewall에서:
- HTTP (80) ✅
- HTTPS (443) ✅
- SSH (22) ✅
