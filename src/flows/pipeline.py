"""
Top-level Prefect orchestrator for CampScout.

Daily schedule:
  - weather + availability (daily, 6 AM UTC): all 6 regions
  - Skips metadata/amenities/images (infrequent changes)

Ingest flows run first (rec-gov for availability, noaa for weather). Each is
submitted with return_state=True so that a single source failing does not abort
the run — failures are logged and the transform always runs after both finish.

Run standalone:
    python -m src.flows.pipeline --weather-availability  # daily sync (all regions)
"""
import argparse
import logging
import os

from dotenv import load_dotenv
from prefect import flow, get_run_logger, task

from .noaa import noaa_flow
from .nps import nps_flow
from .rec_gov import rec_gov_flow
from .transform import transform_flow

load_dotenv()

log = logging.getLogger(__name__)

ALL_REGIONS = ["southeast", "northeast", "great_lakes", "plains", "mountain", "pacific_west"]
DEFAULT_AVAILABILITY_REGIONS = ["southeast"]


@flow(name="campscout-daily")
def pipeline(
    regions: list[str] = DEFAULT_AVAILABILITY_REGIONS,
    availability_regions: list[str] = DEFAULT_AVAILABILITY_REGIONS,
    availability_only: bool = False,
) -> None:
    """
    Full CampScout pipeline:
      1. Ingest from Recreation.gov, NPS, and NOAA for the specified regions.
      2. Run the transform pipeline regardless of partial ingest failures
         (includes pruning past-date availability and weather rows).
      3. Refresh materialized view.

    Default schedule: SE metadata + SE availability (daily).
    For weekly national metadata sync, call with regions=ALL_REGIONS.

    Args:
        regions: regions to sync metadata for
        availability_regions: regions to sync availability for
        availability_only: if True, skip campsite metadata (daily sync mode)
    """
    logger = get_run_logger()

    # --- Ingest phase ---
    # return_state=True means a failing subflow returns a Failed State instead
    # of raising, so we can log and continue.
    rec_state = rec_gov_flow(regions=regions, availability_only=availability_only, return_state=True)
    nps_state = nps_flow(regions=regions, return_state=True)
    noaa_state = noaa_flow(return_state=True)

    ingest_results = [
        ("rec-gov", rec_state),
        ("nps", nps_state),
        ("noaa", noaa_state),
    ]
    for name, state in ingest_results:
        if state.is_failed():
            logger.warning(
                "Ingest flow '%s' failed — transform will still run with whatever data is available",
                name,
            )
        else:
            logger.info("Ingest flow '%s' completed successfully", name)

    # --- Transform phase --- always runs, even if some ingest flows failed
    # Note: transform_flow includes prune_stale step which cleans past-date data
    transform_flow()

    # --- Refresh materialized view --- zero-downtime concurrent refresh
    try:
        import sqlalchemy
        from ..storage.database import SessionLocal
        with SessionLocal() as db:
            db.execute(sqlalchemy.text(
                "REFRESH MATERIALIZED VIEW CONCURRENTLY campground_summary_mv"
            ))
            db.commit()
        logger.info("Materialized view refreshed")
    except Exception as exc:
        logger.warning("MV refresh failed (non-fatal): %s", exc)

    logger.info("Pipeline complete")


@flow(name="campscout-national-metadata")
def national_metadata_pipeline() -> None:
    """
    Weekly national metadata sync — runs for all 6 regions.
    Availability is NOT synced here (daily SE-only pipeline does that).
    """
    logger = get_run_logger()

    rec_state = rec_gov_flow(regions=ALL_REGIONS, return_state=True)
    nps_state = nps_flow(regions=ALL_REGIONS, return_state=True)
    noaa_state = noaa_flow(return_state=True)

    for name, state in [("rec-gov", rec_state), ("nps", nps_state), ("noaa", noaa_state)]:
        if state.is_failed():
            logger.warning("National metadata ingest '%s' failed", name)
        else:
            logger.info("National metadata ingest '%s' completed", name)

    transform_flow()
    logger.info("National metadata pipeline complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Run the CampScout pipeline.")
    parser.add_argument(
        "--weather-availability",
        action="store_true",
        help="Run daily weather + availability sync.",
    )
    parser.add_argument(
        "--national",
        action="store_true",
        help="Run the national metadata pipeline (all 6 regions, includes metadata).",
    )
    parser.add_argument(
        "--region",
        type=str,
        choices=ALL_REGIONS,
        help="Run for a single region only (used with --weather-availability for parallel execution).",
    )
    args = parser.parse_args()

    if args.national:
        national_metadata_pipeline()
    elif args.region:
        # Single region sync (for GitHub Actions matrix strategy)
        log.info(f"Running availability sync for single region: {args.region}")
        pipeline(regions=[args.region], availability_regions=[args.region], availability_only=True)
    else:
        # All regions sync (backward compatible)
        pipeline(regions=ALL_REGIONS, availability_regions=ALL_REGIONS, availability_only=True)
