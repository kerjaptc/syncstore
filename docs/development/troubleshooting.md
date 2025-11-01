# 🔧 Comprehensive Troubleshooting Guide

**Project**: StoreSync - Multi-platform E-commerce Management System  
**Last Updated**: November 2024

## 🎯 Quick Status Check

Run this command to check overall system health:
```bash
npm run diagnose
```

## 🚨 Common Issues & Solutions

### 1. Authentication Issues

#### **Clerk Authentication Timeout**
**Error**: `ClerkRuntimeError: Failed to load Clerk (code="failed_to_load_clerk_js_timeout")`

**Solutions**:
```bash
# 1. Check environment variables
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
echo $CLERK_SECRET_KEY

# 2. Restart with clean cache
rm -rf .next
npm run dev:light

# 3. Test Clerk connectivity
curl -I https://clerk.com
```

#### **Session Expired or Invalid**
**Symptoms**: Redirected to login repeatedly, API calls return 401

**Solutions**:
- Clear browser cache and cookies
- Try incognito/private mode
- Check Clerk dashboard for API key validity
- Verify environment variables are properly set

### 2. Database Issues

#### **Connection Failures**
**Error**: `Database connection failed` or `ECONNREFUSED`

**Solutions**:
```bash
# 1. Check database URL
echo $DATABASE_URL

# 2. Test connection
npm run db:studio

# 3. Run migrations
npm run db:migrate

# 4. Reset if needed
npm run db:reset
```

#### **Migration Errors**
**Error**: `Migration failed` or schema mismatch

**Solutions**:
```bash
# 1. Check migration status
npm run db:migrate:status

# 2. Reset and re-migrate
npm run db:reset
npm run db:migrate

# 3. Seed with sample data
npm run db:seed
```

### 3. Shopee Integration Issues

#### **OAuth Flow Failures**
**Error**: `Invalid credentials` or `OAuth callback failed`

**Solutions**:
```bash
# 1. Check Shopee credentials
echo $SHOPEE_PARTNER_ID
echo $SHOPEE_PARTNER_KEY

# 2. Verify callback URL in Shopee dashboard
# Should be: http://localhost:3000/api/platforms/shopee/oauth/callback

# 3. Test health endpoint
curl http://localhost:3000/api/platforms/shopee/health
```

#### **API Rate Limiting**
**Error**: `Rate limit exceeded` or `429 Too Many Requests`

**Solutions**:
- Wait for rate limit reset (usually 1 minute)
- Implement exponential backoff in API calls
- Check API usage in Shopee dashboard
- Consider upgrading API limits if needed

#### **Sandbox vs Production Configuration**
**Error**: `Invalid shop_id` or `Unauthorized`

**Solutions**:
```bash
# 1. Check environment
echo $NODE_ENV

# 2. Verify credentials match environment
# Sandbox: Use test credentials
# Production: Use live credentials

# 3. Update base URL if needed
# Sandbox: https://partner.test-stable.shopeemobile.com
# Production: https://partner.shopeemobile.com
```

### 4. Performance Issues

#### **High Memory Usage**
**Symptoms**: Slow response times, system lag

**Solutions**:
```bash
# 1. Check memory usage
npm run memory:check

# 2. Run optimized development server
npm run dev:light

# 3. Clear cache
rm -rf .next
rm -rf node_modules/.cache
```

#### **Slow API Responses**
**Symptoms**: Long loading times, timeouts

**Solutions**:
- Check database query performance
- Implement caching for frequently accessed data
- Optimize API endpoints with pagination
- Monitor external API response times

### 5. UI/UX Issues

#### **Component Rendering Errors**
**Error**: `Hydration mismatch` or component crashes

**Solutions**:
```bash
# 1. Clear Next.js cache
rm -rf .next

# 2. Check for client/server state mismatches
# 3. Verify component props and state

# 4. Restart development server
npm run dev:light
```

#### **Responsive Design Issues**
**Symptoms**: Layout breaks on mobile, components overlap

**Solutions**:
- Test on different screen sizes
- Check Tailwind CSS classes
- Verify responsive breakpoints
- Use browser dev tools for debugging

## 🔍 Diagnostic Tools

### Environment Variables Check
```bash
# Check all required variables
npm run diagnose:env

# Manual check
node -e "
console.log('Clerk Publishable:', process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Set' : 'Missing');
console.log('Clerk Secret:', process.env.CLERK_SECRET_KEY ? 'Set' : 'Missing');
console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('Shopee Partner ID:', process.env.SHOPEE_PARTNER_ID ? 'Set' : 'Missing');
"
```

