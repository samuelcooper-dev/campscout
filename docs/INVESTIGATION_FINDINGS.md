# Investigation Findings - Three UI Issues

Investigated using Playwright browser automation on 2026-08-25.

## Issue 1: "Data as of 4d ago" Staleness

**Status:** Confirmed - Data is actually 4 days old

**Findings:**
- FreshnessBadge component correctly calculates time since last update
- Component logic in `frontend/src/components/MapView/FreshnessBadge.jsx` is working correctly
- The `dataAsOf` timestamp comes from the API's `data_as_of` field in `/api/campgrounds` response
- This field is calculated from `max(campground.updated_at)` in `src/api/routes/campgrounds.py:126-128`

**Root Cause:**
The campground data hasn't been refreshed in 4 days. This is a **data pipeline issue**, not a UI bug.

**Investigation needed:**
1. Check when the ingestion pipeline last ran successfully
2. Check Prefect flows/schedules
3. Verify database `campgrounds.updated_at` timestamps
4. Check if Recreation.gov/NPS/NOAA ingestion is running on schedule

**Temporary verification:**
```bash
# Check latest campground update in database
SELECT MAX(updated_at) FROM campgrounds;
```

---

## Issue 2: Missing Images

**Status:** False alarm - Images load successfully, but DetailPanel is off-screen

**Findings:**
- DetailPanel DOES render with 5 photos successfully
- Example: Delta National Forest campground loaded 5 photos from Recreation.gov CDN
- All images have valid src URLs and load without errors (checked via `image.complete` and `image.naturalWidth`)
- Sample image: `https://cdn.recreation.gov/public/2019/10/02/23/40/253459_2f3e49ad-bc21-4a38-9800-3f70a5ac7d41_700.webp`

**Root Cause:**
DetailPanel is positioned **off-screen** at `left: 1440px` (detected via `getBoundingClientRect()`).

**CSS Investigation:**
The DetailPanel renders as the second `<aside>` element with class `_panel_orh4j_3`:
```javascript
{
  left: 1440,
  width: 480,
  zIndex: 10,
  display: "flex",
  position: "static"
}
```

On a 1920px wide screen, the panel appears partially, but on smaller screens (1366px, 1440px), it's completely off-screen.

**Files to check:**
- `frontend/src/App.module.css` - `.body` layout
- `frontend/src/components/DetailPanel/DetailPanel.module.css` - panel sizing

**Expected behavior:**
DetailPanel should be visible on the right side of the viewport, not extending beyond screen width.

---

## Issue 3: Site Crashes When Clicking Through Campsites

**Status:** Confirmed - React hooks error in PhotoGallery component

**Error:**
```
Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
Error in <PhotoGallery> component
```

**Root Cause:**
`frontend/src/components/DetailPanel/PhotoGallery.jsx:14` has an early return AFTER hooks have been called.

**Current code (BUGGY):**
```javascript
export function PhotoGallery({ urls }) {
  const [index, setIndex] = useState(0)           // Hook 1
  const [lightbox, setLightbox] = useState(false) // Hook 2
  const stripRef = useRef(null)                   // Hook 3
  const indexRef = useRef(0)                      // Hook 4

  useEffect(() => { indexRef.current = index }, [index])  // Hook 5

  if (!urls?.length) return null  // ❌ EARLY RETURN

  // More hooks below that sometimes don't run:
  const prev = useCallback(...)   // Hook 6
  const next = useCallback(...)   // Hook 7
  useEffect(...)                  // Hook 8
```

**Why it crashes:**
1. User clicks campground A → PhotoGallery renders with 5 photos → all 8 hooks run
2. User clicks campground B → PhotoGallery renders with null/empty photos → only 5 hooks run
3. React detects hook count mismatch → throws error → entire app unmounts → blank page

**Fix:**
Move the early return BEFORE any hooks are called:

```javascript
export function PhotoGallery({ urls }) {
  if (!urls?.length) return null  // ✅ EARLY RETURN FIRST

  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const stripRef = useRef(null)
  const indexRef = useRef(0)
  // ... rest of hooks
```

**Files to fix:**
- `frontend/src/components/DetailPanel/PhotoGallery.jsx` - Move line 14 to line 5

---

## Summary

| Issue | Status | Severity | Type | Fix Complexity |
|-------|--------|----------|------|---------------|
| Data 4 days old | Confirmed | Medium | Data pipeline | Investigate Prefect |
| Missing images | False alarm | High | CSS layout | Easy - CSS fix |
| Crash on clicks | Confirmed | Critical | React hooks | Easy - Move 1 line |

## Recommended Fix Order

1. **Fix crash (Critical)** - Move early return in PhotoGallery.jsx (1 line change)
2. **Fix off-screen panel (High)** - Adjust DetailPanel CSS layout
3. **Investigate data staleness (Medium)** - Check ingestion pipeline schedule

## Test Plan

After fixes:
1. Click through 10+ campgrounds rapidly without crash
2. Verify DetailPanel visible on screens 1366px-1920px wide
3. Confirm images display in photo gallery
4. Check data freshness after next pipeline run
