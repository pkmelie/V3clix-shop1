#!/bin/bash
# deploy.sh - Script de déploiement automatique V3clix Pack Bot
# Usage: sudo bash deploy.sh

set -e  # Arrêter en cas d'erreur

echo "======================================"
echo "🚀 V3clix Pack Bot - Déploiement"
echo "======================================"
echo ""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si exécuté en tant que root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Ce script doit être exécuté en tant que root${NC}"
   echo "Usage: sudo bash deploy.sh"
   exit 1
fi

# Configuration
PROJECT_DIR="/var/www/v3clix-api"
STORAGE_DIR="/var/www/storage"
PACKS_DIR="/var/www/packs"
DB_NAME="v3clix_packs"
DB_USER="v3clix_user"

echo -e "${YELLOW}📋 Configuration${NC}"
echo "Répertoire projet: $PROJECT_DIR"
echo "Stockage: $STORAGE_DIR"
echo "Packs: $PACKS_DIR"
echo "Base de données: $DB_NAME"
echo ""

# Demander des informations
read -p "Entrez votre domaine API (ex: api.v3clix-shop.com): " DOMAIN_API
read -p "Entrez votre domaine frontend (ex: v3clix-shop.com): " DOMAIN_FRONTEND
read -p "Entrez votre email pour SSL: " SSL_EMAIL
read -sp "Entrez un mot de passe pour PostgreSQL: " DB_PASSWORD
echo ""
read -p "Entrez votre clé API Resend: " RESEND_KEY
echo ""

# Confirmation
echo -e "${YELLOW}⚠️  Vérification de la configuration:${NC}"
echo "  - Domaine API: $DOMAIN_API"
echo "  - Domaine Frontend: $DOMAIN_FRONTEND"
echo "  - Email SSL: $SSL_EMAIL"
echo ""
read -p "Continuer ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation annulée."
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Début de l'installation...${NC}"
echo ""

# 1. Mise à jour du système
echo -e "${YELLOW}[1/10]${NC} Mise à jour du système..."
apt update && apt upgrade -y

# 2. Installation Node.js 18
echo -e "${YELLOW}[2/10]${NC} Installation Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi
echo "  Node.js version: $(node --version)"
echo "  npm version: $(npm --version)"

# 3. Installation PostgreSQL
echo -e "${YELLOW}[3/10]${NC} Installation PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
fi
echo "  PostgreSQL version: $(psql --version)"

# 4. Configuration PostgreSQL
echo -e "${YELLOW}[4/10]${NC} Configuration PostgreSQL..."
sudo -u postgres psql <<EOF
-- Créer la base de données
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

# Créer les tables
sudo -u postgres psql -d $DB_NAME <<'EOF'
CREATE TABLE IF NOT EXISTS purchases (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    selections JSONB NOT NULL,
    payment_intent_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    pack_id VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packs (
    id VARCHAR(32) PRIMARY KEY,
    purchase_id VARCHAR(32) REFERENCES purchases(id),
    download_token VARCHAR(64) UNIQUE NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP NOT NULL,
    downloaded BOOLEAN DEFAULT FALSE,
    downloaded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);
CREATE INDEX IF NOT EXISTS idx_packs_token ON packs(download_token);
CREATE INDEX IF NOT EXISTS idx_packs_expiry ON packs(expiry_date);
EOF

echo -e "${GREEN}  ✓ Base de données créée${NC}"

# 5. Installation Nginx
echo -e "${YELLOW}[5/10]${NC} Installation Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
fi
systemctl enable nginx
systemctl start nginx

# 6. Création des répertoires
echo -e "${YELLOW}[6/10]${NC} Création des répertoires..."
mkdir -p $PROJECT_DIR
mkdir -p $STORAGE_DIR/{templates,bots,assets,docs}
mkdir -p $PACKS_DIR

# Permissions
chown -R www-data:www-data $STORAGE_DIR
chown -R www-data:www-data $PACKS_DIR
chmod -R 755 $STORAGE_DIR
chmod -R 755 $PACKS_DIR

echo -e "${GREEN}  ✓ Répertoires créés${NC}"

# 7. Création du projet Node.js
echo -e "${YELLOW}[7/10]${NC} Configuration du projet Node.js..."
cd $PROJECT_DIR

# package.json
cat > package.json <<'PKGJSON'
{
  "name": "v3clix-pack-api",
  "version": "1.0.0",
  "description": "API de génération de packs personnalisés",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.3",
    "archiver": "^6.0.1",
    "resend": "^3.0.0",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5"
  }
}
PKGJSON

# Installation des dépendances
npm install

