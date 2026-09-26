// Notification Helper - Real-time notifications for financial events

// Show notification from anywhere
export const showNotification = (notification) => {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: notification }));
};

// Transaction notifications
export const notifyTransactionAdded = (description, amount, type) => {
  showNotification({
    type: 'success',
    title: type === 'income' ? '💰 Pendapatan Ditambahkan' : '💸 Pengeluaran Ditambahkan',
    message: `${description}`,
    description: `Rp ${amount?.toLocaleString('id-ID')}`,
    category: 'transaction'
  });
};

export const notifyTransactionDeleted = () => {
  showNotification({
    type: 'info',
    title: '🗑️ Transaksi Dihapus',
    message: 'Transaksi berhasil dihapus',
    category: 'transaction'
  });
};

export const notifyTransactionUpdated = (description) => {
  showNotification({
    type: 'success',
    title: '✏️ Transaksi Diperbarui',
    message: description,
    category: 'transaction'
  });
};

// Budget notifications
export const notifyBudgetExceeded = (budgetName, spent, limit) => {
  showNotification({
    type: 'warning',
    title: '⚠️ Budget Melebihi Limit!',
    message: `${budgetName} sudah habis`,
    description: `Terpakai: Rp ${spent?.toLocaleString('id-ID')} / Rp ${limit?.toLocaleString('id-ID')}`,
    category: 'budget'
  });
};

export const notifyBudgetWarning = (budgetName, percent) => {
  showNotification({
    type: 'warning',
    title: '⚠️ Budget Hampir Penuh',
    message: `${budgetName}`,
    description: `Terpakai ${percent}% dari limit`,
    category: 'budget'
  });
};

// Goal notifications
export const notifyGoalProgress = (goalName, progress) => {
  showNotification({
    type: 'success',
    title: '🎯 Tujuan Maju!',
    message: `${goalName}`,
    description: `Progress: ${progress}%`,
    category: 'goal'
  });
};

export const notifyGoalCompleted = (goalName) => {
  showNotification({
    type: 'success',
    title: '🎉 Tujuan Tercapai!',
    message: `${goalName} berhasil diselesaikan!`,
    category: 'goal'
  });
};

export const notifyGoalContribution = (goalName, amount) => {
  showNotification({
    type: 'success',
    title: '💰 Tabungan Ditambahkan',
    message: `Ke ${goalName}`,
    description: `Rp ${amount?.toLocaleString('id-ID')}`,
    category: 'goal'
  });
};

// Debt notifications
export const notifyDebtPayment = (debtName, amount) => {
  showNotification({
    type: 'success',
    title: '✅ Pembayaran Utang',
    message: `${debtName}`,
    description: `Rp ${amount?.toLocaleString('id-ID')}`,
    category: 'debt'
  });
};

export const notifyDebtCompleted = (debtName) => {
  showNotification({
    type: 'success',
    title: '🎊 Utang Lunas!',
    message: `${debtName} berhasil dilunasi!`,
    category: 'debt'
  });
};

// Recurring notifications
export const notifyRecurringDue = (name, amount) => {
  showNotification({
    type: 'info',
    title: '🔄 Tagihan Berulang',
    message: `${name} akan diproses`,
    description: `Rp ${amount?.toLocaleString('id-ID')}`,
    category: 'recurring'
  });
};

// General notifications
export const notifyError = (title, message) => {
  showNotification({
    type: 'error',
    title: title || '❌ Error',
    message: message,
    category: 'error'
  });
};

export const notifySuccess = (title, message) => {
  showNotification({
    type: 'success',
    title: title || '✅ Berhasil',
    message: message,
    category: 'success'
  });
};
