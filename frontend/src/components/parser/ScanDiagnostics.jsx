/**
 * Scan diagnostics + self-learning panel for the receipt scanner.
 *
 * ScanDiagnostics explains how the image was processed: which restored
 * variant won, what defects were detected in the photo, and which parser
 * produced the result. This turns "the scan looks wrong" into an
 * actionable message.
 *
 * LearnFromScan lets the user confirm the item names that were read. Every
 * confirmed term is written into the product catalogue, so the recogniser
 * learns the vocabulary that actually appears on this user's receipts
 * without anyone maintaining a dictionary by hand.
 */
import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { apiUrl } from '../../config/url';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

// Human-readable labels for the issue codes the backend reports.
const ISSUE_LABELS = {
  gambar_buram: 'Foto buram',
  gambar_gelap: 'Foto terlalu gelap',
  kontras_rendah: 'Kontras rendah',
  bayangan: 'Ada bayangan',
  gambar_tidak_dapat_dibaca: 'Gambar tidak dapat dibaca',
  opencv_tidak_tersedia: 'OpenCV tidak tersedia',
};

const RESTORATION_LABELS = {
  untouched: 'gambar asli',
  upscaled: 'diperbesar',
  perspective_rectified: 'perspective dikoreksi',
  deskewed: 'dirotasi',
  illumination_flattened: 'pencahayaan diratakan',
};

const QUALITY_STYLES = {
  good: 'border-green-200 bg-green-50 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
  fair: 'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300',
  poor: 'border-red-200 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
};

export const ScanDiagnostics = ({ diagnostics }) => {
  const { language } = useTranslation();
  const K = batch3[language]?.scan_diagnostics;
  const [expanded, setExpanded] = useState(false);

  if (!diagnostics || typeof diagnostics !== 'object') return null;

  const quality = diagnostics.quality || {};
  const issues = quality.issues || [];
  const restoration = diagnostics.restoration || [];
  const variants = diagnostics.variants_tried || [];
  const best = diagnostics.best_variant;

  // Nothing worth showing.
  if (!issues.length && !restoration.length && !variants.length) return null;

  const severity = quality.severity || 'good';
  const style = QUALITY_STYLES[severity] || QUALITY_STYLES.good;

  return (
    <div className={`rounded-lg border p-3 text-sm ${style}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 font-medium">
          {severity === 'good' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          {issues.length > 0
            ? `Kualitas foto: ${issues.map((i) => ISSUE_LABELS[i] || i).join(', ')}`
            : 'Pemrosesan gambar berhasil'}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-current/20 space-y-2 text-xs">
          {best && (
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 flex-shrink-0" />
              <span>
                {K.best_variant} <strong>{best}</strong>
              </span>
            </div>
          )}

          {restoration.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Wrench className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                Perbaikan:{' '}
                <strong>
                  {restoration.map((r) => RESTORATION_LABELS[r] || r).join(', ')}
                </strong>
              </span>
            </div>
          )}

          {variants.length > 0 && (
            <div>
              <p className="font-medium mb-1">{K.tested_variants}</p>
              <ul className="space-y-0.5">
                {variants.map((v) => (
                  <li key={v.name} className="flex justify-between gap-2">
                    <span>{v.name}</span>
                    <span className="opacity-70">
                      {v.lines} baris · {v.confidence}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quality.sharpness !== undefined && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 opacity-80">
              <span>Ketajaman: {Math.round(quality.sharpness)}</span>
              <span>Terang: {Math.round(quality.brightness)}</span>
              <span>Kontras: {Math.round(quality.contrast)}</span>
              <span>Miring: {quality.skew_deg}°</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const LearnFromScan = ({ items, onLearned }) => {
  const { language } = useTranslation();
  const K = batch3[language]?.scan_diagnostics;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState({});

  const names = (items || [])
    .map((i) => i.name || i.raw_name)
    .filter(Boolean);

  if (!names.length) return null;

  const handleToggle = (name) => {
    setConfirmed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleLearn = async () => {
    const terms = Object.keys(confirmed).filter((k) => confirmed[k]);
    if (!terms.length) return;

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(apiUrl('learning/learn'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token')
            ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
            : {}),
        },
        body: JSON.stringify({ terms }),
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }
      const data = await response.json();
      setStatus({ ok: true, message: data.message || `${terms.length} istilah disimpan` });
      onLearned?.(terms);
    } catch (err) {
      console.error('Learn terms failed:', err);
      setStatus({ ok: false, message: err?.message || 'Gagal menyimpan istilah' });
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = Object.values(confirmed).filter(Boolean).length;

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-800 p-3 text-sm text-primary-900 dark:text-primary-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left font-medium"
      >
        <span className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 flex-shrink-0" />
          Ajarkan nama produk ini ke sistem
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-current/20 space-y-2">
          <p className="text-xs opacity-80">
            Centang nama yang benar agar scan berikutnya mengenalinya, termasuk
            produk yang belum pernah dilihat sistem.
          </p>

          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {names.map((name) => (
              <li key={name}>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={!!confirmed[name]}
                    onChange={() => handleToggle(name)}
                    className="rounded border-gray-300"
                  />
                  <span className="truncate">{name}</span>
                </label>
              </li>
            ))}
          </ul>

          {status && (
            <p
              className={`text-xs ${
                status.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
              }`}
            >
              {status.message}
            </p>
          )}

          <button
            onClick={handleLearn}
            disabled={busy || selectedCount === 0}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            {K.save_terms} ({selectedCount})
          </button>
        </div>
      )}
    </div>
  );
};

export default ScanDiagnostics;
