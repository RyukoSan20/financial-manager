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
 * "BBM & Parkir", "Pakaian". The reader chooses one, or makes one
 * of their own.
 *
 * The parent is what is recorded, because that is what the budget and
 * the report already understand. The sub-category is what the reader
 * chose, and it travels with the transaction.
 */

import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Check } from 'lucide-react';

import { subCategoriesFor } from '../../features/transactions/nlp/subCategories.js';
import { categoryName } from '../../utils/categoryName';

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
  onClose,
}) {
  const [expanded, setExpanded] = useState({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

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

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full bg-white dark:bg-gray-800 rounded-t-3xl max-h-[85vh] flex flex-col">
        <div className="shrink-0 p-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            Pilih Kategori
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Pilih kategori induk, lalu sub-kategori yang lebih spesifik.
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
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {name}
                    </span>
                    {selectedId === cat.id && !subKey ? (
                      <Check className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                    ) : null}
                  </button>
                </div>

                {isOpen ? (
                  <div className="px-3 pb-3 space-y-1">
                    {subs.map((sub) => (
                      <button
                        key={sub.key}
                        type="button"
                        onClick={() => {
                          onPick(cat.id);
                          onPickSub(sub.key);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 ${
                          selectedId === cat.id && subKey === sub.key
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 font-medium'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate">{sub.name}</span>
                        {selectedId === cat.id && subKey === sub.key ? (
                          <Check className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}

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
                        <span className="truncate">{categoryName(child, language)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* The categories with nothing under them. */}
          {withoutSubs.length ? (
            <div className="pt-2 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 px-1">
                Lainnya
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
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
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
                  placeholder="Nama kategori baru"
                  aria-label="Nama kategori baru"
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={submitNew}
                  className="px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-medium shrink-0"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium shrink-0"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                data-testid="create-category"
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-white/20 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:border-primary-400 transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Buat Kategori Sendiri
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
