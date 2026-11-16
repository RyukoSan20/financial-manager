// Shopping Kanban Board Page - Full drag & drop shopping pipeline
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Modal, Spinner } from '../../components/ui';
import api from '../../services/api';
import {
  ShoppingCart, Heart, Package, Truck, CheckCircle, XCircle,
  Plus, MoreVertical, Edit2, Trash2, ExternalLink, Star,
  X, GripVertical, RefreshCw, DollarSign, TrendingUp, Filter, Search
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import PixelArtBusinessIcon from '../../components/ui/PixelArtBusinessIcon';
import DraggableSparkleMascot from '../../components/mascot/DraggableSparkleMascot';
import { toast } from '../../contexts/ToastContext';
import { ask } from '../../contexts/ConfirmContext';
import VisualProductCatalogGrid, { saveProductToWishlist } from '../../components/shopping/VisualProductCatalogGrid';
import PartnerMerchantFeedSection from '../../components/shopping/PartnerMerchantFeedSection';

// Pipeline stages configuration
// Each column is a stationery board column with its own pastel header
// tape and a drawn pixel icon - no emoji.
const STAGES = [
  { id: 'wishlist', labelKey: 'shopping.stage_wishlist', icon: 'lightbulb', tape: '#FDE8E4', color: 'gray' },
  { id: 'to_buy', labelKey: 'shopping.stage_to_buy', icon: 'money_bag_rp', tape: '#FFF6D6', color: 'blue' },
  { id: 'ordered', labelKey: 'shopping.stage_ordered', icon: 'receipt', tape: '#E3F2EA', color: 'purple' },
  { id: 'shipped', labelKey: 'shopping.stage_shipped', icon: 'briefcase', tape: '#EFE8FA', color: 'orange' },
  { id: 'received', labelKey: 'shopping.stage_received', icon: 'income', tape: '#E3F2FD', color: 'green' },
  { id: 'cancelled', labelKey: 'shopping.stage_cancelled', icon: 'ledger_red', tape: '#F3ECE6', color: 'red' },
];

const ZENIMARU_CHEERS = {
  id: ['Mantap, satu langkah lagi!', 'Barangnya jalan terus!', 'Catat dulu, baru beli. Sip!', 'Hore, pindah kolom!'],
  en: ['Nice, one step closer!', 'On the move!', 'Plan first, then buy. Great!', 'Hooray, next column!'],
};


const MARKETPLACES = ['shopee', 'tokopedia', 'lazada', 'blibli', 'tiktok', 'bukalapak', 'lainnya'];

const ShoppingPage = () => {
  const { t, language } = useTranslation();
  const en = language === 'en';
  // Zenimaru cheers when an item moves to another column.
  const [cheer, setCheer] = useState(null);
  const cheerMove = useCallback(() => {
    const lines = ZENIMARU_CHEERS[en ? 'en' : 'id'];
    setCheer({ text: lines[Math.floor(Math.random() * lines.length)], at: Date.now() });
  }, [en]);
  useEffect(() => {
    if (!cheer) return undefined;
    const id = setTimeout(() => setCheer(null), 2600);
    return () => clearTimeout(id);
  }, [cheer]);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    quantity: 1,
    stage: 'wishlist',
    marketplace: '',
    product_url: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  /* The catalogue.

     The board is a board of decisions. It is not a way to look at
     things, so a reader cannot see what a thing looks like before they
     decide about it. This is the looking: the same search the tracker
     uses, the same answer, and the same honesty about where the price
     came from. */
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogAnswer, setCatalogAnswer] = useState(null);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.request('/shopping/board');
      setBoard(response.data || response);
    } catch (err) {
      console.error('Failed to fetch board:', err);
      setError(t('shopping.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'Rp 0';
    const num = typeof amount === 'string' ? parseInt(amount) : amount;
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleDragStart = (e, item, stage) => {
    setDraggedItem({ ...item, fromStage: stage });
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItem(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);
    
    if (!draggedItem || draggedItem.fromStage === targetStage) {
      setDraggedItem(null);
      return;
    }

    try {
      await api.request(`/shopping/items/${draggedItem.id}/move`, {
        method: 'POST',
        data: { stage: targetStage },
      });
      cheerMove();
      fetchBoard();
    } catch (err) {
      console.error('Failed to move item:', err);
      toast.error(t('shopping.move_error'));
    }
    
    setDraggedItem(null);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    setSaving(true);
    try {
      await api.request('/shopping/items', {
        method: 'POST',
        data: {
          name: formData.name,
          price: formData.price ? parseInt(formData.price) : null,
          quantity: formData.quantity || 1,
          stage: formData.stage,
          marketplace: formData.marketplace || null,
          product_url: formData.product_url || null,
          notes: formData.notes || null,
        },
      });
      setShowAddModal(false);
      resetForm();
      fetchBoard();
    } catch (err) {
      console.error('Failed to add item:', err);
      toast.error(t('shopping.add_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();
    if (!editingItem || !formData.name.trim()) return;
    
    setSaving(true);
    try {
      await api.request(`/shopping/items/${editingItem.id}`, {
        method: 'PUT',
        data: {
          name: formData.name,
          price: formData.price ? parseInt(formData.price) : null,
          quantity: formData.quantity || 1,
          marketplace: formData.marketplace || null,
          product_url: formData.product_url || null,
          notes: formData.notes || null,
        },
      });
      setShowEditModal(false);
      setEditingItem(null);
      resetForm();
      fetchBoard();
    } catch (err) {
      console.error('Failed to update item:', err);
      toast.error(t('shopping.update_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!(await ask({ message: t('shopping.delete_confirm'), tone: 'danger' }))) return;
    
    try {
      await api.request(`/shopping/items/${itemId}`, { method: 'DELETE' });
      fetchBoard();
    } catch (err) {
      console.error('Failed to delete item:', err);
      toast.error(t('shopping.delete_error'));
    }
  };

  const handleMoveItem = async (itemId, newStage) => {
    try {
      await api.request(`/shopping/items/${itemId}/move`, {
        method: 'POST',
        data: { stage: newStage },
      });
      cheerMove();
      fetchBoard();
    } catch (err) {
      console.error('Failed to move item:', err);
      toast.error(t('shopping.move_error'));
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price || '',
      quantity: item.quantity || 1,
      stage: item.stage,
      marketplace: item.marketplace || '',
      product_url: item.product_url || '',
      notes: item.notes || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      quantity: 1,
      stage: 'wishlist',
      marketplace: '',
      product_url: '',
      notes: '',
    });
  };

  /* The search behind the catalogue.

     It is the endpoint the tracker already uses, and the answer is
     taken as it comes back: the body of the answer, not a wrapper
     around it. The answer says where it came from, and that is what
     the grid uses to be honest about the price. */
  const searchCatalog = useCallback(async (text) => {
    const needle = (text ?? '').trim();
    if (!needle) {
      setCatalogAnswer(null);
      return;
    }

    setCatalogSearching(true);
    try {
      const found = await api.request(
        `/shopping-search/search?q=${encodeURIComponent(needle)}&limit=24`
      );
      setCatalogAnswer(found);
    } catch (err) {
      console.error('The catalogue search failed:', err);
      setCatalogAnswer(null);
      toast.error(t('shopping_catalog.search_failed'));
    } finally {
      setCatalogSearching(false);
    }
  }, [t]);

  /* The search happens once the reader has stopped typing, so that
     every keystroke does not ask the server the same question. */
  useEffect(() => {
    const needle = catalogQuery.trim();
    if (!needle) {
      setCatalogAnswer(null);
      return undefined;
    }
    const timer = setTimeout(() => searchCatalog(needle), 350);
    return () => clearTimeout(timer);
  }, [catalogQuery, searchCatalog]);

  /* A thing from the catalogue goes on the board as a thing on the
     wishlist stage, with the picture and the link and the note of
     where the price came from. */
  const saveCatalogProduct = async (product) => {
    setCatalogSaving(true);
    try {
      await saveProductToWishlist(product);
      toast.success(t('shopping_catalog.saved_to_wishlist'));
      fetchBoard();
    } catch (err) {
      console.error('Saving to the board failed:', err);
      toast.error(t('shopping_catalog.save_failed'));
    } finally {
      setCatalogSaving(false);
    }
  };

  const getItemActions = (item) => {
    const currentIndex = STAGES.findIndex(s => s.id === item.stage);
    const actions = [];
    
    // Previous stages
    if (currentIndex > 0) {
      actions.push({ stage: STAGES[currentIndex - 1], label: `← ${t(STAGES[currentIndex - 1].labelKey)}` });
    }
    // Next stages
    if (currentIndex < STAGES.length - 1 && item.stage !== 'cancelled') {
      if (item.stage === 'wishlist') {
        actions.push({ stage: STAGES[2], label: t('shopping.action_order') }); // Skip to ordered
      } else if (item.stage === 'to_buy') {
        actions.push({ stage: STAGES[2], label: t('shopping.action_order') });
      } else if (item.stage === 'ordered') {
        actions.push({ stage: STAGES[3], label: t('shopping.action_mark_shipped') });
      } else if (item.stage === 'shipped') {
        actions.push({ stage: STAGES[4], label: t('shopping.action_mark_received') });
      }
    }
    
    return actions;
  };

  if (loading && !board) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
        <span className="ml-4 text-gray-500">{t('shopping.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="!p-6 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchBoard}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('shopping.retry')}
        </Button>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header: a stationery banner with Zenimaru, who cheers when an
          item moves across the board. */}
      <header
        className="relative mb-6 flex flex-col items-center gap-4 overflow-visible rounded-[24px] border-2 border-[#4A3540] bg-gradient-to-r from-[#FFF6D6] via-[#FFFDF9] to-[#EFE8FA] p-5 shadow-[0_6px_0_#E2D6C3] sm:flex-row"
        data-testid="kanban-header-banner"
      >
        <span aria-hidden="true" className="absolute -top-2.5 left-6 h-4 w-20 -rotate-2 rounded-sm bg-[#A8E6CF]/90" />
        <span aria-hidden="true" className="absolute right-4 top-3 text-[#E07A5F]">✦</span>
        <div className="relative shrink-0" data-testid="kanban-zenimaru">
          <DraggableSparkleMascot
            key={cheer ? cheer.at : 'idle'}
            persona="zenimaru"
            size={100}
            mood={cheer ? 'celebrate' : 'happy'}
            hint={en ? '✨ Drag me!' : '✋ Geser aku!'}
            label="Zenimaru"
          />
          {cheer ? (
            <span
              role="status"
              className="parade-say absolute -right-2 -top-3 translate-x-full whitespace-nowrap rounded-2xl border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-1 text-[12px] font-extrabold text-[#2C221E] shadow-[0_3px_0_#4A3540]"
              data-testid="kanban-zenimaru-cheer"
            >
              {cheer.text}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-extrabold text-[#2C221E] sm:justify-start">
            <PixelArtBusinessIcon name="clipboard" size={34} />
            {t('shopping.title').replace(/^[^\p{L}\p{N}]+/u, '')}
          </h1>
          <p className="mt-1 text-[12.5px] text-[#5C6460]">{t('shopping.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchBoard}
            aria-label={t('shopping.retry')}
            className="rounded-full border-2 border-[#4A3540] bg-[#FFFDF9] p-2.5 shadow-[0_3px_0_#4A3540] active:translate-y-0.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#4A3540] bg-[#2F4842] px-4 py-2 text-sm font-extrabold text-[#FFFDF9] shadow-[0_4px_0_#1B2E28] active:translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            {t('shopping.add_item')}
          </button>
        </div>
      </header>

      {/* The four totals, as stationery cards. */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="kanban-stats">
        {[
          { label: t('shopping.total_budget'), value: formatCurrency(board?.total_budget || 0), icon: 'money_bag_rp', tape: '#FDE8E4' },
          { label: t('shopping.total_spent'), value: formatCurrency(board?.total_spent || 0), icon: 'receipt', tape: '#FFF6D6' },
          { label: t('shopping.remaining_budget'), value: formatCurrency(board?.remaining_budget || 0), icon: 'coin', tape: '#E3F2EA' },
          { label: t('shopping.total_items'), value: board?.stages?.reduce((sum, st) => sum + st.count, 0) || 0, icon: 'clipboard', tape: '#EFE8FA' },
        ].map((card) => (
          <div
            key={card.icon}
            className="relative rounded-[24px] border-2 border-[#4A3540] bg-[#FFFDF9] p-4 shadow-[0_6px_0_#E2D6C3] dark:bg-[#2A2420]"
          >
            <span aria-hidden="true" className="absolute -top-2 left-4 h-3.5 w-14 -rotate-2 rounded-sm" style={{ background: card.tape }} />
            <div className="flex items-center gap-2 text-[12px] font-bold text-[#6B5E57] dark:text-[#CBB8A6]">
              <PixelArtBusinessIcon name={card.icon} size={22} badge={false} />
              {card.label}
            </div>
            <div className="mt-1 text-xl font-extrabold tabular-nums text-[#2C221E] dark:text-[#FAF5EE]">{card.value}</div>
          </div>
        ))}
      </div>

      {/* The catalogue.

          A board of decisions is not a way to look at things. This is
          the looking: a search, a grid of pictures, and a card that
          says plainly whether the price is a price in a shop or a
          reference price of the reader's own. */}
      <div className="mb-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PixelArtBusinessIcon name="money_bag_rp" size={26} />
            {String(t('shopping_catalog.title')).replace(/^[^\p{L}\p{N}]+/u, '')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('shopping_catalog.subtitle')}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchCatalog(catalogQuery);
            }}
            placeholder={t('shopping_catalog.placeholder')}
            aria-label={t('shopping_catalog.title')}
            className="w-full pl-10 pr-3 py-2.5 rounded-full border-2 border-[#4A3540] bg-[#FFFDF9] dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm shadow-[0_3px_0_#E2D6C3]"
          />
        </div>

        {catalogSearching && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            {t('shopping_catalog.searching')}
          </div>
        )}

        {catalogAnswer && !catalogSearching && (
          <VisualProductCatalogGrid
            products={catalogAnswer.results || []}
            source={catalogAnswer.source || 'provider'}
            onSave={saveCatalogProduct}
            saving={catalogSaving}
          />
        )}

        <PartnerMerchantFeedSection onSaved={() => fetchBoard()} />
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageData = board?.stages?.find(s => s.stage === stage.id);
          const items = board?.items_by_stage?.[stage.id] || [];
          const isDragOver = dragOverStage === stage.id;
          
          return (
            <div
              key={stage.id}
              data-testid={`kanban-column-${stage.id}`}
              className={`relative flex-shrink-0 w-72 overflow-visible rounded-[24px] border-2 border-[#4A3540] bg-[#FFFDF9] dark:bg-[#2A2420] p-3 pt-0 shadow-[0_6px_0_#E2D6C3] transition-transform ${
                isDragOver ? '-translate-y-1 ring-4 ring-[#F7C8D8]' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage header: a strip of pastel washi tape. */}
              <span aria-hidden="true" className="pointer-events-none absolute -right-1.5 -top-2 text-[13px] text-[#E07A5F]">✦</span>
              <span aria-hidden="true" className="pointer-events-none absolute -bottom-2 -left-1 text-[11px] text-[#8EC9E0]">✦</span>
              <div
                className="-mx-3 mb-3 flex items-center justify-between rounded-t-[22px] border-b-2 border-dashed border-[#4A3540]/40 px-3 py-2.5"
                style={{ background: stage.tape }}
                data-testid={`kanban-tape-${stage.id}`}
              >
                <div className="flex items-center gap-2">
                  <PixelArtBusinessIcon name={stage.icon} size={24} badge={false} />
                  <h3 className="font-extrabold text-[#2C221E]">
                    {String(t(stage.labelKey)).replace(/^[^\p{L}\p{N}]+/u, '')}
                  </h3>
                  <span className="rounded-full border border-[#4A3540]/40 bg-[#FFFDF9] px-2 py-0.5 text-xs font-extrabold text-[#2C221E]">
                    {stageData?.count || items.length}
                  </span>
                </div>
                <span className="text-sm font-bold text-[#6B5E57]">
                  {formatCurrency(stageData?.total || items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0))}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2 min-h-[200px]">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-300 text-sm">
                    {t('shopping.drop_here')}
                  </div>
                ) : (
                  items.map((item) => (
                    <Card 
                      key={item.id} 
                      className="!p-3 !rounded-2xl !border-2 !border-[#4A3540] !shadow-[0_3px_0_#4A3540] cursor-move transition-transform hover:-translate-y-0.5"
                      draggable
                      onDragStart={(e) => handleDragStart(e, item, stage.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {item.name}
                          </div>
                          {item.marketplace && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {item.marketplace}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                              {formatCurrency(item.price)} × {item.quantity}
                            </span>
                            {item.rating && (
                              <div className="flex items-center gap-1">
                                {[...Array(item.rating)].map((_, i) => (
                                  <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                ))}
                              </div>
                            )}
                          </div>
                          {item.product_url && (
                            <a 
                              href={item.product_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary-500 hover:underline mt-1 flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              {t('shopping.open_link')}
                            </a>
                          )}
                        </div>
                        <div className="relative group">
                          <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border dark:border-gray-600 py-1 min-w-[120px] hidden group-hover:block z-10">
                            <button
                              onClick={() => openEditModal(item)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-red-500 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t('common.delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Actions */}
                      {stage.id !== 'received' && stage.id !== 'cancelled' && (
                        <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                          {getItemActions(item).slice(0, 2).map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleMoveItem(item.id, action.stage.id)}
                              className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Item Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{t('shopping.add_item_title')}</h2>
            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleAddItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.item_name')}
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('shopping.item_name_placeholder')}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('shopping.price')}
                </label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="15000000"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('shopping.quantity')}
                </label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.stage_label')}
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {STAGES.filter(s => s.id !== 'received' && s.id !== 'cancelled').map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {String(t(stage.labelKey)).replace(/^[^\p{L}\p{N}]+/u, '')}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.marketplace')}
              </label>
              <select
                value={formData.marketplace}
                onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('shopping.select_marketplace')}</option>
                {MARKETPLACES.map((mp) => (
                  <option key={mp} value={mp}>
                    {mp.charAt(0).toUpperCase() + mp.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.product_link')}
              </label>
              <Input
                type="url"
                value={formData.product_url}
                onChange={(e) => setFormData({ ...formData, product_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('shopping.notes_placeholder')}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Spinner size="sm" /> : t('shopping.add')}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Edit Item Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingItem(null); resetForm(); }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{t('shopping.edit_item')}</h2>
            <button onClick={() => { setShowEditModal(false); setEditingItem(null); resetForm(); }} className="p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleEditItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.item_name')}
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('shopping.price')}
                </label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('shopping.quantity')}
                </label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.marketplace')}
              </label>
              <select
                value={formData.marketplace}
                onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('shopping.select_marketplace')}</option>
                {MARKETPLACES.map((mp) => (
                  <option key={mp} value={mp}>
                    {mp.charAt(0).toUpperCase() + mp.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.product_link')}
              </label>
              <Input
                type="url"
                value={formData.product_url}
                onChange={(e) => setFormData({ ...formData, product_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shopping.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowEditModal(false); setEditingItem(null); resetForm(); }}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Spinner size="sm" /> : t('common.save')}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default ShoppingPage;
