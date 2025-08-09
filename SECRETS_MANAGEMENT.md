# Secrets Management Guide

## Обзор

Правильное управление секретами критически важно для безопасности приложения. Этот документ описывает best practices для хранения и использования конфиденциальных данных.

## Принципы безопасности

1. **Никогда не коммитьте секреты в Git**
2. **Используйте разные секреты для разных окружений**
3. **Регулярно ротируйте секреты**
4. **Минимизируйте доступ к секретам**
5. **Логируйте доступ к секретам**

## Рекомендуемые решения

### 1. HashiCorp Vault (Рекомендуется для Production)

#### Установка и настройка

```bash
# Установка Vault
wget https://releases.hashicorp.com/vault/1.15.0/vault_1.15.0_linux_amd64.zip
unzip vault_1.15.0_linux_amd64.zip
sudo mv vault /usr/local/bin/

# Запуск в dev режиме (только для тестирования!)
vault server -dev

# Production конфигурация
cat > /etc/vault/config.hcl <<EOF
storage "postgresql" {
  connection_url = "postgresql://vault:password@localhost:5432/vault"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 0
  tls_cert_file = "/opt/vault/tls/vault.crt"
  tls_key_file  = "/opt/vault/tls/vault.key"
}

api_addr = "https://vault.yourdomain.com:8200"
cluster_addr = "https://vault.yourdomain.com:8201"
ui = true
EOF
```

#### Интеграция с приложением

```typescript
// server/services/vault.ts
import { Vault } from 'node-vault';

class VaultService {
  private client: Vault;
  
  constructor() {
    this.client = new Vault({
      endpoint: process.env.VAULT_ADDR || 'https://vault.yourdomain.com:8200',
      token: process.env.VAULT_TOKEN
    });
  }
  
  async getSecret(path: string): Promise<any> {
    try {
      const result = await this.client.read(path);
      return result.data;
    } catch (error) {
      console.error('Failed to read secret from Vault:', error);
      throw new Error('Secret retrieval failed');
    }
  }
  
  async initialize() {
    // Загружаем все необходимые секреты при старте
    const secrets = await this.getSecret('secret/data/ai-travel-agent/production');
    
    // Устанавливаем переменные окружения
    process.env.DATABASE_URL = secrets.data.DATABASE_URL;
    process.env.TELEGRAM_TOKEN = secrets.data.TELEGRAM_TOKEN;
    process.env.JWT_ACCESS_SECRET = secrets.data.JWT_ACCESS_SECRET;
    // ... остальные секреты
  }
}

export const vaultService = new VaultService();
```

### 2. AWS Secrets Manager

```bash
# Установка AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Создание секрета
aws secretsmanager create-secret \
  --name ai-travel-agent/production \
  --secret-string file://secrets.json
```

```typescript
// server/services/aws-secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

class AWSSecretsService {
  private client: SecretsManagerClient;
  
  constructor() {
    this.client = new SecretsManagerClient({ region: "us-east-1" });
  }
  
  async getSecrets(secretName: string): Promise<any> {
    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });
      
      const response = await this.client.send(command);
      return JSON.parse(response.SecretString || '{}');
    } catch (error) {
      console.error('Failed to retrieve secret:', error);
      throw error;
    }
  }
}
```

### 3. Kubernetes Secrets (для K8s деплойментов)

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-travel-agent-secrets
type: Opaque
stringData:
  database-url: postgresql://user:pass@host:5432/db
  telegram-token: YOUR_TELEGRAM_TOKEN
  jwt-secret: YOUR_JWT_SECRET
```

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-travel-agent
spec:
  template:
    spec:
      containers:
      - name: app
        image: ai-travel-agent:latest
        envFrom:
        - secretRef:
            name: ai-travel-agent-secrets
```

## Локальная разработка

### 1. Использование .env файлов

```bash
# Создайте .env.local (добавьте в .gitignore!)
cp .env.example .env.local

# Генерация безопасных секретов
openssl rand -base64 32  # Для JWT секретов
openssl rand -hex 32     # Для API ключей
```

### 2. Использование direnv

```bash
# Установка direnv
curl -sfL https://direnv.net/install.sh | bash

# Создание .envrc
cat > .envrc <<EOF
# Загрузка секретов из безопасного хранилища
export DATABASE_URL=$(vault kv get -field=database_url secret/ai-travel-agent/dev)
export TELEGRAM_TOKEN=$(vault kv get -field=telegram_token secret/ai-travel-agent/dev)
EOF

# Активация
direnv allow
```

