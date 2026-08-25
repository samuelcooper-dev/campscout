# Data Staleness Investigation Report

**Investigation Date:** 2026-08-25
**Last Data Update:** 2026-08-21 06:02:10 UTC
**Data Age:** 4 days, 13 hours

## Findings

### Database Status
```sql
SELECT MAX(updated_at) as last_update FROM campgrounds;
-- Result: 2026-08-21 06:02:10.498717+00:00
```

The campground data has not been refreshed since August 21, 2026.

### Pipeline Configuration

**GitHub Actions Workflow:** `.github/workflows/pipeline-availability.yml`

```yaml
schedule:
  - cron: '0 5 * * *'  # Daily at 5:00 AM UTC
```

**Expected behavior:** Pipeline should run daily, updating campground data.

**Actual behavior:** Pipeline has not run successfully since August 21.

### Possible Causes

1. **GitHub Actions Disabled**
   - Workflow may have been manually disabled in GitHub UI
   - Check: https://github.com/[owner]/campscout/actions/workflows/pipeline-availability.yml

2. **Pipeline Failures**
   - Pipeline may be failing silently
   - Check Actions tab for red X markers
   - Common failure points:
     - Recreation.gov API rate limits
     - Database connection timeouts (Neon free tier quota)
     - Missing/invalid API keys in GitHub Secrets

3. **GitHub Actions Minutes Exhausted**
   - Free tier: 2,000 minutes/month
   - Pipeline timeout: 180 minutes max
   - Each run ~10-30 minutes estimated
   - Check repository Settings → Billing → Actions

4. **Neon Database Issues**
   - Database may have been in read-only mode due to quota (we recently upgraded)
   - Write operations would fail silently if DB was in quota-exceeded state

## Recommended Actions

### Immediate (Manual Trigger)
```bash
# Trigger pipeline manually from GitHub UI
# OR via gh CLI:
gh workflow run pipeline-availability.yml
```

### Investigation Steps
1. Check GitHub Actions history:
   ```bash
   gh run list --workflow=pipeline-availability.yml --limit 10
   ```

2. View most recent run logs:
   ```bash
   gh run view [run-id] --log
   ```

3. Verify GitHub Secrets are set:
   - `DATABASE_URL`
   - `RECREATION_GOV_API_KEY`
   - `NPS_API_KEY`
   - `NOAA_USER_AGENT`

4. Check Neon dashboard for:
   - Storage quota status
   - Compute hour usage
   - Connection pool limits
   - Recent error logs

### Long-term Fixes

1. **Add Monitoring**
   - Set up alerts when data age exceeds 36 hours
   - Add health check endpoint that returns data freshness
   - Monitor pipeline failures via GitHub Actions notifications

2. **Add Graceful Degradation**
   - Show "Data may be outdated" banner when > 48 hours old
   - Add "Last updated" timestamp to UI
   - Provide manual refresh button (API-triggered workflow dispatch)

3. **Optimize Pipeline**
   - Add incremental updates (only changed campgrounds)
   - Reduce API calls with smarter caching
   - Split into smaller, more frequent runs

4. **Consider Alternative Scheduling**
   - Move to Prefect Cloud for better observability
   - Use Render Cron Jobs (if backend is on Render)
   - Add webhook-based triggers

## Status

**Current:** Pipeline has been stale for 4 days
**Action Required:** Manually trigger pipeline and investigate GitHub Actions history
**Severity:** Medium (data still usable, but availability may be inaccurate)
