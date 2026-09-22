"""Geocoding Service for merchant location lookup.

Uses OpenStreetMap Nominatim (free) with fallback to manual coordinates.
For production, consider Google Maps Geocoding API.
"""

import requests
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class GeoLocation:
    """Geocoded location data."""
    latitude: float
    longitude: float
    formatted_address: str
    city: Optional[str] = None
    country: Optional[str] = None
    confidence: float = 0.5


class GeocodingService:
    """Service for geocoding merchant names/addresses to coordinates."""
    
    # OpenStreetMap Nominatim API (free, rate-limited)
    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"
    
    # Indonesian cities for common merchant locations
    INDONESIAN_CITIES = {
        "jakarta": (-6.2088, 106.8456),
        "bandung": (-6.9175, 107.6191),
        "surabaya": (-7.2575, 112.7521),
        "yogyakarta": (-7.7956, 110.3637),
        "semarang": (-6.9667, 110.4205),
        "medan": (3.5952, 98.6722),
        "makassar": (-5.1426, 119.4123),
        "palembang": (-2.9912, 104.7617),
        "tangerang": (-6.1783, 106.6300),
        "bekasi": (-6.2349, 106.9926),
        "depok": (-6.4025, 106.7942),
        "bogor": (-6.5950, 106.8166),
        "bali": (-8.3405, 115.0920),
        "denpasar": (-8.6705, 115.2126),
    }
    
    # Known merchant locations (for common Indonesian merchants)
    KNOWN_LOCATIONS = {
        "indomaret": (-6.2088, 106.8456),  # Default to Jakarta
        "alfamart": (-6.2088, 106.8456),
        "gojek": (-6.2088, 106.8456),
        "grab": (-6.2088, 106.8456),
        "warung": (-6.2088, 106.8456),
        "tokopedia": (-6.2088, 106.8456),
        "shopee": (1.3521, 103.8198),  # Singapore HQ
        "tokopedia": (-6.2088, 106.8456),
        "traveloka": (-6.2088, 106.8456),
        "ticket": (-6.2088, 106.8456),
        "bca": (-6.2088, 106.8456),
        "mandiri": (-6.2088, 106.8456),
        "bri": (-6.2088, 106.8456),
        "bni": (-6.2088, 106.8456),
        "alfamidi": (-6.2088, 106.8456),
        "ceria": (-6.2088, 106.8456),
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "FinancialManager/1.0 (Educational Use)"
        })
    
    def geocode(self, query: str, city: str = None) -> Optional[GeoLocation]:
        """
        Geocode a query string to coordinates.
        
        Args:
            query: Merchant name or address
            city: Optional city name to narrow search
            
        Returns:
            GeoLocation with coordinates or None if not found
        """
        if not query:
            return None
        
        query = query.strip()
        
        # Check known locations first
        for known_name, coords in self.KNOWN_LOCATIONS.items():
            if known_name in query.lower():
                return GeoLocation(
                    latitude=coords[0],
                    longitude=coords[1],
                    formatted_address=f"{query}, Indonesia",
                    confidence=0.8
                )
        
        # Build search query
        search_query = query
        if city:
            search_query = f"{query}, {city}, Indonesia"
        else:
            search_query = f"{query}, Indonesia"
        
        try:
            # Use Nominatim API
            params = {
                "q": search_query,
                "format": "json",
                "limit": 1,
                "addressdetails": 1,
            }
            
            response = self.session.get(
                self.NOMINATIM_URL,
                params=params,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data:
                    result = data[0]
                    lat = float(result.get("lat", 0))
                    lon = float(result.get("lon", 0))
                    display_name = result.get("display_name", query)
                    
                    # Extract city from address
                    addr = result.get("address", {})
                    city_name = (
                        addr.get("city") or 
                        addr.get("town") or 
                        addr.get("municipality") or
                        city
                    )
                    
                    return GeoLocation(
                        latitude=lat,
                        longitude=lon,
                        formatted_address=display_name,
                        city=city_name,
                        country=addr.get("country"),
                        confidence=0.7
                    )
        
        except Exception as e:
            print(f"Geocoding error: {e}")
        
        return None
    
    def reverse_geocode(self, latitude: float, longitude: float) -> Optional[GeoLocation]:
        """
        Reverse geocode coordinates to address.
        
        Args:
            latitude: Latitude
            longitude: Longitude
            
        Returns:
            GeoLocation with address or None
        """
        try:
            params = {
                "lat": latitude,
                "lon": longitude,
                "format": "json",
                "addressdetails": 1,
            }
            
            response = self.session.get(
                self.NOMINATIM_REVERSE,
                params=params,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data:
                    lat = float(data.get("lat", 0))
                    lon = float(data.get("lon", 0))
                    display_name = data.get("display_name", "")
                    
                    addr = data.get("address", {})
                    city = (
                        addr.get("city") or 
                        addr.get("town") or 
                        addr.get("municipality")
                    )
                    
                    return GeoLocation(
                        latitude=lat,
                        longitude=lon,
                        formatted_address=display_name,
                        city=city,
                        country=addr.get("country"),
                        confidence=0.8
                    )
        
        except Exception as e:
            print(f"Reverse geocoding error: {e}")
        
        return None
    
    def estimate_location(self, merchant_name: str, city: str = None) -> Optional[Tuple[float, float]]:
        """
        Estimate location based on merchant name.
        
        Returns:
            Tuple of (latitude, longitude) or None
        """
        if not merchant_name:
            return None
        
        merchant_lower = merchant_name.lower()
        
        # Check known locations
        for known, coords in self.KNOWN_LOCATIONS.items():
            if known in merchant_lower:
                return coords
        
        # Check Indonesian cities
        if city:
            city_lower = city.lower()
            for city_name, coords in self.INDONESIAN_CITIES.items():
                if city_name in city_lower:
                    return coords
        
        return None


# Global instance
geocoding_service = GeocodingService()


def geocode_merchant(merchant_name: str, city: str = None) -> Optional[GeoLocation]:
    """Quick function to geocode a merchant."""
    return geocoding_service.geocode(merchant_name, city)


def get_coordinates(merchant_name: str, city: str = None) -> Optional[Tuple[float, float]]:
    """Quick function to get coordinates tuple."""
    geo = geocoding_service.geocode(merchant_name, city)
    if geo:
        return (geo.latitude, geo.longitude)
    return None
