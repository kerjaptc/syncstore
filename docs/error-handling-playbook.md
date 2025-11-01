# Error Handling Playbook

## Overview

This document provides comprehensive guidance for handling errors in the StoreSync application, including troubleshooting procedures, escalation policies, and recovery strategies.

## Error Classification

### Error Types

1. **Validation Errors** (`VALIDATION_ERROR`)
   - User input validation failures
   - Data format errors
   - Business rule violations
   - **Severity**: Low
   - **Action**: Fix input and retry

2. **Authentication Errors** (`AUTHENTICATION_ERROR`)
   - Login failures
   - Token expiration
   - Invalid credentials
   - **Severity**: High
   - **Action**: Re-authenticate user

3. **Authorization Errors** (`AUTHORIZATION_ERROR`)
   - Insufficient permissions
   - Role-based access violations
   - **Severity**: High
   - **Action**: Check user permissions

4. **Platform API Errors** (`PLATFORM_API_ERROR`)
   - Shopee/TikTok Shop API failures
   - Third-party service errors
   - **Severity**: Medium-High
   - **Action**: Check platform status, retry with backoff

5. **Sync Errors** (`SYNC_ERROR`)
   - Data synchronization failures
   - Conflict resolution issues
   - **Severity**: Medium
   - **Action**: Review sync logs, manual intervention

6. **Rate Limit Errors** (`RATE_LIMIT_ERROR`)
   - API rate limiting
   - Too many requests
   - **Severity**: Medium
   - **Action**: Implement backoff, queue requests

7. **Network Errors** (`NETWORK_ERROR`)
   - Connection timeouts
   - DNS resolution failures
   - **Severity**: Medium
   - **Action**: Retry with exponential backoff

8. **Database Errors** (`DATABASE_ERROR`)
   - Connection failures
   - Query errors
   - Data integrity issues
   - **Severity**: High-Critical
   - **Action**: Check database health, escalate

9. **Internal Errors** (`INTERNAL_ERROR`)
   - Application bugs
   - Unexpected exceptions
   - **Severity**: Critical
   - **Action**: Immediate investigation required

## Severity Levels

### Low Severity
- **Response Time**: 24-48 hours
- **Notification**: In-app only
- **Examples**: Validation errors, minor UI issues

### Medium Severity
- **Response Time**: 4-8 hours
- **Notification**: Email + In-app
- **Examples**: Sync failures, API timeouts

### High Severity
- **Response Time**: 1-2 hours
- **Notification**: Email + Slack + In-app
- **Examples**: Authentication failures, database issues

### Critical Severity
- **Response Time**: 15-30 minutes
- **Notification**: All channels + SMS
- **Examples**: System-wide outages, data corruption

## Troubleshooting Procedures

### 1. Platform API Errors

#### Shopee API Issues
```bash
# Check Shopee API status
curl -H "Authorization: Bearer $SHOPEE_TOKEN" \
  "https://partner.shopeemobile.com/api/v2/shop/get_shop_info"

# Common issues:
# - Token expired: Refresh OAuth token
# - Rate limited: Implement exponential backoff
# - API changes: Check Shopee developer docs
```

#### TikTok Shop API Issues
```bash
# Check TikTok Shop API status
curl -H "Authorization: Bearer $TIKTOK_TOKEN" \
  "https://open-api.tiktokglobalshop.com/api/shops/info"

# Common issues:
# - Invalid signature: Check app secret
# - Scope issues: Verify app permissions
# - Regional restrictions: Check supported regions
```

### 2. Database Connection Issues

```sql
-- Check database connections
SELECT count(*) FROM pg_stat_activity;

-- Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Check database locks
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### 3. Sync Operation Failures

#### Product Sync Issues
1. Check sync job status in dashboard
2. Review error logs for specific failures
3. Verify platform credentials are valid
4. Check for data conflicts or validation errors
5. Manual retry with conflict resolution

#### Inventory Sync Issues
1. Verify inventory levels in master catalog
2. Check platform-specific inventory limits
3. Review reservation conflicts
4. Validate stock adjustment logs

#### Order Sync Issues
1. Check order import logs
2. Verify webhook configurations
3. Review order status mapping
4. Check for duplicate order handling

### 4. Performance Issues

#### Slow Database Queries
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Analyze slow queries
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### High Memory Usage
```bash
# Check Node.js memory usage
node --inspect --max-old-space-size=4096 server.js

# Monitor memory leaks
npm install -g clinic
clinic doctor -- node server.js
```

## Recovery Strategies

### 1. Circuit Breaker Recovery

When circuit breakers are open:
1. Check the underlying service health
2. Verify network connectivity
3. Review error patterns in logs
4. Manual circuit breaker reset if service is healthy
5. Gradual traffic increase

### 2. Data Recovery

#### Database Recovery
```bash
# Point-in-time recovery
pg_restore --clean --no-owner --no-privileges \
  --dbname=storesync_recovery backup_file.dump

# Verify data integrity
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM orders WHERE created_at > '2024-01-01';
```

#### Sync Data Recovery
1. Identify last successful sync timestamp
2. Re-sync data from that point
3. Resolve any conflicts manually
4. Verify data consistency across platforms

### 3. Service Recovery

#### Application Recovery
```bash
# Restart application services
pm2 restart storesync-app
pm2 restart storesync-worker

