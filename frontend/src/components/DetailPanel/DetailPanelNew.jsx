import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useCampgroundDetail } from '../../hooks/useCampgroundDetail.js'
import { useWeather } from '../../hooks/useWeather.js'
import { useAlerts } from '../../hooks/useAlerts.js'
import { useAvailability } from '../../hooks/useAvailability.js'
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx'
import { PhotoGallery } from './PhotoGallery.jsx'
import { getWildlifeIcon, primaryWildlifeGroup } from '../../emblems/wildlifeEmblems.js'
import { getTerrainColor, getTerrainIcon } from '../../emblems/terrainColors.js'
import { getActivityIcon } from '../../emblems/activityEmblems.js'
import styles from './DetailPanelNew.module.css'

const AMENITY_LABELS = [
  { key: 'has_electricity', label: 'Electricity', icon: '⚡' },
  { key: 'has_showers', label: 'Showers', icon: '🚿' },
  { key: 'has_toilets', label: 'Flush Toilets', icon: '🚽' },
  { key: 'has_drinking_water', label: 'Drinking Water', icon: '💧' },
  { key: 'pets_allowed', label: 'Dog Friendly', icon: '🐕' },
  { key: 'ada_accessible', label: 'ADA Accessible', icon: '♿' },
]

/** Map NOAA short_forecast text → weather emoji */
function wxEmoji(forecast) {
  if (!forecast) return '🌤️'
  const f = forecast.toLowerCase()
  if (f.includes('thunder') || f.includes('storm')) return '⛈️'
  if (f.includes('snow') || f.includes('wintry') || f.includes('blizzard')) return '🌨️'
  if (f.includes('fog') || f.includes('hazy') || f.includes('smoke')) return '🌫️'
  if (f.includes('rain') || f.includes('shower') || f.includes('drizzle')) return '🌧️'
  if (f.includes('overcast') || f.includes('cloudy')) return '☁️'
  if (f.includes('mostly sunny') || f.includes('partly')) return '⛅'
  if (f.includes('sunny') || f.includes('clear')) return '☀️'
  if (f.includes('wind') || f.includes('breezy')) return '💨'
  return '🌤️'
}

/** Small icon bubble: SVG inside a circle, tooltip label */
function IconBubble({ icon, label, dotColor }) {
  return (
    <span
      title={label}
      className={styles.iconBubble}
      style={dotColor ? { borderColor: dotColor, color: dotColor } : {}}
      aria-label={label}
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
    </span>
  )
}

/** Compact alert rows */
const ALERT_COLORS = {
  Danger: 'var(--color-danger)',
  'Park Closure': 'var(--color-danger)',
  Caution: 'var(--color-caution)',
  Information: 'var(--color-info)',
}

function AlertsSummary({ alerts }) {
  if (!alerts?.length) return null
  return (
    <div className={styles.alertsCompact}>
      {alerts.slice(0, 3).map((a, i) => (
        <div key={i} className={styles.alertCompactRow}>
          <span
            className={styles.alertCompactBadge}
            style={{ background: ALERT_COLORS[a.category] ?? 'var(--color-info)' }}
          >
            {a.category ?? 'Alert'}
          </span>
          <span className={styles.alertCompactTitle}>{a.title}</span>
        </div>
      ))}
      {alerts.length > 3 && (
        <p className={styles.alertCompactMore}>+{alerts.length - 3} more</p>
      )}
    </div>
  )
}

