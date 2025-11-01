# SyncStore Troubleshooting Guide

**Version:** 1.0.0  
**Date:** November 2, 2025  
**Scope:** Phase 1 - Data Import and Master Schema

---

## Quick Reference

### Emergency Contacts
- **System Administrator:** [Your contact info]
- **Database Administrator:** [DBA contact info]
- **API Support:** [Platform API support contacts]

### Critical Commands
```bash
# Check system status
npm run health-check

# View recent logs
tail -f logs/syncstore.log

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Restart services
pm2 restart syncstore
```

---

## Common Issues

### 1. Import Process Failures

#### Issue: Shopee Import Fails with Authentication Error

**Error Messages:**
```
❌ Shopee API error: 401 Unauthorized
❌ Invalid signature
❌ Access token expired
```

**Diagnosis Steps:**
1. Check API credentials:
   ```bash
   echo "Partner ID: $SHOPEE_PARTNER_ID"
   echo "Shop ID: $SHOPEE_SHOP_ID"
   # Don't echo sensitive keys in production
   ```

2. Test API connectivity:
   ```bash
   curl -X GET "https://partner.shopeemobile.com/api/v2/shop/get_shop_info" \
     -H "Authorization: Bearer $SHOPEE_ACCESS_TOKEN"
   ```

3. Verify signature generation:
   ```typescript
   // Test signature generation
   const testSignature = generateShopeeSignature({
     partnerId: 'your_partner_id',
     apiPath: '/api/v2/shop/get_shop_info',
     timestamp: Math.floor(Date.now() / 1000),
     accessToken: 'your_access_token',
     shopId: 'your_shop_id'
   });
   console.log('Generated signature:', testSignature);
   ```

**Solutions:**
1. **Refresh Access Token:**
   ```typescript
   const authClient = new ShopeeAuthClient();
   const newToken = await authClient.refreshAccessToken(refreshToken);
   ```

2. **Verify System Time:**
   ```bash
   # Check system time synchronization
   timedatectl status
   
   # Sync time if needed
   sudo ntpdate -s time.nist.gov
   ```

3. **Update API Credentials:**
   - Log into Shopee Partner Center
   - Generate new API credentials
   - Update environment variables
   - Restart application

#### Issue: TikTok Shop Import Rate Limited

**Error Messages:**
```
❌ TikTok Shop API error: 429 Too Many Requests
❌ Rate limit exceeded, retry after 60 seconds
❌ API quota exceeded for today
```

**Diagnosis Steps:**
1. Check current rate limit status:
   ```typescript
   const rateLimiter = new RateLimiter();
   console.log('Current requests:', rateLimiter.getCurrentCount());
   console.log('Reset time:', rateLimiter.getResetTime());
   ```

2. Review API usage:
   ```bash
   # Check recent API calls in logs
   grep "TikTok API" logs/syncstore.log | tail -20
   ```

**Solutions:**
1. **Implement Exponential Backoff:**
   ```typescript
   const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
   await new Promise(resolve => setTimeout(resolve, backoffDelay));
   ```

2. **Reduce Concurrent Requests:**
   ```typescript
   // Reduce batch size and concurrency
   const importConfig = {
     batchSize: 25,        // Reduced from 50
     maxConcurrency: 2,    // Reduced from 5
     delayBetweenBatches: 2000  // 2 second delay
   };
   ```

3. **Monitor API Quotas:**
   ```typescript
   // Track API usage
   const apiUsage = await tiktokClient.getApiUsage();
   console.log('Daily quota used:', apiUsage.dailyQuotaUsed);
   console.log('Remaining calls:', apiUsage.remainingCalls);
   ```

### 2. Database Issues

#### Issue: Database Connection Timeouts

**Error Messages:**
```
❌ Connection timeout
❌ Too many connections
❌ Connection pool exhausted
```

**Diagnosis Steps:**
1. Check active connections:
   ```sql
   SELECT count(*) as active_connections 
   FROM pg_stat_activity 
   WHERE state = 'active';
   ```

2. Check connection pool status:
   ```typescript
   const pool = getDatabasePool();
   console.log('Total connections:', pool.totalCount);
   console.log('Idle connections:', pool.idleCount);
   console.log('Waiting clients:', pool.waitingCount);
   ```

