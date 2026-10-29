// Shopping Kanban Board Page - Full drag & drop shopping pipeline
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Modal, Spinner } from '../../components/ui';
import api from '../../services/api';
import {
  ShoppingCart, Heart, Package, Truck, CheckCircle, XCircle,
  Plus, MoreVertical, Edit2, Trash2, ExternalLink, Star,
  X, GripVertical, RefreshCw, DollarSign, TrendingUp, Filter
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { buildFlag } from '../../utils/featureFlags';
import { SHOPPING_STAGE_ICONS } from '../../utils/icons';
import { IconText } from '../../components/ui/IconText';

// Pipeline stages configuration
const STAGES = [
  { id: 'wishlist', labelKey: 'shopping.stage_wishlist', icon: '💭', color: 'gray' },
  { id: 'to_buy', labelKey: 'shopping.stage_to_buy', icon: '🛒', color: 'blue' },
  { id: 'ordered', labelKey: 'shopping.stage_ordered', icon: '📦', color: 'purple' },
  { id: 'shipped', labelKey: 'shopping.stage_shipped', icon: '🚚', color: 'orange' },
  { id: 'received', labelKey: 'shopping.stage_received', icon: '✅', color: 'green' },
  { id: 'cancelled', labelKey: 'shopping.stage_cancelled', icon: '❌', color: 'red' },
];


const MARKETPLACES = ['shopee', 'tokopedia', 'lazada', 'blibli', 'tiktok', 'bukalapak', 'lainnya'];

const ShoppingPage = () => {
  const { t } = useTranslation();
  // With the polish switch off, the emoji stay as they are.
  const polished = buildFlag('UI_POLISH');
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
      fetchBoard();
    } catch (err) {
      console.error('Failed to move item:', err);
      alert(t('shopping.move_error'));
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
      alert(t('shopping.add_error'));
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
      alert(t('shopping.update_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm(t('shopping.delete_confirm'))) return;
    
    try {
      await api.request(`/shopping/items/${itemId}`, { method: 'DELETE' });
      fetchBoard();
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert(t('shopping.delete_error'));
    }
  };

  const handleMoveItem = async (itemId, newStage) => {
    try {
      await api.request(`/shopping/items/${itemId}/move`, {
        method: 'POST',
        data: { stage: newStage },
      });
      fetchBoard();
    } catch (err) {
      console.error('Failed to move item:', err);
      alert(t('shopping.move_error'));
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            <IconText name="cart" emoji="🛒" on={polished}>{t('shopping.title')}</IconText>
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('shopping.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBoard}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('shopping.add_item')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="!p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('shopping.total_budget')}</div>
          <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(board?.total_budget || 0)}
          </div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('shopping.total_spent')}</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(board?.total_spent || 0)}
          </div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('shopping.remaining_budget')}</div>
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(board?.remaining_budget || 0)}
          </div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('shopping.total_items')}</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {board?.stages?.reduce((sum, s) => sum + s.count, 0) || 0}
          </div>
        </Card>
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
              className={`flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 transition-colors ${
                isDragOver ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const StageIcon = SHOPPING_STAGE_ICONS[stage.id];
                    if (polished && StageIcon) {
                      return <StageIcon className="w-5 h-5 shrink-0" aria-hidden="true" />;
                    }
                    return <span className="text-xl">{stage.icon}</span>;
                  })()}
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {t(stage.labelKey)}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    stage.color === 'gray' ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                    stage.color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                    stage.color === 'purple' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                    stage.color === 'orange' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                    stage.color === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {stageData?.count || items.length}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
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
                      className="!p-3 cursor-move hover:shadow-md transition-shadow"
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
                    {polished ? null : `${stage.icon} `}{t(stage.labelKey)}
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