### API Endpoint Testing
```bash
# Test core endpoints
curl http://localhost:3000/api/platforms
curl http://localhost:3000/api/stores/connect
curl http://localhost:3000/api/platforms/shopee/health

# Test with authentication (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/dashboard/metrics
```

### Database Health Check
```bash
# Open database studio
npm run db:studio

# Check table structure
npm run db:introspect

# Verify data integrity
npm run db:validate
```

## 🚀 Quick Recovery Procedures

### Complete System Reset
```bash
# 1. Stop all processes
Ctrl+C

# 2. Clear all caches
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo

# 3. Reinstall dependencies (if needed)
npm install

# 4. Reset database
npm run db:reset
npm run db:migrate

# 5. Start fresh
npm run dev:light
```

### Environment Setup from Scratch
```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Add required variables
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# CLERK_SECRET_KEY=sk_test_...
# DATABASE_URL=postgresql://...
# ENCRYPTION_KEY=your-32-character-key

# 3. Verify setup
npm run diagnose
```

### Shopee Integration Reset
```bash
# 1. Clear stored credentials
npm run db:clear-connections

# 2. Reset OAuth state
# Clear browser cookies for localhost:3000

# 3. Verify Shopee app settings
# Check callback URL in Shopee Partner Center

# 4. Test connection
npm run test:shopee-connection
```

## 📊 Monitoring & Logging

### Error Tracking
```bash
# Check application logs
tail -f logs/application.log

# Check error logs
tail -f logs/error.log

# Monitor API calls
tail -f logs/api.log
```

### Performance Monitoring
```bash
# Monitor memory usage
npm run monitor:memory

# Check API response times
npm run monitor:api

# Database performance
npm run monitor:db
```

## 🔧 Development Tools

### Useful Scripts
```bash
# System diagnostics
npm run diagnose              # Full system check
npm run diagnose:env         # Environment variables
npm run diagnose:db          # Database connectivity
npm run diagnose:api         # API endpoints

# Fixes and maintenance
npm run fix:clerk            # Clerk authentication issues
npm run fix:db               # Database issues
npm run fix:cache            # Clear all caches

# Testing
npm run test:integration     # Integration tests
npm run test:api             # API endpoint tests
npm run test:shopee          # Shopee integration tests
```

### Browser Developer Tools
1. **Console Tab**: Check for JavaScript errors
2. **Network Tab**: Monitor API calls and responses
3. **Application Tab**: Check localStorage, cookies, service workers
4. **Performance Tab**: Analyze page load performance

## 🚨 Emergency Procedures

### System Down/Unresponsive
1. **Check Process**: `ps aux | grep node`
2. **Kill Process**: `pkill -f "next"`
3. **Clear Everything**: `rm -rf .next node_modules/.cache`
4. **Restart**: `npm install && npm run dev:light`

### Data Corruption
1. **Backup Current State**: `npm run db:backup`
2. **Reset Database**: `npm run db:reset`
3. **Restore from Backup**: `npm run db:restore`
4. **Verify Integrity**: `npm run db:validate`

### Security Breach
1. **Rotate API Keys**: Update all external service keys
2. **Clear Sessions**: `npm run auth:clear-sessions`
3. **Check Logs**: Review access logs for suspicious activity
4. **Update Dependencies**: `npm audit fix`

## 📞 Getting Help

### Self-Service Resources
1. **Documentation**: Check `/docs` folder
2. **API Reference**: Available at `/api-docs`
3. **Component Library**: Storybook at `/storybook`
4. **Database Schema**: Drizzle Studio at `/db-studio`

### Escalation Path
1. **Check Known Issues**: Review this troubleshooting guide
2. **Search Logs**: Look for specific error messages
3. **Test in Isolation**: Reproduce issue in minimal environment
4. **Document Steps**: Record exact steps to reproduce

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Shopee API Documentation](https://open.shopee.com/developer-guide/27)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

## ✅ Health Check Checklist

Before reporting issues, verify:

### Environment
- [ ] All required environment variables are set
- [ ] Environment variables have correct format
- [ ] No typos in variable names
- [ ] Secrets are properly encoded

### Services
- [ ] Database is accessible
- [ ] Clerk authentication is working
- [ ] External APIs are responding
- [ ] Network connectivity is stable

### Application
- [ ] Development server starts without errors
- [ ] No console errors in browser
- [ ] API endpoints return expected responses
- [ ] UI components render correctly

### Data
- [ ] Database schema is up to date
- [ ] Required tables exist
- [ ] Sample data is available (if needed)
- [ ] No data corruption detected

This troubleshooting guide should help resolve most common issues. For persistent problems, follow the escalation path and document all attempted solutions.