/**
 * The header every page has.
 *
 * Before this, every page wrote its own header: a different margin, a
 * different size for the title, a different gap under it, and the
 * subtitle in a different place each time. This is one shape for all
 * of them.
 *
 * It is used only where the polish switch is on. With the switch off,
 * the page keeps the header it already had, so nothing changes for
 * anyone who has not asked for it.
 */

/**
 * The header of a page.
 *
 * `title` is the name of the page. `subtitle` is the one line under
 * it, if the page has one. `action` is the button on the right, if
 * the page has one. `icon` is drawn to the left of the title.
 */
export const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  action,
  className = '',
  children,
}) => {
  return (
    <div
      className={`page-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon ? (
          <span className="shrink-0 mt-0.5 w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5" size={18} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="page-header__title text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {title}
          </h1>
          {subtitle ? (
            <p className="page-header__subtitle text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {action ? (
        <div className="flex items-center gap-2 shrink-0 sm:self-center">
          {action}
        </div>
      ) : null}

      {children}
    </div>
  );
};

/**
 * The header of a page, or the page's own header.
 *
 * The point of this is that a page does not have to know whether the
 * polish switch is on. It asks for its header, and gets either the
 * old one or the new one.
 *
 * `fallback` is the header the page already has. It is rendered
 * exactly as it was when the switch is off.
 */
export const PageHeaderOr = ({ polished, fallback, ...props }) => {
  if (!polished) return fallback;
  return <PageHeader {...props} />;
};

export default PageHeader;
