"""
Prefect flow wrapping Recreation.gov ingestion.

Each of the three ingest functions becomes a @task with retries.
The flow mirrors the run() logic in src/ingestion/recreation_gov.py —
it does not duplicate any business logic.

Run standalone:
    python -m src.flows.rec_gov
"""
import logging
import os

import httpx
from dotenv import load_dotenv
from prefect import flow, task, unmapped

from ..ingestion.recreation_gov import (
    DEFAULT_REGIONS,
    REGION_STATES,
    ingest_availability,
    ingest_campsites,
    ingest_facilities,
)
from ..storage.database import SessionLocal

load_dotenv()

log = logging.getLogger(__name__)


@task(name="rec-gov-fetch-facilities", retries=2, retry_delay_seconds=30)
def fetch_facilities(states: list[str], limit: int | None) -> list[str]:
    """Fetch all campground facilities for the given states and return their IDs."""
    api_key = os.environ["RECREATION_GOV_API_KEY"]
    with (
        httpx.Client(headers={"apikey": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        return ingest_facilities(client, db, states, limit)


@task(name="rec-gov-fetch-campsites", retries=2, retry_delay_seconds=30)
def fetch_campsites(facility_id: str) -> None:
    """Fetch all campsites for a single facility."""
    api_key = os.environ["RECREATION_GOV_API_KEY"]
    with (
        httpx.Client(headers={"apikey": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        ingest_campsites(client, db, facility_id)


@task(name="rec-gov-fetch-availability", retries=2, retry_delay_seconds=30)
def fetch_availability(facility_id: str) -> None:
    """Fetch availability for the next N months for a single facility."""
    api_key = os.environ["RECREATION_GOV_API_KEY"]
    with (
        httpx.Client(headers={"apikey": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        ingest_availability(client, db, facility_id)


@task(name="rec-gov-process-facility", retries=2, retry_delay_seconds=30)
def process_facility(facility_id: str, availability_only: bool = False) -> None:
    """Process a single facility: fetch campsites (optional) and availability."""
    api_key = os.environ["RECREATION_GOV_API_KEY"]
    with (
        httpx.Client(headers={"apikey": api_key}, timeout=30) as client,
        SessionLocal() as db,
    ):
        if not availability_only:
            try:
                ingest_campsites(client, db, facility_id)
            except Exception as exc:
                log.error("Campsite ingest failed facility=%s: %s", facility_id, exc)

        try:
            ingest_availability(client, db, facility_id)
        except Exception as exc:
            log.error("Availability ingest failed facility=%s: %s", facility_id, exc)


@flow(name="rec-gov-ingest")
def rec_gov_flow(
    regions: list[str] = DEFAULT_REGIONS,
    states: list[str] | None = None,
    limit: int | None = None,
    availability_only: bool = False,
) -> None:
    """
    Ingest Recreation.gov facilities, campsites, and availability.

    Args:
        regions: region slugs to ingest (resolved to state lists)
        states: explicit state override (takes precedence over regions)
        limit: max facilities — useful for testing
        availability_only: if True, skip campsite metadata fetch (daily sync mode)
    """
    if states is None:
        states = []
        for region in regions:
            states.extend(REGION_STATES.get(region, []))

    facility_ids = fetch_facilities(states, limit)
    log.info("Processing %d facilities (availability_only=%s)", len(facility_ids), availability_only)

    # Parallel processing with concurrency limit via tags
    process_facility.map(facility_ids, availability_only=unmapped(availability_only))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    rec_gov_flow()
