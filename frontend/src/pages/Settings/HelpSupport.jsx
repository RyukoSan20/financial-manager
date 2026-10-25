// Help & Support Page - FAQs + contact form backed by POST/GET /api/settings/support
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

const HelpSupport = () => {
  const [expanded, setExpanded] = useState(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const faqs = [
    {
      id: 1,
      question: 'Bagaimana cara menambah transaksi baru?',
      answer:
        'Tekan tombol + di halaman utama atau navigasi ke menu "Tambah Transaksi". Isi detail transaksi termasuk jumlah, kategori, akun, dan tanggal.'
    },
    {
      id: 2,
      question: 'Bagaimana cara mentransfer antar akun?',
      answer:
        'Pilih jenis transaksi "Transfer", pilih akun asal dan akun tujuan, masukkan jumlah, dan simpan.'
    },
    {
      id: 3,
      question: 'Apakah data saya aman?',
      answer:
        'Ya, data Anda dienkripsi dan tersimpan dengan aman. Kami tidak membagikan data Anda kepada pihak ketiga.'
    },
    {
      id: 4,
      question: 'Bagaimana cara reset password?',
      answer:
        'Tekan "Lupa Password" di halaman login, masukkan email Anda, dan kami akan mengirimkan link reset password.'
    },
    {
      id: 5,
      question: 'Bagaimana cara export data?',
      answer:
        'Navigasi ke menu Laporan, pilih periode yang diinginkan, dan tekan tombol Export untuk mengunduh data dalam format CSV atau PDF.'
    },
    {
      id: 6,
      question: 'Apa itu Budget dan bagaimana cara menggunakannya?',
      answer:
        'Budget membantu Anda mengatur pengeluaran bulanan. Buat budget per kategori dan aplikasi akan membantu melacak pengeluaran Anda.'
    },
    {
      id: 7,
      question: 'Bagaimana cara memakai papan belanja (Kanban)?',
      answer:
        'Buka menu Belanja lalu pilih tab Papan. Geser kartu antar kolom (Wishlist → Mau Dibeli → Dipesan → Dikirim → Diterima), atau gunakan menu "Pindahkan ke..." di layar sentuh.'
    },
    {
      id: 8,
      question: 'Kenapa feed review saya kosong?',
      answer:
        'Feed menampilkan transaksi hasil scan struk dan import email yang menunggu persetujuan. Refresh halaman, atau buka tab "Semua" untuk melihat transaksi yang sudah diproses.'
    }
  ];

  const loadRequests = useCallback(async () => {
    try {
      const data = await api.request('/settings/support');
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      // Not critical - the contact form still works.
      console.error('Load support requests error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.request('/settings/support', {
        method: 'POST',
        body: JSON.stringify({
          subject: contactForm.subject,
          message: contactForm.message
        })
      });
      setMessage('Pesan Anda telah dikirim. Tim kami akan segera menghubungi Anda.');
      setContactForm({ subject: '', message: '' });
      await loadRequests();
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Gagal mengirim pesan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-600 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">❓ Help & Support</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Quick Links */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">Kontak Kami</h2>

          <div className="grid grid-cols-2 gap-3">
            <a
              href="mailto:support@my-financial-manager.online"
              className="flex flex-col items-center p-4 bg-primary-50 rounded-lg hover:bg-primary-100"
            >
              <span className="text-2xl mb-2">📧</span>
              <span className="text-sm font-medium">Email</span>
            </a>
            <a
              href="tel:+628000000000"
              className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100"
            >
              <span className="text-2xl mb-2">📱</span>
              <span className="text-sm font-medium">WhatsApp</span>
            </a>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">FAQ</h2>

          <div className="space-y-2">
            {faqs.map(faq => (
              <div key={faq.id} className="border-b last:border-b-0">
                <button
                  onClick={() => setExpanded(expanded === faq.id ? null : faq.id)}
                  className="w-full py-3 flex items-center justify-between text-left"
                >
                  <span className="font-medium pr-4">{faq.question}</span>
                  <span
                    className={`transform transition-transform ${
                      expanded === faq.id ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {expanded === faq.id && (
                  <div className="pb-3 text-gray-600 text-sm">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">Kirim Pesan</h2>

          {message && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">{message}</div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subjek</label>
              <input
                type="text"
                value={contactForm.subject}
                onChange={e => setContactForm({ ...contactForm, subject: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="Subjek pesan Anda"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pesan</label>
              <textarea
                value={contactForm.message}
                onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full p-3 border rounded-lg h-32"
                placeholder="Jelaskan masalah atau pertanyaan Anda..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {submitting ? 'Mengirim...' : '📤 Kirim Pesan'}
            </button>
          </form>
        </div>

        {/* My Requests */}
        {!loading && requests.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-bold text-lg mb-4">Riwayat Pesan Saya</h2>
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{req.subject}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'open'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{req.message}</p>
                  {req.response && (
                    <div className="mt-2 p-2 bg-primary-50 rounded text-sm text-primary-800">
                      <strong>Balasan:</strong> {req.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
          <p>Financial Manager v2.0</p>
          <p>© 2026 All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
};

export default HelpSupport;