# Fichier .env
cat > .env <<ENVFILE
# Serveur
PORT=3001
NODE_ENV=production

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Chemins
STORAGE_PATH=$STORAGE_DIR
PACKS_PATH=$PACKS_DIR

# Domaine
DOMAIN=https://$DOMAIN_API
FRONTEND_URL=https://$DOMAIN_FRONTEND

# Resend
RESEND_API_KEY=$RESEND_KEY

# Sécurité
PACK_EXPIRY_DAYS=7
MAX_PACK_SIZE_GB=10
ENVFILE

chmod 600 .env

echo -e "${GREEN}  ✓ Projet Node.js configuré${NC}"

# 8. Configuration Nginx
echo -e "${YELLOW}[8/10]${NC} Configuration Nginx..."
cat > /etc/nginx/sites-available/v3clix-api <<NGINXCONF
server {
    listen 80;
    server_name $DOMAIN_API;

    client_max_body_size 10G;
    client_body_timeout 600s;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
    }

    # Compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
NGINXCONF

# Activer le site
ln -sf /etc/nginx/sites-available/v3clix-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Tester la configuration
nginx -t
systemctl reload nginx

echo -e "${GREEN}  ✓ Nginx configuré${NC}"

# 9. SSL avec Certbot
echo -e "${YELLOW}[9/10]${NC} Installation SSL (Certbot)..."
apt install -y certbot python3-certbot-nginx

# Obtenir le certificat
certbot --nginx -d $DOMAIN_API --non-interactive --agree-tos --email $SSL_EMAIL --redirect

echo -e "${GREEN}  ✓ SSL configuré${NC}"

# 10. Service Systemd
echo -e "${YELLOW}[10/10]${NC} Configuration du service systemd..."
cat > /etc/systemd/system/v3clix-api.service <<SERVICECONF
[Unit]
Description=V3clix Pack API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=v3clix-api
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICECONF

# Activer et démarrer le service
systemctl daemon-reload
systemctl enable v3clix-api
systemctl start v3clix-api

echo -e "${GREEN}  ✓ Service configuré et démarré${NC}"

# Configuration du firewall
echo ""
echo -e "${YELLOW}Configuration du firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5432/tcp  # PostgreSQL (local)

echo -e "${GREEN}  ✓ Firewall configuré${NC}"

# Script de nettoyage
cat > $PROJECT_DIR/cleanup.sh <<'CLEANUPSH'
#!/bin/bash
find /var/www/packs -name "*.zip" -mtime +7 -delete
echo "Cleanup terminé: $(date)" >> /var/log/v3clix-cleanup.log
CLEANUPSH

chmod +x $PROJECT_DIR/cleanup.sh

# Ajouter au crontab
(crontab -l 2>/dev/null; echo "0 3 * * * $PROJECT_DIR/cleanup.sh") | crontab -

echo -e "${GREEN}  ✓ Script de nettoyage configuré${NC}"

# Vérification finale
echo ""
echo "======================================"
echo -e "${GREEN}✅ Installation terminée !${NC}"
echo "======================================"
echo ""
echo "📋 Informations importantes:"
echo "  - API: https://$DOMAIN_API"
echo "  - Frontend: https://$DOMAIN_FRONTEND"
echo "  - Stockage: $STORAGE_DIR"
echo "  - Logs: journalctl -u v3clix-api -f"
echo ""
echo "🔧 Prochaines étapes:"
echo "  1. Copier le fichier server.js dans $PROJECT_DIR"
echo "  2. Redémarrer le service: systemctl restart v3clix-api"
echo "  3. Ajouter vos fichiers dans $STORAGE_DIR"
echo "  4. Tester l'API: curl https://$DOMAIN_API/health"
echo ""
echo "📊 Commandes utiles:"
echo "  - Statut: systemctl status v3clix-api"
echo "  - Logs: journalctl -u v3clix-api -f"
echo "  - Redémarrer: systemctl restart v3clix-api"
echo "  - Nginx: systemctl status nginx"
echo ""
echo -e "${YELLOW}⚠️  N'oubliez pas:${NC}"
echo "  - Configurer les DNS: $DOMAIN_API -> IP du serveur"
echo "  - Vérifier Resend: domaine vérifié"
echo "  - Ajouter vos fichiers sources dans $STORAGE_DIR"
echo ""

# Test de l'API
sleep 3
echo "🧪 Test de l'API..."
if curl -s https://$DOMAIN_API/health > /dev/null; then
    echo -e "${GREEN}✓ API répond correctement${NC}"
else
    echo -e "${RED}⚠ API ne répond pas. Vérifier les logs.${NC}"
fi

echo ""
echo "🎉 Déploiement terminé avec succès !"