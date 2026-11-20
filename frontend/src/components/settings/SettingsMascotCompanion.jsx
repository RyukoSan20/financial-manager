/**
 * The companion that lives in the settings banner.
 *
 * The settings page has a lot of small decisions in it - switch a
 * concept, save a name, turn on a reminder. Each one of them is a
 * little moment where the page could say something back. This is the
 * thing that says it.
 *
 * It is built on DraggableSparkleMascot, which already knows how to be
 * picked up and dragged, how to leave a sparkle trail behind it while
 * it is carried about, and how to let go of a shower of confetti. This
 * file adds the part that is specific to settings: a speech bubble
 * that has something to say, and a way for the page to tell it that
 * something happened.
 *
 * The page says what happened by dispatching a 'koban:celebrate'
 * event, or by bumping the celebrateSignal prop. Both reach whichever
 * companion is on the page at that moment, so swapping the persona
 * cannot swallow a celebration.
 *
 * The bubble text comes from the caller, so it is translated with the
 * rest of the page. There are no strings in this file.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import DraggableSparkleMascot from '../mascot/DraggableSparkleMascot';

/**
 * The bubble's own small state machine.
 *
 * The bubble has to feel like it is reacting, not like it is being
 * replaced, so a new message fades the old one out rather than
 * snapping. A message that arrives while one is already showing
 * replaces it, and the figure celebrates either way.
 */
export default function SettingsMascotCompanion({
  persona = 'kaneru',
  size = 96,
  message,
  hint,
  celebrateSignal = 0,
  onTap,
  className = '',
}) {
  const [shown, setShown] = useState(message || '');
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);

  // A new message fades the old one out and brings the new one in.
  useEffect(() => {
    if (!message || message === shown) return;
    setFading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShown(message);
      setFading(false);
    }, 180);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // `shown` is deliberately not a dependency: including it would
    // re-run this effect on every fade and restart the fade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onCelebrate = useCallback(() => {
    // The figure celebrates; the bubble is allowed to say the message
    // that was passed in. Nothing else to do here - the confetti and
    // the bounce are the mascot's own.
  }, []);

  return (
    <div className={`sbg-mascot ${className}`.trim()} data-testid="settings-mascot">
      <span className="sbg-mascot__figure">
        <DraggableSparkleMascot
          persona={persona}
          mood="idle"
          size={size}
          draggable
          hint={hint}
          label={hint}
          onTap={onTap}
          onCelebrate={onCelebrate}
          celebrateSignal={celebrateSignal}
        />
      </span>
      {shown ? (
        <span
          className="sbg-mascot__bubble"
          data-testid="settings-mascot-bubble"
          data-fading={fading ? 'true' : 'false'}
          style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
        >
          {shown}
        </span>
      ) : null}
    </div>
  );
}
