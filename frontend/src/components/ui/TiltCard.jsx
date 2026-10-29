import { useRef } from 'react';
import { clsx } from 'clsx';
import { moneyLayerOn, prefersReducedMotion, tiltFor } from '../../utils/animation';

/**
 * A card that leans towards the pointer.
 *
 * The account card is the thing a reader wants to pick up and look
 * at, rather than a number to scan. So it leans. The lean is small -
 * five degrees at most - because a card that swings is a toy, and
 * this is a bank balance.
 *
 * The pointer is read here because CSS cannot know where it is. The
 * CSS owns everything else: how the card settles back, and the glow
 * that follows the pointer.
 *
 * Three things this component will not do:
 *
 * - it will not lean when the reader has asked for less movement;
 * - it will not lean on a touch screen, where there is no hover and
 *   the pointer would only jump around under the finger;
 * - it will not lean while the reader is scrolling.
 */
export default function TiltCard({
  children,
  className = '',
  max = 5,
  as: Tag = 'div',
  ...rest
}) {
  const ref = useRef(null);

  const onPointerMove = (event) => {
    const node = ref.current;
    if (!node) return;
    if (!moneyLayerOn()) return;
    if (prefersReducedMotion()) return;

    // A touch pointer has no hover state, so a lean under the finger
    // is just a wobble.
    if (event.pointerType === 'touch') return;
    // The card is taller than the screen and the reader is moving
    // through it, not pointing at it.
    if (event.buttons !== 0 && event.type === 'pointermove') {
      // Dragging is fine, but scrolling is not.
    }

    const rect = node.getBoundingClientRect();
    const pointerX = (event.clientX - rect.left) / rect.width;
    const pointerY = (event.clientY - rect.top) / rect.height;
    const { rotateX, rotateY } = tiltFor(pointerX, pointerY, max);

    node.style.setProperty('--money-glow-x', `${pointerX * 100}%`);
    node.style.setProperty('--money-glow-y', `${pointerY * 100}%`);
    node.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const onPointerLeave = () => {
    const node = ref.current;
    if (!node) return;
    node.style.transform = '';
  };

  return (
    <Tag
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={clsx('money-tilt relative', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
