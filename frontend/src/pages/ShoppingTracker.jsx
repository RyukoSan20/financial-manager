// Shopping Tracker v3 - AI Search + Wishlist + Budget Integration
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../services/api";
import { useTranslation } from "../i18n";

const ShoppingTracker = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tracked");
  
  // Budget state - PRORITY!
  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem("shopping_budget");
    return saved ? parseFloat(saved) : 0;
  });
  const [budgetInput, setBudgetInput] = useState(budget.toString());
  const [fetchingBudget, setFetchingBudget] = useState(false);
  
  // AI Search state
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState(null);
  const [aiSearching, setAiSearching] = useState(false);
  
  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsData, wishlistData] = await Promise.all([
        api.request("/shopping/items").catch(() => []),
        api.request("/shopping/wishlist").catch(() => [])
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
  
  // Fetch budget from account
  const fetchBudgetFromAccount = async () => {
    setFetchingBudget(true);
    try {
      const accounts = await api.request("/accounts/");
      if (Array.isArray(accounts) && accounts.length > 0) {
        // Use first account's balance as budget
        const accBalance = accounts[0].balance || 0;
        setBudget(accBalance);
        setBudgetInput(accBalance.toString());
        localStorage.setItem("shopping_budget", accBalance.toString());
      }
    } catch (e) {
      console.error("Fetch budget error:", e);
    } finally {
      setFetchingBudget(false);
    }
  };
  
  // Calculate totals
  const stats = useMemo(() => {
    const totalSpent = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const budgetRemaining = budget - totalSpent;
    const percentUsed = budget > 0 ? Math.min((totalSpent / budget * 100), 100) : 0;
    return { totalSpent, budgetRemaining, percentUsed };
  }, [items, budget]);
  
  // Save budget
  const saveBudget = (value) => {
    const num = parseFloat(value) || 0;
    setBudget(num);
    localStorage.setItem("shopping_budget", num.toString());
  };
  
  // AI Price Search
  const searchWithAI = async () => {
    if (!aiQuery.trim()) return;
    setAiSearching(true);
    setAiResults(null);
    
    try {
      const results = await api.request(`/search/price?q=${encodeURIComponent(aiQuery)}&country=ID`);
      if (results && results.searches) {
        setAiResults({
          query: aiQuery,
          marketplaces: results.searches,
          cached: results.cached,
          timestamp: results.timestamp,
          currency: results.currency_symbol || 'Rp'
        });
      }
    } catch (e) {
      console.error("AI search error:", e);
      setAiResults({ error: t("shopping_tracker.search_error") });
    } finally {
      setAiSearching(false);
    }
  };
  
  // Add to Wishlist
  const addToWishlist = async (marketplace) => {
    try {
      const wishlistItem = {
        name: aiQuery,
        target_price: 0,
        marketplace: marketplace.marketplace,
        search_url: marketplace.search_url,
        priority: "medium"
      };
      
      const result = await api.request("/shopping/wishlist", {
        method: "POST",
        body: JSON.stringify(wishlistItem)
      });
      
      if (result) {
        // Refresh wishlist
        const newWishlist = await api.request("/shopping/wishlist");
        if (Array.isArray(newWishlist)) setWishlist(newWishlist);
        
        // Show success
        alert(t("shopping_tracker.added_to_wishlist").replace("%s", marketplace.name));
      }
    } catch (e) {
      console.error("Add to wishlist error:", e);
      alert(t("shopping_tracker.add_failed"));
    }
  };
  
  // Remove from Wishlist
  const removeFromWishlist = async (id) => {
    try {
      await api.request(`/shopping/wishlist/${id}`, { method: "DELETE" });
      setWishlist(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      console.error("Remove error:", e);
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
  const getMarketplaceStyle = (name) => {
    const styles = {
      shopee: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
      tokopedia: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
      lazada: { bg: "bg-primary-50", text: "text-primary-600", border: "border-primary-200" },
      blibli: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
      tiktok: { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" }
    };
    return styles[name?.toLowerCase()] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
  };
  
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-primary-600 text-white p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-xl font-bold">🛒 {t('nav.shopping')}</h1>
      </div>
      
      {/* Budget Card - PRIORITY FIRST! */}
      <div className="p-4 bg-white m-4 rounded-xl shadow-sm border border-primary-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600 font-medium">{t('shopping_tracker.monthly_budget')}</span>
          <span className="font-bold text-lg text-primary-600">{formatCurrency(budget)}</span>
        </div>
        
        <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${
              stats.percentUsed > 90 ? "bg-red-500" : 
              stats.percentUsed > 70 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${stats.percentUsed}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm mb-3">
          <span className="text-gray-500">{t('shopping_tracker.spent_label').replace("%s", formatCurrency(stats.totalSpent))}</span>
          <span className={stats.budgetRemaining < 0 ? "text-red-500 font-medium" : "text-green-500 font-medium"}>
            {(stats.budgetRemaining >= 0 ? t('shopping_tracker.remaining_label') : t('shopping_tracker.over_label')).replace("%s", formatCurrency(Math.abs(stats.budgetRemaining)))}
          </span>
        </div>
        
        <div className="flex gap-2">
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder={t('shopping_tracker.set_budget')}
            className="flex-1 p-2 border rounded-lg text-sm"
          />
          <button
            onClick={() => saveBudget(budgetInput)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium"
          >
            {t('shopping_tracker.set')}
          </button>
          <button
            onClick={fetchBudgetFromAccount}
            disabled={fetchingBudget}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm"
            title={t('shopping_tracker.from_account')}
          >
            {fetchingBudget ? "..." : "📥"}
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-4">
        {[
          { id: "tracked", label: t('shopping_tracker.tab_tracked'), count: items.length },
          { id: "wishlist", label: t('shopping_tracker.tab_wishlist'), count: wishlist.length },
          { id: "ai", label: t('shopping_tracker.tab_ai'), count: null }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
              activeTab === tab.id 
                ? "bg-primary-600 text-white shadow-md" 
                : "bg-white text-gray-600"
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? "bg-primary-600" : "bg-gray-200"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab: Tracked Items */}
      {activeTab === "tracked" && (
        <div className="px-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p>{t('common.loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-4">🛒</p>
              <p>{t('shopping_tracker.empty_tracked')}</p>
              <p className="text-sm mt-2">{t('shopping_tracker.empty_tracked_desc')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => {
                const style = getMarketplaceStyle(item.marketplace);
                return (
                  <div key={item.id} className={`bg-white rounded-lg p-4 border ${style.border}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantity}x {formatCurrency(item.price || 0)}
                        </p>
                        {item.marketplace && (
                          <span className={`text-xs px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                            {item.marketplace}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency((item.price || 0) * (item.quantity || 1))}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Tab: Wishlist */}
      {activeTab === "wishlist" && (
        <div className="px-4">
          {wishlist.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-4">❤️</p>
              <p>{t('shopping_tracker.empty_wishlist')}</p>
              <p className="text-sm mt-2">{t('shopping_tracker.empty_wishlist_desc')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wishlist.map(item => {
                const style = getMarketplaceStyle(item.marketplace);
                return (
                  <div key={item.id} className={`bg-white rounded-lg p-4 border ${style.border}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {t('shopping_tracker.target_label').replace("%s", formatCurrency(item.target_price || 0))}
                        </p>
                        {item.marketplace && (
                          <span className={`text-xs px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                            {item.marketplace}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {item.search_url && (
                          <a
                            href={item.search_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-primary-600 text-white rounded text-sm"
                          >
                            {t('shopping_tracker.check')}
                          </a>
                        )}
                        <button
                          onClick={() => removeFromWishlist(item.id)}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Tab: AI Search */}
      {activeTab === "ai" && (
        <div className="px-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-primary-100">
            <h3 className="font-bold text-lg mb-2">🔍 {t('shopping_tracker.ai_price_search')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('shopping_tracker.ai_price_search_desc')}
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder={t('shopping_tracker.search_placeholder')}
                className="flex-1 p-3 border rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && searchWithAI()}
              />
              <button
                onClick={searchWithAI}
                disabled={aiSearching || !aiQuery.trim()}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 shadow-md"
              >
                {aiSearching ? "⏳" : "🔍"}
              </button>
            </div>
          </div>
          
          {/* AI Results */}
          {aiResults && (
            <div className="mt-4">
              {aiResults.error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
                  {aiResults.error}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-600">
                      <strong>"{aiResults.query}"</strong> - {t('shopping_tracker.marketplace_count').replace("%s", aiResults.marketplaces?.length ?? 0)}
                      {aiResults.cached && <span className="ml-2 text-xs bg-yellow-100 px-2 py-0.5 rounded">{t('shopping_tracker.cache')}</span>}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {aiResults.marketplaces?.map((mp, idx) => {
                      const style = getMarketplaceStyle(mp.marketplace);
                      return (
                        <div 
                          key={idx}
                          className={`bg-white rounded-xl p-4 shadow-sm border ${style.border}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">{mp.icon || "🛒"}</span>
                              <div>
                                <p className={`font-bold text-lg ${style.text}`}>{mp.name}</p>
                                <p className="text-xs text-gray-500">{t('shopping_tracker.click_to_search').replace("%s", mp.name)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={mp.search_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium"
                              >
                                {t('shopping_tracker.open')}
                              </a>
                              <button
                                onClick={() => addToWishlist(mp)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
                              >
                                {t('shopping_tracker.add_wishlist')}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                    💡 {aiResults.note || t('shopping_tracker.price_note')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Quick Add Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <p className="text-xs text-gray-400 text-center mb-2">
            {t('shopping_tracker.summary_bar')
              .replace('%s', formatCurrency(budget))
              .replace('%s', formatCurrency(stats.totalSpent))
              .replace('%s', formatCurrency(stats.budgetRemaining))}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShoppingTracker;
