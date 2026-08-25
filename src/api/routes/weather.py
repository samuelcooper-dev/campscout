"""
Weather forecast endpoint.

GET /campgrounds/{id}/weather — upcoming forecast rows for a campground.
"""
import logging
from datetime import date, timedelta
from typing import Annotated

from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from ...storage.models import Campground, WeatherForecast
from ..deps import get_db
from ..schemas import WeatherRow

log = logging.getLogger(__name__)

router = APIRouter()

# Cache weather forecasts — 15 min TTL (weather updates every 6-12 hours)
_weather_cache: TTLCache = TTLCache(maxsize=256, ttl=900)


@router.get("/{campground_id}/weather", response_model=list[WeatherRow])
def get_weather(
    campground_id: int,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    days: Annotated[int, Query(ge=1, le=7)] = 7,
) -> list[WeatherRow]:
    cache_key = (campground_id, days)
    cached = _weather_cache.get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = "public, max-age=900, stale-while-revalidate=180"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Check campground exists (only query ID column, not full row)
    exists = db.query(Campground.id).filter(Campground.id == campground_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Campground not found")

    today = date.today()
    end_date = today + timedelta(days=days)

    rows = (
        db.query(WeatherForecast)
        .filter(
            WeatherForecast.campground_id == campground_id,
            WeatherForecast.forecast_date >= today,
            WeatherForecast.forecast_date < end_date,
        )
        .order_by(WeatherForecast.forecast_date, WeatherForecast.is_daytime.desc())
        .all()
    )
    result = [WeatherRow.model_validate(r) for r in rows]

    _weather_cache[cache_key] = result
    response.headers["Cache-Control"] = "public, max-age=900, stale-while-revalidate=180"
    response.headers["X-Cache"] = "MISS"
    return result
