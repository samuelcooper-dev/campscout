"""
Alerts endpoint.

GET /campgrounds/{id}/alerts — active alerts for a campground, newest first.
"""
import logging
from typing import Annotated

from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ...storage.models import Campground, CampgroundAlert
from ..deps import get_db
from ..schemas import AlertRow

log = logging.getLogger(__name__)

router = APIRouter()

# Cache alerts — 10 min TTL (alerts update infrequently)
_alerts_cache: TTLCache = TTLCache(maxsize=128, ttl=600)


@router.get("/{campground_id}/alerts", response_model=list[AlertRow])
def get_alerts(
    campground_id: int,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> list[AlertRow]:
    cached = _alerts_cache.get(campground_id)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=120"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Check campground exists (only query ID column, not full row)
    exists = db.query(Campground.id).filter(Campground.id == campground_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Campground not found")

    rows = (
        db.query(CampgroundAlert)
        .filter(CampgroundAlert.campground_id == campground_id)
        .order_by(CampgroundAlert.published_at.desc())
        .all()
    )
    result = [AlertRow.model_validate(r) for r in rows]

    _alerts_cache[campground_id] = result
    response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=120"
    response.headers["X-Cache"] = "MISS"
    return result
