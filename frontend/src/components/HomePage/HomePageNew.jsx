import { useEffect, useState } from 'react'
import { fetchRegions, fetchCampgrounds } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { DEMO_MODE, isRegionEnabled, DISABLED_REGION_MESSAGE } from '../../config/demo.js'
import styles from './HomePageNew.module.css'

const REGION_ICONS = {
  southeast:   '🌿',
  northeast:   '🍂',
  great_lakes: '🌊',
  plains:      '🌾',
  mountain:    '⛰️',
  pacific_west:'🌲',
}

const REGION_COLORS = {
  southeast:   'linear-gradient(135deg, #2d5a2d 0%, #1a3d1a 100%)',
  northeast:   'linear-gradient(135deg, #8b4513 0%, #654321 100%)',
  great_lakes: 'linear-gradient(135deg, #1e5a7a 0%, #0d3d5a 100%)',
  plains:      'linear-gradient(135deg, #c4a747 0%, #9d7f2a 100%)',
  mountain:    'linear-gradient(135deg, #5a6b7a 0%, #3d4a5a 100%)',
  pacific_west:'linear-gradient(135deg, #2e5a3d 0%, #1a3d2a 100%)',
}

function LiveStats({ regions }) {
  const totalCampgrounds = regions.reduce((sum, r) => sum + (r.campground_count || 0), 0)

  return (
    <div className={styles.liveStats}>
      <div className={styles.statItem}>
        <div className={styles.statValue}>{totalCampgrounds.toLocaleString()}</div>
        <div className={styles.statLabel}>Federal Campgrounds</div>
      </div>
      <div className={styles.statDivider} />
      <div className={styles.statItem}>
        <div className={styles.statValue}>7-Day</div>
        <div className={styles.statLabel}>Weather Forecasts</div>
      </div>
      <div className={styles.statDivider} />
      <div className={styles.statItem}>
        <div className={styles.statValue}>Live</div>
        <div className={styles.statLabel}>Availability Data</div>
      </div>
    </div>
  )
}

function FeaturedGallery({ campgrounds }) {
  const withPhotos = campgrounds.filter((cg) => cg.photo_urls?.length > 0)
  if (withPhotos.length === 0) return null

  return (
    <section className={styles.featuredSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Featured Campgrounds</h2>
        <p className={styles.sectionSubtitle}>Handpicked sites from across the Southeast</p>
      </div>
      <div className={styles.featuredGrid}>
        {withPhotos.slice(0, 6).map((cg) => (
          <div key={cg.id} className={styles.featuredCard}>
            <div className={styles.featuredImage}>
              <img src={cg.photo_urls[0]} alt={cg.name} loading="lazy" />
              <div className={styles.featuredOverlay}>
                <div className={styles.featuredBadge}>{cg.state_code}</div>
              </div>
            </div>
            <div className={styles.featuredContent}>
              <h3 className={styles.featuredName}>{cg.name}</h3>
              <div className={styles.featuredTags}>
                {cg.wildlife_tags?.slice(0, 2).map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function HomePageNew() {
  const [regions, setRegions] = useState([])
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const { setSelectedRegion } = useApp()

  useEffect(() => {
    fetchRegions()
      .then(setRegions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    fetchCampgrounds({ region: 'southeast', limit: 20 })
      .then((data) => setFeatured(data.items ?? []))
      .catch(() => {})
  }, [loading])

  return (
    <div className={styles.page}>
      {/* Fixed Navigation */}
      <nav className={styles.nav}>
        <span className={styles.logo}>CampScout</span>
        {DEMO_MODE && <span className={styles.demoPill}>Portfolio Demo</span>}
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.heroPattern}></div>
        </div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Discover Your Perfect
            <span className={styles.heroTitleAccent}> Campsite</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Live availability · Real-time weather · Thousands of federal campgrounds
          </p>
          <a href="#regions" className={styles.heroCta}>
            <span>Explore Campgrounds</span>
            <span className={styles.ctaArrow}>→</span>
          </a>
          {!loading && regions.length > 0 && <LiveStats regions={regions} />}
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Find Your Spot in Seconds</h2>
          <p className={styles.sectionSubtitle}>Three simple steps to your next adventure</p>
        </div>
        <div className={styles.stepsGrid}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <h3 className={styles.stepTitle}>Choose Region</h3>
            <p className={styles.stepDesc}>Select from 6 US regions covering thousands of federal campgrounds</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <h3 className={styles.stepTitle}>Filter & Search</h3>
            <p className={styles.stepDesc}>Find sites by amenities, wildlife, terrain, and activities</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <h3 className={styles.stepTitle}>Check Availability</h3>
            <p className={styles.stepDesc}>See live availability windows and book directly on Recreation.gov</p>
          </div>
        </div>
      </section>

      {/* Regions */}
      <section id="regions" className={styles.regionsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Explore by Region</h2>
          <p className={styles.sectionSubtitle}>
            {DEMO_MODE
              ? 'Demo showcases Southeast region with full functionality'
              : 'Choose your destination across the United States'}
          </p>
        </div>

        {loading ? (
          <div className={styles.regionGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.regionCardSkeleton}>
                <div className={styles.skeletonIcon} />
                <div className={styles.skeletonText} />
                <div className={styles.skeletonText} style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.regionGrid}>
            {regions.map((r) => {
              const enabled = isRegionEnabled(r.id)
              return (
                <button
                  key={r.id}
                  className={`${styles.regionCard} ${!enabled ? styles.regionCardDisabled : ''}`}
                  onClick={() => enabled && setSelectedRegion(r.id)}
                  disabled={!enabled}
                  type="button"
                  style={{ background: enabled ? REGION_COLORS[r.id] : undefined }}
                >
                  {!enabled && <div className={styles.disabledOverlay}>
                    <span className={styles.demoBadge}>DEMO</span>
                    <span className={styles.disabledMessage}>{DISABLED_REGION_MESSAGE}</span>
                  </div>}
                  <div className={styles.regionIcon}>{REGION_ICONS[r.id] ?? '📍'}</div>
                  <div className={styles.regionInfo}>
                    <h3 className={styles.regionName}>{r.name}</h3>
                    <p className={styles.regionStates}>
                      {r.states.slice(0, 3).join(' · ')}
                      {r.states.length > 3 ? ` +${r.states.length - 3}` : ''}
                    </p>
                    {enabled && (
                      <div className={styles.regionCount}>
                        {r.campground_count.toLocaleString()} campgrounds
                      </div>
                    )}
                  </div>
                  <div className={styles.regionArrow}>→</div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Featured Gallery */}
      <FeaturedGallery campgrounds={featured} />

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>CampScout</div>
            <p className={styles.footerTagline}>Federal campsite discovery made simple</p>
          </div>
          <div className={styles.footerSources}>
            <p className={styles.footerLabel}>Data Sources</p>
            <p className={styles.footerText}>Recreation.gov · National Park Service · NOAA</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
