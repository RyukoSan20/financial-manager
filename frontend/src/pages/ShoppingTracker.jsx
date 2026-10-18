// Shopping Tracker Page - Item-level shopping tracking
import { useState, useEffect } from "react";
import { api } from "../services/api";

const ShoppingTracker = () => {
  const [items, setItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("items");
  const [priceHistoryItem, setPriceHistoryItem] = useState("");
  const [priceHistory, setPriceHistory] = useState(null);

  useEffect(() => {
    loadItems();
    loadWishlist();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await api.shopping.items();
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadWishlist = async () => {
    try {
      const data = await api.shopping.wishlist();
      setWishlist(data.items || []);
    } catch (error) {
      console.error("Failed to load wishlist:", error);
    }
  };

  const checkPriceHistory = async () => {
    if (!priceHistoryItem) return;
    try {
      const data = await api.shopping.priceHistory(priceHistoryItem);
      setPriceHistory(data);
    } catch (error) {
      console.error("Failed to check price:", error);
    }
  };

  const addToWishlist = async () => {
    if (!priceHistoryItem) return;
    try {
      await api.shopping.addWishlist({
        item_name: priceHistoryItem,
        target_price: 0,
        priority: 2,
      });
      loadWishlist();
    } catch (error) {
      console.error("Failed to add wishlist:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Shopping Tracker</h1>
        <p className="opacity-90">Lacak harga dan kelola wishlist belanjaan</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-gray-500 text-sm">Item Dilacak</p>
          <p className="text-2xl font-bold">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-gray-500 text-sm">Wishlist</p>
          <p className="text-2xl font-bold">{wishlist.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-gray-500 text-sm">Transaksi</p>
          <p className="text-2xl font-bold">-</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-gray-500 text-sm">Rata-rata</p>
          <p className="text-2xl font-bold">-</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("items")}
            className={`px-6 py-3 font-medium ${activeTab === "items" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
          >
            Item Terakhir
          </button>
          <button
            onClick={() => setActiveTab("wishlist")}
            className={`px-6 py-3 font-medium ${activeTab === "wishlist" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
          >
            Wishlist ({wishlist.length})
          </button>
          <button
            onClick={() => setActiveTab("price")}
            className={`px-6 py-3 font-medium ${activeTab === "price" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
          >
            Cek Harga
          </button>
        </div>

        <div className="p-6">
          {activeTab === "items" && (
            <div>
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">🛒</p>
                  <p>Belum ada item. Upload struk untuk mulai melacak.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantity} x Rp {(item.unit_price || 0).toLocaleString()}
                        </p>
                      </div>
                      <p className="font-semibold">Rp {(item.total_price || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "wishlist" && (
            <div>
              {wishlist.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">❤️</p>
                  <p>Wishlist kosong. Cek harga untuk menambahkan.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wishlist.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-pink-50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-gray-500">
                          Target: Rp {(item.target_price || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">Rp {(item.current_price || 0).toLocaleString()}</p>
                        <p className={`text-xs ${parseFloat(item.current_price) <= parseFloat(item.target_price) ? "text-green-600" : "text-red-600"}`}>
                          {parseFloat(item.current_price) <= parseFloat(item.target_price) ? "✓ Sudah sesuai" : "Above target"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "price" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={priceHistoryItem}
                  onChange={(e) => setPriceHistoryItem(e.target.value)}
                  placeholder="Nama item (contoh: Beras 5kg)"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === "Enter" && checkPriceHistory()}
                />
                <button
                  onClick={checkPriceHistory}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Cek
                </button>
                <button
                  onClick={addToWishlist}
                  className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                >
                  + Wishlist
                </button>
              </div>

              {priceHistory && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">{priceHistory.item_name}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Harga Saat Ini</p>
                      <p className="text-xl font-bold">Rp {priceHistory.current_price?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Rata-rata</p>
                      <p className="text-xl font-bold">Rp {priceHistory.average?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tertinggi</p>
                      <p className="text-xl font-bold text-red-600">Rp {priceHistory.highest?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Terendah</p>
                      <p className="text-xl font-bold text-green-600">Rp {priceHistory.lowest?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                  {priceHistory.trend && (
                    <p className="mt-3 text-sm">
                      Tren: <span className={priceHistory.trend === "decreasing" ? "text-green-600" : "text-red-600"}>
                        {priceHistory.trend === "decreasing" ? "↓ Harga turun" : priceHistory.trend === "increasing" ? "↑ Harga naik" : "→ Stabil"}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingTracker;
