# Production Deployment Checklist

## ✅ Pre-deployment Checklist

### 🔐 Security
- [ ] All API keys and secrets removed from code and configs
- [ ] Secrets stored in secure secret management system
- [ ] SSL certificates obtained and configured
- [ ] Security headers configured in Nginx
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection protection verified
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented

### 🏗️ Infrastructure
- [ ] Docker images built and tested
- [ ] Docker secrets configured
- [ ] Database backups configured and tested
- [ ] Redis persistence enabled
- [ ] Health checks configured
- [ ] Monitoring (Prometheus/Grafana) set up
- [ ] Log aggregation configured
- [ ] Error tracking (Sentry) configured
- [ ] Load balancer configured
- [ ] Auto-scaling policies defined

### 📦 Dependencies
- [ ] All npm packages updated
- [ ] Security vulnerabilities fixed (`npm audit`)
- [ ] Production dependencies separated from dev
- [ ] Package lock file committed
- [ ] License compliance checked

### 🧪 Testing
- [ ] All tests passing
- [ ] Code coverage > 70%
- [ ] Integration tests passing
- [ ] Load testing completed
- [ ] Security testing done
- [ ] User acceptance testing completed

### 📚 Documentation
- [ ] API documentation up to date
- [ ] Deployment guide updated
- [ ] Runbook created
- [ ] Architecture diagrams current
- [ ] Environment variables documented

### 🚀 Deployment Process
- [ ] Zero-downtime deployment tested
- [ ] Rollback procedure documented and tested
- [ ] Database migration scripts ready
- [ ] Feature flags configured (if applicable)
- [ ] CDN configured for static assets
- [ ] DNS records configured

### 📊 Performance
- [ ] Database queries optimized
- [ ] Indexes created
- [ ] Caching strategy implemented
- [ ] Response times < 200ms for API
- [ ] Static assets minified and compressed
- [ ] Images optimized

### 🔄 Business Continuity
- [ ] Disaster recovery plan documented
- [ ] Backup restoration tested
- [ ] Failover procedures tested
- [ ] SLA defined and achievable
- [ ] On-call rotation scheduled
- [ ] Incident response plan ready

## 📋 Deployment Steps

### 1. Pre-deployment (1 hour before)
```bash
# Verify all services are healthy
docker-compose -f docker-compose.production.yml ps
docker-compose -f docker-compose.production.yml exec app npm run test

# Create database backup
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U $DB_USER $DB_NAME > backup-$(date +%Y%m%d-%H%M%S).sql

# Pull latest images
docker-compose -f docker-compose.production.yml pull
```

### 2. Create Docker Secrets
```bash
# Create secrets in Docker
echo "your-db-user" | docker secret create ai_travel_agent_db_user -
echo "your-db-password" | docker secret create ai_travel_agent_db_password -
echo "your-jwt-secret" | docker secret create ai_travel_agent_jwt_access_secret -
# ... repeat for all secrets
```

### 3. Deploy
```bash
# Deploy with rolling update
docker stack deploy -c docker-compose.production.yml ai-travel-agent

# Or with docker-compose
docker-compose -f docker-compose.production.yml up -d --scale app=2

# Monitor deployment
docker service logs -f ai-travel-agent_app
```

### 4. Post-deployment Verification
```bash
# Check health endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/health

# Run smoke tests
npm run test:smoke

# Check metrics
curl http://localhost:9090/metrics

# Verify logs
docker logs ai-travel-agent_app_1 --tail 100
```

### 5. Monitoring Setup
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards showing key metrics
- [ ] Alerts configured for:
  - High error rate (> 1%)
  - High response time (> 500ms)
  - Low disk space (< 20%)
  - High memory usage (> 80%)
  - Service downtime

## 🚨 Rollback Procedure

If issues are detected:

```bash
# 1. Revert to previous version
docker service update --image ai-travel-agent:previous-version ai-travel-agent_app

# 2. Or full rollback
docker stack deploy -c docker-compose.production-previous.yml ai-travel-agent

# 3. Restore database if needed
docker-compose -f docker-compose.production.yml exec postgres psql -U $DB_USER $DB_NAME < backup-timestamp.sql
```

## 📞 Emergency Contacts

- **DevOps Lead**: +X-XXX-XXX-XXXX
- **Backend Lead**: +X-XXX-XXX-XXXX
- **Database Admin**: +X-XXX-XXX-XXXX
- **Security Team**: security@company.com

## 🔍 Common Issues and Solutions

### High Memory Usage
```bash
# Check memory usage
docker stats

# Restart with memory limits
docker update --memory="2g" --memory-swap="2g" container_id
```

### Database Connection Issues
```bash
# Check connection
docker-compose exec app npm run db:health

# Restart database
docker-compose restart postgres
```

### SSL Certificate Issues
```bash
# Renew certificates
certbot renew --nginx

# Restart nginx
docker-compose restart nginx
```

## ✅ Sign-off

- [ ] Technical Lead: ___________________ Date: _______
- [ ] Security Review: __________________ Date: _______
- [ ] Business Owner: ___________________ Date: _______
- [ ] DevOps: ___________________________ Date: _______