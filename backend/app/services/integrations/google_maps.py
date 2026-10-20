"""Google Maps Geocoding Service - Reverse geocoding for transaction locations."""

import httpx
import os
from typing import Optional
from app.core.config import get_settings

settings = get_settings()


async def get_location_name(lat: float, lng: float) -> str:
    """
    Reverse geocode coordinates to address.
    Uses OpenStreetMap/Nominatim (free) by default, falls back to Google Maps if API key is available.
    """
    # Try OpenStreetMap/Nominatim first (free, no API key needed)
    try:
        url = f"https://nominatim.openstreetmap.org/reverse"
        params = {
            "format": "json",
            "lat": lat,
            "lon": lng,
            "accept-language": "id"  # Indonesian
        }
        headers = {"User-Agent": "FinManager/1.0"}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params, headers=headers)
            data = response.json()
            
            if data.get("display_name"):
                # Parse to get cleaner address
                addr = data.get("address", {})
                parts = []
                for key in ["neighbourhood", "suburb", "city_district", "city", "town", "village"]:
                    if addr.get(key):
                        parts.append(addr[key])
                if addr.get("road"):
                    parts.append(addr["road"])
                if addr.get("postcode"):
                    parts.append(addr["postcode"])
                
                if parts:
                    return ", ".join(parts[:3])  # Return first 3 parts
                return data["display_name"].split(",")[0]  # Return first part of full address
    except Exception as e:
        print(f"Nominatim error: {e}")
    
    # Fallback to Google Maps if API key is available
    api_key = settings.GOOGLE_MAPS_API_KEY or os.getenv("GOOGLE_MAPS_API_KEY")
    
    if not api_key:
        return f"Loc: {lat:.4f}, {lng:.4f}"
    
    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "latlng": f"{lat},{lng}",
            "key": api_key,
            "language": "id"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
            
            if data.get("results"):
                return data["results"][0].get("formatted_address", f"Loc: {lat:.4f}, {lng:.4f}")
    except Exception as e:
        print(f"Google Maps error: {e}")
    
    return f"Loc: {lat:.4f}, {lng:.4f}"


async def search_places(query: str, location: tuple = None, radius: int = 1000) -> list:
    """
    Search for places using OpenStreetMap/Nominatim (free) or Google Places API.
    """
    results = []
    
    # Try OpenStreetMap/Nominatim first (free)
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "format": "json",
            "q": query,
            "limit": 5,
            "accept-language": "id"
        }
        if location:
            params["lat"] = location[0]
            params["lon"] = location[1]
            params["radius"] = radius
        
        headers = {"User-Agent": "FinManager/1.0"}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params, headers=headers)
            data = response.json()
            
            if data:
                for place in data[:5]:
                    results.append({
                        "name": place.get("display_name", "").split(",")[0],
                        "address": place.get("display_name", ""),
                        "place_id": place.get("place_id"),
                        "location": {
                            "lat": float(place.get("lat", 0)),
                            "lng": float(place.get("lon", 0))
                        }
                    })
                return results
    except Exception as e:
        print(f"Nominatim search error: {e}")
    
    # Fallback to Google Places if API key is available
    api_key = settings.GOOGLE_PLACES_API_KEY or settings.GOOGLE_MAPS_API_KEY or os.getenv("GOOGLE_PLACES_API_KEY")
    
    if not api_key:
        return results
    
    try:
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        params = {
            "query": query,
            "key": api_key,
            "language": "id"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
            
            if data.get("results"):
                for place in data["results"][:5]:
                    results.append({
                        "name": place.get("name"),
                        "address": place.get("formatted_address"),
                        "place_id": place.get("place_id"),
                        "location": place.get("geometry", {}).get("location", {})
                    })
    except Exception as e:
        print(f"Google Places error: {e}")
    
    return results


def get_static_map_url(lat: float, lng: float, zoom: int = 15, size: str = "400x300") -> str:
    """
    Generate static map URL using OpenStreetMap (free) or Google Maps.
    """
    # Use OpenStreetMap by default (free)
    return f"https://www.openstreetmap.org/export/embed.html?bbox={lng-0.01},{lat-0.01},{lng+0.01},{lat+0.01}&marker={lat},{lng}"
