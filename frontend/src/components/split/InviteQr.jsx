/**
 * The invite, as a picture.
 *
 * A host who wants everybody at the table to join the bill has two
 * ways of doing it: send the link in the chat, or show the phone.
 *
 * Sending the link in the chat is the usual way. Showing the phone
 * is the way that works when the chat is a group chat that two of
 * them have muted, or when somebody is standing next to the host and
 * neither of them wants to type a long address. A phone camera reads
 * a QR code without anybody installing anything, which is the whole
 * point: the guests are not going to install an application to
 * settle a dinner bill.
 *
 * The code is drawn here, in the page, from the link. It is not
 * fetched from anywhere, so the link that lets a stranger into the
 * group never leaves the reader's own device.
 */

import { useMemo, useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';
import { qrToSvg } from './qr';
import { useTranslation } from '../../i18n';
import { batch9 } from '../../i18n/keys_batch9';

/**
 * The WhatsApp link.
 *
 * This is how a link is shared on WhatsApp: the address of WhatsApp,
 * a slash, a question mark, the word text, an equals sign, and the
 * message written out with the characters that are not allowed in an
 * address encoded.
 */
export function whatsappShareUrl(link, message) {
  const text = message ? `${message} ${link}` : link;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const InviteQr = ({
  link = '',
  size = 220,
  className = '',
  title = '',
  message = '',
}) => {
  const { language } = useTranslation();
  const K = batch9[language]?.split || batch9.id.split;

  const [copied, setCopied] = useState(false);

  const svg = useMemo(() => {
    if (!link) return '';
    try {
      return qrToSvg(link);
    } catch (err) {
      // A code that cannot be drawn is not a reason to break the
      // page. The link is still there to be copied.
      return '';
    }
  }, [link]);

  if (!link) return null;

  const copy = async () => {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // Copying is a convenience. If the browser will not do it, the
      // link is still on the screen to be selected by hand.
    }
  };

  const share = async () => {
    // The browser's own share sheet is better than anything this
    // page can offer, when the browser has one.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: title || K.qr_title, text: message, url: link });
        return;
      } catch (err) {
        // The reader closed the share sheet without sharing. That is
        // not a failure worth reporting.
        if (err && err.name === 'AbortError') return;
      }
    }
    // Otherwise WhatsApp, which is how a group of friends in
    // Indonesia is reached anyway.
    if (typeof window !== 'undefined') {
      window.open(whatsappShareUrl(link, message), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`split-invite-qr ${className}`.trim()}>
      {svg ? (
        <div
          className="split-invite-qr__code"
          // The code is drawn from the link, in the page. There is
          // no image to load and no address to fetch.
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label={title || K.qr_title}
        />
      ) : null}

      <p className="split-invite-qr__hint">{K.qr_hint}</p>

      <p className="split-invite-qr__link">{link}</p>

      <div className="split-invite-qr__actions">
        <button type="button" onClick={copy} className="split-invite-qr__button">
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? K.link_copied : K.copy_link}
        </button>

        <button type="button" onClick={share} className="split-invite-qr__button">
          <Share2 size={16} aria-hidden="true" />
          {K.share_whatsapp}
        </button>
      </div>
    </div>
  );
};

export default InviteQr;
