/**
 * The category tree.
 *
 * The category sheet was a long flat list: "Belanja", "Kesehatan",
 * "Pendidikan" and so on, one after another, with nothing under them.
 * A reader who wants to say "Kopi & Kafe" had nowhere to say it, and
 * a reader who wanted to make a category of their own had no button
 * to press.
 *
 * So the sheet is a tree now. Each category is a heading, and the
 * sub-categories sit under it. The sub-categories are the words a
 * reader would use for the things they actually buy: "Kopi & Kafe",
 * "BBM & Bensin", "Pakaian & Fashion". The reader chooses one, or
 * makes one of their own.
 *
 * The parent is what is recorded, because that is what the budget and
 * the report already understand. The sub-category is what the reader
 * chose, and it travels with the transaction.
 *
 * And the tree depends on the kind of transaction: an expense is
 * offered food and transport, an income is offered a salary and
 * dividends, and a transfer is offered the moving of money between
 * accounts. A reader adding an expense was being offered "Gaji".
 */

import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Check } from 'lucide-react';

import { subCategoriesFor } from '../../features/transactions/nlp/subCategories.js';
import { categoryName } from '../../utils/categoryName';
import { useTranslation } from '../../i18n';

/**
 * The sheet.
 *
 * `categories` are the categories the reader has. `selectedId` is the
 * one that is chosen now. `subKey` is the sub-category under it.
 */