# Check service health
curl -f http://localhost:3000/api/health
```

#### Cache Recovery
```bash
# Clear Redis cache
redis-cli FLUSHALL

# Warm up critical caches
curl -X POST http://localhost:3000/api/cache/warmup
```

## Escalation Procedures

### Level 1: Automated Response
- **Trigger**: Error detected by monitoring
- **Action**: Automatic retry, circuit breaker activation
- **Notification**: System logs only

### Level 2: Development Team
- **Trigger**: Medium severity errors, repeated failures
- **Response Time**: 4-8 hours
- **Notification**: Email + Slack
- **Actions**: 
  - Review error logs
  - Apply fixes
  - Monitor for resolution

### Level 3: Senior Engineering
- **Trigger**: High severity errors, system degradation
- **Response Time**: 1-2 hours
- **Notification**: Email + Slack + Phone
- **Actions**:
  - Incident response activation
  - Root cause analysis
  - Emergency fixes

### Level 4: Critical Incident
- **Trigger**: Critical severity, system outage
- **Response Time**: 15-30 minutes
- **Notification**: All channels + SMS + Phone calls
- **Actions**:
  - War room activation
  - All hands on deck
  - Customer communication
  - Post-incident review

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rate**
   - Target: < 1% for API endpoints
   - Alert: > 5% error rate for 5 minutes

2. **Response Time**
   - Target: < 2 seconds for 95th percentile
   - Alert: > 5 seconds for 95th percentile

3. **Database Performance**
   - Target: < 100ms average query time
   - Alert: > 500ms average query time

4. **Sync Success Rate**
   - Target: > 99% success rate
   - Alert: < 95% success rate

5. **Platform API Health**
   - Target: 100% availability
   - Alert: Any API returning errors

### Alert Configuration

```yaml
# Example alert rules (Prometheus/AlertManager format)
groups:
  - name: storesync.rules
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseConnectionFailure
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failure"
          
      - alert: SyncJobFailure
        expr: increase(sync_jobs_failed_total[10m]) > 5
        for: 0m
        labels:
          severity: high
        annotations:
          summary: "Multiple sync job failures"
```

## Post-Incident Procedures

### 1. Immediate Actions
- Confirm service restoration
- Update status page
- Notify stakeholders
- Document timeline

### 2. Post-Incident Review
- Schedule review meeting within 24 hours
- Analyze root cause
- Identify contributing factors
- Document lessons learned

### 3. Follow-up Actions
- Implement preventive measures
- Update monitoring and alerting
- Improve documentation
- Conduct team training

## Common Error Scenarios

### Scenario 1: Shopee API Rate Limiting
**Symptoms**: 429 errors from Shopee API
**Cause**: Exceeded API rate limits
**Solution**: 
1. Implement exponential backoff
2. Distribute requests across time
3. Cache frequently accessed data
4. Request rate limit increase from Shopee

### Scenario 2: Database Connection Pool Exhaustion
**Symptoms**: "Connection pool exhausted" errors
**Cause**: Too many concurrent database connections
**Solution**:
1. Increase connection pool size
2. Optimize query performance
3. Implement connection pooling
4. Add connection monitoring

### Scenario 3: Memory Leak in Sync Process
**Symptoms**: Increasing memory usage, eventual OOM
**Cause**: Objects not being garbage collected
**Solution**:
1. Profile memory usage
2. Identify leak sources
3. Fix object references
4. Add memory monitoring

### Scenario 4: Webhook Delivery Failures
**Symptoms**: Missing order updates, sync delays
**Cause**: Webhook endpoint unavailable
**Solution**:
1. Implement webhook retry logic
2. Add webhook health monitoring
3. Fallback to polling mechanism
4. Queue failed webhooks

## Contact Information

### Emergency Contacts
- **On-call Engineer**: +1-XXX-XXX-XXXX
- **Engineering Manager**: +1-XXX-XXX-XXXX
- **DevOps Lead**: +1-XXX-XXX-XXXX

### Escalation Matrix
| Severity | Primary | Secondary | Manager |
|----------|---------|-----------|---------|
| Low | Dev Team | - | - |
| Medium | Senior Dev | Dev Lead | Eng Manager |
| High | Dev Lead | Eng Manager | CTO |
| Critical | Eng Manager | CTO | CEO |

### External Contacts
- **Shopee Support**: partner-support@shopee.com
- **TikTok Shop Support**: developer@tiktokshop.com
- **Infrastructure Provider**: support@provider.com

## Tools and Resources

### Monitoring Tools
- **Sentry**: Error tracking and performance monitoring
- **Grafana**: Metrics visualization
- **Prometheus**: Metrics collection
- **Uptime Robot**: External monitoring

### Debugging Tools
- **Sentry**: Error details and stack traces
- **Database Logs**: Query performance and errors
- **Application Logs**: Structured logging with correlation IDs
- **Network Tools**: curl, ping, traceroute

### Documentation
- **API Documentation**: Internal API specs
- **Platform APIs**: Shopee and TikTok Shop documentation
- **Runbooks**: Operational procedures
- **Architecture Docs**: System design and data flow