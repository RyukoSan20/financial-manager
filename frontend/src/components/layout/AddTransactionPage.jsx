// Smart Add Transaction Page - Quick, intuitive, professional
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, API_BASE_URL as API_URL, getToken } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { parseQuickEntry, fetchDirection } from "../../features/transactions/nlp/parseQuickEntry.js";
import { fetchBootstrap, recordTokens, extractTokens } from "../../features/transactions/nlp/api.js";
import { useTranslation } from "../../i18n";
import { batch1, fill } from "../../i18n/keys_batch1";
import { categoryName } from '../../utils/categoryName';

const AddTransactionPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { language, getCurrencyConfig } = useTranslation();
  const K = batch1[language]?.addTx || batch1.id.addTx;
  // The currency is a choice of its own, so the symbol is read from the
  // store rather than written into the page.
  const currencySymbol = getCurrencyConfig().symbol;
  
  // Helper: Get date in WIB timezone (YYYY-MM-DD) - defined first
  const getWIBDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
  };
  
  // Transaction type
  const [type, setType] = useState("expense"); // expense, income, transfer
  
  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [date, setDate] = useState(getWIBDate());
  
  // Transfer specific
  const [toAccountId, setToAccountId] = useState(null);
  const [transferFee, setTransferFee] = useState("");
  
  // Data
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [recentCombos, setRecentCombos] = useState([]);
  const [loadError, setLoadError] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  
  // Location state
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  
  const amountInputRef = useRef(null);
  
  // Category keyword mapping with word boundaries
  const categoryKeywords = [
    { pattern: /\b(makan|food|cafe|coff|ristor|kopi|teh|makan|ayam|burger|pizza|sushi|nasgor|nasi)\b/i, category: "Makanan & Minuman" },
    { pattern: /\b(grab|gojek|taxi|bensin|parkir|tol|ojek|bis|kereta|mrt|trans|transport|ride|hely)\b/i, category: "Transportasi" },
    { pattern: /\b(indomaret|alfamart|carrefour|minimarket|toko|belanja|market)\b/i, category: "Belanja" },
    { pattern: /\b(pulsa|data|internet|wifi|telkom|axis|three|im3|telkomsel)\b/i, category: "Pulsa & Data" },
    { pattern: /\b(listrik|pln|pdam|bill|token|air\s*(?:listrik|pdam|token))\b/i, category: "Tagihan" },
    { pattern: /\b(gym|fitness|olahraga|renang|yoga|workout)\b/i, category: "Kesehatan" },
    { pattern: /\b(film|netflix|spotify|disney|gaming|steam|playstation|hiburan|music|spotify)\b/i, category: "Hiburan" },
    { pattern: /\b(obat|apotek|dokter|rumah\s*sakit|klinik|vaksin|health)\b/i, category: "Kesehatan" },
    { pattern: /\b(baju|pakaian|clothes|zara|uniqlo|fashion|pakaian)\b/i, category: "Fashion" },
    { pattern: /\b(shopee|lazada|blibli|tokopedia)\b/i, category: "Fashion" },
    { pattern: /\b(kado|hadi|gift|ulang\s*tahun)\b/i, category: "Hadiah" },
    { pattern: /\b(kos|sewa|rumah|apart|kontrakan|rent)\b/i, category: "Tempat Tinggal" },
    { pattern: /\b(gaji|slip|gaji|thr|bouns|bonus|pendapatan)\b/i, category: "Pendapatan" },
  ];
  
  // Quick amount presets
  const quickAmounts = [5000, 10000, 15000, 25000, 50000, 100000, 200000, 500000, 1000000];
  
  // NLP State
  const [quickEntry, setQuickEntry] = useState("");
  const [nlpPreview, setNlpPreview] = useState(null);
  
  // Idempotency key - prevents duplicate transactions from double-tap
  const [transactionRequestId] = useState(() => crypto.randomUUID());
  
  // Date shortcuts
  const dateShortcuts = [
    { label: K.today, getValue: () => getWIBDate() },
    { label: K.yesterday, getValue: () => getWIBDate(-1) },
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    loadData();
    amountInputRef.current?.focus();
  }, [isAuthenticated, navigate]);

  const loadData = async () => {
    try {
      setLoadError(null);
      
      // Try bootstrap first (categories + hints + recent combos)
      // Uses api.js for consistent token handling
      let bootstrapFailed = false;
      try {
        const bootstrapData = await api.get('/category-hints/bootstrap');
        
        if (bootstrapData?.categories) {
          setCategories(bootstrapData.categories || []);
          setRecentCombos((bootstrapData.recent_combos || []).slice(0, 4));
          if (bootstrapData.hints) {
            localStorage.setItem('categoryHints', JSON.stringify(bootstrapData.hints));
          }
        } else {
          bootstrapFailed = true;
        }
      } catch (e) {
        console.log('Bootstrap failed, using legacy load:', e.message);
        bootstrapFailed = true;
      }
      
      if (bootstrapFailed) {
        // Legacy load - independent from NLP
        const catRes = await api.get('/categories/');
        if (catRes?.length > 0) {
          setCategories(catRes);
        }
        const accRes = await api.get('/accounts/');
        if (accRes?.length > 0) {
          setAccounts(accRes);
          if (accRes[0]?.id) setAccountId(accRes[0].id);
        }
        const combos = JSON.parse(localStorage.getItem("recentCombos") || "[]");
        setRecentCombos(combos.slice(0, 4));
      } else {
        // Bootstrap succeeded but may not include accounts — load them separately
        const accRes = await api.get('/accounts/');
        if (accRes?.length > 0) {
          setAccounts(accRes);
          if (accRes[0]?.id && !accountId) setAccountId(accRes[0].id);
        }
      }
      
      // Smart default: last used category
      const lastCatId = localStorage.getItem("lastCategoryId");
      if (lastCatId) setCategoryId(parseInt(lastCatId));
      
    } catch (err) {
      console.error("Load error:", err);
      setLoadError(err.message || K.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  // Auto-suggest category from description
  useEffect(() => {
    if (!description || categories.length === 0) return;
    
    for (const { pattern, category } of categoryKeywords) {
      if (pattern.test(description)) {
        const matched = categories.find(c => c.name === category);
        if (matched && !categoryId) {
          setCategoryId(matched.id);
          break;
        }
      }
    }
  }, [description, categories]);

  // NLP Quick Entry parsing
  useEffect(() => {
    if (!quickEntry.trim() || categories.length === 0) {
      setNlpPreview(null);
      return;
    }
    
    const parsed = parseQuickEntry(quickEntry, {
      categories,
      userHints: {}, // TODO: Load from localStorage
      accounts
    });
    
    setNlpPreview(parsed);
    
    // Auto-fill high confidence results
    if (parsed.categoryConfidence === 'high' && !categoryId) {
      setCategoryId(parsed.categoryId);
    }
    if (parsed.amount && !amount) {
      setAmount(String(parsed.amount));
    }
    if (parsed.type && parsed.type !== type) {
      setType(parsed.type);
    }

    // Which way does the money go? The backend decides, so this box and
    // the voice parser and the AI agent always agree. The local answer
    // above is only a stand-in until the answer comes back.
    classifyDirection(quickEntry, parsed);
  }, [quickEntry, categories, accounts]);

  // Ask the backend which way the money goes, and apply the answer.
  //
  // The request is tagged so that a slow answer for an earlier phrase
  // cannot overwrite the answer for the phrase the user is looking at
  // now.
  const directionRequestId = useRef(0);

  const classifyDirection = useCallback(async (text) => {
    const requestId = ++directionRequestId.current;

    const answer = await fetchDirection(text);
    if (!answer) {
      // The device is offline. The local answer stands.
      return;
    }
    if (requestId !== directionRequestId.current) {
      // The user has typed something else since this was asked for.
      return;
    }

    const wanted = answer.direction === 'transfer' ? 'transfer' : answer.direction;

    setNlpPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        type: wanted,
        directionSource: answer.source,
        directionConfidence: answer.confidence,
        directionReasons: answer.reasons,
      };
    });

    setType(wanted);
  }, []);

  // When the user picks the type themselves, that is a correction.
  // The backend remembers it, so the same wording is classified the
  // same way next time.
  const recordTypeCorrection = useCallback(async (chosen) => {
    const text = (quickEntry || "").trim();
    if (!text) return;

    const previous = nlpPreview?.type;
    if (previous && previous === chosen) return;

    try {
      await api.direction.feedback(text, chosen);
    } catch (err) {
      // The correction is a nicety. Failing to record it must not
      // stop the user from saving the transaction.
    }
  }, [quickEntry, nlpPreview]);

  // Format number with dots
  const formatNumber = (num) => {
    if (!num) return "";
    return parseInt(num.toString().replace(/\D/g, "")).toLocaleString("id-ID");
  };

  // Parse formatted number
  const parseNumber = (formatted) => {
    return parseInt(formatted.replace(/\./g, "") || "0");
  };

  // Handle amount input
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setAmount(raw);
  };

  // Apply recent combo
  const applyCombo = (combo) => {
    setAmount(combo.amount.toString());
    setCategoryId(combo.category_id);
    setAccountId(combo.account_id);
    setDescription(combo.description || "");
    
    // Update category if needed
    if (combo.category_id) {
      const cat = categories.find(c => c.id === combo.category_id);
      if (cat) setCategoryId(cat.id);
    }
  };

  // Quick add preset amount
  const addPreset = (preset) => {
    const current = parseNumber(amount);
    setAmount((current + preset).toString());
    amountInputRef.current?.focus();
  };

  // Get selected category
  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedAccount = accounts.find(a => a.id === accountId);
  const selectedToAccount = accounts.find(a => a.id === toAccountId);

  // Save transaction
  const handleSave = async (addAnother = false) => {
    const finalAmount = parseNumber(amount);
    if (!finalAmount || finalAmount <= 0) {
      alert(K.invalidAmount);
      return;
    }
    if (!accountId) {
      alert(K.pickAccountAlert);
      return;
    }
    if (type !== "transfer" && !categoryId) {
      alert(K.pickCategoryAlert);
      return;
    }

    setSaving(true);
    try {
      // Create transaction
      if (type === "transfer") {
        // Create expense from source account
        await api.transactions.create({
          type: "expense",
          amount: finalAmount,
          description: description || fill(K.transferToDesc, { name: selectedToAccount?.name || K.transferOtherAccount }),
          account_id: accountId,
          date,
          category_id: getTransferCategory(),
          client_request_id: `${transactionRequestId}-expense`,
        });
        
        // Create income to destination account
        await api.transactions.create({
          type: "income",
          amount: finalAmount,
          description: description || fill(K.transferFromDesc, { name: selectedAccount?.name || K.transferOtherAccount }),
          account_id: toAccountId,
          date,
          category_id: getTransferCategory(),
          client_request_id: `${transactionRequestId}-income`,
        });
        
        // Create fee as expense if any
        if (parseNumber(transferFee) > 0) {
          await api.transactions.create({
            type: "expense",
            amount: parseNumber(transferFee),
            description: K.transferFeeDesc,
            account_id: accountId,
            date,
            category_id: getFeeCategory(),
            client_request_id: `${transactionRequestId}-fee`,
          });
        }
      } else {
        await api.transactions.create({
          type,
          amount: finalAmount,
          description,
          account_id: accountId,
          category_id: categoryId,
          date,
          client_request_id: transactionRequestId,
        });
        
        // Save as recent combo
        const combos = JSON.parse(localStorage.getItem("recentCombos") || "[]");
        const newCombo = {
          category_id: categoryId,
          account_id: accountId,
          amount: finalAmount,
          description: type === "expense" ? description : "",
        };
        const filtered = combos.filter(c => 
          c.category_id !== categoryId || c.account_id !== accountId
        );
        localStorage.setItem("recentCombos", JSON.stringify([newCombo, ...filtered].slice(0, 10)));
        localStorage.setItem("lastCategoryId", categoryId);
        
        // Record tokens for user learning
        if (description) {
          const tokens = extractTokens(description);
          if (tokens.length > 0) {
            recordTokens(tokens, categoryId).catch(() => {});
          }
        }
      }
      
      if (addAnother) {
        // Reset form but keep account
        setAmount("");
        setDescription("");
        setCategoryId(null);
        setDate(new Date().toISOString().split("T")[0]);
        // Generate new idempotency key for next transaction
        setTransactionRequestId(crypto.randomUUID());
        amountInputRef.current?.focus();
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.error("Save error:", err);
      alert(K.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const getTransferCategory = () => {
    // Find or create transfer category
    const transferCat = categories.find(c => 
      c.name.toLowerCase().includes("transfer")
    );
    return transferCat?.id || categories[0]?.id || 1;
  };

  const getFeeCategory = () => {
    const feeCat = categories.find(c => 
      c.name.toLowerCase().includes("biaya") || c.name.toLowerCase().includes("admin")
    );
    return feeCat?.id || categories[0]?.id || 1;
  };

  const getTypeColor = () => {
    if (type === "expense") return "bg-red-500";
    if (type === "income") return "bg-green-500";
    return "bg-primary-500";
  };

  const getCategoryIcon = (name) => {
    const icons = {
      "Makanan & Minuman": "🍔",
      "Transportasi": "🚗",
      "Belanja": "🛒",
      "Pulsa & Data": "📱",
      "Tagihan": "💡",
      "Kesehatan": "💊",
      "Hiburan": "🎬",
      "Fashion": "👕",
      "Pendapatan": "💰",
    };
    return icons[name] || "📋";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="font-semibold text-lg mb-2">{K.loadFailedTitle}</h2>
          <p className="text-gray-600 mb-4">{loadError}</p>
          <button
            onClick={loadData}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium"
          >
            🔄 {K.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-2">
            ✕
          </button>
          <h1 className="font-semibold">{K.addTransaction}</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Type Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {["expense", "income", "transfer"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                recordTypeCorrection(t);
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                type === t ? `${getTypeColor()} text-white` : "text-gray-600"
              }`}
            >
              {t === "expense" ? K.expenseTab : t === "income" ? K.incomeTab : K.transferTab}
            </button>
          ))}
        </div>

        {/* Quick Entry NLP Input */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-medium text-gray-600">{K.quickType}</span>
          </div>
          <input
            type="text"
            value={quickEntry}
            onChange={(e) => setQuickEntry(e.target.value)}
            placeholder={K.quickPlaceholder}
            className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none text-base"
          />
          {nlpPreview && nlpPreview.suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nlpPreview.suggestions.map((s, i) => (
                <span
                  key={i}
                  className={`px-3 py-1 rounded-full text-sm ${
                    s.confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' :
                    s.confidence === 'medium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {/* A category suggestion is named by the language of
                      the reader. The parser works out which category it
                      is; the wording is the reader's. */}
                  {s.type === 'category'
                    ? (categoryName(categories.find(c => c.id === s.value), language) || s.label)
                    : s.label}
                  {s.confidence && <span className="ml-1 text-xs opacity-60">({s.confidence})</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Recent Combos */}
        {recentCombos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">{K.recent}</p>
            <div className="flex flex-wrap gap-2">
              {recentCombos.map((combo, idx) => {
                const cat = categories.find(c => c.id === combo.category_id);
                return (
                  <button
                    key={idx}
                    onClick={() => applyCombo(combo)}
                    className="bg-white border rounded-full px-3 py-1.5 text-sm flex items-center gap-1 hover:bg-gray-50"
                  >
                    <span>{getCategoryIcon(cat?.name)}</span>
                    <span>{cat?.name || K.other}</span>
                    <span className="text-gray-400">·</span>
                    <span className="font-medium">{formatNumber(combo.amount)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{currencySymbol}</span>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="numeric"
              value={formatNumber(amount)}
              onChange={handleAmountChange}
              placeholder="0"
              className="text-4xl font-bold w-full bg-transparent outline-none"
            />
          </div>
          
          {/* Quick Amounts */}
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => addPreset(preset)}
                className="bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 text-sm font-medium"
              >
                +{formatNumber(preset)}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={K.descPlaceholder}
            className="w-full outline-none text-base"
          />
        </div>

        {/* Category Selector */}
        <button
          onClick={() => setShowCategorySheet(true)}
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getCategoryIcon(selectedCategory?.name)}</span>
            <div className="text-left">
              <p className="text-sm text-gray-500">{K.category}</p>
              <p className="font-medium">{selectedCategory?.name || K.pickCategory}</p>
            </div>
          </div>
          <span className="text-gray-400">›</span>
        </button>

        {/* Account Selector */}
        <button
          onClick={() => setShowAccountSheet(true)}
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-sm text-gray-500">{K.account}</p>
            <p className="font-medium">{selectedAccount?.name || K.pickAccount}</p>
            {selectedAccount?.balance && (
              <p className="text-xs text-gray-400">
                {fill(K.balance, { amount: `${currencySymbol} ${parseInt(selectedAccount.balance).toLocaleString("id-ID")}` })}
              </p>
            )}
          </div>
          <span className="text-gray-400">›</span>
        </button>

        {/* Transfer: To Account */}
        {type === "transfer" && (
          <button
            onClick={() => setShowAccountSheet(true)}
            className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-sm text-gray-500">{K.transferTo}</p>
              <p className="font-medium">{selectedToAccount?.name || K.pickTargetAccount}</p>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        )}

        {/* Date Selector */}
        <button
          onClick={() => setShowDateSheet(true)}
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-sm text-gray-500">{K.date}</p>
            <p className="font-medium">{new Date(date).toLocaleDateString(language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'id-ID', {
              weekday: "long", year: "numeric", month: "long", day: "numeric"
            })}</p>
          </div>
          <span className="text-gray-400">›</span>
        </button>

        {/* Quick Date Chips */}
        <div className="flex gap-2">
          {dateShortcuts.map((shortcut) => {
            const value = shortcut.getValue();
            return (
              <button
                key={shortcut.label}
                onClick={() => setDate(value)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  date === value 
                    ? "bg-primary-600 text-white" 
                    : "bg-white text-gray-600"
                }`}
              >
                {shortcut.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowDateSheet(true)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-600"
          >
            📅 {K.pick}
          </button>
        </div>

        {/* Location Selector */}
        <button
          onClick={() => setShowLocationSheet(true)}
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-sm text-gray-500">{K.location}</p>
            <p className={`font-medium ${location ? "text-gray-800" : "text-gray-400"}`}>
              {location || K.addLocation}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {locationCoords && <span className="text-green-500 text-sm">✓</span>}
            <span className="text-gray-400">›</span>
          </div>
        </button>
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 py-4 rounded-xl border-2 border-primary-500 text-primary-500 font-semibold disabled:opacity-50"
          >
            + {K.more}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className={`flex-1 py-4 rounded-xl text-white font-semibold disabled:opacity-50 ${getTypeColor()}`}
          >
            {saving ? K.saving : K.save}
          </button>
        </div>
      </div>

      {/* Category Bottom Sheet */}
      {/* Category Bottom Sheet */}
      {showCategorySheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCategorySheet(false)}></div>
          <div className="relative w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="shrink-0 p-4 border-b">
              <h2 className="font-semibold text-lg">{K.pickCategoryTitle}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {categories
                .filter(c => {
                  // Categories with no type are system-wide — show them
                  if (!c.type) return true;
                  // Filter by type match
                  if (type === 'expense') return c.type !== 'income';
                  if (type === 'income') return c.type !== 'expense';
                  return true;
                })
                .map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setCategoryId(cat.id); setShowCategorySheet(false); }}
                  className={`w-full p-4 rounded-xl flex items-center gap-3 ${
                    categoryId === cat.id ? "bg-primary-50 border-2 border-primary-500" : "bg-gray-50"
                  }`}
                >
                  <span className="text-2xl">{cat.icon || getCategoryIcon(cat.name)}</span>
                  <span className="font-medium">{categoryName(cat, language)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Account Bottom Sheet */}
      {/* Account Bottom Sheet */}
      {showAccountSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAccountSheet(false)}></div>
          <div className="relative w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="shrink-0 p-4 border-b">
              <h2 className="font-semibold text-lg">
                {type === "transfer" && !toAccountId ? K.pickSourceAccount : K.pickAccountTitle}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {accounts.map((acc) => {
                const isDisabled = type === "transfer" && toAccountId && acc.id === toAccountId;
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      if (type === "transfer") {
                        if (!toAccountId) setAccountId(acc.id);
                        else setToAccountId(acc.id);
                      } else {
                        setAccountId(acc.id);
                      }
                      setShowAccountSheet(false);
                    }}
                    disabled={isDisabled}
                    className={`w-full p-4 rounded-xl flex items-center justify-between ${
                      isDisabled ? "opacity-50" : ""
                    } ${
                      (type !== "transfer" && accountId === acc.id) || 
                      (type === "transfer" && (accountId === acc.id || toAccountId === acc.id))
                        ? "bg-primary-50 border-2 border-primary-500" 
                        : "bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-sm text-gray-500">
                        {fill(K.balance, { amount: `${currencySymbol} ${parseInt(acc.balance || 0).toLocaleString("id-ID")}` })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Date Bottom Sheet */}
      {/* Date Bottom Sheet */}
      {showDateSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDateSheet(false)}></div>
          <div className="relative w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="shrink-0 p-4 border-b">
              <h2 className="font-semibold text-lg">{K.pickDateTitle}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setShowDateSheet(false); }}
                className="w-full p-4 border rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Location Bottom Sheet */}
      {showLocationSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLocationSheet(false)}></div>
          <div className="relative w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="shrink-0 p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-lg">{K.location}</h2>
              <button onClick={() => setShowLocationSheet(false)} className="text-gray-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Current Location Button */}
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      async (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setLocationCoords({ lat: latitude, lng: longitude });
                        // Reverse geocode
                        try {
                          const res = await fetch(`${API_URL}/location/reverse-geocode?lat=${latitude}&lng=${longitude}`);
                          if (res.ok) {
                            const data = await res.json();
                            setLocation(data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                          } else {
                            setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                          }
                        } catch {
                          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                        }
                        setShowLocationSheet(false);
                      },
                      (err) => alert(fill(K.geolocationFailed, { message: err.message }))
                    );
                  } else {
                    alert(K.geolocationUnsupported);
                  }
                }}
                className="w-full py-4 bg-primary-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                📍 {K.useCurrentLocation}
              </button>

              {/* Manual Input */}
              <div>
                <label className="block text-sm text-gray-600 mb-2">{K.orTypePlace}</label>
                <input
                  type="text"
                  placeholder={K.placePlaceholder}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full p-4 border rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && location) {
                      setShowLocationSheet(false);
                    }
                  }}
                />
              </div>
              
              {/* Clear Location */}
              {location && (
                <button
                  onClick={() => { setLocation(""); setLocationCoords(null); setShowLocationSheet(false); }}
                  className="w-full py-3 text-red-500 border border-red-200 rounded-xl"
                >
                  🗑️ {K.removeLocation}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddTransactionPage;
