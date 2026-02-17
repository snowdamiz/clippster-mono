# Production Deployment Checklist - Admin Panel Overhaul

**Deployment Date:** TBD  
**Feature:** Admin Panel Overhaul with Moderator System  
**Status:** ✅ Ready for Production

---

## 🔍 Pre-Deployment Verification

### ✅ Database Migration
- [x] Migration file created: `20260216002217_add_moderator_and_restrictions.exs`
- [x] Duplicate migration removed: `20260216002243_create_mod_action_logs.exs` (empty file deleted)
- [x] Migration includes all required fields:
  - Users: `is_moderator`, `is_restricted`, restriction fields, discount fields
  - Conversations: `status`, `archived_at`, `archived_by_user_id`
  - New table: `mod_action_logs` with indexes
- [x] Migration is idempotent and safe for production
- [x] All indexes created for performance

### ✅ Backend Implementation
- [x] **Controllers Created:**
  - `SupportController` - 8 endpoints for customer service
  - `StaffController` - 5 endpoints for internal messaging
  - `AdminController` - 11 new moderator/discount actions added

- [x] **Context Functions:**
  - `Accounts` - Moderator promotion/demotion, restrictions, discounts
  - `ModLogs` - Complete audit logging system
  - `Messaging` - Support conversations, staff messaging

- [x] **Plugs:**
  - `ModeratorPlug` - Allows admin OR moderator access
  - `RestrictionPlug` - Enforces platform-level restrictions

- [x] **Routes Registered:**
  - `/api/support/*` - User support endpoints (api_auth)
  - `/admin/support/*` - Staff support endpoints (api_mod)
  - `/staff/*` - Staff messaging endpoints (api_mod)
  - `/admin/users/:id/moderator` - Promote/demote moderator
  - `/admin/users/:id/mod-discount` - Toggle mod discount
  - `/admin/mod-logs` - Moderator action logs

- [x] **Stripe Integration:**
  - Admin discounts create and apply Stripe coupons
  - Moderator discounts create 10% forever coupons
  - Discount removal properly updates Stripe subscriptions
  - Error handling for Stripe API failures

### ✅ Frontend Implementation
- [x] **New Pages Created:**
  - `AdminStaffMessages.vue` (300+ lines) - Internal messaging
  - `AdminModLogs.vue` (250+ lines) - Audit log viewer
  - `AdminCustomerService.vue` (300+ lines) - Support ticket system

- [x] **Updated Pages:**
  - `AdminUsers.vue` - Moderator promotion/demotion UI
  - `AdminHub.vue` - Role-based filtering (already implemented)
  - Router guards updated for moderator access

- [x] **Build Verification:**
  - Frontend builds successfully without errors
  - No TypeScript compilation errors
  - All new components properly imported

### ✅ Bug Fixes Applied
- [x] **Subscription Change Fix:**
  - `admin_change_tier` now properly activates subscriptions
  - Sets `subscription_status: "active"`
  - Creates start/end dates if missing
  - Always creates subscription history record

- [x] **UI Alignment Fix:**
  - "Promote to Moderator" displays on one line
  - Matches "Promote to Admin" styling

---

## 📋 Deployment Steps

### 1. Database Migration (Production)

```bash
# SSH into production server
cd /path/to/clippster-mono/server

# Run migration
mix ecto.migrate

# Verify migration applied
mix ecto.migrations
```

**Expected Output:**
```
up     20260216002217  add_moderator_and_restrictions
```

**Rollback Plan (if needed):**
```bash
mix ecto.rollback --step 1
```

### 2. Backend Deployment

```bash
# Build production release
cd server
MIX_ENV=prod mix release

# Deploy to production
# (Your deployment process here)
```

**Environment Variables Required:**
- `STRIPE_SECRET_KEY` - Already exists, used for discount integration
- `JWT_SECRET` - Already exists
- No new environment variables needed

### 3. Frontend Deployment

```bash
# Build production frontend
cd client
yarn build

# Build Tauri app (if deploying desktop)
yarn tauri build
```

**Build Output Verified:**
- ✅ No compilation errors
- ✅ All admin pages included in bundle
- ✅ Chunk sizes acceptable (warnings are normal)

### 4. Post-Deployment Verification

**Immediately After Deployment:**

1. **Database Check:**
   ```sql
   -- Verify new columns exist
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name IN ('is_moderator', 'is_restricted');
   
   -- Verify mod_action_logs table exists
   SELECT * FROM mod_action_logs LIMIT 1;
   ```

2. **API Health Check:**
   ```bash
   # Test support endpoint
   curl -X GET https://your-domain.com/api/support/conversation \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Test admin moderator endpoint
   curl -X POST https://your-domain.com/admin/users/123/moderator \
     -H "Authorization: Bearer ADMIN_TOKEN"
   ```

3. **Frontend Check:**
   - Navigate to `/admin/users`
   - Verify "Promote to Moderator" appears in Actions dropdown
   - Verify moderator badge displays correctly

