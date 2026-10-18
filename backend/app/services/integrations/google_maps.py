"""Google Maps Geocoding Service - Reverse geocoding for transaction locations."""

import httpx
import os
from typing import Optional
from app.core.config import get_settings

settings = get_settings()


async def get_location_name(lat: float, lng: float) -> str:
    """
    Reverse geocode coordinates to address using Google Maps Geocoding API.
    
    Args:
        lat: Latitude
        lng: Longitude
        
    Returns:
        Formatted address or "Lokasi Tidak Dikenal" if failed
    """
    api_key = settings.GOOGLE_MAPS_API_KEY or os.getenv("GOOGLE_MAPS_API_KEY")
    
    if not api_key:
        return "Google Maps API key not configured"
    
    url = f"https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "latlng": f"{lat},{lng}",
        "key": api_key,
        "language": "id"  # Indonesian
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
            
            if data.get("results"):
                return data["results"][0].get("formatted_address", "Lokasi Tidak Dikenal")
            
            return "Lokasi Tidak Dikenal"
    except Exception as e:
        print(f"Geocoding error: {e}")
        return "Lokasi Tidak Dikenal"


async def search_places(query: str, location: tuple = None, radius: int = 1000) -> list:
    """
    Search for places using Google Places API.
    
    Args:
        query: Search query (e.g., "Indomaret Jakarta")
        location: Optional (lat, lng) tuple to bias results
        radius: Search radius in meters
        
    Returns:
        List of place results
    """
    api_key = settings.GOOGLE_PLACES_API_KEY or settings.GOOGLE_MAPS_API_KEY or os.getenv("GOOGLE_PLACES_API_KEY")
    
    if not api_key:
        return []
    
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "key": api_key,
        "language": "id"
    }
    
    if location:
        params["location"] = f"{location[0]},{location[1]}"
        params["radius"] = str(radius)
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
            
            if data.get("results"):
                return [
                    {
                        "name": place.get("name"),
                        "address": place.get("formatted_address"),
                        "place_id": place.get("place_id"),
                        "location": place.get("geometry", {}).get("location", {})
                    }
                    for place in data["results"][:5]
                ]
            
            return []
    except Exception as e:
        print(f"Places search error: {e}")
        return []


def get_static_map_url(lat: float, lng: float, zoom: int = 15, size: str = "400x300") -> str:
    """
    Generate static map URL for displaying location.
    
    Args:
        lat: Latitude
        lng: Longitude
        zoom: Map zoom level (1-20)
        size: Image size (e.g., "400x300")
        
    Returns:
        Static map image URL
    """
    api_key = settings.GOOGLE_MAPS_API_KEY or os.getenv("GOOGLE_MAPS_API_KEY")
    
    if not api_key:
        return ""
    
    return (
        f"https://maps.googleapis.com/maps/api/staticmap?"
        f"center={lat},{lng}&zoom={zoom}&size={size}"
        f"&markers=color:red%7C{lat},{lng}"
        f"&key={api_key}"
    )
