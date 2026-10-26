/**
 * Enhanced AI Financial Advisor
 * Features:
 * - Multi-turn conversation
 * - Financial health analysis
 * - Personalized recommendations
 * - Market insights integration
 * - Goal progress tracking
 */
import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatPercent } from '../utils/format';
import { useTranslation } from '../i18n';
import { batch3 } from '../i18n/keys_batch3';
import { 
  Send, Sparkles, RefreshCw, TrendingUp, TrendingDown, 
  Wallet, PiggyBank, Target, AlertTriangle, CheckCircle,
  MessageSquare, BarChart3, Zap, Lightbulb, ChevronDown, ChevronUp
} from 'lucide-react';

const AIAdvisor = () => {
  const { t , language } = useTranslation();
  const K = batch3[language]?.ai_advisor || {};
  const { isAuthenticated } = useAuth();
  const [advice, setAdvice] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("insights"); // insights, chat
  const [expandedAdvice, setExpandedAdvice] = useState(null);
  const messagesEndRef = useRef(null);

  // Pre-built prompts
  const quickPrompts = [
    { icon: "📊", label: t('ai_advisor.prompt_budget_label'), prompt: t('ai_advisor.prompt_budget') },
    { icon: "🎯", label: t('ai_advisor.prompt_goal_label'), prompt: t('ai_advisor.prompt_goal') },
    { icon: "💰", label: t('ai_advisor.prompt_saving_label'), prompt: t('ai_advisor.prompt_saving') },
    { icon: "📉", label: t('ai_advisor.prompt_expense_label'), prompt: t('ai_advisor.prompt_expense') },
    { icon: "📈", label: t('ai_advisor.prompt_invest_label'), prompt: t('ai_advisor.prompt_invest') },
    { icon: "🛡️", label: t('ai_advisor.prompt_emergency_label'), prompt: t('ai_advisor.prompt_emergency') },
  ];

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [adviceRes, summaryRes] = await Promise.all([
        api.ai.advice(),
        api.ai.summary()
      ]);
      setAdvice(Array.isArray(adviceRes) ? adviceRes : []);
      setSummary(summaryRes);
    } catch (err) {
      console.error("Error:", err);
      // Fallback to local analysis
      await fetchLocalSummary();
    } finally {
      setLoading(false);
    }
  };

  const fetchLocalSummary = async () => {
    try {
      const [dashRes, goalsRes, budgetsRes] = await Promise.all([
        api.request('/dashboard/summary').catch(() => ({})),
        api.goals.list().catch(() => []),
        api.budgets.list().catch(() => []),
      ]);
      
      setSummary({
        total_balance: dashRes?.total_balance || 0,
        total_income: dashRes?.totalIncome || 0,
        total_expense: dashRes?.totalExpense || 0,
        net_cash_flow: dashRes?.netSavings || 0,
        active_goals: goalsRes?.filter(g => !g.is_completed)?.length || 0,
        total_debt: 0,
        savings_rate: dashRes?.totalIncome > 0 
          ? ((dashRes.totalIncome - dashRes.totalExpense) / dashRes.totalIncome * 100) 
          : 0,
      });
    } catch (err) {
      console.error("Local summary error:", err);
    }
  };

  const sendMessage = async (prompt = null) => {
    const userMsg = prompt || message;
    if (!userMsg.trim() || sending) return;

    setMessage("");
    setSending(true);
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);

    try {
      // Try the agent first: it understands the intent, so a number becomes
      // a transaction and a budget instruction becomes a budget rule. When
      // the agent has nothing to do it answers with information anyway.
      let response = null;
      let agentActions = null;

      // The messages that came before. A follow up such as "kalau untuk
      // 2 tahun ke depan gimana?" only means something next to the
      // earlier question, so the conversation travels with it.
      const history = messages
        .filter(m => m.content)
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      try {
        const agent = await api.ai.agent(userMsg, false, history);
        if (agent && agent.success && agent.intent !== 'unknown') {
          response = { response: agent.reply || agent.message || '' };
          agentActions = agent.actions || null;
        }
      } catch (agentErr) {
        console.warn('Agent unavailable, falling back to chat:', agentErr);
      }

      if (!response) {
        response = await api.ai.chat({ 
          message: userMsg, 
          history,
          context: {
            summary: summary,
            advice: advice,
          }
        });
      }

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.response || response,
        actions: agentActions,
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: generateLocalResponse(userMsg),
        timestamp: new Date()
      }]);
    } finally {
      setSending(false);
    }
  };

  // Local AI response fallback
  const generateLocalResponse = (userMsg) => {
    const msg = userMsg.toLowerCase();
    
    if (msg.includes('budget') || msg.includes('analisis')) {
      return `${t('ai_advisor.local_budget_title')}\n\n${t('ai_advisor.local_based_on')}\n${t('ai_advisor.local_total_balance').replace('%value%', formatCurrency(summary?.total_balance || 0))}\n${t('ai_advisor.local_total_income').replace('%value%', formatCurrency(summary?.total_income || 0))}\n${t('ai_advisor.local_total_expense').replace('%value%', formatCurrency(summary?.total_expense || 0))}\n${t('ai_advisor.local_net_cash_flow').replace('%value%', formatCurrency(summary?.net_cash_flow || 0))}\n\n${summary?.savings_rate > 0 ? t('ai_advisor.local_savings_positive') : t('ai_advisor.local_savings_negative')}\n\n${t('ai_advisor.local_tips')}\n${t('ai_advisor.local_tip_record')}\n${t('ai_advisor.local_tip_save20')}\n${t('ai_advisor.local_tip_502030')}`;
    }
    
    if (msg.includes('goal') || msg.includes('target')) {
      const goals = summary?.active_goals || 0;
      return `${t('ai_advisor.local_goal_title')}\n\n${goals > 0 ? t('ai_advisor.local_goal_active').replace('%count%', goals) : t('ai_advisor.local_goal_none')}\n\n${t('ai_advisor.local_goal_tips')}\n${t('ai_advisor.local_goal_tip1')}\n${t('ai_advisor.local_goal_tip2')}\n${t('ai_advisor.local_goal_tip3')}\n${t('ai_advisor.local_goal_tip4')}`;
    }
    
    if (msg.includes('tabung') || msg.includes('saving')) {
      return `${t('ai_advisor.local_saving_title')}\n\n${t('ai_advisor.local_saving_tip1')}\n${t('ai_advisor.local_saving_tip2')}\n${t('ai_advisor.local_saving_tip3')}\n${t('ai_advisor.local_saving_rule1')}\n${t('ai_advisor.local_saving_rule2')}\n${t('ai_advisor.local_saving_rule3')}\n\n${t('ai_advisor.local_saving_tip4')}\n${t('ai_advisor.local_saving_tip5')}`;
    }
    
    if (msg.includes('invest') || msg.includes('investasi')) {
      return `${t('ai_advisor.local_invest_title')}\n\n${t('ai_advisor.local_invest_order')}\n${t('ai_advisor.local_invest_step1')}\n${t('ai_advisor.local_invest_step2')}\n${t('ai_advisor.local_invest_step3')}\n${t('ai_advisor.local_invest_step4')}\n\n${t('ai_advisor.local_risk_profile')}\n${t('ai_advisor.local_risk_conservative')}\n${t('ai_advisor.local_risk_moderate')}\n${t('ai_advisor.local_risk_aggressive')}\n\n${t('ai_advisor.local_disclaimer')}`;
    }
    
    return `${t('ai_advisor.local_greeting_title')}\n\n${t('ai_advisor.local_greeting_intro')}\n${t('ai_advisor.local_greeting_item1')}\n${t('ai_advisor.local_greeting_item2')}\n${t('ai_advisor.local_greeting_item3')}\n${t('ai_advisor.local_greeting_item4')}\n${t('ai_advisor.local_greeting_item5')}\n\n${t('ai_advisor.local_greeting_end')}`;
  };

  // The advice is named by a key, so it reads in the language of the
  // reader. The numbers that go into a sentence travel with it.
  const adviceTitle = (item) => {
    if (!item) return '';
    if (item.title_key) {
      const values = item.insight_values || {};
      return t(item.title_key, '', values);
    }
    return item.title || '';
  };

  const adviceInsight = (item) => {
    if (!item) return '';
    if (item.insight_key) {
      return t(item.insight_key, '', item.insight_values || {});
    }
    return item.insight || item.description || '';
  };

  const adviceActions = (item) => {
    if (!item) return [];
    // Each step is named by a key, so it reads in the language of the
    // reader.
    if (Array.isArray(item.action_item_keys) && item.action_item_keys.length) {
      return item.action_item_keys.map((k) => t(k)).filter(Boolean);
    }
    return item.action_items || [];
  };

  const getPriorityConfig = (priority) => {
    switch(priority) {
      case "high": return { color: "#ef4444", bg: "bg-red-50", border: "border-l-red-500" };
      case "medium": return { color: "#f59e0b", bg: "bg-yellow-50", border: "border-l-yellow-500" };
      default: return { color: "#22c55e", bg: "bg-green-50", border: "border-l-green-500" };
    }
  };

  const getCategoryIcon = (category) => {
    switch(category) {
      case "budget": return <BarChart3 className="w-5 h-5" />;
      case "savings": return <PiggyBank className="w-5 h-5" />;
      case "debt": return <TrendingDown className="w-5 h-5" />;
      case "investment": return <TrendingUp className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Sparkles className="w-12 h-12 mx-auto text-purple-500 animate-pulse" />
            <p className="mt-4 text-gray-500">{t('ai_advisor.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-primary-600 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8" />
          <h1 className="text-2xl font-bold">{K.page_title}</h1>
        </div>
        <p className="text-purple-100">{t('ai_advisor.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "insights"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          <Lightbulb className="w-4 h-4 inline mr-2" />
          {K.insights}
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "chat"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          {K.chat}
        </button>
      </div>

      {/* Insights Tab */}
      {activeTab === "insights" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-green-500">
              <p className="text-sm text-gray-500 mb-1">{t('ai_advisor.total_balance')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary?.total_balance || 0)}
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-primary-500">
              <p className="text-sm text-gray-500 mb-1">{t('ai_advisor.savings_rate')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatPercent(summary?.savings_rate || 0, 1)}
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
              <p className="text-sm text-gray-500 mb-1">{t('ai_advisor.active_goals')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {summary?.active_goals || 0}
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-red-500">
              <p className="text-sm text-gray-500 mb-1">{t('ai_advisor.total_debt')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary?.total_debt || 0)}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('ai_advisor.ask_ai')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveTab("chat");
                    sendMessage(prompt.prompt);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors text-left"
                >
                  <span>{prompt.icon}</span>
                  <span className="text-gray-700 dark:text-gray-300">{prompt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Advice */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('ai_advisor.advice_title')}</h3>
            {advice.length > 0 ? (
              <div className="space-y-3">
                {advice.map((item, i) => {
                  const config = getPriorityConfig(item.priority);
                  const isExpanded = expandedAdvice === i;
                  
                  return (
                    <div 
                      key={i}
                      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${config.border} overflow-hidden`}
                    >
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => setExpandedAdvice(isExpanded ? null : i)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`p-2 rounded-lg ${config.bg}`}>
                              {getCategoryIcon(item.category)}
                            </span>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                {adviceTitle(item)}
                              </h4>
                              <p className="text-sm text-gray-500 line-clamp-1">
                                {adviceInsight(item)}
                              </p>
                            </div>
                          </div>
                          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                        
                        {/* Tags */}
                        <div className="flex gap-2 mt-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${config.bg}`}
                                style={{ color: config.color }}>
                            {item.priority === 'high'
                              ? t('ai_advisor.priority_high')
                              : item.priority === 'medium'
                              ? t('ai_advisor.priority_medium')
                              : t('ai_advisor.priority_low')}
                          </span>
                          {item.category && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 capitalize">
                              {item.category}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Expanded Content */}
                      {isExpanded && item.action_items && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {K.action_items}
                          </p>
                          <ul className="space-y-1">
                            {adviceActions(item).map((action, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">{t('ai_advisor.no_advice')}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {K.empty_hint}
                </p>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {K.refresh}
          </button>
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">{t('ai_advisor.chat_empty')}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {K.placeholder}
                </p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div 
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-br-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md"
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <ul className="mt-2 pt-2 border-t border-black/5 dark:border-white/10 space-y-1">
                      {msg.actions.map((a, ai) => (
                        <li key={ai} className="text-xs flex items-start gap-1.5">
                          <span className={`shrink-0 mt-0.5 ${
                            a.success === false ? 'text-red-500' : 'text-green-600'
                          }`}>
                            {a.success === false ? '\u2715' : '\u2713'}
                          </span>
                          <span className="min-w-0">{a.description || a.type}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {msg.timestamp && (
                    <p className={`text-xs mt-1 ${
                      msg.role === "user" ? "text-purple-200" : "text-gray-400"
                    }`}>
                      {new Date(msg.timestamp).toLocaleTimeString('id-ID', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={t('ai_advisor.placeholder')}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                           bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                           placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={sending}
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending || !message.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default AIAdvisor;
