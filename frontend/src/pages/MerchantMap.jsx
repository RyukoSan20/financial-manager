// Merchant Map Analytics Component
// Shows spending patterns on interactive map

import { useState, useEffect } from "react";
import { api } from "../services/api";

const MerchantMap = () => {
  const [merchants, setMerchants] = useState([]);
  const [topMerchants, setTopMerchants] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("spending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMerchantData();
    fetchTopMerchants();
  }, [selectedMetric]);

  const fetchMerchantData = async () => {
    try {
      setLoading(true);
      const response = await api.request("/analytics/merchants/map");
      setMerchants(response.markers || []);
    } catch (err) {
      console.error("Error fetching merchant data:", err);
      setError("Failed to load merchant map data");
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

  if (loading && merchants.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Selector */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedMetric("spending")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedMetric === "spending"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Highest Spending
          </button>
          <button
            onClick={() => setSelectedMetric("frequency")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedMetric === "frequency"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Most Visits
          </button>
        </div>
      </div>

      {/* Map Placeholder - Would integrate with Google Maps or Leaflet */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Spending Map
        </h3>
        
        {merchants.length > 0 ? (
          <div className="bg-gray-100 rounded-xl h-80 flex items-center justify-center relative overflow-hidden">
            {/* Map Background */}
            <div className="absolute inset-0 opacity-20">
              <svg viewBox="0 0 400 300" className="w-full h-full">
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)"/>
              </svg>
            </div>
            
            {/* Merchant Markers */}
            {merchants.slice(0, 20).map((merchant, index) => {
              // Distribute markers across the map
              const x = 50 + (index % 5) * 70;
              const y = 50 + Math.floor(index / 5) * 50;
              const size = Math.min(40, 20 + merchant.visit_count * 3);
              const opacity = 0.6 + (merchant.total_spent / 100000) * 0.4;
              
              return (
                <div
                  key={merchant.merchant_name}
                  className="absolute group"
                  style={{ left: x, top: y }}
                >
                  {/* Marker */}
                  <div
                    className="bg-red-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg cursor-pointer transition-transform hover:scale-110"
                    style={{
                      width: size,
                      height: size,
                      opacity: Math.min(1, opacity),
                    }}
                  >
                    <span className="text-xs">{index + 1}</span>
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                      <p className="font-semibold">{merchant.merchant_name}</p>
                      <p>Visits: {merchant.visit_count}</p>
                      <p>Total: Rp {merchant.total_spent?.toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
              <p className="font-semibold text-gray-700 mb-2">Legend</p>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-gray-600">Merchant location</span>
              </div>
              <p className="text-gray-500 mt-1">Size = Visit frequency</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-xl h-80 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-500">No location data yet</p>
              <p className="text-sm text-gray-400 mt-1">Add transactions with merchant names to see them on the map</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Merchants List */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top {selectedMetric === "spending" ? "Spending" : "Visited"} Merchants
        </h3>
        
        {topMerchants.length > 0 ? (
          <div className="space-y-3">
            {topMerchants.map((merchant, index) => (
              <div
                key={merchant.merchant_name}
                className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? "bg-yellow-400 text-yellow-900" :
                  index === 1 ? "bg-gray-300 text-gray-700" :
                  index === 2 ? "bg-amber-600 text-white" :
                  "bg-gray-200 text-gray-600"
                }`}>
                  {index + 1}
                </div>
                
                {/* Merchant Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {merchant.merchant_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {merchant.visit_count} visits
                  </p>
                </div>
                
                {/* Amount */}
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    Rp {merchant.total_spent?.toLocaleString("id-ID")}
                  </p>
                  <p className="text-sm text-gray-500">
                    ~Rp {Math.round(merchant.avg_transaction)?.toLocaleString("id-ID")}/visit
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="w-20">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (merchant.total_spent / topMerchants[0].total_spent) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No merchant data available</p>
          </div>
        )}
      </div>

      {/* Spending Insights */}
      {merchants.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Spending Insights
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Total Locations</p>
              <p className="text-2xl font-bold text-blue-900">
                {merchants.length}
              </p>
              <p className="text-xs text-blue-600 mt-1">Unique merchants with location</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Most Visited</p>
              <p className="text-lg font-bold text-green-900 truncate">
                {topMerchants[0]?.merchant_name || "N/A"}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {topMerchants[0]?.visit_count || 0} visits
              </p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">Highest Spender</p>
              <p className="text-lg font-bold text-purple-900 truncate">
                {topMerchants.find(m => m.total_spent === Math.max(...topMerchants.map(x => x.total_spent)))?.merchant_name || "N/A"}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                Rp {topMerchants.reduce((max, m) => m.total_spent > (max?.total_spent || 0) ? m : max, null)?.total_spent?.toLocaleString("id-ID") || 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantMap;
