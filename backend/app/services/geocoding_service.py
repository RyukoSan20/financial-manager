"""Geocoding Service for merchant location lookup.

Uses OpenStreetMap Nominatim (free) with fallback to manual coordinates.
For production, consider Google Maps Geocoding API.
"""

import requests
import re
import time
import threading
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from datetime import datetime


# The words that mean a place is on a street.
#
# A name with a street in it is a place and can be looked up. A name
# without one is a brand, and the middle of the city is all that can
# be said about it. The two are told apart here, so that a shop with
# an address is never given the coordinates of a city.
_STREET_WORDS = re.compile(
    r"\b("
    r"jl\.?|jalan|street|st\.|road|rd\.|Jl\.?\.?|"
    r"no\.?|nomor|lot|block|blok|unit|"
    r"kawasan|perk_complex|plaza|"
    r"gang|gg\.|komplek|"
    r"^\d+\s|,|\d+\s*[A-Za-z]"
    r")\b",
    re.IGNORECASE,
)


@dataclass
class GeoLocation:
    """Geocoded location data."""
    latitude: float
    longitude: float
    formatted_address: str
    city: Optional[str] = None
    country: Optional[str] = None
    confidence: float = 0.5
    # How exact this answer is.
    #
    # "street" means the place was found and the coordinates point at
    # it. "city" means the merchant is a brand the application knows
    # and the coordinates are the middle of the city it trades in,
    # which is a true statement about the city but not about the
    # shop. Anything that shows an address to the reader has to know
    # which of the two it is holding.
    precision: str = "street"


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
        # The answers that have already been looked up.
        #
        # The merchant map asks about the same handful of merchants
        # every time it is opened, and Nominatim asks to be treated
        # gently. The answers are kept for a while so the second
        # reader to open the map does not wait on the network for an
        # answer the first one already paid for.
        self._cache: Dict[str, Tuple[float, Optional["GeoLocation"]]] = {}
        self._cache_lock = threading.Lock()

    # How long a looked-up answer is kept, in seconds.
    CACHE_TTL_SECONDS = 60 * 60 * 6

    def _cache_get(self, key: str) -> Tuple[bool, Optional["GeoLocation"]]:
        """The remembered answer for a key, if it is still fresh."""
        with self._cache_lock:
            entry = self._cache.get(key)
            if entry is None:
                return False, None
            stored_at, value = entry
            if time.time() - stored_at > self.CACHE_TTL_SECONDS:
                self._cache.pop(key, None)
                return False, None
            return True, value

    def _cache_put(self, key: str, value: Optional["GeoLocation"]) -> None:
        """Remember an answer, including the answer "not found"."""
        with self._cache_lock:
            self._cache[key] = (time.time(), value)

    def clear_cache(self) -> None:
        """Forget every looked-up answer."""
        with self._cache_lock:
            self._cache.clear()
    
    def geocode(self, query: str, city: str = None) -> Optional[GeoLocation]:
        """
        Geocode a query string to coordinates.

        The query is looked for in the order that finds the most
        precise answer:

            1. the whole query, as it was written - "Indomaret Kemang
               Raya, Jakarta" finds that shop;
            2. the query on its own, which is what finds a brand.

        A brand is not a place. When the query is only a brand that
        the application knows, the answer is the middle of the city
        the brand trades in, and the answer says so: its precision is
        "city", not "street". A caller that shows an address to the
        reader has to know which of the two it is holding, because a
        pin that claims to be a shop when it is really the middle of
        the city is a lie the reader cannot see.

        Args:
            query: Merchant name or address
            city: Optional city name to narrow search

        Returns:
            GeoLocation with coordinates or None if not found
        """
        if not query:
            return None

        query = query.strip()
        if not query:
            return None

        key = f"{query.lower()}|{(city or '').lower()}"
        found, remembered = self._cache_get(key)
        if found:
            return remembered

        # A place that is named with a street in it is a place, not
        # a brand. The street is what makes it a place.
        has_street = bool(_STREET_WORDS.search(query))

        if not has_street:
            # The brand alone. This is the last thing that is tried,
            # because it is the least precise of the answers.
            brand = self._known_brand(query)
            if brand is not None:
                answer = GeoLocation(
                    latitude=brand[0],
                    longitude=brand[1],
                    formatted_address=f"{query}, Indonesia",
                    city=city,
                    confidence=0.8,
                    precision="city",
                )
                self._cache_put(key, answer)
                return answer

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

                    answer = GeoLocation(
                        latitude=lat,
                        longitude=lon,
                        formatted_address=display_name,
                        city=city_name,
                        country=addr.get("country"),
                        confidence=0.7,
                        precision="street",
                    )
                    self._cache_put(key, answer)
                    return answer

        except Exception as e:
            print(f"Geocoding error: {e}")

        # The brand is tried last, so a place with a street in it is
        # never given the middle of the city.
        brand = self._known_brand(query)
        if brand is not None:
            answer = GeoLocation(
                latitude=brand[0],
                longitude=brand[1],
                formatted_address=f"{query}, Indonesia",
                city=city,
                confidence=0.6,
                precision="city",
            )
            self._cache_put(key, answer)
            return answer

        self._cache_put(key, None)
        return None

    def _known_brand(self, query: str) -> Optional[Tuple[float, float]]:
        """
        The middle of the city a known brand trades in.

        This is the last answer and the least precise one. The
        application knows that "Indomaret" is in Jakarta; it does not
        know which Indomaret, and it will not pretend to.
        """
        lowered = query.lower()
        for known_name, coords in self.KNOWN_LOCATIONS.items():
            if known_name in lowered:
                return coords
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