3. Identify long-running queries:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
   ```

**Solutions:**
1. **Optimize Connection Pool:**
   ```typescript
   const poolConfig = {
     min: 5,           // Minimum connections
     max: 20,          // Maximum connections (reduced)
     idleTimeoutMillis: 30000,  // Close idle connections
     connectionTimeoutMillis: 5000,  // Faster timeout
   };
   ```

2. **Kill Long-Running Queries:**
   ```sql
   -- Kill specific query
   SELECT pg_terminate_backend(12345);  -- Replace with actual PID
   
   -- Kill all long-running queries
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE (now() - pg_stat_activity.query_start) > interval '10 minutes';
   ```

3. **Add Query Timeouts:**
   ```typescript
   const queryTimeout = 30000; // 30 seconds
   const result = await db.query(sql, params, { timeout: queryTimeout });
   ```

#### Issue: Slow Database Performance

**Error Messages:**
```
⚠️ Query execution time: 15.2 seconds
⚠️ Database performance degraded
⚠️ Index scan taking too long
```

**Diagnosis Steps:**
1. Check slow queries:
   ```sql
   -- Enable slow query logging
   ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
   SELECT pg_reload_conf();
   
   -- Check current slow queries
   SELECT query, mean_exec_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   ```

2. Analyze table statistics:
   ```sql
   SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
   FROM pg_stat_user_tables 
   ORDER BY n_tup_ins DESC;
   ```

3. Check index usage:
   ```sql
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes 
   ORDER BY idx_scan DESC;
   ```

**Solutions:**
1. **Add Missing Indexes:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX CONCURRENTLY idx_master_products_name_search 
   ON master_products USING gin(to_tsvector('english', name));
   
   CREATE INDEX CONCURRENTLY idx_platform_mappings_sync_status 
   ON platform_mappings(sync_status) 
   WHERE sync_status != 'synced';
   ```

2. **Update Table Statistics:**
   ```sql
   ANALYZE master_products;
   ANALYZE platform_mappings;
   ANALYZE raw_import_data;
   ```

3. **Optimize Queries:**
   ```sql
   -- Use EXPLAIN ANALYZE to optimize slow queries
   EXPLAIN ANALYZE SELECT * FROM master_products 
   WHERE name ILIKE '%drone%' 
   AND status = 'active';
   ```

### 3. Memory Issues

#### Issue: Out of Memory Errors

**Error Messages:**
```
❌ JavaScript heap out of memory
❌ Cannot allocate memory
⚠️ Memory usage: 95% of available heap
```

**Diagnosis Steps:**
1. Monitor memory usage:
   ```typescript
   const memoryUsage = process.memoryUsage();
   console.log('Heap used:', Math.round(memoryUsage.heapUsed / 1024 / 1024), 'MB');
   console.log('Heap total:', Math.round(memoryUsage.heapTotal / 1024 / 1024), 'MB');
   console.log('External:', Math.round(memoryUsage.external / 1024 / 1024), 'MB');
   ```

2. Check for memory leaks:
   ```bash
   # Use Node.js built-in profiler
   node --inspect --max-old-space-size=4096 app.js
   
   # Monitor with htop
   htop -p $(pgrep node)
   ```

3. Profile memory allocation:
   ```typescript
   // Add memory monitoring
   setInterval(() => {
     const usage = process.memoryUsage();
     const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
     if (heapUsedMB > 1500) {  // Alert at 1.5GB
       console.warn(`High memory usage: ${heapUsedMB}MB`);
     }
   }, 30000);
   ```

