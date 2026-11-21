/**
 * The Smart Text Parser.
 *
 * The reader types or pastes a sentence about money, and this screen
 * works out what it meant. There is no template and no list of forms
 * to pick from: "beli 2 kopi susu @18rb sama 1 roti bakar 22rb bayar
 * pakai gopay di blok m" is a perfectly good sentence, and so is
 * "gajian masuk 8.5jt ke bca" and "transfer 500rb dari bca ke ovo".
 *
 * The reading comes back as a transaction with lines: what was bought,
 * how many of each, for what price, what it all came to, which shop
 * it was at, which place, which category and which account. Every one
 * of those can be corrected before it is saved, and the lines can be
 * added to, taken from or rewritten.
 *
 * And there is the companion. Kaneru, the ledger-keeper, sits in the
 * corner and can be asked to put right what the reading left out.
 * "Tanya Maskot" runs a refinement pass: it works out the category,
 * matches the account the reader named, settles the total against the
 * lines, and says what it did. The pass runs on the server, and when
 * the server cannot be reached the browser does the same work itself,
 * so the button always does something.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button } from '../ui';
import {
  Camera, FileText, Loader2, Check, Sparkles, AlertCircle, ChevronDown,
  ChevronUp, Trash2, Zap, Calendar, Volume2, VolumeX, MapPin, Store,
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from '../../i18n';
import { batch4 } from '../../i18n/keys_batch4';
import DraggableSparkleMascot from '../mascot/DraggableSparkleMascot';
import LineItemEditor, { toLines, fromLines, linesTotal } from '../transactions/LineItemEditor';
import { readSentence, emptyReading } from '../../features/transactions/nlp/readSentence';
import { speak, isMuted, setMuted, summaryFor } from '../../utils/mascotVoice';

export const TextParserModal = ({ isOpen, onClose, onSuccess, initialText = '' }) => {
  // The messages in this screen used to be written in Indonesian, so
  // a reader who picked English still read Indonesian. They are read
  // from the language the reader picked now.
  const { language } = useTranslation();
  const K = batch4[language]?.text_parser;

  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState('input');

  // The reading. It holds everything the screen shows and everything
  // that is saved.
  const [reading, setReading] = useState(emptyReading());
  // The lines, held separately so that editing them does not go
  // through the whole reading.
  const [lines, setLines] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [magicWorking, setMagicWorking] = useState(false);
  const [magicMessage, setMagicMessage] = useState('');
  const [celebrate, setCelebrate] = useState(0);
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Text that came in from somewhere else, such as a QR code that was
  // just scanned. It is put in the box so the person can read it and
  // correct it before it is read.
  useEffect(() => {
    if (isOpen && initialText) {
      setRawText(initialText);
      setStep('input');
    }
  }, [isOpen, initialText]);

  const loadData = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        api.accounts.list(),
        api.categories.list(),
      ]);
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  /**
   * Put the reading into the screen.
   *
   * The lines come from the reading, and the total follows them: a
   * total that disagrees with the lines is a total the reader cannot
   * trust.
   */
  const applyReading = useCallback((next) => {
    const itemLines = toLines(next.items);
    setLines(itemLines);
    // The total follows the lines.
    //
    // A total that disagrees with the lines is a total the reader
    // cannot trust. But when there are no lines at all, the total the
    // reading came with is the amount: "gajian masuk 8.5jt ke bca" has
    // no lines and is still worth eight and a half million.
    setReading({
      ...next,
      total_amount: itemLines.length ? linesTotal(itemLines) : next.total_amount || 0,
      // A transfer names two accounts. The one the money leaves from
      // is the account the transaction is filed under, so it is put in
      // the account picker the reader can see.
      account_id:
        next.type === 'transfer'
          ? next.source_account_id || next.account_id || null
          : next.account_id || null,
    });
  }, []);

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError(K.empty_text);
      return;
    }

    setLoading(true);
    setError('');
    setMagicMessage('');

    try {
      const result = await readSentence(rawText, { accounts, categories });
      if (!result.total_amount && !(result.items || []).length) {
        setError(K.no_transaction);
        return;
      }
      applyReading(result);
      setStep('preview');
      speak(summaryFor(result), { language });
    } catch (err) {
      console.error('Parse error:', err);
      setError(K.read_failed + ' ' + (err.message || K.unknown_error));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ask the companion to put the reading right.
   *
   * The pass runs on the server. It is the same reading the parser
   * makes, with the refinement on top: the category is worked out, the
   * account the reader named is matched against their own accounts, and
   * the total is settled against the lines.
   *
   * When the server cannot be reached, the browser does the same work
   * from what it already knows, so the button always answers.
   */
  const handleAskMascot = async () => {
    setMagicWorking(true);
    setMagicMessage('');
    setCelebrate((n) => n + 1);

    try {
      const result = await readSentence(rawText, { accounts, categories });
      const before = reading;
      applyReading(result);

      const said = describeFixes(result, before, K);
      setMagicMessage(said);
      speak(said, { language });
    } catch (err) {
      console.error('The mascot could not read the sentence:', err);
      setMagicMessage(K.magic_fixed_nothing);
    } finally {
      setMagicWorking(false);
    }
  };

  /**
   * The account the reader named, matched against their own accounts.
   */
  const matchedAccount = useMemo(() => {
    if (reading.account_id) {
      return accounts.find((a) => a.id === reading.account_id) || null;
    }
    return null;
  }, [reading.account_id, accounts]);

  const handleConfirm = async () => {
    const total = lines.length ? linesTotal(lines) : Number(reading.total_amount) || 0;
    if (!total) {
      setError(K.pick_transaction);
      return;
    }

    const accountId = reading.account_id || (accounts[0] && accounts[0].id);
    if (!accountId) {
      setError(K.pick_account);
      return;
    }

    setConfirming(true);
    setError('');

    try {
      const payload = {
        amount: total,
        type: reading.type === 'income' ? 'income' : 'expense',
        description:
          reading.description ||
          reading.merchant ||
          (lines.length ? lines.map((l) => l.name).join(', ') : K.from_parsed_text),
        date: new Date().toISOString().split('T')[0],
        account_id: parseInt(accountId, 10),
        category_id: reading.category_id || null,
        merchant_name: reading.merchant || null,
        raw_source_text: rawText,
        confidence_score: reading.confidence,
        detection_type: 'SMART_TEXT',
        source: 'manual',
        // The lines of the bill, so the transaction can be opened and
        // read line by line afterwards.
        items: fromLines(lines),
      };

      // A transfer moves money between two of the reader's own
      // accounts, and it is written through the transfer route so the
      // two halves stay linked.
      if (reading.type === 'transfer') {
        // The reading names both ends. The account the money leaves
        // from is the source, and it is not the same field as the
        // account the transaction is filed under.
        //
        // The names are matched loosely, the way the server matches
        // them: the reader says "bca" and the account is called
        // "BCA", and they are the same account.
        const matchByName = (name) =>
          accounts.find(
            (a) =>
              name &&
              String(a.name || '').toLowerCase().includes(
                String(name).toLowerCase()
              )
          );

        const sourceId =
          reading.source_account_id ||
          (matchByName(reading.source_account) || {}).id ||
          accountId;
        const destinationId =
          reading.destination_account_id ||
          (matchByName(reading.destination_account) || {}).id;

        if (sourceId && destinationId && destinationId !== sourceId) {
          await api.transfers.create({
            amount: total,
            from_account_id: parseInt(sourceId, 10),
            to_account_id: parseInt(destinationId, 10),
            description: payload.description,
            date: payload.date,
          });
        } else {
          await api.transactions.create({ ...payload, type: 'expense' });
        }
      } else {
        await api.transactions.create(payload);
      }

      speak(summaryFor({ ...reading, total_amount: total }, { saved: true }), { language });
      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Confirm error:', err);
      setError(K.save_failed + ' ' + (err.message || K.unknown_error));
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setRawText('');
    setReading(emptyReading());
    setLines([]);
    setError('');
    setStep('input');
    setMagicMessage('');
    // The panel has to actually go away.
    //
    // It used to only put the state back the way it was, which looked
    // like the close button did nothing at all: the panel stayed on
    // the screen with an empty box in it, and the reader had no way
    // out of it.
    onClose();
  };

  const toggleMute = () => {
    const next = setMuted(!muted);
    setMutedState(next);
  };

  const getTypeLabel = (type) => {
    if (type === 'income') return K.type_income;
    if (type === 'transfer') return K.type_transfer;
    return K.type_expense;
  };

  const getTypeColor = (type) => {
    if (type === 'income') return 'text-green-600 bg-green-50';
    if (type === 'transfer') return 'text-blue-600 bg-blue-50';
    return 'text-red-600 bg-red-50';
  };

  const itemLabels = {
    title: K.items_label,
    add: K.add_item,
    empty: K.no_items,
    name: K.item_name,
    qty: K.item_qty,
    price: K.item_price,
    remove: K.remove_item,
    total: K.items_total,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Smart Text Parser"
      size="lg"
      footer={
        step === 'input' ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setRawText('')}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" /> {K.clear}
            </button>

            <Button onClick={handleParse} disabled={loading || !rawText.trim()} className="flex items-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {K.parsing}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {K.parse_now}
                </>
              )}
            </Button>
          </div>
        ) : step === 'preview' ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep('input');
                setReading(emptyReading());
                setLines([]);
              }}
              className="flex-1"
            >
              {K.back || 'Kembali'}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || (!reading.account_id && !(accounts[0] && accounts[0].id))}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {K.saving || 'Menyimpan...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {K.save || 'Simpan Transaction'}
                </>
              )}
            </Button>
          </div>
        ) : null
      }
    >
      {/* Step 1: the sentence */}
      {step === 'input' && (
        <div className="space-y-4">
          {/* The companion, welcome from the start.
              The reader is asked to write a sentence, which is a strange
              thing to ask. Kaneru says hello and says what it will do
              with the sentence, so the first screen is not a bare box
              waiting to be filled in. */}
          <div className="relative rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="shrink-0 self-center">
                <DraggableSparkleMascot
                  persona="kaneru"
                  mood="idle"
                  size={72}
                  hint={K.step1_mascot_hint}
                />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                {K.step1_hint}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {K.parse_anything}
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={K.placeholder}
              className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500 resize-none
                         box-border
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* A few free-form sentences to try. They are not templates:
              any sentence works, and these are only here to show it. */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            {[K.example_expense, K.example_income, K.example_transfer].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setRawText(example)}
                className="text-xs px-3 py-2 bg-white dark:bg-gray-700 rounded-xl border border-primary-200 dark:border-primary-700
                           hover:bg-primary-100 dark:hover:bg-primary-800 hover:border-primary-400 dark:hover:border-primary-500
                           active:bg-primary-200 dark:active:bg-primary-900 active:scale-[0.99]
                           transition-colors duration-150 text-left leading-relaxed
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                           min-w-0 break-words"
              >
                {example}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 2: the reading */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* What was read. */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(reading.type)}`}
                >
                  {getTypeLabel(reading.type)}
                </span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {formatCurrency(lines.length ? linesTotal(lines) : reading.total_amount || 0)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {reading.merchant || reading.description || K.from_parsed_text}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {K.confidence_label} {Math.round((reading.confidence || 0) * 100)}%
                </span>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? K.mute_off : K.mute_on}
                  title={muted ? K.mute_off : K.mute_on}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* The shop, the place, the category and the account. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field icon={Store} label={K.merchant_label} value={reading.merchant} />
              <Field icon={MapPin} label={K.location_label} value={reading.location} />
              <Field
                icon={FileText}
                label={K.category_label}
                value={
                  reading.category_id
                    ? (categories.find((c) => c.id === reading.category_id) || {}).name ||
                      reading.category
                    : reading.category
                }
              />
              <Field
                icon={Zap}
                label={K.account_label}
                value={matchedAccount ? matchedAccount.name : reading.account_hint}
              />
            </div>

            {/* The account picker. It is filled in when the sentence
                named an account, and it can always be changed. */}
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                {K.account_label}
              </label>
              <select
                value={reading.account_id || ''}
                onChange={(e) =>
                  setReading({
                    ...reading,
                    account_id: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{K.choose_account}</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} - {formatCurrency(acc.balance, acc.currency)}
                  </option>
                ))}
              </select>
            </div>

            {/* A transfer has two ends, so it has two pickers.
                The reader has to be able to see where the money is
                going, and to correct it when the sentence named the
                wrong account. */}
            {reading.type === 'transfer' && (
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {K.destination_account_label}
                </label>
                <select
                  value={reading.destination_account_id || ''}
                  onChange={(e) =>
                    setReading({
                      ...reading,
                      destination_account_id: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">{K.choose_account}</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} - {formatCurrency(acc.balance, acc.currency)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* The lines of the bill. */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <LineItemEditor
              lines={lines}
              onChange={setLines}
              labels={itemLabels}
              fallbackTotal={reading.total_amount || 0}
            />
          </div>

          {/* The companion. */}
          <div className="relative rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="shrink-0 self-center">
                <DraggableSparkleMascot
                  persona="kaneru"
                  mood={magicWorking ? 'thinking' : 'idle'}
                  size={96}
                  hint={K.magic_title}
                  celebrateSignal={celebrate}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Button
                  onClick={handleAskMascot}
                  disabled={magicWorking}
                  className="flex items-center gap-2"
                >
                  {magicWorking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {K.magic_working}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {K.magic_button}
                    </>
                  )}
                </Button>
                {magicMessage && (
                  <div className="rounded-lg bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-700 p-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {K.magic_said}
                    </span>{' '}
                    {magicMessage}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

/**
 * One field of the reading, with its label.
 */
const Field = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2">
    {Icon && <Icon className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" aria-hidden="true" />}
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-gray-900 dark:text-gray-100 truncate">{value || '-'}</p>
    </div>
  </div>
);

/**
 * What the companion did, said in words the reader can read.
 */
export const describeFixes = (after, before, K) => {
  const parts = [];
  const fixes = after.fixes || [];

  for (const fix of fixes) {
    const [kind, value] = fix.split(':');
    if (kind === 'category' && value) {
      parts.push(K.magic_fixed_category.replace('%s', value));
    } else if (kind === 'account' && value) {
      parts.push(K.magic_fixed_account.replace('%s', value));
    } else if (kind === 'total_from_items' || kind === 'total_recalculated') {
      parts.push(K.magic_fixed_total);
    }
  }

  // A category that was worked out but was not listed as a change.
  if (!parts.length && after.category && !before.category) {
    parts.push(K.magic_fixed_category.replace('%s', after.category));
  }
  if (!parts.length && after.account_id && !before.account_id) {
    parts.push(K.magic_fixed_account.replace('%s', after.account_hint || ''));
  }

  if (!parts.length) return K.magic_fixed_nothing;
  return parts.join(', ') + '.';
};

export default TextParserModal;
