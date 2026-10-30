// Smart Add Transaction Page - Quick, intuitive, professional
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api, API_BASE_URL as API_URL, getToken } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { parseQuickEntry, fetchDirection } from "../../features/transactions/nlp/parseQuickEntry.js";
import { fetchBootstrap, recordTokens, extractTokens } from "../../features/transactions/nlp/api.js";
import { useTranslation } from "../../i18n";
import { IconText } from "../ui/IconText";
import { buildFlag } from "../../utils/featureFlags";
import { batch1, fill } from "../../i18n/keys_batch1";
import { categoryName } from '../../utils/categoryName';
import {
  sanitizeAmount,
  formatAmountInput,
  parseAmount,
  addAmount,
  amountStyle,
} from '../../utils/amountInput';
import {
  isExpression,
  evaluateExpression,
  resolveAmountText,
  sanitizeExpression,
} from '../../utils/amountExpression';
import { readAmountField, isBrokenExpression } from '../../utils/amountField';
import { formatNative, currencyConfig } from '../../utils/currency';

// Category keyword mapping with word boundaries.
//
// These live outside the component on purpose. A list written inside a
// component is a new list on every render, and anything that depends
// on it is then rebuilt every time, which makes the page fetch and
// work again for no reason.
const CATEGORY_KEYWORDS = [
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

// The amounts the reader can reach with one tap.
const QUICK_AMOUNTS = [5000, 10000, 15000, 25000, 50000, 100000, 200000, 500000, 1000000];

const AddTransactionPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { language } = useTranslation();
  // With the polish switch off, the page keeps the drawings it has.
  const polished = buildFlag('UI_POLISH');
  const K = batch1[language]?.addTx || batch1.id.addTx;
  // The currency the amount is written in. This is the currency of the
  // account the money goes into, because a transaction is in the
  // currency of its account. The display currency is a reading choice
  // and does not change the money itself.
  const [accountCurrency, setAccountCurrency] = useState('IDR');
  // The symbol on the amount field is the symbol of the currency the
  // amount is written in, which is the currency of the account the
  // money goes into. The display currency is a reading choice, and
  // putting its symbol on a dollar amount would say the wrong thing.
  //
  // This reads the state above, so it has to come after it: reading a
  // `const` before it is declared throws, and the page goes blank.
  const amountSymbol = (currencyConfig(accountCurrency) || {}).symbol || 'Rp';
  
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
  // What the expression in the field comes to. It is worked out while
  // the reader is still typing, so they can see that the field
  // understood them without having to save first.
  const amountPreview = useMemo(
    () => readAmountField(amount, { currency: accountCurrency }),
    [amount, accountCurrency]
  );
  const amountIsBroken = useMemo(
    () => isBrokenExpression(amount),
    [amount]
  );
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
  // Which end of a transfer is being picked: the source or the
  // destination. Both used to open the same sheet, which meant the two
  // ends could not be told apart and picking one could overwrite the
  // other.
  const [accountSheetSide, setAccountSheetSide] = useState('source');
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  
  // Location state
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  
  const amountInputRef = useRef(null);

  // Quick amount presets
  const quickAmounts = QUICK_AMOUNTS;
  
  // NLP State
  const [quickEntry, setQuickEntry] = useState("");
  const [nlpPreview, setNlpPreview] = useState(null);
  
  // Idempotency key - prevents duplicate transactions from double-tap
  const [transactionRequestId, setTransactionRequestId] = useState(() => crypto.randomUUID());
  
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
    
    for (const { pattern, category } of CATEGORY_KEYWORDS) {
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
  //
  // The amount is written the way its own currency writes it, and the
  // reader's currency is the currency of the account the money goes
  // into. The helpers live in `utils/amountInput.js`, because the
  // rules about decimals and grouping are the same wherever money is
  // typed.
  //
  // An expression is written as it was typed, without the grouping:
  // "25000+15000" grouped would read "25.000+15.000", which is
  // harder to read, not easier. The grouping comes back when the
  // expression is finished and becomes one number.
  const formatNumber = (num) => {
    if (!num) return "";
    if (isExpression(num)) return String(num);
    return formatAmountInput(String(num), accountCurrency);
  };

  // Parse formatted number
  const parseNumber = (formatted) => {
    // An expression is worked out first. A text that cannot be read
    // is read as zero, which is the same as an empty field.
    const resolved = resolveAmountText(formatted);
    const value = evaluateExpression(resolved);
    if (value !== null) return value;
    return parseAmount(resolved, accountCurrency);
  };

  // Handle amount input
  //
  // The field takes an expression, so the operators have to survive
  // being typed. Everything else does not.
  const handleAmountChange = (e) => {
    const typed = e.target.value;
    // The field shows the amount with its grouping marks, so the
    // text that comes back has the marks in it. They are taken off
    // before the expression is read, and which mark is which depends
    // on the currency: a rupiah amount is grouped with a dot and has
    // no cents, and a dollar amount is grouped with a comma and has
    // two decimals.
    const style = amountStyle(accountCurrency);
    const bare = typed.split(style.group).join('').split(style.decimal).join('.');
    const cleaned = sanitizeExpression(bare);

    // A plain amount keeps the old rule: the currency decides how
    // many decimals there are.
    if (!isExpression(cleaned)) {
      setAmount(sanitizeAmount(cleaned, accountCurrency));
      return;
    }

    setAmount(cleaned);
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
  //
  // The chip adds to what is already there, so pressing it twice is
  // twice that amount. When the field holds an expression that
  // cannot be worked out yet - "25000+" - the chip is not added to
  // it, because there is no number to add to. The reader's own text
  // is left alone rather than being thrown away.
  const addPreset = (preset) => {
    const current = resolveAmountText(amount);
    // A plain amount is read as itself. An expression is worked out.
    // A text that is neither - "25000+" - has no number in it yet.
    const working = isExpression(current)
      ? evaluateExpression(current)
      : parseAmount(current, accountCurrency);
    if (working === null) {
      // The field is mid-expression. The chip is ignored rather than
      // replacing what the reader is typing.
      amountInputRef.current?.focus();
      return;
    }
    setAmount(addAmount(String(working), preset, accountCurrency));
    amountInputRef.current?.focus();
  };

  // Get selected category
  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedAccount = accounts.find(a => a.id === accountId);
  const selectedToAccount = accounts.find(a => a.id === toAccountId);

  // The amount is written in the currency of the account it is going
  // into, so the currency follows the account. A reader with a dollar
  // account and a rupiah account sees the amount written the way each
  // of those currencies writes it.
  useEffect(() => {
    const next = (selectedAccount?.currency || 'IDR').toUpperCase();
    if (next !== accountCurrency) {
      setAccountCurrency(next);
    }
  }, [selectedAccount?.currency, accountCurrency]);

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
    // A transfer needs both ends. Without the destination, the money
    // would leave the source account and never arrive anywhere, and
    // the source would be debited for good. The whole transfer has to
    // be checked before any of it is sent.
    if (type === "transfer" && !toAccountId) {
      alert(K.pickTargetAccountAlert);
      return;
    }
    if (type === "transfer" && toAccountId === accountId) {
      alert(K.sameAccountAlert);
      return;
    }

    setSaving(true);
    try {
      // Create transaction
      if (type === "transfer") {
        // The server does the whole transfer in one go, so the money
        // cannot be left half moved. The two transactions it writes are
        // linked to each other and to the transfer itself, and the
        // server rolls the whole thing back if any part of it fails.
        //
        // Writing the two halves here as two separate transactions was
        // wrong in three ways: the two halves were not linked, so
        // nothing could tell them apart later; the destination was
        // credited the same number as the source was debited, even
        // when the two accounts hold different currencies; and if the
        // second half failed, the first was already saved, so the money
        // had left the source account and arrived nowhere.
        await api.transfers.create({
          amount: finalAmount,
          currency: accountCurrency,
          date,
          description: description || fill(K.transferToDesc, { name: selectedToAccount?.name || K.transferOtherAccount }),
          from_account_id: accountId,
          to_account_id: toAccountId,
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

  // The transfer category is no longer needed here. The server writes
  // the two halves of a transfer itself, and it does not use a category
  // for them.

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
            <IconText name="repeat" emoji="🔄" on={polished}>{K.retry}</IconText>
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
            <IconText name="zap" emoji="⚡" on={polished} className="w-5 h-5" />
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
            <span className="text-2xl">{amountSymbol}</span>
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

          {/* The hint under the field says what the field will accept,
              so the reader knows that "+" is allowed before they
              wonder whether it is. It is only shown when the field is
              empty, because once there is a number in it, the hint is
              in the way. */}
          {!amount && (
            <p className="text-xs text-gray-400 mb-3">
              {K.amountExpressionHint}
            </p>
          )}

          {/* What the expression comes to. The reader writes a sum and
              cannot see the sum, so the field says what it worked out,
              while they are still typing it. */}
          {amountPreview.isSum && amountPreview.value !== null && (
            <p className="text-xs text-primary-600 dark:text-primary-400 mb-3 amount-preview">
              {amountPreview.text} = {formatNative(amountPreview.value, accountCurrency)}
            </p>
          )}

          {/* An expression that cannot be worked out says so, because
              otherwise the reader presses save and nothing happens. */}
          {amountIsBroken && (
            <p className="text-xs text-danger-600 dark:text-danger-400 mb-3 amount-preview-error">
              {K.amountExpressionError}
            </p>
          )}

          {/* Quick Amounts. The chip class is what gives them the
              spring press: the chip goes down a little under the
              finger and comes straight back. */}
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => addPreset(preset)}
                className="amount-chip bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 text-sm font-medium"
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
          onClick={() => {
            setAccountSheetSide('source');
            setShowAccountSheet(true);
          }}
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-sm text-gray-500">{K.account}</p>
            <p className="font-medium">{selectedAccount?.name || K.pickAccount}</p>
            {selectedAccount?.balance && (
              <p className="text-xs text-gray-400">
                {fill(K.balance, { amount: formatNative(selectedAccount.balance, selectedAccount.currency) })}
              </p>
            )}
          </div>
          <span className="text-gray-400">›</span>
        </button>

        {/* Transfer: To Account */}
        {type === "transfer" && (
          <button
            onClick={() => {
              setAccountSheetSide('destination');
              setShowAccountSheet(true);
            }}
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
            <IconText name="calendar" emoji="📅" on={polished}>{K.pick}</IconText>
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
                {type === "transfer" && accountSheetSide === 'destination'
                  ? K.pickTargetAccount
                  : type === "transfer"
                    ? K.pickSourceAccount
                    : K.pickAccountTitle}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {accounts.map((acc) => {
                // The two ends of a transfer cannot be the same
                // account, so the other end is not offered.
                const isDisabled = type === "transfer" && (
                  accountSheetSide === 'destination'
                    ? acc.id === accountId
                    : acc.id === toAccountId
                );
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      if (type === "transfer") {
                        if (accountSheetSide === 'destination') {
                          setToAccountId(acc.id);
                        } else {
                          setAccountId(acc.id);
                        }
                      } else {
                        setAccountId(acc.id);
                      }
                      setShowAccountSheet(false);
                    }}
                    disabled={isDisabled}
                    className={`w-full p-4 rounded-xl flex items-center justify-between ${
                      isDisabled ? "opacity-50" : ""
                    } ${
                      type === "transfer"
                        ? (accountSheetSide === 'destination'
                            ? toAccountId === acc.id
                            : accountId === acc.id)
                        : accountId === acc.id
                        ? "bg-primary-50 border-2 border-primary-500" 
                        : "bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-sm text-gray-500">
                        {fill(K.balance, { amount: formatNative(acc.balance || 0, acc.currency) })}
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
                          // The server needs to know who is asking: the
                          // endpoint reads the paid geocoding key, so it
                          // is not open to anyone.
                          const token = getToken();
                          const res = await fetch(
                            `${API_URL}/location/reverse-geocode?lat=${latitude}&lng=${longitude}`,
                            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
                          );
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
                <IconText name="location" emoji="📍" on={polished}>{K.useCurrentLocation}</IconText>
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
                  <IconText name="trash" emoji="🗑️" on={polished}>{K.removeLocation}</IconText>
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
