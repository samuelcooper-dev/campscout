"""
Campsites endpoint.

GET /campgrounds/{id}/campsites — individual site attributes for a campground.
"""
from typing import Annotated

from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Response

from ...storage.models import Campground, Campsite
from ..deps import get_db
from ..schemas import CampsiteDetail

router = APIRouter()

# Cache campsite lists — 10 min TTL (campsites rarely change)
_campsites_cache: TTLCache = TTLCache(maxsize=128, ttl=600)


@router.get("/{campground_id}/campsites", response_model=list[CampsiteDetail])
def get_campsites(
    campground_id: int,
    response: Response,
    db: Annotated[object, Depends(get_db)],
) -> list[CampsiteDetail]:
    cached = _campsites_cache.get(campground_id)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=120"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Check campground exists (only query ID column, not full row)
    exists = db.query(Campground.id).filter(Campground.id == campground_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Campground not found")

    sites = (
        db.query(Campsite)
        .filter(Campsite.campground_id == campground_id)
        .order_by(Campsite.name)
        .all()
    )
    result = [CampsiteDetail.model_validate(s) for s in sites]

    _campsites_cache[campground_id] = result
    response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=120"
    response.headers["X-Cache"] = "MISS"
    return result
