"""Location API routes - Geocoding and place search."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from app.core.security import get_current_user_optional
from app.models.user import User
from app.services.integrations.google_maps import (
    get_location_name,
    search_places,
    get_static_map_url
)

router = APIRouter(tags=["Location"])


class LocationInfo(BaseModel):
    address: str
    latitude: float
    longitude: float
    static_map_url: Optional[str] = None


class PlaceResult(BaseModel):
    name: str
    address: str
    place_id: Optional[str] = None
    latitude: float
    longitude: float


@router.get("/reverse-geocode", response_model=LocationInfo)
async def reverse_geocode(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    current_user: User = Depends(get_current_user_optional)
):
    """
    Reverse geocode coordinates to address using Google Maps.
    
    Args:
        lat: Latitude (-90 to 90)
        lng: Longitude (-180 to 180)
    """
    address = await get_location_name(lat, lng)
    static_map = get_static_map_url(lat, lng)
    
    return LocationInfo(
        address=address,
        latitude=lat,
        longitude=lng,
        static_map_url=static_map
    )


@router.get("/search-places", response_model=List[PlaceResult])
async def search_nearby_places(
    query: str = Query(..., description="Search query"),
    lat: Optional[float] = Query(None, description="Latitude for nearby search"),
    lng: Optional[float] = Query(None, description="Longitude for nearby search"),
    radius: int = Query(1000, description="Search radius in meters"),
    current_user: User = Depends(get_current_user_optional)
):
    """
    Search for places using Google Places API.
    
    Args:
        query: Search query (e.g., "Indomaret Jakarta")
        lat: Optional latitude to bias results
        lng: Optional longitude to bias results
        radius: Search radius in meters (max 50000)
    """
    location = (lat, lng) if lat and lng else None
    results = await search_places(query, location, min(radius, 50000))
    
    return [
        PlaceResult(
            name=r["name"],
            address=r["address"],
            place_id=r["place_id"],
            latitude=r["location"].get("lat", 0),
            longitude=r["location"].get("lng", 0)
        )
        for r in results
    ]


@router.get("/static-map")
async def get_map_image(
    lat: float = Query(...),
    lng: float = Query(...),
    zoom: int = Query(15, ge=1, le=21),
    size: str = Query("400x300", pattern=r"^\d+x\d+$"),
    current_user: User = Depends(get_current_user_optional)
):
    """Get static map image URL for a location."""
    return {"url": get_static_map_url(lat, lng, zoom, size)}
