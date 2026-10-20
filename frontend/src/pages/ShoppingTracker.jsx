// Shopping Tracker v2 - Improved with AI Search and Budget Priority
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../services/api";

const ShoppingTracker = () => {
  const [items, setItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tracked"); // tracked | wishlist | ai
  
  // Budget state (PRIORITY)
  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem("shopping_budget");
    return saved ? parseFloat(saved) : 0;
  });
  const [budgetInput, setBudgetInput] = useState(budget.toString());
  
  // AI Search state
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState(null);
  const [aiSearching, setAiSearching] = useState(false);
  
  // Debounced search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  
  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsData, wishlistData] = await Promise.all([
        api.request("/shopping/items"),
        api.request("/shopping/wishlist")
      ]);
      
      if (Array.isArray(itemsData)) setItems(itemsData);
      if (Array.isArray(wishlistData)) setWishlist(wishlistData);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => { loadData(); }, [loadData]);
  
  // Calculate totals
  const stats = useMemo(() => {
    const totalSpent = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const budgetRemaining = budget - totalSpent;
    const percentUsed = budget > 0 ? (totalSpent / budget * 100).toFixed(0) : 0;
    return { totalSpent, budgetRemaining, percentUsed };
  }, [items, budget]);
  
  // Save budget
  const saveBudget = (value) => {
    const num = parseFloat(value) || 0;
    setBudget(num);
    localStorage.setItem("shopping_budget", num.toString());
  };
  
  // AI Price Search using marketplace links
  const searchWithAI = async () => {
    if (!aiQuery.trim()) return;
    setAiSearching(true);
    setAiResults(null);
    
    try {
      // Use search API to get marketplace prices
      const results = await api.request(`/search/price?q=${encodeURIComponent(aiQuery)}&country=ID`);
      
      if (results && results.marketplaces) {
        setAiResults({
          query: aiQuery,
          marketplaces: results.marketplaces,
          cached: results.cached,
          timestamp: results.timestamp
        });
      }
    } catch (e) {
      console.error("AI search error:", e);
      setAiResults({ error: "Gagal mencari harga" });
    } finally {
      setAiSearching(false);
    }
  };
  
  // Format currency
  const formatCurrency = (num) => {
    if (!num && num !== 0) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(num);
  };
  
  // Get marketplace color
  const getMarketplaceColor = (name) => {
    const colors = {
      shopee: "text-orange-500",
      tokopedia: "text-green-500",
      lazada: "text-blue-500",
      blibli: "text-purple-500",
      tiktok: "text-pink-500"
    };
    return colors[name?.toLowerCase()] || "text-gray-500";
  };
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-blue-500 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">🛒 Belanja</h1>
      </div>
      
      {/* Budget Card - PRIORITY */}
      <div className="p-4">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Budget Bulanan</span>
            <span className="font-bold text-lg">{formatCurrency(budget)}</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                stats.percentUsed > 90 ? "bg-red-500" : 
                stats.percentUsed > 70 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(stats.percentUsed, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Terpakai: {formatCurrency(stats.totalSpent)}</span>
            <span className={stats.budgetRemaining < 0 ? "text-red-500 font-medium" : "text-green-500 font-medium"}>
              {stats.budgetRemaining >= 0 ? "Sisa: " : "Over: "}{formatCurrency(Math.abs(stats.budgetRemaining))}
            </span>
          </div>
          
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="Budget..."
              className="flex-1 p-2 border rounded-lg text-sm"
            />
            <button
              onClick={() => saveBudget(budgetInput)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              Set
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-4">
        {["tracked", "wishlist", "ai"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              activeTab === tab 
                ? "bg-blue-500 text-white" 
                : "bg-white text-gray-600"
            }`}
          >
            {tab === "tracked" ? "📝 Tracked" : tab === "wishlist" ? "❤️ Wishlist" : "🤖 AI Search"}
          </button>
        ))}
      </div>
      
      {/* Tab: Tracked Items */}
      {activeTab === "tracked" && (
        <div className="px-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Memuat...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>Belum ada item</p>
              <p className="text-sm mt-2">Tambah item baru di bawah</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.quantity}x {formatCurrency(item.price || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency((item.price || 0) * (item.quantity || 1))}</p>
                    {item.marketplace && (
                      <span className={`text-xs ${getMarketplaceColor(item.marketplace)}`}>
                        {item.marketplace}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Tab: Wishlist */}
      {activeTab === "wishlist" && (
        <div className="px-4">
          {wishlist.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>Wishlist kosong</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wishlist.map(item => (
                <div key={item.id} className="bg-white rounded-lg p-3">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        Target: {formatCurrency(item.target_price || 0)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      item.priority === "high" ? "bg-red-100 text-red-600" :
                      item.priority === "medium" ? "bg-yellow-100 text-yellow-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {item.priority || "medium"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Tab: AI Search */}
      {activeTab === "ai" && (
        <div className="px-4">
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-bold mb-3">🔍 Cari Harga dengan AI</h3>
            <p className="text-sm text-gray-500 mb-3">
              Tanyakan tentang produk, contoh: "harga beras 5kg terbaru" atau "iPhone 15 pro max"
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Contoh: Harga laptop gaming ASUS..."
                className="flex-1 p-3 border rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && searchWithAI()}
              />
              <button
                onClick={searchWithAI}
                disabled={aiSearching || !aiQuery.trim()}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {aiSearching ? "..." : "Cari"}
              </button>
            </div>
          </div>
          
          {/* AI Results */}
          {aiResults && (
            <div className="mt-4">
              {aiResults.error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl">
                  {aiResults.error}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-500">
                      Hasil untuk: <strong>{aiResults.query}</strong>
                      {aiResults.cached && <span className="ml-2 text-xs">📦 Cache</span>}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {aiResults.marketplaces?.map((mp, idx) => (
                      <a
                        key={idx}
                        href={mp.search_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{mp.icon || "🛒"}</span>
                          <span className={`font-bold ${getMarketplaceColor(mp.name)}`}>
                            {mp.name}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Klik untuk melihat di {mp.name}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Quick Add */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            type="text"
            placeholder="Tambah item..."
            className="flex-1 p-3 border rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                // Quick add
                const name = e.target.value.trim();
                setItems(prev => [...prev, { id: Date.now(), name, price: 0, quantity: 1 }]);
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ShoppingTracker;
