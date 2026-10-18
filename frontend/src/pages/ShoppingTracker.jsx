// Shopping Tracker Page - Enhanced with Budget & Wishlist Planning
import { useState, useEffect } from "react";
import { api } from "../services/api";

const ShoppingTracker = () => {
  const [items, setItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form states
  const [newItem, setNewItem] = useState("");
  const [wishlistItem, setWishlistItem] = useState("");
  const [wishlistPrice, setWishlistPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [activeTab, setActiveTab] = useState("tracked"); // tracked, wishlist, budget

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsRes, wishlistRes] = await Promise.all([
        api.shopping.items().catch(() => ({ ok: false })),
        api.shopping.wishlist().catch(() => ({ ok: false }))
      ]);
      
      if (itemsRes?.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
      }
      
      if (wishlistRes?.ok) {
        const data = await wishlistRes.json();
        setWishlist(data.items || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Search product prices via Google Shopping / Places API
  const searchProduct = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      // Use Google Places API for store search
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/location/search-places?query=${encodeURIComponent(searchQuery + " Indonesia")}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.slice(0, 5));
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const addToTracked = async () => {
    if (!newItem.trim()) return;
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/shopping/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            name: newItem,
            current_price: 0,
            category: "general"
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setItems([...items, data]);
        setNewItem("");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const addToWishlist = async () => {
    if (!wishlistItem.trim()) return;
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/shopping/wishlist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            name: wishlistItem,
            target_price: parseFloat(wishlistPrice) || 0,
            priority: "medium",
            notes: ""
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setWishlist([...wishlist, data]);
        setWishlistItem("");
        setWishlistPrice("");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const setBudgetAmount = async () => {
    if (!monthlyBudget || monthlyBudget <= 0) return;
    
    try {
      // Store budget in localStorage (simplified)
      localStorage.setItem("shopping_budget", monthlyBudget);
      setBudget(parseFloat(monthlyBudget));
      alert(`Budget belanja bulanan ditetapkan: Rp ${parseInt(monthlyBudget).toLocaleString("id-ID")}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getSpentAmount = () => {
    return items.reduce((sum, item) => sum + (item.current_price || 0), 0);
  };

  const getWishlistTotal = () => {
    return wishlist.reduce((sum, item) => sum + (item.target_price || 0), 0);
  };

  const getBudgetUsed = () => {
    if (!budget) return 0;
    return (getSpentAmount() / budget) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-4">Shopping Tracker</h1>
      
      {/* Budget Overview Card */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-5 text-white mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Budget Belanja Bulanan</h2>
          <span className="text-sm opacity-80">
            {getBudgetUsed().toFixed(0)}% terpakai
          </span>
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {budget ? formatCurrency(budget) : "Belum diatur"}
        </div>
        
        <div className="text-sm opacity-80 mb-3">
          Terpakai: {formatCurrency(getSpentAmount())} dari {budget ? formatCurrency(budget) : "Rp 0"}
        </div>
        
        <div className="h-2 bg-white/30 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              getBudgetUsed() > 90 ? "bg-red-500" : 
              getBudgetUsed() > 70 ? "bg-yellow-500" : "bg-white"
            }`}
            style={{ width: `${Math.min(getBudgetUsed(), 100)}%` }}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab("tracked")}
          className={`flex-1 py-2 text-center font-medium ${
            activeTab === "tracked" 
              ? "border-b-2 border-blue-500 text-blue-500" 
              : "text-gray-500"
          }`}
        >
          Item Dilacak ({items.length})
        </button>
        <button
          onClick={() => setActiveTab("wishlist")}
          className={`flex-1 py-2 text-center font-medium ${
            activeTab === "wishlist" 
              ? "border-b-2 border-blue-500 text-blue-500" 
              : "text-gray-500"
          }`}
        >
          Wishlist ({wishlist.length})
        </button>
        <button
          onClick={() => setActiveTab("budget")}
          className={`flex-1 py-2 text-center font-medium ${
            activeTab === "budget" 
              ? "border-b-2 border-blue-500 text-blue-500" 
              : "text-gray-500"
          }`}
        >
          Budget
        </button>
      </div>

      {/* Tracked Items Tab */}
      {activeTab === "tracked" && (
        <>
          {/* Search Product */}
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-semibold mb-3">🔍 Cek Harga</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk (contoh: beras 5kg)"
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button
                onClick={searchProduct}
                disabled={searching}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
              >
                {searching ? "..." : "Cek"}
              </button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((place, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{place.name}</p>
                    <p className="text-sm text-gray-600">{place.address}</p>
                    <button
                      onClick={() => {
                        setNewItem(place.name);
                        setActiveTab("tracked");
                      }}
                      className="mt-2 text-sm text-blue-500"
                    >
                      + Tambahkan ke Item Dilacak
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Item */}
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-semibold mb-3">Tambah Item Baru</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Nama item (contoh: Beras)"
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button
                onClick={addToTracked}
                className="px-4 py-2 bg-green-500 text-white rounded-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Tracked Items List */}
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {items.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="text-4xl mb-2">🛒</p>
                <p>Belum ada item yang dilacak</p>
                <p className="text-sm">Tambahkan item untuk melacak harga</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.category || "Umum"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.current_price)}</p>
                    {item.last_price && (
                      <p className="text-xs text-gray-500">
                        {item.current_price < item.last_price ? "📉" : item.current_price > item.last_price ? "📈" : "➡️"}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Wishlist Tab */}
      {activeTab === "wishlist" && (
        <>
          {/* Add to Wishlist */}
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-semibold mb-3">Tambah ke Wishlist</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={wishlistItem}
                onChange={(e) => setWishlistItem(e.target.value)}
                placeholder="Nama barang (contoh: Sepeda baru)"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={wishlistPrice}
                  onChange={(e) => setWishlistPrice(e.target.value)}
                  placeholder="Target harga (Rp)"
                  className="flex-1 px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={addToWishlist}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg"
                >
                  + Wishlist
                </button>
              </div>
            </div>
          </div>

          {/* Wishlist Stats */}
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <div className="flex justify-between text-center">
              <div>
                <p className="text-2xl font-bold">{wishlist.length}</p>
                <p className="text-xs text-gray-500">Total Item</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(getWishlistTotal())}
                </p>
                <p className="text-xs text-gray-500">Target Total</p>
              </div>
            </div>
          </div>

          {/* Wishlist Items */}
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {wishlist.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="text-4xl mb-2">❤️</p>
                <p>Wishlist kosong</p>
                <p className="text-sm">Tambahkan barang yang ingin dibeli</p>
              </div>
            ) : (
              wishlist.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      Target: {formatCurrency(item.target_price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.priority === "high" ? "bg-red-100 text-red-600" :
                      item.priority === "medium" ? "bg-yellow-100 text-yellow-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {item.priority || "medium"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Budget Tab */}
      {activeTab === "budget" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold mb-3">Atur Budget Bulanan</h3>
            <p className="text-sm text-gray-500 mb-3">
              Tentukan jumlah maksimal uang belanja per bulan
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="Contoh: 2000000"
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button
                onClick={setBudgetAmount}
                className="px-4 py-2 bg-green-500 text-white rounded-lg"
              >
                Set
              </button>
            </div>
          </div>

          {/* Budget Info */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="font-semibold mb-2">💡 Tips Budgeting</h4>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>• Gunakan aturan 50/30/20 (kebutuhan/keinginan/tabungan)</li>
              <li>• Catat setiap pengeluaran belanja</li>
              <li>• Bandingkan harga sebelum membeli</li>
              <li>• Manfaatkan promo dan diskon resmi</li>
            </ul>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={loadData}
        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mt-4"
      >
        🔄 Refresh
      </button>
    </div>
  );
};

export default ShoppingTracker;
