import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { MapView } from './components/MapView/MapView.jsx'
import { SearchBar } from './components/SearchBar/SearchBar.jsx'
import { FilterPanel } from './components/FilterPanel/FilterPanel.jsx'
import { DetailPanel } from './components/DetailPanel/DetailPanel.jsx'
import { HomePageNew as HomePage } from './components/HomePage/HomePageNew.jsx'
import { DemoBanner } from './components/DemoBanner/DemoBanner.jsx'
import { ErrorBoundary } from './components/shared/ErrorBoundary.jsx'
import { useCampgrounds } from './hooks/useCampgrounds.js'
import { fetchRegions } from './api/client.js'
import { isRegionEnabled } from './config/demo.js'
import styles from './App.module.css'

const REGION_ICONS = {
  southeast:   '🌿',
  northeast:   '🍂',
  great_lakes: '🌊',
  plains:      '🌾',
  mountain:    '⛰️',
  pacific_west:'🌲',
}

function RegionSwitcher({ allRegions }) {
  const { selectedRegion, setSelectedRegion } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Filter to only show enabled regions in demo mode
  const enabledRegions = allRegions.filter((r) => isRegionEnabled(r.id))
  const current = enabledRegions.find((r) => r.id === selectedRegion)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!enabledRegions.length) return null

  // Hide switcher if only one region is enabled
  if (enabledRegions.length === 1) {
    return (
      <div className={styles.regionLabel}>
        <span>{REGION_ICONS[selectedRegion] ?? '📍'}</span>
        <span>{current?.name ?? 'Region'}</span>
      </div>
    )
  }

  return (
    <div ref={ref} className={styles.regionSwitcher}>
      <button
        className={styles.regionBtn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        type="button"
      >
        <span>{REGION_ICONS[selectedRegion] ?? '📍'}</span>
        <span>{current?.name ?? 'Region'}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▾</span>
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          {enabledRegions.map((r) => (
            <button
              key={r.id}
              className={`${styles.dropdownItem} ${r.id === selectedRegion ? styles.dropdownItemActive : ''}`}
              onClick={() => { setSelectedRegion(r.id); setOpen(false) }}
              role="option"
              aria-selected={r.id === selectedRegion}
              type="button"
            >
              <span className={styles.dropdownIcon}>{REGION_ICONS[r.id] ?? '📍'}</span>
              <span>{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Dashboard({ regionData, allRegions }) {
  const [bbox, setBbox] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const { filters, selectedRegion, setSelectedRegion, selectedId } = useApp()
  const { campgrounds, dataAsOf, loading } = useCampgrounds(bbox, filters, selectedRegion)

  // Close filter sheet when a campground is selected on mobile
  const prevSelectedId = useRef(null)
  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedId.current) setFilterOpen(false)
    prevSelectedId.current = selectedId
  }, [selectedId])

  return (
    <div className={styles.layout}>
      <DemoBanner />
      <header className={styles.topBar}>
        <button className={styles.logo} onClick={() => setSelectedRegion(null)} type="button">
          CampScout
        </button>
        <span className={styles.navDivider} />
        <RegionSwitcher allRegions={allRegions} />
        <SearchBar />
        {loading && <span className={styles.loadingDot} title="Loading..." />}
      </header>

      <div className={styles.body}>
        <ErrorBoundary fallbackMessage="Unable to load filters. Please refresh the page.">
          <FilterPanel open={filterOpen} />
        </ErrorBoundary>
        <ErrorBoundary fallbackMessage="Unable to load map. Please check your connection and refresh.">
          <MapView
            campgrounds={campgrounds}
            dataAsOf={dataAsOf}
            onBboxChange={setBbox}
            regionData={regionData}
          />
        </ErrorBoundary>
        <ErrorBoundary fallbackMessage="Unable to load campground details.">
          <DetailPanel />
        </ErrorBoundary>
      </div>

      <button
        className={`${styles.filterFab} ${filterOpen ? styles.filterFabActive : ''}`}
        onClick={() => setFilterOpen((v) => !v)}
        type="button"
        aria-label="Toggle filters"
      >
        ⚙ {filterOpen ? 'Close Filters' : 'Filters'}
      </button>
    </div>
  )
}

function AppInner() {
  const { selectedRegion } = useApp()
  const [allRegions, setAllRegions] = useState([])

  useEffect(() => {
    fetchRegions()
      .then(setAllRegions)
      .catch((err) => console.error('fetchRegions failed:', err))
  }, [])

  const regionData = allRegions.find((r) => r.id === selectedRegion) ?? null

  if (!selectedRegion) {
    return <HomePage />
  }

  return <Dashboard regionData={regionData} allRegions={allRegions} />
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </ErrorBoundary>
  )
}
