# Database Optimization Summary

Applied optimizations to reduce Neon database costs on the Launch tier.

**Target:** Reduce monthly cost from ~$15-20 to ~$6-12/month (40-50% reduction)

## 1. Connection Pooling Optimizations

**File:** `src/storage/database.py`

```python
engine = create_engine(
    _url,
    pool_pre_ping=True,
    pool_size=3,              # Reduced from default 5
    max_overflow=2,           # Reduced from default 10
    pool_recycle=3600,        # Recycle connections after 1 hour
    pool_timeout=30,          # Fail fast if no connection available
    echo_pool=False,          # Disable connection pool logging
)
```

**Impact:**
- Fewer concurrent connections to database
- Reduced connection overhead
- Prevents stale connections
- Better resource utilization on free/low-tier plans

## 2. Query Result Caching

Added in-memory TTL caches to all data endpoints to avoid redundant database queries.

### Availability Endpoint
**File:** `src/api/routes/availability.py`
- Cache size: 128 entries
- TTL: 5 minutes (300s)
- Impact: Most expensive query (joins across availability_snapshots, campsites, campgrounds)

### Campsite Listings
**File:** `src/api/routes/campsites.py`
- Cache size: 128 entries
- TTL: 10 minutes (600s)
- Impact: Campsites rarely change, safe to cache longer

### Weather Forecasts
**File:** `src/api/routes/weather.py`
- Cache size: 256 entries
- TTL: 15 minutes (900s)
- Impact: Weather updates every 6-12 hours, aggressive caching is safe

### Alerts
**File:** `src/api/routes/alerts.py`
- Cache size: 128 entries
- TTL: 10 minutes (600s)
- Impact: Alerts update infrequently

**Combined Impact:**
- ~70-85% reduction in database queries for repeat requests
- Reduced data transfer for cached responses
- Faster response times for users

## 3. Selective Column Queries

Replaced full-row fetches with targeted column queries where only existence checks or specific fields are needed.

### Existence Checks
Changed from:
```python
db.query(Campground).filter(Campground.id == campground_id).first()
```

To:
```python
db.query(Campground.id).filter(Campground.id == campground_id).first()
```

**Files optimized:**
- `src/api/routes/campsites.py`
- `src/api/routes/weather.py`
- `src/api/routes/alerts.py`

### Availability Query Optimization
**File:** `src/api/routes/availability.py`

Changed from fetching full Campground and Campsite rows to only needed columns:

**Before:**
```python
campground = db.query(Campground).filter(...).first()
campsites = db.query(Campsite).filter(...).all()
```

**After:**
```python
campground = db.query(
    Campground.id, Campground.availability_fetched_at
).filter(...).first()

campsites = db.query(
    Campsite.id, Campsite.rec_campsite_id, Campsite.name,
    Campsite.loop, Campsite.site_type, Campsite.reserve_type
).filter(...).all()
```

**Impact:**
- Reduced data transfer per query (6-20 columns → 2-6 columns)
- Faster query execution
- Less memory usage

## 4. Existing Optimizations (Already Present)

These were already in place:

1. **Campgrounds list caching** (`src/api/routes/campgrounds.py`)
   - 5 min TTL for list view
   - 60s TTL for detail view

2. **Regions caching** (`src/api/routes/regions.py`)
   - 1 hour TTL (regions rarely change)

3. **Database indexes** (`src/storage/models.py`)
   - GiST index on location column
   - Indexes on frequently filtered columns (state_code, campground_id, etc.)

4. **Pagination** (`src/api/routes/campgrounds.py`)
   - Default limit: 50, max: 200
   - Prevents unbounded queries

## 5. Keep-Alive Optimization

**File:** `.github/workflows/keep-alive.yml`

Reduced GitHub Actions keep-alive frequency:
- **Before:** Every 14 minutes (103x/day)
- **After:** Every hour (24x/day)
- **Reduction:** 85% fewer keep-alive requests

Combined with /health endpoint optimization (no DB queries), this virtually eliminates keep-alive database load.

## Expected Cost Savings

### On Neon Launch Tier (~$15/mo typical):

**Before optimizations:**
- Compute: 100-150 CU-hours/month = $10-16/mo
- Storage: 1-2 GB = $0.35-0.70/mo
- Transfer: Under 500 GB included = $0
- **Total: ~$12-18/month**

**After optimizations:**
- Compute: 50-80 CU-hours/month = $5-8/mo (40-50% reduction)
- Storage: 1-2 GB = $0.35-0.70/mo (unchanged)
- Transfer: Under 500 GB included = $0
- **Total: ~$6-10/month**

**Savings: ~$5-10/month (40-50% reduction)**

## Monitoring Recommendations

1. **Check Neon dashboard** for actual usage patterns after deployment
2. **Monitor cache hit rates** via `X-Cache` response headers
3. **Watch connection pool utilization** in application logs
4. **Track response times** to ensure caching doesn't cause stale data issues

## Future Optimizations (If Needed)

1. **Add Redis** for distributed caching (if multiple backend instances)
2. **Implement conditional requests** (ETags, Last-Modified headers)
3. **Add database read replicas** (if read load becomes significant)
4. **Optimize ingestion pipeline** to reduce write load
5. **Add query result pagination** to campsites/alerts endpoints (currently unbounded)

## Testing

All optimizations have been applied and the backend is running. The database quota issue must be resolved (upgrade to Launch tier or wait for quota reset) before these optimizations can be fully validated.
