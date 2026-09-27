// Merchant Map with Leaflet + OpenStreetMap
// Shows spending patterns on interactive map

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { api } from "../services/api";
import { formatCurrency } from "../utils/format";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for merchants
const createMerchantIcon = (size = 30) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      border: 2px solid white;
      border-radius: 50%;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">💰</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

const MerchantMap = () => {
  const [merchants, setMerchants] = useState([]);
  const [topMerchants, setTopMerchants] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("spending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([-6.2, 106.8]); // Jakarta default

  useEffect(() => {
    fetchMerchantData();
    fetchTopMerchants();
  }, [selectedMetric]);

  const fetchMerchantData = async () => {
    try {
      setLoading(true);
      const response = await api.request("/analytics/merchants/map");
      const markers = response.markers || [];
      setMerchants(markers);
      
      // Center map on first merchant with location
      if (markers.length > 0) {
        const withLocation = markers.find(m => m.latitude && m.longitude);
        if (withLocation) {
          setMapCenter([withLocation.latitude, withLocation.longitude]);
        }
      }
    } catch (err) {
      console.error("Error fetching merchant data:", err);
      setError("Gagal memuat data merchant");
    } finally {
      setLoading(false);
    }
  };

  const fetchTopMerchants = async () => {
    try {
      const response = await api.request(
        `/analytics/merchants/top?metric=${selectedMetric}&limit=10`
      );
      setTopMerchants(response.merchants || []);
    } catch (err) {
      console.error("Error fetching top merchants:", err);
    }
  };

  // Component to fly to selected merchant
  const FlyToMerchant = ({ merchant }) => {
    const map = useMap();
    if (merchant?.latitude && merchant?.longitude) {
      map.flyTo([merchant.latitude, merchant.longitude], 15, {
        duration: 1
      });
    }
    return null;
  };

  if (loading && merchants.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Count merchants with valid locations
  const merchantsWithLocation = merchants.filter(m => m.latitude && m.longitude);

  return (
    <div className="space-y-6">
      {/* Metric Selector */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedMetric("spending")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedMetric === "spending"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            💸 Pengeluaran Tertinggi
          </button>
          <button
            onClick={() => setSelectedMetric("frequency")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedMetric === "frequency"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            📍 Kunjungan Terbanyak
          </button>
          <button
            onClick={() => setSelectedMetric("recent")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedMetric === "recent"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            🕐 Terbaru
          </button>
        </div>
      </div>

      {/* Map and Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                🗺️ Peta Pengeluaran
              </h3>
              <p className="text-sm text-gray-500">
                {merchantsWithLocation.length} lokasi terdeteksi
              </p>
            </div>
            
            <div className="h-[500px] relative">
              {merchantsWithLocation.length > 0 ? (
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {merchantsWithLocation.map((merchant, index) => {
                    const markerSize = 25 + Math.min(25, merchant.visit_count * 2);
                    return (
                      <Marker
                        key={merchant.merchant_name}
                        position={[merchant.latitude, merchant.longitude]}
                        icon={createMerchantIcon(markerSize)}
                      >
                        <Popup>
                          <div className="min-w-[200px]">
                            <h4 className="font-bold text-lg mb-2">{merchant.merchant_name}</h4>
                            <div className="space-y-1 text-sm">
                              <p>📍 Kunjungan: <strong>{merchant.visit_count}x</strong></p>
                              <p>💰 Total: <strong>{formatCurrency(merchant.total_spent)}</strong></p>
                              {merchant.avg_transaction && (
                                <p>📊 Rata-rata: <strong>{formatCurrency(merchant.avg_transaction)}</strong></p>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">📍</div>
                    <h4 className="font-semibold text-gray-700 mb-2">Belum Ada Data Lokasi</h4>
                    <p className="text-gray-500 text-sm">
                      Scan struk dengan aktifkan lokasi untuk melihat di peta
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Map Legend */}
            <div className="p-4 bg-gray-50 border-t">
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span>Marker merchant</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📍</span>
                  <span>Ukuran = Frekuensi kunjungan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🗺️</span>
                  <span>Data dari OpenStreetMap</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Top Merchants */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                🏆 Top 10 Merchant
              </h3>
            </div>
            
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {topMerchants.length > 0 ? (
                topMerchants.map((merchant, index) => (
                  <div
                    key={merchant.merchant_name}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (merchant.latitude && merchant.longitude) {
                        setMapCenter([merchant.latitude, merchant.longitude]);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' :
                        'bg-primary-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {merchant.merchant_name}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <span>📍 {merchant.visit_count}x</span>
                          <span>•</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(merchant.total_spent)}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary-600 h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (merchant.total_spent / (topMerchants[0]?.total_spent || 1)) * 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">📊</div>
                  <p>Belum ada data merchant</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm p-4 mt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Statistik</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Merchant</span>
                <span className="font-semibold">{merchants.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Dengan Lokasi</span>
                <span className="font-semibold text-green-600">{merchantsWithLocation.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Pengeluaran</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(topMerchants.reduce((sum, m) => sum + (m.total_spent || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Merchant List (if no map data) */}
      {merchantsWithLocation.length === 0 && merchants.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📋 Daftar Merchant
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {merchants.map((merchant) => (
              <div key={merchant.merchant_name} className="border rounded-lg p-4">
                <h4 className="font-medium">{merchant.merchant_name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {merchant.visit_count} kunjungan • {formatCurrency(merchant.total_spent)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantMap;
