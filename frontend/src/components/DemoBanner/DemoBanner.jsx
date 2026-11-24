import { DEMO_MODE, DEMO_MESSAGE } from '../../config/demo.js'
import styles from './DemoBanner.module.css'

export function DemoBanner() {
  if (!DEMO_MODE) return null

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>🎯</span>
      <span className={styles.text}>{DEMO_MESSAGE}</span>
    </div>
  )
}
