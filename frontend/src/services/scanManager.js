/**
 * Background scan client.
 *
 * Scanning a receipt takes a while. The user should not have to sit and
 * watch a spinner, so the scan is queued on the server and the client
 * polls for the result. When it arrives, a notification appears that the
 * user can tap or swipe up to open the result.
 *
 * The same flow is used for a receipt image, a photo taken with the
 * camera, and a QR code read with the camera.
 */
import { apiUrl } from '../config/url';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120000;

const tokenOf = () =>
  localStorage.getItem('token') ||
  localStorage.getItem('sb_token') ||
  localStorage.getItem('access_token');

const authHeaders = () => {
  const token = tokenOf();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * A scan that is running, or has finished, in the background.
 */
class ScanManager {
  constructor() {
    /** job_id -> { kind, status, progress, message, result, error, startedAt } */
    this.jobs = new Map();
    this.listeners = new Set();
    this.timers = new Map();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.list();
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('Scan listener failed:', err);
      }
    });
  }

  list() {
    return Array.from(this.jobs.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  update(jobId, patch) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    Object.assign(job, patch);
    this.emit();
  }

  /**
   * Queue a receipt image for scanning.
   */
  async scanReceipt(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.start('receipt', 'scans/receipt', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Queue a QR code text for parsing.
   */
  async scanQr(text) {
    return this.start('qr', 'scans/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  }

  async start(kind, path, options) {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });

    if (!response.ok) {
      let detail = `Scan gagal (${response.status})`;
      try {
        const body = await response.json();
        detail = body.detail || detail;
      } catch (err) {
        /* the body was not JSON */
      }
      throw new Error(detail);
    }

    const data = await response.json();
    const jobId = data.job_id;

    this.jobs.set(jobId, {
      jobId,
      kind,
      status: data.status || 'queued',
      progress: 0,
      message: 'Menunggu server...',
      result: null,
      error: null,
      startedAt: Date.now(),
    });
    this.emit();

    this.poll(jobId);
    return jobId;
  }

  poll(jobId) {
    const startedAt = Date.now();

    const tick = async () => {
      const job = this.jobs.get(jobId);
      if (!job) return;

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        this.update(jobId, {
          status: 'failed',
          error: 'Waktu tunggu habis. Coba lagi dengan gambar yang lebih jelas.',
        });
        this.timers.delete(jobId);
        return;
      }

      try {
        const response = await fetch(apiUrl(`scans/${jobId}`), {
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        this.update(jobId, {
          status: data.status,
          progress: data.progress ?? 0,
          message: data.message || '',
          result: data.result || null,
          error: data.error || null,
        });

        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          this.timers.delete(jobId);
          return;
        }
      } catch (err) {
        // A single failed poll is not fatal; the next one may work.
        console.warn('Scan poll failed:', err.message);
      }

      this.timers.set(jobId, setTimeout(tick, POLL_INTERVAL_MS));
    };

    this.timers.set(jobId, setTimeout(tick, 400));
  }

  /**
   * Remove a finished job from the list.
   */
  dismiss(jobId) {
    this.jobs.delete(jobId);
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
    this.emit();
  }

  /**
   * The finished jobs that have not been looked at yet.
   */
  unseenCompleted() {
    return this.list().filter((job) => job.status === 'completed' && !job.seen);
  }

  markSeen(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.seen = true;
      this.emit();
    }
  }

  /**
   * Load the jobs that ran while the app was closed, so a finished scan
   * is not lost.
   */
  async restore() {
    try {
      const response = await fetch(apiUrl('scans/'), { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      (data.jobs || []).forEach((job) => {
        if (this.jobs.has(job.job_id)) return;
        this.jobs.set(job.job_id, {
          jobId: job.job_id,
          kind: job.kind,
          status: job.status,
          progress: job.progress || 0,
          message: job.message || '',
          result: job.result || null,
          error: job.error || null,
          startedAt: job.created_at ? new Date(job.created_at).getTime() : Date.now(),
          seen: job.status !== 'completed',
        });
      });
      this.emit();
    } catch (err) {
      console.warn('Could not restore scan jobs:', err.message);
    }
  }
}

export const scanManager = new ScanManager();

/**
 * Turn a base64 data URL into a File, so it can be sent as multipart.
 */
export const dataUrlToFile = async (dataUrl, name = 'receipt.jpg') => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
};
