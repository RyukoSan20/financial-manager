// The grouped sidebar.
//
// The flat list of twenty items is hard to scan: everything is the
// same weight, so the eye has to read every line to find anything.
// This groups the items by what they are for, so a reader looks at
// four headings instead of twenty lines.
//
// The grouping is behind the `NAV_V2` reader switch. With the switch
// off, the old flat list is what is shown, unchanged.
//
// The groups themselves live in `navGroups.js`, so that a script can
// check them without a browser.

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { visibleGroups } from './navGroups.js';
import { splitGroupItems, moreLabel } from './navDisclosure.js';

export {
  NAV_GROUPS,
  ADVANCED_PAGES,
  buildNavMap,
  isGroupedNavOn,
  isAdvancedOn,
  visibleGroups,
  isAdvancedPage,
  canSeePage,
} from './navGroups.js';

export default function GroupedNav({ navMap, icons }) {
  const location = useLocation();
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;
  const groups = visibleGroups(navMap);

  // Which groups the reader has opened. It is remembered for the
  // session, so a group the reader opened once does not close again
  // every time they move to another page.
  const [openedGroups, setOpenedGroups] = useState({});

  // The sidebar scrolls, and the group holding the page the reader is
  // on may be below the fold. Without this, a reader who arrived at
  // a page cannot see that the page is in the menu, because the
  // menu is scrolled to the top and the page is somewhere else.
  //
  // So the active item is brought into view once, when it changes.
  const activeRef = useRef(null);
  useEffect(() => {
    const node = activeRef.current;
    if (!node) return;

    // The sidebar is measured after it has been drawn, so scrolling
    // straight away lands on the wrong place: the list is still
    // settling and the item ends up just past the edge. Waiting for
    // the next frame lets the browser finish laying it out first.
    //
    // The scrolling is done on the sidebar itself, and not with
    // `scrollIntoView`, because that one scrolls the nearest
    // scrollable thing it can find, which here is the window. The
    // window does not scroll, so nothing moved and the item stayed
    // just past the edge of the sidebar.
    //
    // The list is still settling when this first runs: the groups
    // are laid out and the fonts are still being measured, so a
    // measurement taken now is wrong a moment later. The check is
    // therefore made again on the next frame, and once more after a
    // short wait, until the item is where it should be or the tries
    // run out.
    let tries = 0;
    let timer = null;

    const place = () => {
      const scroller = node.closest('nav') || node.parentElement;
      if (!scroller) return;

      const itemBox = node.getBoundingClientRect();
      const box = scroller.getBoundingClientRect();

      // The item is already in sight. Nothing to do, and scrolling
      // now would move the list under the reader for no reason.
      if (itemBox.top >= box.top - 1 && itemBox.bottom <= box.bottom + 1) return;

      const delta =
        itemBox.top < box.top ? itemBox.top - box.top - 8 : itemBox.bottom - box.bottom + 8;
      scroller.scrollTop += delta;

      tries += 1;
      if (tries < 4) {
        timer = setTimeout(place, 60);
      }
    };

    const frame = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [location.pathname]);

  return (
    <>
      {groups.map((group) => {
        // A long group shows the first few and keeps the rest behind
        // one line. The page the reader is on is always among the
        // ones shown, so it is never hidden inside the closed part.
        const { shown, hidden, hasMore, moreCount } = splitGroupItems(group.items, {
          activeHref: location.pathname,
        });

        return (
        <div key={group.key} className="mb-1">
          <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider dark:text-gray-300">
            {K[group.label]}
          </p>
          <div className="space-y-1">
            {shown.map((item) => {
              const Icon = icons[item.icon];
              const isActive =
                location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                    ref={isActive ? activeRef : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 font-medium shadow-sm dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`}
                >
                  {Icon ? <Icon className="w-5 h-5 flex-shrink-0" /> : null}
                  <span className="text-sm">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* The rest of the group, behind one line. */}
          {hasMore && !openedGroups[group.key] && (
            <button
              type="button"
              onClick={() => setOpenedGroups((open) => ({ ...open, [group.key]: true }))}
              className="w-full mt-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors duration-150 text-left"
            >
              {moreLabel(moreCount, language)}
            </button>
          )}

          {openedGroups[group.key] && hidden.length > 0 && (
            <div className="space-y-1">
              {hidden.map((item) => {
                const Icon = icons[item.icon];
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== '/' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    ref={isActive ? activeRef : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-50 text-primary-600 font-medium shadow-sm dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                    }`}
                  >
                    {Icon ? <Icon className="w-5 h-5 flex-shrink-0" /> : null}
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        );
      })}
    </>
  );
}
