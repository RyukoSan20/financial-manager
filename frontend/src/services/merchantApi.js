// Merchant API client
import api from './api';

const merchantApi = {
  // Merchant CRUD
  createMerchant: (data) => api.request('/merchant/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  listMerchants: () => api.request('/merchant/'),
  
  getMerchant: (id) => api.request(`/merchant/${id}`),
  
  updateMerchant: (id, data) => api.request(`/merchant/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  deleteMerchant: (id) => api.request(`/merchant/${id}`, {
    method: 'DELETE',
  }),
  
  // Merchant Summary
  getSummary: (id) => api.request(`/merchant/${id}/summary`),
  
  // Quick Sale (POS)
  quickSale: (data) => api.request('/merchant/quick-sale', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Products
  listProducts: (merchantId) => api.request(`/merchant/${merchantId}/products`),
  
  addProduct: (merchantId, data) => api.request(`/merchant/${merchantId}/products`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Daily Settlement
  createSettlement: (merchantId, transferAmount = 0, notes = null) => {
    const params = new URLSearchParams();
    params.append('transfer_amount', transferAmount.toString());
    if (notes) params.append('notes', notes);
    
    return api.request(`/merchant/${merchantId}/daily-settlement?${params}`, {
      method: 'POST',
    });
  },
  
  listSettlements: (merchantId, limit = 30) => api.request(`/merchant/${merchantId}/settlements?limit=${limit}`),
};

export default merchantApi;