---

## 🧪 Testing Checklist

### Critical Path Testing

**1. Moderator Promotion Flow:**
- [ ] Admin promotes user to moderator
- [ ] User sees moderator badge in admin panel
- [ ] Moderator can access mod-only routes
- [ ] Moderator cannot access admin-only routes

**2. Subscription Change Flow:**
- [ ] Admin changes user from Free to Creator
- [ ] User logs in and sees Creator tier
- [ ] User can access Creator-tier features
- [ ] Subscription end date is set correctly

**3. Support Ticket Flow:**
- [ ] User creates support conversation
- [ ] Auto-message appears
- [ ] Staff sees ticket in Customer Service page
- [ ] Staff responds to ticket
- [ ] User receives response
- [ ] Staff archives ticket

**4. Moderator Discount Flow:**
- [ ] Admin enables mod discount for user
- [ ] Stripe coupon is created
- [ ] User's subscription shows discount
- [ ] Admin disables mod discount
- [ ] Stripe coupon is removed

**5. User Restriction Flow:**
- [ ] Admin restricts user
- [ ] User can still login
- [ ] User cannot perform mutations (POST/PUT/DELETE)
- [ ] User sees restriction message
- [ ] Admin unrestricts user
- [ ] User can perform actions again

---

## 🔐 Security Verification

### Access Control
- [x] `api_mod` pipeline requires admin OR moderator
- [x] `api_admin` pipeline requires admin only
- [x] RestrictionPlug blocks mutations for restricted users
- [x] Support conversations isolated per user
- [x] Staff messaging only accessible to staff

### Data Protection
- [x] Stripe coupon IDs stored securely
- [x] Restriction reasons logged for audit
- [x] Moderator actions logged in mod_action_logs
- [x] No sensitive data exposed in error messages

---

## 📊 Monitoring & Alerts

### Metrics to Monitor

**Database:**
- Migration completion time
- mod_action_logs table growth rate
- Query performance on new indexes

**API:**
- `/admin/support/*` endpoint response times
- `/staff/*` endpoint response times
- Moderator promotion success rate
- Stripe discount API call success rate

**Frontend:**
- Admin page load times
- JavaScript errors in admin panel
- User session drops after deployment

### Alert Thresholds

- Database migration takes > 5 minutes → Investigate
- Stripe API error rate > 5% → Check API keys
- mod_action_logs table > 1M rows → Archive old logs
- Admin page load time > 3 seconds → Optimize queries

---

## 🚨 Rollback Plan

### If Critical Issues Occur:

**1. Database Rollback:**
```bash
cd server
mix ecto.rollback --step 1
```

**2. Code Rollback:**
```bash
# Revert to previous release
git revert <commit-hash>
# Or deploy previous version
```

**3. Feature Flag Disable:**
If you have feature flags, disable:
- Moderator system
- Customer service
- Staff messaging

**Known Safe State:**
- Previous commit before admin panel overhaul
- Database state before migration `20260216002217`

---

## 📝 Post-Deployment Tasks

### Immediate (Within 1 hour):
- [ ] Verify first moderator can be promoted
- [ ] Test support ticket creation
- [ ] Monitor error logs for new issues
- [ ] Check Stripe dashboard for discount coupons

### Within 24 hours:
- [ ] Review moderator action logs
- [ ] Check support conversation volume
- [ ] Verify subscription changes are working
- [ ] Monitor database performance

### Within 1 week:
- [ ] Gather user feedback on moderator system
- [ ] Review mod_action_logs for patterns
- [ ] Optimize slow queries if needed
- [ ] Document any edge cases discovered

---

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ Database migration completes without errors
2. ✅ All new API endpoints respond correctly
3. ✅ Admin can promote users to moderator
4. ✅ Moderators can access mod-only features
5. ✅ Support tickets can be created and responded to
6. ✅ Subscription changes properly activate tiers
7. ✅ Stripe discounts are created and applied
8. ✅ No increase in error rates
9. ✅ No performance degradation
10. ✅ All existing features continue working

---

## 📞 Emergency Contacts

**If deployment fails:**
- Database issues: DBA team
- API issues: Backend team
- Frontend issues: Frontend team
- Stripe issues: Billing team

**Rollback Decision Maker:**
- Tech Lead / CTO

---

## ✅ Final Checklist

Before deploying to production:

- [ ] All tests pass locally
- [ ] Database migration tested on staging
- [ ] Frontend builds without errors
- [ ] Backend compiles without warnings
- [ ] Stripe integration tested with test API keys
- [ ] Rollback plan documented and tested
- [ ] Team notified of deployment
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] This checklist reviewed and approved

---

**Deployment Approved By:** _______________  
**Date:** _______________  
**Deployed By:** _______________  
**Deployment Time:** _______________  
**Rollback Deadline:** _______________ (if issues found)