## Генерация безопасных секретов

### Скрипт для генерации секретов

```bash
#!/bin/bash
# scripts/generate-secrets.sh

generate_secret() {
  openssl rand -base64 64 | tr -d '\n'
}

echo "Generating secure secrets..."
echo ""
echo "JWT_ACCESS_SECRET=$(generate_secret)"
echo "JWT_REFRESH_SECRET=$(generate_secret)"
echo "CSRF_SECRET=$(generate_secret)"
echo "COOKIE_SECRET=$(generate_secret)"
echo "SESSION_SECRET=$(generate_secret)"
echo ""
echo "⚠️  Store these secrets in your secret management system!"
```

## CI/CD интеграция

### GitHub Actions с секретами

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Retrieve secrets from AWS Secrets Manager
        run: |
          SECRET=$(aws secretsmanager get-secret-value --secret-id ai-travel-agent/production)
          echo "::add-mask::$SECRET"
          echo "SECRETS=$SECRET" >> $GITHUB_ENV
      
      - name: Deploy application
        env:
          SECRETS: ${{ env.SECRETS }}
        run: |
          # Deployment logic here
```

## Ротация секретов

### Автоматическая ротация

```typescript
// server/services/secret-rotation.ts
import { CronJob } from 'cron';
import { vaultService } from './vault';
import { generateSecureToken } from './auth';

class SecretRotationService {
  private rotationJobs: CronJob[] = [];
  
  startRotation() {
    // Ротация JWT секретов каждые 30 дней
    const jwtRotation = new CronJob('0 0 1 * *', async () => {
      console.log('Rotating JWT secrets...');
      
      const newAccessSecret = generateSecureToken(64);
      const newRefreshSecret = generateSecureToken(64);
      
      // Сохраняем новые секреты в Vault
      await vaultService.writeSecret('secret/data/ai-travel-agent/production', {
        JWT_ACCESS_SECRET: newAccessSecret,
        JWT_REFRESH_SECRET: newRefreshSecret,
        rotated_at: new Date().toISOString()
      });
      
      // Уведомляем администраторов
      await this.notifyAdmins('JWT secrets rotated successfully');
    });
    
    jwtRotation.start();
    this.rotationJobs.push(jwtRotation);
  }
  
  private async notifyAdmins(message: string) {
    // Отправка уведомлений через Slack/Email
  }
}
```

## Мониторинг и аудит

### Логирование доступа к секретам

```typescript
// server/middleware/secretAudit.ts
export const auditSecretAccess = (secretName: string, userId?: string) => {
  logger.info('Secret accessed', {
    secretName,
    userId,
    timestamp: new Date().toISOString(),
    source: 'application'
  });
};
```

## Чеклист безопасности

- [ ] Все секреты удалены из репозитория
- [ ] .env файлы добавлены в .gitignore
- [ ] Настроена система управления секретами
- [ ] Реализована ротация секретов
- [ ] Настроен аудит доступа к секретам
- [ ] Секреты зашифрованы в покое (at rest)
- [ ] Секреты передаются по защищенным каналам
- [ ] Минимальные права доступа к секретам
- [ ] Резервное копирование секретов настроено
- [ ] План восстановления после компрометации

## Экстренные процедуры

### При компрометации секретов

1. **Немедленно смените все затронутые секреты**
2. **Инвалидируйте все активные сессии**
3. **Проверьте логи на подозрительную активность**
4. **Уведомите затронутых пользователей**
5. **Обновите секреты во всех окружениях**
6. **Проведите security review**

### Команды для быстрой смены секретов

```bash
# Скрипт экстренной ротации
#!/bin/bash
# scripts/emergency-rotate.sh

echo "🚨 Emergency secret rotation started..."

# Генерируем новые секреты
NEW_JWT_SECRET=$(openssl rand -base64 64)
NEW_DB_PASSWORD=$(openssl rand -base64 32)

# Обновляем в Vault
vault kv put secret/ai-travel-agent/production \
  JWT_ACCESS_SECRET="$NEW_JWT_SECRET" \
  DATABASE_PASSWORD="$NEW_DB_PASSWORD"

# Перезапускаем приложение
kubectl rollout restart deployment/ai-travel-agent

echo "✅ Secrets rotated. Please update all dependent services."
```