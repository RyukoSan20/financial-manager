/**
 * What leaves this device.
 *
 * The facts are in `src/data/privacyManifest.js`, and a test checks
 * every one of them against the server code. This file is the screen
 * around them: it turns the manifest into words the reader can act on.
 *
 * Behind the polish switch, so a reader who has not asked for it sees
 * the same application they saw before.
 */

import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { batch7 } from '../../i18n/keys_batch7';
import { buildFlag } from '../../utils/featureFlags';
import {
  GOES_OUT,
  NEVER_SENT,
  STAYS_LOCAL,
} from '../../data/privacyManifest';
import { Eye, EyeOff, HardDrive, ShieldCheck, Send } from 'lucide-react';

export default function PrivacyPage() {
  const { language } = useTranslation();
  const polished = buildFlag('UI_POLISH');

  const K = batch7[language] || batch7.id;

  // Which outgoing entries have their detail open.
  const [open, setOpen] = useState({});

  if (!polished) return null;

  const toggle = (id) => setOpen((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="privacy-page" data-ui="polish">
      <header className="privacy-page__header">
        <h1>{K.privacy_page_title}</h1>
        <p>{K.privacy_page_subtitle}</p>
      </header>

      {/* What stays. */}
      <section className="privacy-section">
        <h2>
          <HardDrive size={18} aria-hidden="true" />
          {K.privacy_stays_heading}
        </h2>
        <ul className="privacy-list">
          {STAYS_LOCAL.map((entry) => (
            <li key={entry.id} className="privacy-item">
              <strong>{entry.what}</strong>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What goes out. */}
      <section className="privacy-section">
        <h2>
          <Send size={18} aria-hidden="true" />
          {K.privacy_out_heading}
        </h2>
        <ul className="privacy-list">
          {GOES_OUT.map((entry) => {
            const isOpen = Boolean(open[entry.id]);
            return (
              <li key={entry.id} className="privacy-item privacy-item--out">
                <div className="privacy-item__head">
                  <div className="privacy-item__title">
                    <strong>{entry.who}</strong>
                    <span
                      className={`privacy-badge${
                        entry.carries ? ' privacy-badge--carries' : ''
                      }`}
                    >
                      {entry.carries ? K.privacy_carries_yes : K.privacy_carries_no}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="privacy-toggle"
                    onClick={() => toggle(entry.id)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    {isOpen ? K.privacy_hide_detail : K.privacy_show_detail}
                  </button>
                </div>

                {isOpen && (
                  <dl className="privacy-detail">
                    <dt>{K.privacy_host_label}</dt>
                    <dd>{entry.host}</dd>
                    <dt>{K.privacy_what_label}</dt>
                    <dd>{entry.what}</dd>
                    <dt>{K.privacy_when_label}</dt>
                    <dd>{entry.when}</dd>
                    <dt>{K.privacy_why_label}</dt>
                    <dd>{entry.why}</dd>
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* What is never sent. */}
      <section className="privacy-section">
        <h2>
          <ShieldCheck size={18} aria-hidden="true" />
          {K.privacy_never_heading}
        </h2>
        <ul className="privacy-list">
          {NEVER_SENT.map((entry) => (
            <li key={entry.id} className="privacy-item">
              <strong>{entry.what}</strong>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="privacy-footer">{K.privacy_footer}</p>
    </div>
  );
}
