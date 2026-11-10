/**
 * The mascot.
 *
 * It is a grid of sixteen squares by sixteen, drawn in layers: the
 * body, the ears, the face, and what it wears. The grids are in
 * `mascotFrames.js`; this component is what moves them.
 *
 * Two things move. The drawing flickers between two frames - eyes
 * open and eyes shut, ears up and one ear twitched - on a timer. And
 * the whole figure bobs, jumps or shakes, which is done by the
 * stylesheet.
 *
 * It has four states: at rest, happy, celebrating and alarmed. The
 * page that holds it says which. Happy, celebrating and alarmed pass
 * on their own: after a moment it is at rest again.
 *
 * A page can also tell it to cheer, through the ref:
 *
 *     mascot.current.cheer('Kode disalin!')
 *
 * which makes it jump, throw its sparks and say the words.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  GRID,
  JUMP_MS,
  SPARKS,
  SPARK_LIFE_MS,
  SPARK_SHAPES,
  STATES,
  frameHold,
  gridToRects,
  mascotLayers,
} from './mascotFrames.js';

// How long a mood lasts before the mascot is at rest again.
const MOOD_MS = 2200;
// How long the words stay up.
const BUBBLE_MS = 3200;

const Layer = ({ name, rects }) => (
  <g data-layer={name}>
    {rects.map((rect) => (
      <rect
        key={`${rect.x}-${rect.y}`}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={1}
        fill={rect.fill}
      />
    ))}
  </g>
);

const Spark = ({ spark }) => (
  <svg
    className="mascot-sparkle"
    viewBox="0 0 5 5"
    shapeRendering="crispEdges"
    aria-hidden="true"
    style={{
      '--spark-dx': `${spark.dx}px`,
      '--spark-dy': `${spark.dy}px`,
      '--spark-delay': `${spark.delay}ms`,
    }}
  >
    {gridToRects(SPARK_SHAPES[spark.kind]).map((rect) => (
      <rect
        key={`${rect.x}-${rect.y}`}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={1}
        fill={rect.fill}
      />
    ))}
  </svg>
);

const RiggedSvgMascot = forwardRef(function RiggedSvgMascot(
  {
    state = 'idle',
    mode = 'family',
    size = 72,
    message = '',
    // What it says when it is clicked, one after the other.
    lines = [],
    label = 'Mascot',
    className = '',
    // The first frame to draw. The timer takes over from there.
    initialFrame = 0,
  },
  ref
) {
  const [frame, setFrame] = useState(initialFrame === 1 ? 1 : 0);
  const [mood, setMood] = useState(null);
  const [jumping, setJumping] = useState(false);
  const [burst, setBurst] = useState(0);
  const [said, setSaid] = useState('');
  const lineIndex = useRef(0);
  const timers = useRef({});

  const wanted = STATES.includes(state) ? state : 'idle';
  const current = mood || wanted;

  const later = useCallback((name, fn, ms) => {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    const held = timers.current;
    return () => Object.values(held).forEach(clearTimeout);
  }, []);

  // The two frames, turn and turn about.
  useEffect(() => {
    const timer = setTimeout(
      () => setFrame((value) => (value === 0 ? 1 : 0)),
      frameHold(current, frame)
    );
    return () => clearTimeout(timer);
  }, [current, frame]);

  const say = useCallback(
    (text) => {
      if (!text) return;
      setSaid(text);
      later('bubble', () => setSaid(''), BUBBLE_MS);
    },
    [later]
  );

  const react = useCallback(
    (nextMood, text, { sparks = false } = {}) => {
      setMood(nextMood);
      later('mood', () => setMood(null), MOOD_MS);
      setJumping(true);
      later('jump', () => setJumping(false), JUMP_MS);
      if (sparks) {
        setBurst((value) => value + 1);
        later('burst', () => setBurst(0), SPARK_LIFE_MS + 200);
      }
      say(text);
    },
    [later, say]
  );

  useImperativeHandle(
    ref,
    () => ({
      cheer: (text) => react('celebrate', text, { sparks: true }),
      nod: (text) => react('happy', text),
      warn: (text) => react('alert', text),
      say,
    }),
    [react, say]
  );

  // The page changed what it wants said.
  useEffect(() => {
    if (message) say(message);
  }, [message, say]);

  const onClick = () => {
    const text = lines.length ? lines[lineIndex.current % lines.length] : '';
    lineIndex.current += 1;
    react('happy', text, { sparks: true });
  };

  const motion = jumping
    ? current === 'alert'
      ? 'mascot-shake'
      : 'mascot-jump'
    : 'mascot-float';

  return (
    <span
      className={`mascot-root ${className}`}
      data-state={current}
      data-mode={mode}
      data-frame={frame}
    >
      {said ? (
        <span className="mascot-bubble" role="status" aria-live="polite">
          {said}
        </span>
      ) : null}

      <button type="button" className="mascot-button" onClick={onClick} aria-label={label}>
        <svg
          className={`mascot-figure ${motion}`}
          width={size}
          height={size}
          viewBox={`0 0 ${GRID} ${GRID}`}
          shapeRendering="crispEdges"
          role="img"
          aria-hidden="true"
        >
          {mascotLayers({ state: current, mode, frame }).map((layer) => (
            <Layer key={layer.name} name={layer.name} rects={layer.rects} />
          ))}
        </svg>
      </button>

      {burst ? (
        <span className="mascot-sparkles" key={burst} aria-hidden="true">
          {SPARKS.map((spark) => (
            <Spark key={spark.id} spark={spark} />
          ))}
        </span>
      ) : null}
    </span>
  );
});

export default RiggedSvgMascot;
export { RiggedSvgMascot };
