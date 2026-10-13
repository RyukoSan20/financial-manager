/**
 * Interactive AI Assistant Component
 * Features:
 * - Floating button di pojok kiri
 * - Chat interface dengan AI
 * - Voice input (Web Speech API) - multi-language
 * - Quick actions untuk input transaksi
 * - Real-time financial advice
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageSquare, X, Send, Mic, MicOff, ChevronDown, ChevronUp,
  Sparkles, TrendingUp, TrendingDown, Wallet, Plus, AlertCircle,
  Loader2, Minimize2, Maximize2, Globe, Volume2
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

// Language configurations
const LANGUAGES = {
  id: { code: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  en: { code: 'en-US', name: 'English', flag: '🇺🇸' },
  ja: { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  zh: { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  ms: { code: 'ms-MY', name: 'Bahasa Melayu', flag: '🇲🇾' },
};

// Translations
const t = {
  id: {
    welcome: 'Halo! Saya AI Assistant Anda. Saya bisa membantu:\n\n• 📊 Analisis keuangan\n• 💰 Input transaksi\n• 📈 Saran investasi\n• 🎯 Goal tracking\n• ❓ Tanya apa saja\n\nKlik mic untuk voice input!',
    placeholder: 'Tanyakan AI...',
    quickActions: 'Quick Actions',
    listening: 'Mendengarkan...',
    voiceError: 'Voice tidak tersedia di browser ini',
    analyzing: 'Menganalisis...',
    balance: 'Saldo',
    income: 'Total Pemasukan',
    expense: 'Total Pengeluaran',
    netSavings: 'Net Savings',
    positive: '✅ Net savings positif! Pertahankan ini.',
    negative: '⚠️ Pengeluaran lebih besar dari income.',
    actions: {
      input_expense: 'Input Pengeluaran',
      input_income: 'Input Pemasukan',
      analyze_budget: 'Analisis Budget',
      check_savings: 'Cek Tabungan',
      investment_advice: 'Saran Investasi',
      help: 'Bantuan'
    }
  },
  en: {
    welcome: 'Hello! I\'m your AI Assistant. I can help:\n\n• 📊 Financial analysis\n• 💰 Transaction input\n• 📈 Investment advice\n• 🎯 Goal tracking\n• ❓ Ask anything\n\nClick mic for voice input!',
    placeholder: 'Ask AI...',
    quickActions: 'Quick Actions',
    listening: 'Listening...',
    voiceError: 'Voice not available in this browser',
    analyzing: 'Analyzing...',
    balance: 'Balance',
    income: 'Total Income',
    expense: 'Total Expense',
    netSavings: 'Net Savings',
    positive: '✅ Positive net savings! Keep it up.',
    negative: '⚠️ Expenses exceed income.',
    actions: {
      input_expense: 'Input Expense',
      input_income: 'Input Income',
      analyze_budget: 'Budget Analysis',
      check_savings: 'Check Savings',
      investment_advice: 'Investment Advice',
      help: 'Help'
    }
  },
  ja: {
    welcome: 'こんにちは！AIアシスタントです。以下のことができます：\n\n• 📊 財務分析\n• 💰 取引入力\n• 📈 投資提案\n• 🎯 目標追跡\n• ❓ なんでも質問\n\nマイクをクリックして音声入力！',
    placeholder: 'AIに質問...',
    quickActions: 'クイックアクション',
    listening: '聞いています...',
    voiceError: 'このブラウザでは音声は利用できません',
    analyzing: '分析中...',
    balance: '残高',
    income: '総収入',
    expense: '総支出',
    netSavings: '純貯蓄',
    positive: '✅ 純貯蓄がプラスです！この調子で。',
    negative: '⚠️ 支出が収入を超えています。',
    actions: {
      input_expense: '支出を入力',
      input_income: '収入を入力',
      analyze_budget: '予算分析',
      check_savings: '貯蓄確認',
      investment_advice: '投資提案',
      help: 'ヘルプ'
    }
  },
  zh: {
    welcome: '你好！我是您的AI助手。我可以帮您：\n\n• 📊 财务分析\n• 💰 输入交易\n• 📈 投资建议\n• 🎯 目标追踪\n• ❓ 随意提问\n\n点击麦克风进行语音输入！',
    placeholder: '询问AI...',
    quickActions: '快捷操作',
    listening: '正在聆听...',
    voiceError: '此浏览器不支持语音功能',
    analyzing: '分析中...',
    balance: '余额',
    income: '总收入',
    expense: '总支出',
    netSavings: '净储蓄',
    positive: '✅ 净储蓄为正！继续保持。',
    negative: '⚠️ 支出超过收入。',
    actions: {
      input_expense: '输入支出',
      input_income: '输入收入',
      analyze_budget: '预算分析',
      check_savings: '查看储蓄',
      investment_advice: '投资建议',
      help: '帮助'
    }
  },
  ms: {
    welcome: 'Helo! Saya AI Assistant anda. Saya boleh bantu:\n\n• 📊 Analisis kewangan\n• 💰 Input transaksi\n• 📈 Nasihat pelaburan\n• 🎯 Jejak matlamat\n• ❓ Tanya apa-apa\n\nKlik mic untuk input suara!',
    placeholder: 'Tanya AI...',
    quickActions: 'Tindakan Pantas',
    listening: 'Mendengar...',
    voiceError: 'Suara tidak tersedia di pelayar ini',
    analyzing: 'Menganalisis...',
    balance: 'Baki',
    income: 'Jumlah Pendapatan',
    expense: 'Jumlah Perbelanjaan',
    netSavings: 'Simpanan Bersih',
    positive: '✅ Simpanan bersih positif! Teruskan.',
    negative: '⚠️ Perbelanjaan melebihi pendapatan.',
    actions: {
      input_expense: 'Input Perbelanjaan',
      input_income: 'Input Pendapatan',
      analyze_budget: 'Analisis Bajet',
      check_savings: 'Semak Simpanan',
      investment_advice: 'Nasihat Pelaburan',
      help: 'Bantuan'
    }
  }
};

const AIAssistant = ({ userData = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [language, setLanguage] = useState('id');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  
  // Initialize messages with welcome in current language
  useEffect(() => {
    setMessages([{ role: 'assistant', content: t[language].welcome }]);
  }, []);

  // Change language
  const changeLanguage = (lang) => {
    setLanguage(lang);
    setShowLanguagePicker(false);
    setMessages([{ role: 'assistant', content: t[lang].welcome }]);
  };

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setVoiceSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = LANGUAGES[language]?.code || 'id-ID';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setMessage(transcript);
        
        // Auto-send if final result
        if (event.results[0].isFinal) {
          sendMessage(transcript);
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [language]);

  // Update recognition language when language changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANGUAGES[language]?.code || 'id-ID';
    }
  }, [language]);

  const toggleListening = () => {
    if (!voiceSupported) {
      alert(t[language].voiceError);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setIsListening(false);
      }
    }
  };

  const sendMessage = async (text = null) => {
    const userMsg = text || message;
    if (!userMsg.trim()) return;

    setMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      // Try backend AI first with full user data context
      const response = await api.ai.chat({ 
        message: userMsg, 
        language,
        userData: {
          balance: userData.totalBalance || 0,
          income: userData.totalIncome || 0,
          expense: userData.totalExpense || 0,
          currency: 'IDR'
        }
      });
      
      if (response && response.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
      } else if (response && typeof response === 'string') {
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.error('AI chat error:', err);
      // Fallback to local AI response
      const localResponse = generateLocalResponse(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: localResponse }]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateLocalResponse = (msg) => {
    const lang = language;
    const lower = msg.toLowerCase();
    const balance = userData.totalBalance || 0;
    const income = userData.totalIncome || 0;
    const expense = userData.totalExpense || 0;
    const savings = income - expense;
    const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(1) : 0;
    
    // Report Investasi
    if (lower.includes('report') && (lower.includes('investasi') || lower.includes('invest'))) {
      return `📊 **LAPORAN INVESTASI ANDA**

**Kondisi Keuangan:**
• Saldo: ${formatCurrency(balance)}
• Total Income: ${formatCurrency(income)}
• Total Expense: ${formatCurrency(expense)}
• Net Savings: ${formatCurrency(savings)} (${savingsRate}%)

**Analisis:**
${savings > 0 ? '✅ Kondisi baik - Anda surplus!' : '⚠️ Perlu perbaikan - Anda defisit'}

**Portofolio Rekomendasi:**
1. **Emergency Fund**: ${formatCurrency(expense * 3)} (3 bulan expenses)
2. **Reksa Dana Index**: IHSG + Nasdaq
3. **SBN**: Surat Utang Negara
4. **Deposito**: Untuk dana tidak terpakai

**Langkah Selanjutnya:**
1. Bangun emergency fund dulu
2. Diversifikasi investasi
3. Review budget bulanan

Mau saya bantu analisis lebih detail?`;
    }
    
    // Analisis Budget
    if (lower.includes('analisis') || lower.includes('budget') || lower.includes('分析') || lower.includes('analyze')) {
      const expenseRatio = income > 0 ? ((expense / income) * 100).toFixed(1) : 0;
      return `📈 **ANALISIS BUDGET**

**Ringkasan:**
• Saldo: ${formatCurrency(balance)}
• Income: ${formatCurrency(income)}
• Expense: ${formatCurrency(expense)}
• Net: ${formatCurrency(savings)} (${savingsRate}%)
• Expense Ratio: ${expenseRatio}%

**Status Budget:**
${expenseRatio > 100 ? '⚠️ Warning! Pengeluaran > Income' : '✅ Expense ratio sehat'}

**Rekomendasi:**
1. Target expense < 80% income
2. Sisihkan ${formatCurrency(income * 0.2)}/bulan untuk tabungan
3. Catat setiap transaksi

Mau tips budgeting lebih detail?`;
    }
    
    // Saran Investasi
    if (lower.includes('investasi') || lower.includes('invest') || lower.includes('投資') || lower.includes('投资')) {
      return `📈 **SARAN INVESTASI**

**Profile Anda:**
• Dana tersedia: ${formatCurrency(balance)}
• Risk tolerance: ${savings > 0 ? 'Moderate' : 'Conservative'}

**Alokasi Rekomendasi:**

**Dana Darurat (30%):**
• Deposito: ${formatCurrency(balance * 0.3)}
• Likuid & aman

**Investasi Jangka Menengah (40%):**
• Reksa Dana Pasar Uang: ${formatCurrency(balance * 0.2)}
• Reksa Dana Obligasi: ${formatCurrency(balance * 0.2)}

**Investasi Jangka Panjang (30%):**
• Reksa Dana Saham: ${formatCurrency(balance * 0.15)}
• Emas: ${formatCurrency(balance * 0.15)}

**Tips:**
1. Mulai dari kecil, rutin
2. Diversifikasi
3. Jangan panic sell

Mau saya hitung return ekspektasi?`;
    }
    
    // Cek Tabungan
    if (lower.includes('tabung') || lower.includes('saving') || lower.includes('貯蓄') || lower.includes('储蓄')) {
      const monthlyTarget = income * 0.2;
      const monthsToEmergency = expense * 6;
      return `💰 **CEK TABUNGAN**

**Kondisi Saat Ini:**
• Saldo: ${formatCurrency(balance)}
• Tabungan/bulan: ${formatCurrency(monthlyTarget)}
• Target Emergency Fund: ${formatCurrency(monthsToEmergency)}

**Progress Emergency Fund:**
${balance >= monthsToEmergency ? '✅ Target tercapai!' : `${((balance / monthsToEmergency) * 100).toFixed(1)}% - Masih ${formatCurrency(monthsToEmergency - balance)} lagi`}

**Tips Menabung:**
1. Pay yourself first - tabung dulu sebelum belanja
2. Otomatis - setup auto-debit ke rekening tabungan
3. 50/30/20 Rule:
   - 50% Kebutuhan
   - 30% Keinginan
   - 20% Tabungan/Investasi

Mau saya bantu buat rencana tabungan?`;
    }
    
    // Input Transaksi
    if (lower.includes('input') || lower.includes('tambah') || lower.includes('transaksi') || lower.includes('入力') || lower.includes('输入')) {
      return `💵 **INPUT TRANSAKSI**

Untuk input transaksi baru:
1. Click tombol **+** di dashboard
2. Pilih jenis (💸 Pengeluaran / 💰 Pemasukan)
3. Isi jumlah, kategori, deskripsi
4. Submit

**Quick Input:**
• 📱 **Receipt Scanner** - scan struk belanja
• 📝 **Text Parser** - paste SMS bank/ewallet
• ⌨️ **Manual** - ketik langsung

Mau saya bantu setup recurring transaction?`;
    }
    
    // Default help
    return `💡 **HELLO! AI ASSISTANT**

Saya bisa bantu Anda dengan:

📊 **Analisis Keuangan**
• Budget analysis
• Cash flow report
• Expense tracking

💰 **Investasi**
• Portfolio recommendations
• Risk assessment
• Investment strategies

🎯 **Goals**
• Savings plan
• Target calculator
• Progress tracking

❓ **Pertanyaan Umum**
• Tips finance
• Calculator
• General advice

Silakan tanya dalam bahasa Indonesia, English, 日本語, atau 中文!`;
  };

  const handleQuickAction = (action) => {
    setShowQuickActions(false);
    
    switch(action) {
      case 'analyze_budget':
        sendMessage(language === 'id' ? 'Analisis budget saya' : language === 'ja' ? '予算を分析' : 'Analyze my budget');
        break;
      case 'investment_advice':
        sendMessage(language === 'id' ? 'Berikan saran investasi' : language === 'ja' ? '投資提案' : 'Give investment advice');
        break;
      case 'check_savings':
        sendMessage(language === 'id' ? 'Cek tabungan saya' : language === 'ja' ? '貯蓄を確認' : 'Check my savings');
        break;
      default:
        sendMessage(t[language].actions[action]);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) {
    // Floating button
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 bottom-24 z-50 w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title="AI Assistant"
      >
        <Sparkles className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
      </button>
    );
  }

  return (
    <div className={`fixed left-4 bottom-24 z-50 w-96 max-h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="font-semibold text-white">AI Assistant</span>
          <span className="text-white/80 text-xs">{LANGUAGES[language].flag}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4 text-white" /> : <Minimize2 className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Language Picker & Quick Actions */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            {/* Language Picker */}
            <div className="relative">
              <button
                onClick={() => setShowLanguagePicker(!showLanguagePicker)}
                className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700"
              >
                <Globe className="w-4 h-4" />
                {LANGUAGES[language].name}
              </button>
              
              {showLanguagePicker && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                  {Object.entries(LANGUAGES).map(([code, lang]) => (
                    <button
                      key={code}
                      onClick={() => changeLanguage(code)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 ${language === code ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Quick Actions Toggle */}
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700"
            >
              <Plus className="w-4 h-4" />
              {t[language].quickActions}
              {showQuickActions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Quick Actions Grid */}
          {showQuickActions && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 grid grid-cols-2 gap-2">
              {Object.entries(t[language].actions).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleQuickAction(key)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-purple-500 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {isListening && (
              <div className="flex justify-start">
                <div className="bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-2xl rounded-bl-md flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '150ms'}} />
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '300ms'}} />
                  </div>
                  <span className="text-sm text-red-600 dark:text-red-400">{t[language].listening}</span>
                </div>
              </div>
            )}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={t[language].placeholder}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm"
                disabled={isListening}
              />
              
              {/* Voice Button */}
              <button
                onClick={toggleListening}
                className={`p-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-100 dark:bg-gray-700'} hover:opacity-80 transition-colors`}
                title={voiceSupported ? (isListening ? t[language].listening : 'Voice input') : t[language].voiceError}
                disabled={!voiceSupported}
              >
                {isListening ? (
                  <Volume2 className="w-5 h-5 text-white" />
                ) : (
                  <Mic className={`w-5 h-5 ${voiceSupported ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`} />
                )}
              </button>
              
              {/* Send Button */}
              <button
                onClick={() => sendMessage()}
                disabled={!message.trim() || isTyping}
                className="p-2 bg-purple-500 rounded-full hover:bg-purple-600 disabled:opacity-50 transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