export default function CategoryTreeSheet({
  categories = [],
  selectedId,
  subKey,
  type = 'expense',
  language = 'id',
  onPick,
  onPickSub,
  onCreate,
  onCreateSub,
  onClose,
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  // The category the new sub-category is made under. It is the one
  // that is open when the reader presses the button, because that is
  // the one they are looking at.
  const [newSubParent, setNewSubParent] = useState(null);

  // The categories of this kind of transaction.
  //
  // The sheet used to show every category whatever the reader was
  // recording, so a reader adding an expense was offered "Gaji".
  const forThisType = useMemo(
    () =>
      categories.filter((cat) => {
        if (!cat.type) return true;
        if (type === 'expense') return cat.type !== 'income';
        if (type === 'income') return cat.type !== 'expense';
        return true;
      }),
    [categories, type]
  );

  // The ones that have sub-categories under them, and the ones that
  // do not. The reader's own categories are shown with what is under
  // them.
  const withSubs = useMemo(
    () =>
      forThisType.filter((cat) => {
        if (cat.parent_id) return false;
        const subs = subCategoriesFor(cat.system_key);
        const children = forThisType.filter((child) => child.parent_id === cat.id);
        return subs.length > 0 || children.length > 0;
      }),
    [forThisType]
  );

  const withoutSubs = useMemo(
    () =>
      forThisType.filter((cat) => {
        if (cat.parent_id) return false;
        const subs = subCategoriesFor(cat.system_key);
        const children = forThisType.filter((child) => child.parent_id === cat.id);
        return subs.length === 0 && children.length === 0;
      }),
    [forThisType]
  );

  const toggle = (id) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  };

  const submitNew = async () => {
    const name = newName.trim();
    if (!name || !onCreate) return;
    await onCreate(name);
    setNewName('');
    setCreating(false);
  };

  const submitNewSub = async () => {
    const name = newName.trim();
    if (!name || !onCreateSub || !newSubParent) return;
    await onCreateSub(newSubParent, name);
    setNewName('');
    setNewSubParent(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full bg-white dark:bg-gray-800 rounded-t-3xl max-h-[85vh] flex flex-col">
        <div className="shrink-0 p-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            {t('category_tree.title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('category_tree.subtitle')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {withSubs.map((cat) => {
            const isOpen = expanded[cat.id];
            const subs = subCategoriesFor(cat.system_key);
            const children = forThisType.filter((child) => child.parent_id === cat.id);
            const name = categoryName(cat, language);

            return (
              <div key={cat.id} className="rounded-xl border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(cat.id)}
                    aria-expanded={!!isOpen}
                    aria-label={`${name}`}
                    className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick(cat.id)}
                    className={`flex-1 min-w-0 text-left px-2 py-2.5 rounded-lg flex items-center gap-2 ${
                      selectedId === cat.id && !subKey
                        ? 'bg-primary-50 dark:bg-primary-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {cat.icon || '📦'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words">
                      {name}
                    </span>
                    {selectedId === cat.id && !subKey ? (
                      <Check className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                    ) : null}
                  </button>
                </div>

                {isOpen ? (
                  <div className="px-3 pb-3 space-y-1">
                    {/* The sub-categories, as a pastel pill grid.

                        A tall list of lines is a list of things to
                        read. A grid of pills is a set of choices, and
                        the reader can see them all at once.

                        Each pill says its own name in full. Nothing is
                        shortened to fit, and nothing is cut off at
                        the edge of the card: a sub-category the
                        reader cannot read the whole of is a
                        sub-category they will not choose. */}
                    {subs.length ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-emerald-50/40 dark:bg-emerald-900/10 rounded-xl mt-2">
                        {subs.map((sub) => {
                          const isSelected = selectedId === cat.id && subKey === sub.key;
                          return (
                            <button
                              key={sub.key}
                              type="button"
                              onClick={() => {
                                onPick(cat.id);
                                onPickSub(sub.key);
                              }}
                              aria-pressed={isSelected}
                              className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center justify-between gap-2 transition-[color,background-color,border-color,box-shadow,transform] duration-150 text-left ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500'
                                  : 'border-slate-200 bg-white dark:border-white/10 dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-900 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer'
                              }`}
                            >
                              <span className="min-w-0 whitespace-normal break-words">
                                {sub.name}
                              </span>
                              {isSelected ? (
                                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* The categories the reader made themselves, under
                        the category they made them under. */}
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => {
                          onPick(child.id);
                          onPickSub(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                          selectedId === child.id
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 font-medium'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <span aria-hidden="true">{child.icon || '🏷️'}</span>
                        <span className="whitespace-normal break-words">{categoryName(child, language)}</span>
                      </button>
                    ))}

                    {/* A sub-category of the reader's own, under this
                        category. */}
                    {onCreateSub ? (
                      newSubParent === cat.id ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitNewSub();
                              if (e.key === 'Escape') setNewSubParent(null);
                            }}
                            placeholder={t('category_tree.new_sub_placeholder')}
                            aria-label="Nama sub-kategori baru"
                            autoFocus
                            className="flex-1 min-w-0 px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                          />
                          <button
                            type="button"
                            onClick={submitNewSub}
                            className="px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-medium shrink-0"
                          >
                            {t('category_tree.save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewSubParent(null);
                              setNewName('');
                            }}
                            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium shrink-0"
                          >
                            {t('category_tree.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setNewSubParent(cat.id);
                            setNewName('');
                            setCreating(false);
                          }}
                          data-testid="create-sub-category"
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mt-1 rounded-lg border border-dashed border-gray-300 dark:border-white/20 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:border-primary-400 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          {t('category_tree.create_sub')}
                        </button>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* The categories with nothing under them. */}
          {withoutSubs.length ? (
            <div className="pt-2 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 px-1">
                {t('category_tree.others')}
              </p>
              {withoutSubs.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onPick(cat.id);
                    onPickSub(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 ${
                    selectedId === cat.id
                      ? 'bg-primary-50 dark:bg-primary-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-xl" aria-hidden="true">
                    {cat.icon || '📦'}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words">
                    {categoryName(cat, language)}
                  </span>
                  {selectedId === cat.id ? (
                    <Check className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* A category of the reader's own. */}
          <div className="pt-3 border-t border-gray-100 dark:border-white/10">
            {creating ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNew();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  placeholder={t('category_tree.new_cat_placeholder')}
                  aria-label="Nama kategori baru"
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={submitNew}
                  className="px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-medium shrink-0"
                >
                  {t('category_tree.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium shrink-0"
                >
                  {t('category_tree.cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setNewSubParent(null);
                }}
                data-testid="create-category"
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-white/20 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:border-primary-400 transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                {t('category_tree.create_own')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
