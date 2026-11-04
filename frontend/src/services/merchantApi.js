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
  // The shelf.
  //
  // The till reads its goods from the same place the shelf does, so
  // that a thing that is on the shelf is a thing that can be sold.
  listProducts: (merchantId, includeInactive = false) =>
    api.request(`/business/merchants/${merchantId}/products?include_inactive=${includeInactive}`),

  createProduct: (merchantId, data) =>
    api.request(`/business/merchants/${merchantId}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (merchantId, productId, data) =>
    api.request(`/business/merchants/${merchantId}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // A thing that is taken off the shelf is not deleted. A receipt that
  // names it is a record of what happened, so the row stays and it is
  // marked as no longer sold.
  retireProduct: (merchantId, productId) =>
    api.request(`/business/merchants/${merchantId}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: false }),
    }),

  // The photograph of a thing for sale. A file, so it is sent as a
  // file and not as a piece of text.
  uploadProductImage: (merchantId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload(`/merchant/${merchantId}/product-image`, form);
  },

  // Reading a product out of a photograph.
  //
  // This does not create a product. It answers with a draft, and the
  // owner looks at the draft before the product is made. The writing
  // is addProduct below, and it is a separate press.
  captureProduct: (merchantId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload(`/merchant/${merchantId}/capture`, form);
  },
  
  addProduct: (merchantId, data) => api.request(`/merchant/${merchantId}/products`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // The kind of shop this is.
  //
  // The server holds the rules about which fields belong to which
  // kind of shop, and tells the browser what they are. The browser
  // does not keep a copy of the rules, because a copy drifts.
  listBusinessProfiles: () => api.request('/merchant/profiles'),

  getBusinessProfile: (id) => api.request(`/merchant/${id}/profile`),

  updateBusinessProfile: (id, data) => api.request(`/merchant/${id}/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // The journal of the shop.
  listBusinessTransactions: (merchantId, params = {}) => {
    const query = new URLSearchParams();
    if (merchantId) query.append('merchant_id', String(merchantId));
    if (params.limit) query.append('limit', String(params.limit));
    const suffix = query.toString() ? `?${query}` : '';
    return api.request(`/business/transactions${suffix}`);
  },

  // The rules of the tax, and what they work out to.
  listTaxRules: () => api.request('/business/tax-rules'),

  simulateTax: (payload) => api.request('/business/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
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
