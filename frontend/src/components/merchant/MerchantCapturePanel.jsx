import { useRef, useState } from 'react';
import { Camera, Check, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { batch12 } from '../../i18n/keys_batch12';
import { toast } from '../../contexts/ToastContext';
import merchantApi from '../../services/merchantApi';

/**
 * Taking a product off a photograph.
 *
 * The shop owner photographs the goods. This reads the picture and
 * hands back a draft: the name, the price, the category, the unit, and
 * how sure the reader is.
 *
 * The draft is not a product. It is shown next to the picture it was
 * read from, with a warning when the price could not be read, and the
 * owner presses the button that saves it. The reason for that care is
 * simple: a reading is a guess, and the wrong guess gets sold at.
 *
 * The picture is kept beside the draft so the owner can check the
 * label against what was read. That is the whole point of showing
 * them both.
 */

function confidenceLabel(key, confidence, K) {
  if (confidence >= 0.75) return K.capture.confidenceHigh;
  if (confidence >= 0.4) return K.capture.confidenceMedium;
  return K.capture.confidenceLow;
}

function confidenceTone(confidence) {
  if (confidence >= 0.75) return 'is-high';
  if (confidence >= 0.4) return 'is-medium';
  return 'is-low';
}

export default function MerchantCapturePanel({ merchant, onSaved }) {
  const { language } = useTranslation();
  const K = batch12[language]?.merchant || batch12.id.merchant;

  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  const reset = () => {
    setDraft(null);
    setPreview(null);
    setError('');
  };

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !merchant?.id) return;

    reset();
    setReading(true);

    // The picture is shown while it is being read, so that the owner
    // can see it is the picture they took.
    const local = URL.createObjectURL(file);
    setPreview(local);

    try {
      const answer = await merchantApi.captureProduct(merchant.id, file);
      const next = answer?.draft || null;
      setDraft(next);
      if (!next) setError(K.capture.failed);
    } catch (err) {
      setError(K.capture.failed);
    } finally {
      setReading(false);
      URL.revokeObjectURL(local);
    }
  };

  const save = async () => {
    if (!draft || !merchant?.id) return;
    if (draft.price === null || draft.price === undefined || draft.price === '') {
      // The price is what the product is sold at. A draft without one
      // is not saved, because the owner would have to type it in the
      // catalogue anyway.
      setError(K.capture.noPrice);
      return;
    }
    setSaving(true);
    try {
      // The shelf, and not the older catalogue table.
      //
      // The catalogue reads from the shelf table, so a product that
      // was written to the older table was in the books and nowhere
      // a reader could see it. The field names follow: a thing on the
      // shelf is priced in unit_price and counted in stock_quantity.
      await merchantApi.createProduct(merchant.id, {
        name: draft.name,
        sku: draft.sku || '',
        category: draft.category || '',
        unit_of_measure: draft.unit || 'pcs',
        unit_price: draft.price,
        stock_quantity: 0,
        image_url: draft.image_url || '',
        is_active: true,
      });
      toast.success(K.capture.used);
      reset();
      onSaved?.();
    } catch (err) {
      toast.error(K.catalog.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="merchant-capture" aria-label={K.capture.title}>
      <header className="merchant-capture__head">
        <Sparkles size={16} aria-hidden="true" />
        <div>
          <h3>{K.capture.title}</h3>
          <p>{K.capture.hint}</p>
        </div>
      </header>

      <div className="merchant-capture__actions">
        <button
          type="button"
          className="is-primary merchant-capture__choose"
          onClick={() => fileInput.current?.click()}
          disabled={reading}
        >
          <Camera size={15} aria-hidden="true" />
          <span>{reading ? K.capture.taking : K.capture.choose}</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pick}
          hidden
        />
        {draft && (
          <button type="button" onClick={reset} className="merchant-capture__discard">
            <Trash2 size={14} aria-hidden="true" />
            <span>{K.capture.discard}</span>
          </button>
        )}
      </div>

      {reading && (
        <p className="merchant-capture__status">{K.capture.reading}</p>
      )}

      {error && <p className="merchant-capture__error">{error}</p>}

      {draft && (
        <div className="merchant-capture__draft">
          {preview && (
            <img className="merchant-capture__preview" src={preview} alt={K.capture.preview} />
          )}
          <div className="merchant-capture__body">
            <p className="merchant-capture__draft-title">{K.capture.draftTitle}</p>
            <p className="merchant-capture__draft-hint">{K.capture.draftHint}</p>

            <dl className="merchant-capture__fields">
              <div>
                <dt>{K.catalog.name}</dt>
                <dd>{draft.name}</dd>
              </div>
              {draft.brand && (
                <div>
                  <dt>{K.capture.brandLabel}</dt>
                  <dd>{draft.brand}</dd>
                </div>
              )}
              <div>
                <dt>{K.catalog.price}</dt>
                <dd>{draft.price === null ? '—' : draft.price}</dd>
              </div>
              {draft.size && (
                <div>
                  <dt>{K.capture.sizeLabel}</dt>
                  <dd>{draft.size}</dd>
                </div>
              )}
              <div>
                <dt>{K.capture.categoryLabel}</dt>
                <dd>{draft.category}</dd>
              </div>
              <div>
                <dt>{K.catalog.unit}</dt>
                <dd>{draft.unit}</dd>
              </div>
            </dl>

            <p className={`merchant-capture__confidence ${confidenceTone(draft.confidence)}`}>
              {K.capture.confidence}: {confidenceLabel(null, draft.confidence, K)}
            </p>

            {draft.price === null && (
              <p className="merchant-capture__error">{K.capture.noPrice}</p>
            )}

            {(draft.warnings || []).map((warning) => (
              <p className="merchant-capture__warning" key={warning}>
                {warning}
              </p>
            ))}

            <button
              type="button"
              className="is-primary merchant-capture__use"
              onClick={save}
              disabled={saving}
            >
              <Check size={15} aria-hidden="true" />
              <span>{saving ? K.catalog.saving : K.capture.use}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export { MerchantCapturePanel };
