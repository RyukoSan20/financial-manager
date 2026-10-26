// Interactive Spending Map with Real-time Data
// Shows all expense locations with click-to-explore functionality

import { useState, useEffect, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import { api } from "../services/api";
import { formatCurrency } from "../utils/format";
import { useTranslation } from "../i18n";
import { IconText } from "../components/ui/IconText";
import { buildFlag } from "../utils/featureFlags";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Category colors
const CATEGORY_COLORS = {
  "Makanan & Minuman": "#ef4444",
  "Transportasi": "#3b82f6",
  "Belanja": "#ec4899",
  "Hiburan": "#8b5cf6",
  "Kesehatan": "#06b6d4",
  "Fashion": "#f59e0b",
  "Tagihan & Utilitas": "#6b7280",
  "Pendidikan": "#10b981",
  "Investasi & Tabungan": "#22c55e",
  "Investasi": "#22c55e",
  "GPS": "#06b6d4",
  "GPS Transaction": "#0ea5e9",
  "default": "#6b7280",
};

// Get marker size based on spending
const getMarkerSize = (totalSpent, maxSpent) => {
  if (!totalSpent || !maxSpent) return 20;
  const ratio = totalSpent / maxSpent;
  return Math.max(15, Math.min(50, 15 + ratio * 35));
};

// Get color for category
const getCategoryColor = (category) => {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
};

// FlyTo component
const FlyTo = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 14, { duration: 1 });
    }
  }, [center, zoom, map]);
  return null;
};