**Solutions:**
1. **Increase Memory Limit:**
   ```bash
   # Increase Node.js heap size
   node --max-old-space-size=4096 app.js
   
   # Or set environment variable
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. **Reduce Batch Sizes:**
   ```typescript
   const memoryOptimizedConfig = {
     batchSize: 25,        // Reduced from 100
     maxConcurrency: 2,    // Reduced from 5
     processInChunks: true // Process data in smaller chunks
   };
   ```

3. **Implement Memory Management:**
   ```typescript
   class MemoryManager {
     async processWithMemoryCheck<T>(
       items: T[],
       processor: (item: T) => Promise<void>
     ) {
       for (let i = 0; i < items.length; i++) {
         await processor(items[i]);
         
         // Force garbage collection every 100 items
         if (i % 100 === 0 && global.gc) {
           global.gc();
         }
         
         // Check memory usage
         const usage = process.memoryUsage();
         const heapUsedRatio = usage.heapUsed / usage.heapTotal;
         
         if (heapUsedRatio > 0.8) {
           console.warn('High memory usage, pausing processing');
           await new Promise(resolve => setTimeout(resolve, 1000));
         }
       }
     }
   }
   ```

### 4. Data Quality Issues

#### Issue: High Validation Error Rate

**Error Messages:**
```
⚠️ Validation failed: 45% of products have errors
❌ Missing required field: product name
❌ Invalid price format: "N/A"
❌ Image URL not accessible
```

**Diagnosis Steps:**
1. Run validation report:
   ```typescript
   const validator = new ComprehensiveDataValidator();
   const report = await validator.validateAllProducts();
   console.log('Validation summary:', report.summary);
   console.log('Common errors:', report.commonErrors);
   ```

2. Analyze field mapping accuracy:
   ```typescript
   const fieldMapper = new FieldMapper();
   const mappingReport = await fieldMapper.analyzeMappingAccuracy();
   console.log('Mapping accuracy:', mappingReport.accuracy);
   console.log('Unmapped fields:', mappingReport.unmappedFields);
   ```

3. Check data transformation logs:
   ```bash
   grep "transformation error" logs/syncstore.log | head -20
   ```

**Solutions:**
1. **Update Field Mappings:**
   ```typescript
   // Add missing field mappings
   const updatedMappings = {
     'item_title': 'name',           // Shopee alternative field
     'product_title': 'name',        // TikTok alternative field
     'list_price': 'basePrice',      // Alternative price field
     'main_images': 'images'         // Alternative image field
   };
   ```

2. **Implement Data Cleaning:**
   ```typescript
   class DataCleaner {
     cleanProductData(product: any): any {
       return {
         ...product,
         name: this.cleanName(product.name || product.title || 'Unnamed Product'),
         price: this.cleanPrice(product.price || product.list_price || 0),
         description: this.cleanDescription(product.description || ''),
         images: this.cleanImages(product.images || product.main_images || [])
       };
     }
     
     private cleanName(name: string): string {
       return name.trim().replace(/\s+/g, ' ').substring(0, 500);
     }
     
     private cleanPrice(price: any): number {
       const numPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));
       return isNaN(numPrice) ? 0 : numPrice;
     }
   }
   ```

3. **Add Fallback Values:**
   ```typescript
   const productWithDefaults = {
     name: product.name || product.title || 'Unnamed Product',
     description: product.description || 'No description available',
     price: product.price || product.list_price || 0,
     images: product.images || product.main_images || [],
     category: product.category || 'uncategorized',
     brand: product.brand || product.brand_name || 'Unknown'
   };
   ```

### 5. Performance Issues

#### Issue: Slow Import Performance

**Symptoms:**
```
⚠️ Import taking longer than expected
⚠️ Processing 500 products took 15 minutes
⚠️ API response time: 5.2 seconds average
```

**Diagnosis Steps:**
1. Profile import performance:
   ```typescript
   const performanceProfiler = new PerformanceProfiler();
   
   performanceProfiler.start('shopee_import');
   await shopeeImporter.importProducts();
   const importTime = performanceProfiler.end('shopee_import');
   
   console.log('Import performance:', {
     totalTime: importTime,
     productsPerSecond: productCount / (importTime / 1000),
     averageApiResponseTime: performanceProfiler.getAverageApiTime()
   });
   ```

2. Check API response times:
   ```bash
   # Monitor API calls
   grep "API response time" logs/syncstore.log | tail -20
   ```

3. Analyze database query performance:
   ```sql
   SELECT query, mean_exec_time, calls, total_exec_time
   FROM pg_stat_statements 
   WHERE query LIKE '%INSERT INTO master_products%'
   ORDER BY total_exec_time DESC;
   ```

**Solutions:**
1. **Optimize Batch Processing:**
   ```typescript
   const optimizedConfig = {
     batchSize: 100,           // Increase batch size
     maxConcurrency: 5,        // Optimize concurrency
     useTransactions: true,    // Use database transactions
     enableCaching: true       // Enable response caching
   };
   ```

2. **Implement Parallel Processing:**
   ```typescript
   async function parallelImport(platforms: string[]) {
     const importPromises = platforms.map(platform => {
       const importer = createImporter(platform);
       return importer.importProducts();
     });
     
     const results = await Promise.all(importPromises);
     return results;
   }
   ```

3. **Add Caching:**
   ```typescript
   class CachedAPIClient {
     private cache = new Map();
     
     async makeRequest(endpoint: string, params: any) {
       const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
       
       if (this.cache.has(cacheKey)) {
         return this.cache.get(cacheKey);
       }
       
       const response = await this.apiClient.request(endpoint, params);
       this.cache.set(cacheKey, response);
       
       // Cache for 5 minutes
       setTimeout(() => this.cache.delete(cacheKey), 300000);
       
       return response;
     }
   }
   ```

---

## System Monitoring

### Health Check Commands

```bash
# Check system health
curl -f http://localhost:3000/api/health

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check API connectivity
curl -f "https://partner.shopeemobile.com/api/v2/public/get_token_by_resend_code"

