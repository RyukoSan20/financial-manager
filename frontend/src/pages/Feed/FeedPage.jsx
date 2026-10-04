"""Feed Review UI - shadcn/ui based transaction review cards."""

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, XCircle, Loader2, Clock, 
  Receipt, AlertCircle, ChevronRight, Camera 
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import api from '@/services/api';

const FeedPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("pending");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [activeTab]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/feed/all${params}`);
      setTransactions(response.data || []);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      showNotification(t('feed.errorFetch'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/feed/stats');
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleApprove = async (transactionId) => {
    setProcessingIds(prev => new Set([...prev, transactionId]));
    try {
      await api.post(`/feed/approve/${transactionId}`);
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? {...t, status: 'approved'} : t)
      );
      fetchStats();
      showNotification(t('feed.approved'), 'success');
    } catch (error) {
      showNotification(t('feed.errorApprove'), 'error');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  const handleReject = async (transactionId) => {
    setProcessingIds(prev => new Set([...prev, transactionId]));
    try {
      await api.post(`/feed/reject/${transactionId}`);
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? {...t, status: 'rejected'} : t)
      );
      fetchStats();
      showNotification(t('feed.rejected'), 'info');
    } catch (error) {
      showNotification(t('feed.errorReject'), 'error');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const formatCurrency = (amount, currency = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: t('feed.pending') },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: t('feed.approved') },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: t('feed.rejected') }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getSourceBadge = (source) => {
    const sourceLabels = {
      camera_scan: t('feed.sourceCamera'),
      email_forward: t('feed.sourceEmail'),
      whatsapp: t('feed.sourceWhatsapp'),
      manual: t('feed.sourceManual'),
      ocr_receipt: t('feed.sourceOCR')
    };
    return sourceLabels[source] || source;
  };

  const FeedCard = ({ transaction }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {transaction.merchant_name ? (
                <>
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  {transaction.merchant_name}
                </>
              ) : (
                <>
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  {transaction.description || t('feed.transaction')}
                </>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>{new Date(transaction.date).toLocaleDateString('id-ID')}</span>
              {transaction.account_name && (
                <>
                  <span>•</span>
                  <span>{transaction.account_name}</span>
                </>
              )}
              <span>•</span>
              <Badge variant="outline" className="text-xs">
                {getSourceBadge(transaction.source)}
              </Badge>
              {transaction.confidence_score && (
                <Badge variant="outline" className="text-xs">
                  {Math.round(transaction.confidence_score * 100)}% confidence
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${
              transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
            }`}>
              {transaction.type === 'expense' ? '-' : '+'}
              {formatCurrency(transaction.amount, transaction.currency)}
            </div>
            {getStatusBadge(transaction.status)}
          </div>
        </div>
      </CardHeader>
      
      {transaction.items && transaction.items.length > 0 && (
        <CardContent className="pt-0">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-sm font-medium mb-2">{t('feed.items')}:</div>
            <div className="space-y-1">
              {transaction.items.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.total_price)}
                  </span>
                </div>
              ))}
              {transaction.items.length > 5 && (
                <div className="text-sm text-muted-foreground text-center">
                  +{transaction.items.length - 5} more items
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
      
      {transaction.status === 'pending' && (
        <CardContent className="pt-0 flex gap-2">
          <Button 
            onClick={() => handleApprove(transaction.id)}
            disabled={processingIds.has(transaction.id)}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {processingIds.has(transaction.id) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('feed.approve')}
              </>
            )}
          </Button>
          <Button 
            onClick={() => handleReject(transaction.id)}
            disabled={processingIds.has(transaction.id)}
            variant="outline"
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {t('feed.reject')}
          </Button>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('feed.title')}</h1>
        <p className="text-muted-foreground">{t('feed.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending_count}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('feed.pendingCount')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.approved_today}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('feed.approvedToday')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">
                {stats.rejected_today}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('feed.rejectedToday')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {formatCurrency(stats.total_pending_amount)}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('feed.totalPending')}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            {t('feed.pending')}
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle className="h-4 w-4 mr-2" />
            {t('feed.approved')}
          </TabsTrigger>
          <TabsTrigger value="all">
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('feed.all')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('feed.empty')}</p>
              </CardContent>
            </Card>
          ) : (
            transactions.map(transaction => (
              <FeedCard key={transaction.id} transaction={transaction} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-50 ${
          notification.type === 'success' ? 'bg-green-600 text-white' :
          notification.type === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle className="h-5 w-5" />}
            {notification.type === 'error' && <XCircle className="h-5 w-5" />}
            {notification.type === 'info' && <AlertCircle className="h-5 w-5" />}
            {notification.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedPage;