const MerchantMap = () => {
  const { t } = useTranslation();
  // With the polish switch off, the page keeps the drawings it has.
  const polished = buildFlag("UI_POLISH");

  // Data states
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([-6.2, 106.8]);
  const [mapZoom, setMapZoom] = useState(12);
  const [viewMode, setViewMode] = useState("markers"); // markers | heatmap

  // Categories for filter
  const categories = useMemo(() => {
    const cats = [...new Set(markers.map(m => m.category).filter(Boolean))];
    return ["all", ...cats.sort()];
  }, [markers]);

  // Max spent for size calculation
  const maxSpent = useMemo(() => {
    return Math.max(...markers.map(m => m.total_spent || 0), 1);
  }, [markers]);

  // Filter markers
  const filteredMarkers = useMemo(() => {
    let result = markers;

    // Filter by category
    if (selectedCategory !== "all") {
      result = result.filter(m => m.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.address || "").toLowerCase().includes(q) ||
        (m.category || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [markers, selectedCategory, searchQuery]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.request("/analytics/merchants/map");
      const data = response || {};
      setMarkers(data.markers || []);
      setStats({
        total_locations: data.total_locations || 0,
        total_spent: data.total_spent || 0,
        total_visits: data.total_visits || 0,
        sources: data.sources || {},
      });

      // Center on first GPS marker if available
      const gpsMarkers = (data.markers || []).filter(m => m.source === "gps" || m.source === "gps_tx");
      if (gpsMarkers.length > 0) {
        setMapCenter([gpsMarkers[0].latitude, gpsMarkers[0].longitude]);
      }
    } catch (err) {
      console.error("Map fetch error:", err);
      setError(t("merchant_map.load_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle marker click
  const handleMarkerClick = (marker) => {
    setSelectedLocation(marker);
    setMapCenter([marker.latitude, marker.longitude]);
    setMapZoom(15);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedLocation(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">{t("merchant_map.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center p-8">
          <IconText name="warning" emoji="⚠️" on={polished} className="w-8 h-8" />
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-primary-600 text-white rounded-lg">
            {t("merchant_map.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{t("merchant_map.total_locations")}</p>
            <p className="text-xl font-bold text-gray-900">{stats.total_locations}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{t("merchant_map.total_spent")}</p>
            <p className="text-xl font-bold text-red-500">{formatCurrency(stats.total_spent)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{t("merchant_map.total_visits")}</p>
            <p className="text-xl font-bold text-blue-600">{stats.total_visits}x</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{t("merchant_map.gps_data")}</p>
            <p className="text-xl font-bold text-green-500">
              {(stats.sources?.gps || 0) + (stats.sources?.gps_tx || 0)}{t("merchant_map.locations_suffix")}
            </p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder={t("merchant_map.search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><IconText name="search" emoji="🔍" on={polished} className="w-4 h-4" /></span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat === "all" ? t("merchant_map.all_categories") : cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{t("merchant_map.showing").replace("%s", filteredMarkers.length).replace("%s", markers.length)}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("markers")}
              className={`px-3 py-1 rounded-lg ${viewMode === "markers" ? "bg-primary-100 text-primary-600" : "bg-gray-50"}`}
            >
              {t("merchant_map.markers")}
            </button>
            <button
              onClick={() => setViewMode("heatmap")}
              className={`px-3 py-1 rounded-lg ${viewMode === "heatmap" ? "bg-primary-100 text-primary-600" : "bg-gray-50"}`}
            >
              {t("merchant_map.heatmap")}
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="h-[500px] relative">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyTo center={mapCenter} zoom={mapZoom} />

            {/* Markers */}
            {viewMode === "markers" && filteredMarkers.map((marker, idx) => {
              const size = getMarkerSize(marker.total_spent, maxSpent);
              const color = getCategoryColor(marker.category);
              const isSelected = selectedLocation?.id === marker.id;

              return (
                <Marker
                  key={marker.id || idx}
                  position={[marker.latitude, marker.longitude]}
                  eventHandlers={{
                    click: () => handleMarkerClick(marker),
                  }}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `
                      <div style="
                        width: ${size}px;
                        height: ${size}px;
                        background: ${color};
                        border: ${isSelected ? '3px solid #1e40af' : '2px solid white'};
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 8px rgba(0,0,0,${isSelected ? '0.5' : '0.3'});
                        cursor: pointer;
                        transition: all 0.2s;
                        transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
                      ">
                        <span style="
                          color: white;
                          font-size: ${Math.max(10, size / 3)}px;
                          font-weight: bold;
                          text-shadow: 0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9);
                        ">" 
                          ${marker.source === 'category' ? '📍' : '💰'}
                        </span>
                      </div>
                    `,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2],
                  })}
                >
                  <Popup>
                    <div className="min-w-[220px]">
                      <h4 className="font-bold text-base mb-2">{marker.name}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t("merchant_map.total")}</span>
                          <span className="font-semibold text-red-600">{formatCurrency(marker.total_spent)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t("merchant_map.visits")}</span>
                          <span className="font-semibold">{marker.visit_count}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t("merchant_map.average")}</span>
                          <span className="font-semibold">{formatCurrency(marker.avg_transaction)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t("merchant_map.category")}</span>
                          <span className="font-semibold">{marker.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t("merchant_map.source")}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            marker.source === 'gps' || marker.source === 'gps_tx'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {marker.source === 'gps' ? t("merchant_map.source_gps") : marker.source === 'gps_tx' ? t("merchant_map.source_gps_tx") : t("merchant_map.source_category")}
                          </span>
                        </div>
                        {marker.address && (
                          <p className="text-xs text-gray-400 mt-2 border-t pt-2">
                            📍 {marker.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Heatmap mode: CircleMarkers */}
            {viewMode === "heatmap" && filteredMarkers.map((marker, idx) => {
              const radius = getMarkerSize(marker.total_spent, maxSpent);
              const color = getCategoryColor(marker.category);

              return (
                <CircleMarker
                  key={marker.id || idx}
                  center={[marker.latitude, marker.longitude]}
                  radius={radius / 2}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.4,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => handleMarkerClick(marker),
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h4 className="font-bold">{marker.name}</h4>
                      <p className="text-sm">💰 {formatCurrency(marker.total_spent)}</p>
                      <p className="text-xs text-gray-500">{t("merchant_map.visits_count").replace("%s", marker.visit_count)}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-xl p-3 shadow-lg text-xs max-w-[180px] text-gray-900 dark:text-gray-100">
            <p className="font-semibold mb-2">{t("merchant_map.legend")}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>{t("category.makanan")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>{t("category.transport")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                <span>{t("category.belanja")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>{t("merchant_map.gps_real_location")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                <span>{t("merchant_map.gps_transaction")}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">{t("merchant_map.size_legend")}</p>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-full shadow-lg hover:bg-gray-50"
            title={t("merchant_map.refresh_title")}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Selected Location Detail Panel */}
      {selectedLocation && (
        <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-primary-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">{t("merchant_map.detail_title")}</h3>
            <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">{t("merchant_map.name")}</p>
              <p className="font-semibold">{selectedLocation.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("merchant_map.category_label")}</p>
              <p className="font-semibold">{selectedLocation.category}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("merchant_map.total_spent")}</p>
              <p className="font-bold text-red-500 text-lg">{formatCurrency(selectedLocation.total_spent)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("merchant_map.frequency")}</p>
              <p className="font-semibold">{t("merchant_map.visits_count").replace("%s", selectedLocation.visit_count)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500">{t("merchant_map.coordinates")}</p>
              <p className="font-mono text-sm">{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</p>
            </div>
            {selectedLocation.address && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">{t("merchant_map.address")}</p>
                <p className="text-sm">{selectedLocation.address}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-sm text-gray-500">{t("merchant_map.data_source")}</p>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                selectedLocation.source === 'category' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
                {selectedLocation.source === 'category' ? t("merchant_map.source_category_jakarta") : t("merchant_map.gps_real_location")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Location List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">{t("merchant_map.all_locations").replace("%s", filteredMarkers.length)}</h3>
        </div>
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {filteredMarkers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t("merchant_map.no_match")}
            </div>
          ) : (
            filteredMarkers.slice(0, 50).map((marker, idx) => (
              <div
                key={marker.id || idx}
                onClick={() => handleMarkerClick(marker)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedLocation?.id === marker.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getCategoryColor(marker.category) }}
                      ></div>
                      <p className="font-medium truncate">{marker.name}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {marker.visit_count}x · {marker.category}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-red-600">{formatCurrency(marker.total_spent)}</p>
                    <p className="text-xs text-gray-400">
                      {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {filteredMarkers.length > 50 && (
          <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
            {t("merchant_map.showing_50").replace("%s", filteredMarkers.length)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantMap;