# Check memory usage
free -h

# Check disk space
df -h

# Check process status
ps aux | grep node
```

### Log Analysis

```bash
# View recent errors
grep "ERROR" logs/syncstore.log | tail -20

# Check import statistics
grep "Import completed" logs/syncstore.log | tail -10

# Monitor API errors
grep "API error" logs/syncstore.log | tail -20

# Check database errors
grep "database" logs/syncstore.log | grep -i error | tail -10
```

### Performance Monitoring

```bash
# Monitor CPU usage
top -p $(pgrep node)

# Monitor memory usage
watch -n 5 'ps -p $(pgrep node) -o pid,ppid,cmd,%mem,%cpu --sort=-%mem'

# Monitor database performance
psql $DATABASE_URL -c "
SELECT query, calls, total_exec_time, mean_exec_time 
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;"
```

---

## Emergency Procedures

### System Recovery

#### Complete System Restart
```bash
# Stop all services
pm2 stop all

# Clear any stuck processes
pkill -f node

# Restart database (if needed)
sudo systemctl restart postgresql

# Start services
pm2 start ecosystem.config.js

# Verify system health
curl -f http://localhost:3000/api/health
```

#### Database Recovery
```bash
# Check database status
sudo systemctl status postgresql

# Restart database
sudo systemctl restart postgresql

# Check for corruption
psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"

# Restore from backup if needed
gunzip -c /backups/latest_backup.sql.gz | psql $DATABASE_URL
```

#### Data Recovery
```bash
# Restore from latest backup
./scripts/restore-backup.sh /backups/syncstore_20251102.tar.gz

# Verify data integrity
npm run verify-data-integrity

# Re-run failed imports
npm run retry-failed-imports
```

### Escalation Procedures

#### Level 1: Automatic Recovery
- System attempts automatic recovery
- Retry failed operations
- Switch to backup systems if available

#### Level 2: Alert Administrator
- Send alerts to system administrator
- Log critical errors
- Attempt manual intervention

#### Level 3: Emergency Response
- Contact emergency response team
- Implement disaster recovery procedures
- Notify stakeholders

---

## Preventive Measures

### Regular Maintenance

#### Daily Tasks
- [ ] Check system health dashboard
- [ ] Review error logs
- [ ] Monitor API quotas
- [ ] Verify backup completion

#### Weekly Tasks
- [ ] Analyze performance trends
- [ ] Review and clean old data
- [ ] Update API credentials if needed
- [ ] Test disaster recovery procedures

#### Monthly Tasks
- [ ] Update field mappings
- [ ] Review data quality metrics
- [ ] Performance optimization review
- [ ] Security audit

### Monitoring Setup

```typescript
// Set up monitoring alerts
const monitoring = new MonitoringService();

monitoring.addAlert({
  name: 'high_error_rate',
  condition: 'error_rate > 5%',
  action: 'send_email',
  recipients: ['admin@company.com']
});

monitoring.addAlert({
  name: 'low_disk_space',
  condition: 'disk_usage > 85%',
  action: 'send_slack_message',
  channel: '#alerts'
});

monitoring.addAlert({
  name: 'api_quota_warning',
  condition: 'api_quota_used > 80%',
  action: 'reduce_import_frequency'
});
```

---

## Contact Information

### Support Contacts

**Technical Support:**
- Email: tech-support@company.com
- Phone: +1-xxx-xxx-xxxx
- Slack: #syncstore-support

**Database Support:**
- Email: dba@company.com
- Phone: +1-xxx-xxx-xxxx
- Slack: #database-support

**API Support:**
- Shopee: https://partner.shopeemobile.com/support
- TikTok Shop: https://seller-us.tiktok.com/support

### Documentation Links

- [API Documentation](./api-documentation.md)
- [Database Schema](./database-schema.md)
- [Deployment Guide](./deployment-guide.md)
- [Performance Tuning](./performance-tuning.md)

---

**Document Version:** 1.0.0  
**Last Updated:** November 2, 2025  
**Next Review:** December 2, 2025