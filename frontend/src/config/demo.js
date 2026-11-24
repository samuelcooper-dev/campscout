/**
 * Demo Mode Configuration
 *
 * This portfolio demo showcases CampScout's functionality using the Southeast region.
 * Other regions are disabled to focus the demo experience.
 */

export const DEMO_MODE = true

export const ENABLED_REGIONS = ['southeast']

export const DEMO_MESSAGE = 'Portfolio Demo - Southeast Region'

export const DISABLED_REGION_MESSAGE = 'Available in full version'

/**
 * Check if a region is enabled in demo mode
 */
export function isRegionEnabled(regionId) {
  if (!DEMO_MODE) return true
  return ENABLED_REGIONS.includes(regionId)
}
