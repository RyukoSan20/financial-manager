// Shopping Tracker Page - Interactive with Budget & Wishlist
import { useState, useEffect } from "react";

const ShoppingTracker = () => {
  const [items, setItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState(parseFloat(localStorage.getItem("shopping_budget")) || 0);
  const [activeTab, setActiveTab] = useState("tracked");
  
  // Form states
  const [newItem, setNewItem] = useState("");
  const [wishlistName, setWishlistName] = useState("");
  const [wishlistPrice, setWishlistPrice] = useState("");
  const [wishlistPriority, setWishlistPriority] = useState("medium");
  const [budgetInput, setBudgetInput] = useState(budget.toString());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const getToken = () => localStorage.getItem("token");
  const API_URL = import.meta.env.VITE_API_URL;

  const loadData = async () => {
    const token = getToken();
    if (!token) return;
    
    try {
      const [itemsRes, wishlistRes] = await Promise.all([
        fetch(`${API_URL}/shopping/items`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/shopping/wishlist`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(Array.isArray(data) ? data : (data.items || []));
      }
      if (wishlistRes.ok) {
        const data = await wishlistRes.json();
        setWishlist(Array.isArray(data) ? data : (data.wishlist || []));
      }
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    const token = getToken();
    
    try {
      const res = await fetch(`${API_URL}/shopping/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newItem, current_price: 0 })
      });
      
      if (res.ok) {
        const item = await res.json();
        setItems(prev => [...(Array.isArray(prev) ? prev : []), item]);
        setNewItem("");
      }
    } catch (e) {
      console.error("Add error:", e);
    }
  };

  const addToWishlist = async () => {
    if (!wishlistName.trim()) return;
    const token = getToken();
    
    try {
      const res = await fetch(`${API_URL}/shopping/wishlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: wishlistName,
          target_price: parseFloat(wishlistPrice) || 0,
          priority: wishlistPriority
        })
      });
      
      if (res.ok) {
        const item = await res.json();
        setWishlist([...wishlist, item]);
        setWishlistName("");
        setWishlistPrice("");
      }
    } catch (e) {
      console.error("Add wishlist error:", e);
    }
  };

  const saveBudget = () => {
    const amount = parseFloat(budgetInput);
    if (amount > 0) {
      setBudget(amount);
      localStorage.setItem("shopping_budget", amount);
      alert(`Budget ditetapkan: Rp ${amount.toLocaleString("id-ID")}`);
    }
  };

  const deleteItem = async (id) => {
    if (!confirm("Hapus item ini?")) return;
    const token = getToken();
    
    try {
      const res = await fetch(`${API_URL}/shopping/items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setItems(items.filter(i => i.id !== id));
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const deleteWishlist = async (id) => {
    if (!confirm("Hapus dari wishlist?")) return;
    const token = getToken();
    
    try {
      const res = await fetch(`${API_URL}/shopping/wishlist/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setWishlist(wishlist.filter(i => i.id !== id));
      }
    } catch (e) {
      console.error("Delete wishlist error:", e);
    }
  };

  const formatCurrency = (v) => {
    if (!v && v !== 0) return "Rp 0";
    return `Rp ${parseFloat(v).toLocaleString("id-ID")}`;
  };

  // Search product prices across marketplaces
  const searchPrices = async (itemName) => {
    if (!itemName || itemName.length < 2) return;
    
    const token = getToken();
    if (!token) return;
    
    setSearching(true);
    setSearchResults(null);
    setSelectedItem(itemName);
    setSearchModalOpen(true);
    
    try {
      const res = await fetch(`${API_URL}/search/price?q=${encodeURIComponent(itemName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        console.error("Search failed:", res.status);
      }
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  };

  // Open search modal for a specific item
  const openSearch = (item) => {
    setSelectedItem(item.name || item);
    setSearchModalOpen(true);
    setSearchQuery(item.name || item);
    searchPrices(item.name || item);
  };

  const getSpent = () => items.reduce((s, i) => s + (i.current_price || 0), 0);
  const getWishlistTotal = () => wishlist.reduce((s, i) => s + (i.target_price || 0), 0);
  const budgetPercent = budget > 0 ? (getSpent() / budget * 100).toFixed(0) : 0;

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
      
      {/* Budget Card */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-5 text-white mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Budget Belanja</span>
          <span className="text-sm opacity-80">{budgetPercent}% terpakai</span>
        </div>
        <div className="text-2xl font-bold mb-1">
          {budget > 0 ? formatCurrency(budget) : "Belum diatur"}
        </div>
        <div className="text-sm opacity-80 mb-3">
          Terpakai: {formatCurrency(getSpent())} dari {formatCurrency(budget)}
        </div>
        <div className="h-2 bg-white/30 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${budgetPercent > 90 ? "bg-red-400" : budgetPercent > 70 ? "bg-yellow-400" : "bg-white"}`}
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        {["tracked", "wishlist", "budget"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-center font-medium capitalize ${
              activeTab === tab ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500"
            }`}
          >
            {tab === "tracked" ? `Item Dilacak (${items.length})` : 
             tab === "wishlist" ? `Wishlist (${wishlist.length})` : "Budget"}
          </button>
        ))}
      </div>

      {/* Tracked Items Tab */}
      {activeTab === "tracked" && (
        <>
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-semibold mb-3">Tambah Item</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="Nama item (contoh: Beras 5kg)"
                className="flex-1 px-3 py-2 border rounded-lg"
                onKeyDown={e => e.key === "Enter" && addItem()}
              />
              <button onClick={addItem} className="px-4 py-2 bg-green-500 text-white rounded-lg">
                +
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-4xl mb-2">🛒</p>
                <p>Belum ada item yang dilacak</p>
                <p className="text-sm">Tambahkan item untuk melacak harga</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.category || "Umum"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openSearch(item)}
                      className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-sm"
                      title="Cari harga"
                    >
                      🔍
                    </button>
                    <span className="font-semibold">{formatCurrency(item.current_price)}</span>
                    <button onClick={() => deleteItem(item.id)} className="text-red-500 p-1">🗑️</button>
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
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-semibold mb-3">Tambah ke Wishlist</h3>
            <input
              type="text"
              value={wishlistName}
              onChange={e => setWishlistName(e.target.value)}
              placeholder="Nama barang"
              className="w-full px-3 py-2 border rounded-lg mb-2"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={wishlistPrice}
                onChange={e => setWishlistPrice(e.target.value)}
                placeholder="Target harga (Rp)"
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <select
                value={wishlistPriority}
                onChange={e => setWishlistPriority(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
              </select>
              <button onClick={addToWishlist} className="px-4 py-2 bg-purple-500 text-white rounded-lg">
                +
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <div className="flex justify-between text-center">
              <div>
                <p className="text-2xl font-bold">{wishlist.length}</p>
                <p className="text-xs text-gray-500">Total Item</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(getWishlistTotal())}</p>
                <p className="text-xs text-gray-500">Target Total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            {wishlist.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-4xl mb-2">❤️</p>
                <p>Wishlist kosong</p>
              </div>
            ) : (
              wishlist.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">Target: {formatCurrency(item.target_price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.priority === "high" ? "bg-red-100 text-red-600" :
                      item.priority === "medium" ? "bg-yellow-100 text-yellow-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "⚪"} {item.priority}
                    </span>
                    <button onClick={() => deleteWishlist(item.id)} className="text-red-500 p-1">🗑️</button>
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
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                placeholder="Contoh: 2000000"
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button onClick={saveBudget} className="px-6 py-2 bg-green-500 text-white rounded-lg">
                Set
              </button>
            </div>
          </div>

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

      <button onClick={loadData} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium mt-4">
        🔄 Refresh
      </button>

      {/* Search Price Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Cari Harga: {selectedItem}</h3>
              <button onClick={() => setSearchModalOpen(false)} className="text-gray-500">✕</button>
            </div>
            
            <div className="p-4">
              {searching ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : searchResults ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      {searchResults.normalized_query || selectedItem}
                    </p>
                    {searchResults.cached && (
                      <span className="text-xs text-green-500">✓ Cached</span>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-500 mb-4">
                    {searchResults.note}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {searchResults.searches?.map((market) => (
                      <a
                        key={market.marketplace}
                        href={market.search_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl p-4 text-center transition-transform hover:scale-102"
                        style={{ backgroundColor: market.color + '15' }}
                      >
                        <span className="text-4xl mb-2 block">{market.icon}</span>
                        <p className="font-medium capitalize" style={{ color: market.color }}>
                          {market.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Cek harga</p>
                      </a>
                    ))}
                  </div>
                  
                  <div className="bg-amber-50 rounded-xl p-3 mt-4">
                    <p className="text-xs text-amber-800">
                      💡 Tips: Bandingkan harga di beberapa marketplace sebelum membeli untuk mendapatkan harga terbaik!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Gagal memuat hasil pencarian</p>
                  <button 
                    onClick={() => searchPrices(selectedItem)}
                    className="mt-2 text-blue-500"
                  >
                    Coba lagi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingTracker;
