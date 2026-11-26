// Shopping Tracker v3 - AI Search + Wishlist + Budget Integration
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../services/api";
import { useTranslation } from "../i18n";
import PixelArtBusinessIcon from "../components/ui/PixelArtBusinessIcon";
import DraggableSparkleMascot from "../components/mascot/DraggableSparkleMascot";
import { ShoppingCart } from "lucide-react";
import { toast } from '../contexts/ToastContext';
import ProductSearch from '../components/shopping/ProductSearch';
import VisualProductCatalogGrid, {
  saveProductToWishlist,
} from '../components/shopping/VisualProductCatalogGrid';
import PartnerMerchantFeedSection from '../components/shopping/PartnerMerchantFeedSection';

const ShoppingTracker = () => {
  const { t, language } = useTranslation();
  const en = language === 'en';
  const [seeding, setSeeding] = useState(null);
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

  // The catalogue.
  //
  // The three rows of marketplace links this page used to show were
  // three websites and no products. A reader who wanted to buy a
  // kettle was told where a kettle might be found and had to go and
  // look.
  //
  // Now the tab shows the things themselves: a picture of each, what
  // it is, the price, and the shop the price came from. The search
  // the server already runs answers it.
  const [catalogAnswer, setCatalogAnswer] = useState(null);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  
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
    setCatalogSearching(true);
    setAiResults(null);
    setCatalogAnswer(null);

    try {
      // The catalogue the server already keeps. This is the search
      // that answers with the things themselves rather than with the
      // names of shops.
      const found = await api.request(
        `/shopping-search/search?q=${encodeURIComponent(aiQuery.trim())}&limit=24`
      );
      setCatalogAnswer(found);

      // The marketplace links are still asked for, so that a reader
      // who wants to go and look at a shop can still go and look.
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
      setCatalogSearching(false);
    }
  };

  /**
   * Keep a thing for later.
   *
   * The board already knows how to take an item, so the thing is
   * handed to the same call the catalogue grid uses. Where the price
   * came from travels with it, so a reference price is never later
   * shown as a price in a shop.
   */
  const saveCatalogProduct = async (product) => {
    setCatalogSaving(true);
    try {
      await saveProductToWishlist(product);
      toast.success(t('shopping_catalog.saved_to_wishlist'));
      loadData();
    } catch (e) {
      console.error('Saving to the board failed:', e);
      toast.error(t('shopping_catalog.save_failed'));
    } finally {
      setCatalogSaving(false);
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
  
  // One-tap starter packs for an empty tracker: real items, written
  // through the same endpoint the board uses, so the reader can try the
  // tracker without typing anything.
  const STARTER_PACKS = [
    {
      id: 'kos',
      icon: 'home',
      tint: '#FDE8E4',
      label: en ? 'Monthly boarding-house groceries' : 'Paket Belanja Bulanan Kos',
      items: [
        { name: en ? 'Rice 5 kg' : 'Beras 5 kg', price: 75000, quantity: 1 },
        { name: en ? 'Cooking oil 2 L' : 'Minyak goreng 2 L', price: 38000, quantity: 1 },
        { name: en ? 'Eggs 1 kg' : 'Telur 1 kg', price: 29000, quantity: 1 },
        { name: en ? 'Instant noodles (pack of 5)' : 'Mi instan (isi 5)', price: 15500, quantity: 2 },
        { name: en ? 'Laundry detergent' : 'Deterjen cuci', price: 22000, quantity: 1 },
      ],
    },
    {
      id: 'kopi',
      icon: 'coffee',
      tint: '#FFF6D6',
      label: en ? 'Thrifty coffee & breakfast stock' : 'Stok Kopi & Sarapan Hemat',
      items: [
        { name: en ? 'Ground coffee 250 g' : 'Kopi bubuk 250 g', price: 32000, quantity: 1 },
        { name: en ? 'Oats 800 g' : 'Oat 800 g', price: 45000, quantity: 1 },
        { name: en ? 'UHT milk 1 L' : 'Susu UHT 1 L', price: 19000, quantity: 2 },
        { name: en ? 'Bread (loaf)' : 'Roti tawar', price: 16000, quantity: 2 },
      ],
    },
    {
      id: 'hadiah',
      icon: 'money_bag_rp',
      tint: '#E3F2EA',
      label: en ? 'Gift & emergency fund' : 'Dana Hadiah & Darurat',
      items: [
        { name: en ? 'Birthday gift for a friend' : 'Kado ulang tahun teman', price: 150000, quantity: 1 },
        { name: en ? 'First-aid kit' : 'Kotak P3K', price: 85000, quantity: 1 },
        { name: en ? 'Power bank' : 'Power bank', price: 199000, quantity: 1 },
      ],
    },
  ];

  const seedPack = async (pack) => {
    setSeeding(pack.id);
    try {
      for (const item of pack.items) {
        await api.request("/shopping/items", {
          method: "POST",
          body: JSON.stringify({ ...item, stage: "to_buy", notes: pack.label }),
        });
      }
      toast.success(en ? `${pack.items.length} items added` : `${pack.items.length} barang ditambahkan`);
      await loadData();
    } catch (e) {
      toast.error(e?.message || (en ? "Could not add the pack" : "Gagal menambahkan paket"));
    } finally {
      setSeeding(null);
    }
  };

  const TAB_ICONS = { tracked: 'clipboard', wishlist: 'coin', find: 'calculator', ai: 'chat_question' };
  const tabLabel = (raw) => String(raw || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

  return (
    <div className="kakeibo-dot-canvas min-h-screen pb-24" data-testid="shopping-studio">
      {/* The header: a stationery banner, with Koneko and Kogane as the
          reader's shopping advisors, instead of a flat green bar. */}
      <div className="px-4 pt-4">
        <header
          className="relative flex flex-col items-center gap-4 overflow-visible rounded-[24px] border-2 border-[#4A3540] bg-gradient-to-r from-[#FFF6F4] via-[#FFFDF9] to-[#E6F3EC] p-5 shadow-[0_6px_0_#E2D6C3] sm:flex-row"
          data-testid="shopping-header-banner"
        >
          <span aria-hidden="true" className="absolute -top-2.5 left-6 h-4 w-20 -rotate-2 rounded-sm bg-[#F7C8D8]/90" />
          <span aria-hidden="true" className="absolute right-4 top-3 text-[#E07A5F]">✦</span>
          <div className="flex shrink-0 items-end">
            <DraggableSparkleMascot persona="koneko" size={96} mood="happy" hint={en ? '✨ Drag me!' : '✋ Geser aku!'} label="Koneko" />
            <DraggableSparkleMascot persona="kogane" size={86} mood="thinking" hint={en ? '✨ Drag me!' : '✋ Geser aku!'} label="Kogane" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#B5654A]">
              {en ? 'Personal shopping advisors' : 'Penasihat Belanja Pribadi'}
            </p>
            <h1 className="flex items-center justify-center gap-2 text-2xl font-extrabold text-[#2C221E] sm:justify-start">
              <PixelArtBusinessIcon name="money_bag_rp" size={34} />
              {t('nav.shopping')}
            </h1>
            <p className="mt-1 text-[12.5px] text-[#5C6460]">
              {en
                ? 'Koneko keeps the list, Kogane checks the price is fair. Track it, wish for it, then buy it wisely.'
                : 'Koneko mencatat daftarnya, Kogane menimbang harganya. Catat, simpan di wishlist, lalu beli dengan bijak.'}
            </p>
          </div>
        </header>
      </div>

      {/* Budget Card - PRIORITY FIRST! */}
      <div className="m-4 rounded-[24px] border-2 border-[#4A3540] bg-[#FFFDF9] p-4 shadow-[0_6px_0_#E2D6C3]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600 font-medium">{t('shopping_tracker.monthly_budget')}</span>
          <span className="font-bold text-lg text-primary-600">{formatCurrency(budget)}</span>
        </div>
        
        <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
          <div 
            className={`h-3 rounded-full transition-[width] duration-500 ${
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
            {fetchingBudget ? "..." : <PixelArtBusinessIcon name="ewallet" size={20} badge={false} />}
          </button>
        </div>
      </div>
      
      {/* Tabs: tactile pills with drawn icons, no emoji. */}
      <div className="mb-4 flex flex-wrap gap-2 px-4" role="tablist" data-testid="shopping-tabs">
        {[
          { id: "tracked", label: t('shopping_tracker.tab_tracked'), count: items.length },
          { id: "wishlist", label: t('shopping_tracker.tab_wishlist'), count: wishlist.length },
          { id: "find", label: t('shopping_tracker.tab_find'), count: null },
          { id: "ai", label: t('shopping_tracker.tab_ai'), count: null }
        ].map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`shopping-tab-${tab.id}`}
            className={`flex items-center gap-2 rounded-full border-2 border-[#4A3540] px-4 py-2 text-sm font-bold shadow-[0_3px_0_#4A3540] transition-transform active:translate-y-0.5 ${
              activeTab === tab.id
                ? "bg-[#2F4842] text-[#FFFDF9]"
                : "bg-[#FFFDF9] text-[#2C221E] hover:-translate-y-0.5"
            }`}
          >
            <PixelArtBusinessIcon name={TAB_ICONS[tab.id]} size={20} badge={false} />
            {tabLabel(tab.label)}
            {tab.count !== null && (
              <span className={`rounded-full border border-[#4A3540]/40 px-2 py-0.5 text-xs ${
                activeTab === tab.id ? "bg-[#FFF6D6] text-[#2C221E]" : "bg-[#FDE8E4]"
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
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#E2D6C3] border-t-[#2F4842]" />
              <p>{t('common.loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <div
              className="rounded-[24px] border-2 border-[#4A3540] bg-[#FFFDF9] p-6 text-center shadow-[0_6px_0_#E2D6C3]"
              data-testid="shopping-empty-templates"
            >
              <div className="flex justify-center">
                <PixelArtBusinessIcon name="money_bag_rp" size={56} />
              </div>
              <p className="mt-3 font-extrabold text-[#2C221E]">{t('shopping_tracker.empty_tracked')}</p>
              <p className="mt-1 text-sm text-[#6B5E57]">{t('shopping_tracker.empty_tracked_desc')}</p>
              <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#B5654A]">
                {en ? 'Start in one tap' : 'Mulai dengan 1 ketukan'}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {STARTER_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    disabled={seeding !== null}
                    onClick={() => seedPack(pack)}
                    data-testid={`shopping-template-${pack.id}`}
                    className="flex flex-col items-center gap-2 rounded-2xl border-2 border-[#4A3540] p-4 text-sm font-bold text-[#2C221E] shadow-[0_4px_0_#4A3540] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
                    style={{ background: pack.tint }}
                  >
                    <PixelArtBusinessIcon name={pack.icon} size={36} />
                    {pack.label}
                    <span className="text-[11px] font-semibold text-[#6B5E57]">
                      {seeding === pack.id
                        ? (en ? 'Adding…' : 'Menambahkan…')
                        : `${pack.items.length} ${en ? 'items' : 'barang'} · ${formatCurrency(pack.items.reduce((sum, i) => sum + i.price * i.quantity, 0))}`}
                    </span>
                  </button>
                ))}
              </div>
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
              <div className="mb-4 flex justify-center"><PixelArtBusinessIcon name="coin" size={52} /></div>
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
      
      {/* Tab: Find a thing */}
      {activeTab === "find" && (
        <div className="px-4">
          <ProductSearch onAddToBoard={loadData} />
        </div>
      )}

      {/* Tab: AI Search */}
      {activeTab === "ai" && (
        <div className="px-4 pt-4 mt-2">
          <div className="shape-card rounded-xl p-4 border border-primary-100">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold"><PixelArtBusinessIcon name="chat_question" size={26} />{t('shopping_tracker.ai_price_search')}</h3>
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
                {aiSearching ? "…" : <PixelArtBusinessIcon name="chat_question" size={20} badge={false} />}
              </button>
            </div>
          </div>
          
          {/* The catalogue.

              The three rows of marketplace links this page used to
              show were three websites and no products. A reader who
              wanted to buy a kettle was told where a kettle might be
              found, and had to go and look.

              Now it is the things themselves: a picture of each, what
              it is, the price, and the shop the price came from. */}
          {catalogSearching && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
              <ShoppingCart className="w-4 h-4 animate-pulse" aria-hidden="true" />
              {t('shopping_catalog.searching')}
            </div>
          )}

          {catalogAnswer && !catalogSearching && (
            <div className="mt-4 space-y-4">
              <VisualProductCatalogGrid
                products={catalogAnswer.results || []}
                source={catalogAnswer.source || 'provider'}
                onSave={saveCatalogProduct}
                saving={catalogSaving}
              />

              {/* The reader's own shops, in the same grid, so a reader
                  who runs a shop sees their own goods among the
                  things they are thinking of buying. */}
              <PartnerMerchantFeedSection onSaved={() => loadData()} />
            </div>
          )}

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
                      <strong>&quot;{aiResults.query}&quot;</strong> - {t('shopping_tracker.marketplace_count').replace("%s", aiResults.marketplaces?.length ?? 0)}
                      {aiResults.cached && <span className="ml-2 text-xs bg-yellow-100 px-2 py-0.5 rounded">{t('shopping_tracker.cache')}</span>}
                    </p>
                  </div>

                  {/* The shops themselves. This is the way out to the
                      shop, for a reader who wants to see the thing
                      for themselves before they buy it. The prices are
                      above.

                      These were five rows that each took up the whole
                      width of the page, which pushed everything below
                      them out of sight and made a page of links look
                      like a page of results. They are now a row of
                      small chips that a reader can click and be gone. */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t('shopping_catalog.shop_links')}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {aiResults.marketplaces?.map((mp, idx) => {
                      const style = getMarketplaceStyle(mp.marketplace);
                      return (
                        <a
                          key={idx}
                          href={mp.search_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t('shopping_tracker.click_to_search').replace("%s", mp.name)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${style.bg} ${style.text} ${style.border} hover:opacity-80`}
                        >
                          <span aria-hidden="true">{null}
                            <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                          {mp.name}
                        </a>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                    <PixelArtBusinessIcon name="lightbulb" size={16} badge={false} className="mr-1 inline-block align-[-3px]" />{aiResults.note || t('shopping_tracker.price_note')}
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
