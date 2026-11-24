import { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useApp } from '../../context/AppContext.jsx'
import { WILDLIFE_TAGS, LANDSCAPE_TAGS, ACTIVITY_TAGS } from '../../constants/tags.js'
import { WILDLIFE_LEGEND, primaryWildlifeGroup } from '../../emblems/wildlifeEmblems.js'
import { TERRAIN_LEGEND } from '../../emblems/terrainColors.js'
import { ACTIVITY_LEGEND } from '../../emblems/activityEmblems.js'
import styles from './FilterPanelNew.module.css'

const QUICK_AMENITIES = [
  { key: 'has_electricity', label: 'Electricity', icon: '⚡' },
  { key: 'pets_allowed', label: 'Pet-Friendly', icon: '🐕' },
  { key: 'has_showers', label: 'Showers', icon: '🚿' },
  { key: 'has_drinking_water', label: 'Water', icon: '💧' },
]

const ALL_AMENITIES = [
  { key: 'has_electricity', label: 'Electricity', icon: '⚡' },
  { key: 'has_showers', label: 'Showers', icon: '🚿' },
  { key: 'has_toilets', label: 'Flush Toilets', icon: '🚽' },
  { key: 'has_drinking_water', label: 'Drinking Water', icon: '💧' },
  { key: 'pets_allowed', label: 'Dog Friendly', icon: '🐕' },
]

export function FilterPanelNew({ open = true }) {
  const { filters, setFilter, toggleTag, clearFilters } = useApp()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const panelClass = [styles.panel, open ? styles.open : ''].filter(Boolean).join(' ')

  return (
    <aside className={panelClass}>
      <div className={styles.panelHandle} aria-hidden="true" />

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Filters</span>
        <button className={styles.clearBtn} onClick={clearFilters} type="button">
          Clear all
        </button>
      </div>

      {/* ═══ QUICK FILTERS (Always Visible) ═══ */}
      <div className={styles.quickSection}>
        <div className={styles.quickLabel}>
          <span className={styles.quickIcon}>⭐</span>
          <span>Quick Filters</span>
        </div>

        {/* Amenities - Compact chips */}
        <div className={styles.amenityChips}>
          {QUICK_AMENITIES.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`${styles.chip} ${filters[key] ? styles.chipActive : ''}`}
              onClick={() => setFilter(key, !filters[key])}
              type="button"
            >
              <span className={styles.chipIcon}>{icon}</span>
              <span className={styles.chipLabel}>{label}</span>
            </button>
          ))}
        </div>

        {/* Dates */}
        <div className={styles.dateSection}>
          <label className={styles.dateLabel}>Arrival Date</label>
          <DatePicker
            selected={filters.availStart}
            onChange={(d) => setFilter('availStart', d)}
            selectsStart
            startDate={filters.availStart}
            endDate={filters.availEnd}
            minDate={new Date()}
            placeholderText="Select date"
            className={styles.dateInput}
            popperPlacement="bottom-start"
          />

          <label className={styles.dateLabel}>Departure Date</label>
          <DatePicker
            selected={filters.availEnd}
            onChange={(d) => setFilter('availEnd', d)}
            selectsEnd
            startDate={filters.availStart}
            endDate={filters.availEnd}
            minDate={filters.availStart || new Date()}
            placeholderText="Select date"
            className={styles.dateInput}
            popperPlacement="bottom-start"
          />
        </div>
      </div>

      {/* ═══ ADVANCED FILTERS (Collapsible) ═══ */}
      <div className={styles.advancedSection}>
        <button
          className={styles.advancedToggle}
          onClick={() => setAdvancedOpen(!advancedOpen)}
          type="button"
          aria-expanded={advancedOpen}
        >
          <span className={styles.advancedIcon}>⚙️</span>
          <span className={styles.advancedLabel}>Advanced Filters</span>
          <span className={`${styles.chevron} ${advancedOpen ? styles.chevronOpen : ''}`}>
            ▼
          </span>
        </button>

        {advancedOpen && (
          <div className={styles.advancedContent}>
            {/* All Amenities */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>All Amenities</h3>
              {ALL_AMENITIES.map(({ key, label, icon }) => (
                <label key={key} className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={filters[key]}
                    onChange={(e) => setFilter(key, e.target.checked)}
                  />
                  <span className={styles.checkIcon}>{icon}</span>
                  <span>{label}</span>
                </label>
              ))}
            </section>

            {/* Wildlife */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Wildlife</h3>
              <div className={styles.emblemGrid}>
                {WILDLIFE_LEGEND.map(({ group, label, svg }) => {
                  const tagsInGroup = WILDLIFE_TAGS.filter(
                    t => (primaryWildlifeGroup([t]) ?? 'other') === group
                  )
                  const anyActive = tagsInGroup.some(t => filters.wildlife_tags.includes(t))
                  return (
                    <button
                      key={group}
                      className={`${styles.emblemBtn} ${anyActive ? styles.emblemActive : ''}`}
                      onClick={() => tagsInGroup.forEach(t => {
                        if (anyActive ? filters.wildlife_tags.includes(t) : !filters.wildlife_tags.includes(t)) {
                          toggleTag('wildlife_tags', t)
                        }
                      })}
                      type="button"
                      title={label}
                    >
                      <span
                        className={styles.emblemIcon}
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                      <span className={styles.emblemLabel}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Landscape */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Landscape</h3>
              <div className={styles.emblemGrid3}>
                {TERRAIN_LEGEND.map(({ id, label, color, svg, keywords }) => {
                  const tagsInGroup = LANDSCAPE_TAGS.filter(t => keywords.includes(t.toLowerCase()))
                  const anyActive = tagsInGroup.some(t => filters.terrain_tags.includes(t))
                  return (
                    <button
                      key={id}
                      className={`${styles.emblemBtn} ${anyActive ? styles.emblemActive : ''}`}
                      onClick={() => tagsInGroup.forEach(t => {
                        if (anyActive ? filters.terrain_tags.includes(t) : !filters.terrain_tags.includes(t)) {
                          toggleTag('terrain_tags', t)
                        }
                      })}
                      type="button"
                      title={label}
                    >
                      <span
                        className={styles.emblemIcon}
                        style={{ color: anyActive ? color : undefined }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                      <span className={styles.emblemLabel}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Activities */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Activities</h3>
              <div className={styles.emblemGrid3}>
                {ACTIVITY_LEGEND.map(({ id, label, svg, keywords }) => {
                  const tagsInGroup = ACTIVITY_TAGS.filter(t => keywords.includes(t.toLowerCase()))
                  const anyActive = tagsInGroup.some(t => filters.activity_tags.includes(t))
                  return (
                    <button
                      key={id}
                      className={`${styles.emblemBtn} ${anyActive ? styles.emblemActive : ''}`}
                      onClick={() => tagsInGroup.forEach(t => {
                        if (anyActive ? filters.activity_tags.includes(t) : !filters.activity_tags.includes(t)) {
                          toggleTag('activity_tags', t)
                        }
                      })}
                      type="button"
                      title={label}
                    >
                      <span
                        className={styles.emblemIcon}
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                      <span className={styles.emblemLabel}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}