/** Overview Tab Content */
function OverviewTab({ detail, alerts }) {
  // Pre-compute icon lists
  const seenAct = new Set()
  const actIcons = (detail.activity_tags ?? [])
    .map(t => ({ icon: getActivityIcon(t), label: t }))
    .filter(({ icon }) => icon && !seenAct.has(icon) && seenAct.add(icon))

  const seenTer = new Set()
  const terIcons = (detail.terrain_tags ?? [])
    .map(t => ({ icon: getTerrainIcon(t), label: t, dotColor: getTerrainColor(t) }))
    .filter(({ icon }) => icon && !seenTer.has(icon) && seenTer.add(icon))
  const terDots = (detail.terrain_tags ?? [])
    .filter(t => !getTerrainIcon(t) && getTerrainColor(t))
    .map(t => ({ label: t, dotColor: getTerrainColor(t) }))

  const seenWild = new Set()
  const wildIcons = (detail.wildlife_tags ?? [])
    .map(t => {
      const group = primaryWildlifeGroup([t])
      const icon = getWildlifeIcon(group)
      return { icon, label: t }
    })
    .filter(({ icon }) => icon && !seenWild.has(icon) && seenWild.add(icon))

  return (
    <div className={styles.tabContent}>
      {/* Activities */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Activities</h3>
        {actIcons.length > 0 ? (
          <div className={styles.bubbleRow}>
            {actIcons.map(({ icon, label }) => (
              <IconBubble key={label} icon={icon} label={label} />
            ))}
          </div>
        ) : (
          <p className={styles.processingInline}><span aria-hidden="true">⚙</span> Being processed</p>
        )}
      </section>

      {/* Landscape */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Landscape</h3>
        {(terIcons.length > 0 || terDots.length > 0) ? (
          <div className={styles.bubbleRow}>
            {terIcons.map(({ icon, label, dotColor }) => (
              <IconBubble key={label} icon={icon} label={label} dotColor={dotColor} />
            ))}
            {terDots.map(({ label, dotColor }) => (
              <span key={label} title={label} className={styles.dotBubble} style={{ background: dotColor }} aria-label={label} />
            ))}
          </div>
        ) : (
          <p className={styles.processingInline}><span aria-hidden="true">⚙</span> Being processed</p>
        )}
      </section>

      {/* Wildlife */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Wildlife</h3>
        {wildIcons.length > 0 ? (
          <div className={styles.bubbleRow}>
            {wildIcons.map(({ icon, label }) => (
              <IconBubble key={label} icon={icon} label={label} />
            ))}
          </div>
        ) : (
          <p className={styles.processingInline}><span aria-hidden="true">⚙</span> Being processed</p>
        )}
      </section>

      {/* Amenities */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Amenities</h3>
        {AMENITY_LABELS.some(({ key }) => detail[key]) ? (
          <div className={styles.amenityChips}>
            {AMENITY_LABELS.map(({ key, label, icon }) =>
              detail[key] ? (
                <span key={key} className={styles.amenityChip}>
                  <span className={styles.amenityIcon}>{icon}</span>
                  <span>{label}</span>
                </span>
              ) : null
            )}
          </div>
        ) : (
          <p className={styles.processingInline}><span aria-hidden="true">⚙</span> Being processed</p>
        )}
      </section>

      {/* Alerts */}
      {alerts?.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Alerts</h3>
          <AlertsSummary alerts={alerts} />
        </section>
      )}

      {/* Description */}
      {detail.description && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>About</h3>
          <p className={styles.description}>{detail.description}</p>
        </section>
      )}

      {/* Stay limit info */}
      {detail.stay_limit && (
        <p className={styles.meta}>Stay limit: {detail.stay_limit}</p>
      )}
    </div>
  )
}

/** Weather Tab Content */
function WeatherTab({ weatherRows, isStale }) {
  if (!weatherRows?.length) {
    return (
      <div className={styles.tabContent}>
        <p className={styles.processingInline}>
          <span aria-hidden="true">⚙</span> Weather data being processed — check back soon.
        </p>
      </div>
    )
  }

  const grouped = {}
  for (const r of weatherRows) {
    if (!grouped[r.forecast_date]) grouped[r.forecast_date] = {}
    grouped[r.forecast_date][r.is_daytime ? 'day' : 'night'] = r
  }
  const days = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)

  return (
    <div className={styles.tabContent}>
      {isStale && <div className={styles.staleWarning}>Weather may be outdated.</div>}
      <div className={styles.wxGrid}>
        {days.map(([date, { day, night }]) => {
          const dateObj = new Date(date + 'T12:00:00')
          const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
          const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

          return (
            <div key={date} className={styles.wxCard}>
              <div className={styles.wxCardHeader}>
                <span className={styles.wxCardWeekday}>{weekday}</span>
                <span className={styles.wxCardDate}>{monthDay}</span>
              </div>

              {/* Day */}
              <div className={styles.wxCardPeriod}>
                <span className={styles.wxCardLabel}>Day</span>
                <span className={styles.wxCardEmoji} aria-hidden="true">
                  {day ? wxEmoji(day.short_forecast) : '—'}
                </span>
                <span className={styles.wxCardTemp}>{day ? `${day.temperature_f}°F` : '—'}</span>
                {day?.short_forecast && (
                  <span className={styles.wxCardForecast}>{day.short_forecast}</span>
                )}
              </div>

              {/* Night */}
              <div className={styles.wxCardPeriod}>
                <span className={styles.wxCardLabel}>Night</span>
                <span className={styles.wxCardEmoji} aria-hidden="true">
                  {night ? wxEmoji(night.short_forecast) : '—'}
                </span>
                <span className={styles.wxCardTemp}>{night ? `${night.temperature_f}°F` : '—'}</span>
                {night?.short_forecast && (
                  <span className={styles.wxCardForecast}>{night.short_forecast}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Availability Tab Content */
function AvailabilityTab({ availData, availLoading, filters, detail }) {
  // No campsite records at all — walk-in / primitive / not yet ingested
  if (availData?.no_data) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.availStatusCard}>
          <span className={styles.availIcon} aria-hidden="true">📞</span>
          <div className={styles.availText}>
            <strong>Contact the Ranger Station</strong>
            <p>No online reservation data — walk-in or call ahead for availability</p>
          </div>
        </div>
      </div>
    )
  }

  // Campsites exist but availability hasn't been synced yet
  if (availData?.syncing) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.availStatusCard}>
          <span className={styles.availIcon} aria-hidden="true">⏳</span>
          <div className={styles.availText}>
            <strong>Availability syncing</strong>
            <p>Data is being loaded — check back soon</p>
          </div>
        </div>
      </div>
    )
  }

  // Walk-in / primitive — all campsites require hiking in
  if (availData?.walk_in_only) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.availStatusCard}>
          <span className={styles.availIcon} aria-hidden="true">🥾</span>
          <div className={styles.availText}>
            <strong>Walk-in / Primitive Site</strong>
            <p>No vehicle access to campsite — hike in and claim your spot. No reservation needed, call ahead to confirm availability.</p>
          </div>
        </div>
      </div>
    )
  }

  // FCFS campground
  if (availData?.fcfs_only) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.availStatusCard}>
          <span className={styles.availIcon} aria-hidden="true">🥾</span>
          <div className={styles.availText}>
            <strong>First Come, First Serve</strong>
            <p>No online reservations — contact the ranger station for availability</p>
          </div>
        </div>
      </div>
    )
  }

  // No dates selected
  if (!filters.availStart || !filters.availEnd) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.availStatusCard}>
          <span className={styles.availIcon} aria-hidden="true">📅</span>
          <div className={styles.availText}>
            <strong>Select dates to check availability</strong>
            <p>Use the filter panel to set your arrival and departure dates</p>
          </div>
        </div>
      </div>
    )
  }

  if (availLoading) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}><LoadingSpinner size={24} /></div>
      </div>
    )
  }

  const count = availData?.available_site_count ?? 0
  const sites = availData?.sites ?? []

  return (
    <div className={styles.tabContent}>
      {/* Status summary */}
      <div className={`${styles.availStatusCard} ${count > 0 ? styles.availStatusGood : styles.availStatusNone}`}>
        <span className={styles.availIcon} aria-hidden="true">
          {count > 0 ? '✓' : '✕'}
        </span>
        <div className={styles.availText}>
          <strong>{count > 0 ? `${count} site${count !== 1 ? 's' : ''} available` : 'No sites available'}</strong>
          <p>
            {new Date(filters.availStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(filters.availEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Available sites list */}
      {count > 0 && sites.length > 0 && (
        <div className={styles.sitesList}>
          <h3 className={styles.sectionTitle}>Available Sites</h3>
          {sites.map((site, idx) => (
            <div key={idx} className={styles.siteCard}>
              <div className={styles.siteHeader}>
                <span className={styles.siteName}>{site.site_name}</span>
                {site.loop_name && <span className={styles.siteLoop}>{site.loop_name}</span>}
              </div>
              {site.site_type && <span className={styles.siteType}>{site.site_type}</span>}
              {site.dates?.length > 0 && (
                <div className={styles.siteDates}>
                  <span className={styles.siteDatesLabel}>Available dates:</span>
                  <div className={styles.siteDatesList}>
                    {site.dates.map((d, i) => (
                      <span key={i} className={styles.siteDateChip}>
                        {new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reservation link */}
      {detail.reservation_url && (
        <a
          href={detail.reservation_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.reserveLink}
        >
          Reserve on Recreation.gov →
        </a>
      )}
    </div>
  )
}

export function DetailPanelNew() {
  const { selectedId, setSelectedId, filters } = useApp()
  const { detail, loading } = useCampgroundDetail(selectedId)
  const { rows: weatherRows } = useWeather(selectedId)
  const { alerts } = useAlerts(selectedId)
  const { data: availData, loading: availLoading } = useAvailability(
    selectedId,
    filters.availStart,
    filters.availEnd,
  )
  const [activeTab, setActiveTab] = useState('overview')

  if (!selectedId) return null

  return (
    <aside className={styles.panel}>
      {loading && !detail ? (
        <div className={styles.center}><LoadingSpinner size={28} /></div>
      ) : !detail ? (
        <div className={styles.center}><p>Failed to load.</p></div>
      ) : (
        <>
          {/* Sticky top: photo gallery + name bar */}
          <div className={styles.stickyTop}>
            <PhotoGallery urls={detail.photo_urls} />
            <div className={styles.nameBar}>
              <div className={styles.nameGroup}>
                <h2 className={styles.name}>{detail.name}</h2>
                {detail.state_code && (
                  <span className={styles.state}>{detail.state_code}</span>
                )}
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                type="button"
              >✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs} role="tablist">
            <button
              className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('overview')}
              role="tab"
              aria-selected={activeTab === 'overview'}
              type="button"
            >
              Overview
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'weather' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('weather')}
              role="tab"
              aria-selected={activeTab === 'weather'}
              type="button"
            >
              Weather
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'availability' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('availability')}
              role="tab"
              aria-selected={activeTab === 'availability'}
              type="button"
            >
              Availability
            </button>
          </div>

          {/* Tab content */}
          <div className={styles.body}>
            {activeTab === 'overview' && <OverviewTab detail={detail} alerts={alerts} />}
            {activeTab === 'weather' && <WeatherTab weatherRows={weatherRows} isStale={detail.weather_stale} />}
            {activeTab === 'availability' && (
              <AvailabilityTab
                availData={availData}
                availLoading={availLoading}
                filters={filters}
                detail={detail}
              />
            )}
          </div>
        </>
      )}
    </aside>
  )
}
