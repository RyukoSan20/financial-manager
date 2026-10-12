/**
 * Interactive AI Assistant Component
 * Features:
 * - Floating button di pojok kiri
 * - Chat interface dengan AI
 * - Voice input (Web Speech API)
 * - Quick actions untuk input transaksi
 * - Real-time financial advice
 */
import { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, X, Send, Mic, MicOff, ChevronDown, ChevronUp,
  Sparkles, TrendingUp, TrendingDown, Wallet, Plus, AlertCircle,
  Loader2, Minimize2, Maximize2
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

const AIAssistant = ({ userData = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Halo! Saya AI Assistant Anda. Saya bisa membantu:\n\n• 📊 Analisis keuangan\n• 💰 Input transaksi\n• 📈 Saran investasi\n• 🎯 Goal tracking\n• ❓ Tanya apa saja\n\nKlik mic untuk voice input!'
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  
  // Quick actions
  const quickActions = [
    { icon: Plus, label: 'Input Pengeluaran', action: 'input_expense', color: 'text-red-500' },
    { icon: Plus, label: 'Input Pemasukan', action: 'input_income', color: 'text-green-500' },
    { icon: TrendingUp, label: 'Analisis Budget', action: 'analyze_budget', color: 'text-blue-500' },
    { icon: Wallet, label: 'Cek Tabungan', action: 'check_savings', color: 'text-purple-500' },
    { icon: Sparkles, label: 'Saran Investasi', action: 'investment_advice', color: 'text-yellow-500' },
    { icon: AlertCircle, label: 'Bantuan', action: 'help', color: 'text-gray-500' },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setMessage(transcript);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const sendMessage = async (text = null) => {
    const userMsg = text || message;
    if (!userMsg.trim()) return;

    setMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      // Try backend AI first
      const response = await api.ai.chat({ message: userMsg });
      const aiResponse = response.response || response;
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (err) {
      // Fallback to local AI response
      const localResponse = generateLocalResponse(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: localResponse }]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateLocalResponse = (msg) => {
    const lower = msg.toLowerCase();
    
    if (lower.includes('analisis') || lower.includes('budget')) {
      const balance = userData.totalBalance || 0;
      const income = userData.totalIncome || 0;
      const expense = userData.totalExpense || 0;
      const savings = income - expense;
      
      return `📊 **Analisis Keuangan Anda:**

• Saldo: ${formatCurrency(balance)}
• Total Income: ${formatCurrency(income)}
• Total Expense: ${formatCurrency(expense)}
• Net Savings: ${formatCurrency(savings)}

${savings > 0 ? '✅ Net savings positif! Pertahankan ini.' : '⚠️ Pengeluaran lebih besar dari income.'}

**Tips Budgeting:**
1. Gunakan aturan 50/30/20
2. Catat setiap pengeluaran
3. Sisihkan 20% untuk tabungan`;
    }
    
    if (lower.includes('investasi') || lower.includes('invest')) {
      return `📈 **Saran Investasi:**

Untuk pemula dengan tabungan ${formatCurrency(userData.totalBalance || 0)}:

1. **Emergency Fund** dulu (3-6 bulan expenses)
2. **Reksa Dana Index** - IHSG atau Nasdaq
3. **SBN (Surat Utang Negara)** - rendah risiko
4. **Deposito** - untuk dana mendesak

**Risk Profile:**
• Conservative: 70% obligasi, 30% saham
• Moderate: 50% saham, 50% obligasi
• Aggressive: 80% saham, 20% obligasi`;
    }
    
    if (lower.includes('tabung') || lower.includes('saving')) {
      return `💰 **Tips Menabung:**

1. **Pay Yourself First** - tabung sebelum belanja
2. **Otomatis** - standing instruction ke tabungan
3. **50/30/20 Rule**:
   - 50% Kebutuhan
   - 30% Keinginan  
   - 20% Tabungan

4. **Lawan Hedonic Adaptation**
5. **Emergency Fund** dulu!`;
    }
    
    if (lower.includes('input') || lower.includes('tambah') || lower.includes('transaksi')) {
      return `💵 **Input Transaksi:**

Untuk input transaksi baru:
1. Klik tombol **+** di dashboard
2. Pilih jenis (pengeluaran/pemasukan)
3. Isi jumlah, kategori, dan deskripsi
4. Submit

Atau gunakan:
• 📱 Receipt Scanner - scan struk
• 📝 Text Parser - paste SMS bank`;
    }
    
    return `💡 Saya bisa membantu Anda dengan:

• 📊 Analisis keuangan personal
• 💰 Tips menabung dan budgeting
• 📈 Saran investasi
• 🎯 Goal setting
• ❓ Pertanyaan umum

Silakan tanyakan!`;
  };

  const handleQuickAction = (action) => {
    setShowQuickActions(false);
    
    switch(action) {
      case 'analyze_budget':
        sendMessage('Analisis budget saya');
        break;
      case 'investment_advice':
        sendMessage('Berikan saran investasi');
        break;
      case 'check_savings':
        sendMessage('Cek tabungan saya');
        break;
      case 'help':
        sendMessage('Bantuan');
        break;
      default:
        sendMessage(`Saya mau ${action.replace('_', ' ')}`);
    }
  };

  if (!isOpen) {
    // Floating button
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 bottom-24 z-50 w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title="AI Assistant"
      >
        <Sparkles className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></span>
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
          {/* Quick Actions Toggle */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700"
            >
              <Plus className="w-4 h-4" />
              Quick Actions
              {showQuickActions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showQuickActions && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(action.action)}
                    className="flex items-center gap-2 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
                placeholder="Tanyakan AI..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm"
              />
              
              {/* Voice Button */}
              <button
                onClick={toggleListening}
                className={`p-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-100 dark:bg-gray-700'} hover:opacity-80`}
                title={isListening ? 'Stop recording' : 'Voice input'}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5 text-white" />
                ) : (
                  <Mic className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>
              
              {/* Send Button */}
              <button
                onClick={() => sendMessage()}
                disabled={!message.trim()}
                className="p-2 bg-purple-500 rounded-full hover:bg-purple-600 disabled:opacity-50"
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
