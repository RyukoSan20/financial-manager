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

import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { visibleGroups } from './navGroups.js';
import { auroraNavClass } from '../ui/AuroraCard';

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

  return (
    <>
      {groups.map((group) => (
        <div key={group.key} className="mb-1">
          <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider dark:text-gray-300">
            {K[group.label]}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = icons[item.icon];
              const isActive =
                location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${auroraNavClass({ active: isActive })}`}
                >
                  {Icon ? <Icon className="w-5 h-5 flex-shrink-0" /> : null}
                  <span className="text-sm">{item.name}</span>
                  {isActive && (
                    <div className="aurora-active-dot ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
