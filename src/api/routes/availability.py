"""
Availability endpoint.

GET /campgrounds/{id}/availability — grouped availability by campsite over a date range.

Returns AvailabilityResponse with per-campsite windows so the frontend can show
which specific sites are open and link directly to Recreation.gov.
"""
import logging
from collections import defaultdict
from datetime import date
from typing import Annotated

from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...storage.models import AvailabilitySnapshot, Campground, Campsite
from ..deps import get_db
from ..schemas import AvailabilityResponse, CampsiteWindow

log = logging.getLogger(__name__)

router = APIRouter()

# Cache availability queries — 5 min TTL since availability updates hourly
_availability_cache: TTLCache = TTLCache(maxsize=128, ttl=300)


@router.get("/{campground_id}/availability", response_model=AvailabilityResponse)
def get_availability(
    campground_id: int,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    start: Annotated[date, Query(description="Start date (inclusive), ISO format YYYY-MM-DD")],
    end: Annotated[date, Query(description="End date (inclusive), ISO format YYYY-MM-DD")],
) -> AvailabilityResponse:
    cache_key = (campground_id, start, end)
    cached = _availability_cache.get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Check campground exists and get availability_fetched_at (only fetch needed columns)
    campground = db.query(
        Campground.id, Campground.availability_fetched_at
    ).filter(Campground.id == campground_id).first()
    if not campground:
        raise HTTPException(status_code=404, detail="Campground not found")

    # Fetch only campsite fields needed for the response
    campsites = db.query(
        Campsite.id, Campsite.rec_campsite_id, Campsite.name, Campsite.loop,
        Campsite.site_type, Campsite.reserve_type
    ).filter(Campsite.campground_id == campground_id).all()
    if not campsites:
        return AvailabilityResponse(sites=[], available_site_count=0, fcfs_only=False, no_data=True, start=start, end=end)

    # Campsites exist but availability has never been fetched — still syncing
    if campground.availability_fetched_at is None:
        return AvailabilityResponse(sites=[], available_site_count=0, syncing=True, start=start, end=end)

    campsite_ids = [c.id for c in campsites]
    # Build campsite map with only the fields we fetched
    campsite_map = {
        c.id: {
            "id": c.id,
            "rec_campsite_id": c.rec_campsite_id,
            "name": c.name,
            "loop": c.loop,
            "site_type": c.site_type,
            "reserve_type": c.reserve_type,
        }
        for c in campsites
    }

    # Latest snapshot per (campsite_id, date) — availability table is append-only
    subq = (
        db.query(
            AvailabilitySnapshot.campsite_id,
            AvailabilitySnapshot.date,
            func.max(AvailabilitySnapshot.fetched_at).label("latest"),
        )
        .filter(
            AvailabilitySnapshot.campsite_id.in_(campsite_ids),
            AvailabilitySnapshot.date >= start,
            AvailabilitySnapshot.date <= end,
        )
        .group_by(AvailabilitySnapshot.campsite_id, AvailabilitySnapshot.date)
        .subquery()
    )

    rows = (
        db.query(AvailabilitySnapshot)
        .join(
            subq,
            (AvailabilitySnapshot.campsite_id == subq.c.campsite_id)
            & (AvailabilitySnapshot.date == subq.c.date)
            & (AvailabilitySnapshot.fetched_at == subq.c.latest),
        )
        .all()
    )

    # Group snapshots by campsite_id
    by_site: dict[int, list] = defaultdict(list)
    for row in rows:
        by_site[row.campsite_id].append(row)

    windows: list[CampsiteWindow] = []
    for site_id, snapshots in by_site.items():
        campsite = campsite_map[site_id]
        avail_dates = sorted(s.date for s in snapshots if s.status == "Available")
        windows.append(
            CampsiteWindow(
                rec_campsite_id=campsite["rec_campsite_id"],
                name=campsite["name"],
                loop=campsite["loop"],
                site_type=campsite["site_type"],
                reserve_type=campsite["reserve_type"],
                available_dates=avail_dates,
                total_dates=len(snapshots),
            )
        )

    # Sites with availability first, then alphabetically by name
    windows.sort(key=lambda w: (-len(w.available_dates), w.name or ""))

    available_site_count = sum(1 for w in windows if w.available_dates)
    fcfs_only = bool(campsites) and all(c.reserve_type == "first_come" for c in campsites)
    walk_in_only = bool(campsites) and all(
        "walk" in (c.site_type or "").lower() for c in campsites
    )

    result = AvailabilityResponse(
        sites=windows,
        available_site_count=available_site_count,
        fcfs_only=fcfs_only,
        walk_in_only=walk_in_only,
        start=start,
        end=end,
    )

    _availability_cache[cache_key] = result
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    response.headers["X-Cache"] = "MISS"
    return result
