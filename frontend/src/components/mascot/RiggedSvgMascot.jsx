/**
 * The mascot.
 *
 * There are two drawings of the companion.
 *
 * The one that shows by default is the Kakeibo one: a chubby little
 * animal drawn the way a Japanese stationery character is drawn - flat
 * pastel fills, one thick warm-brown outline, round shapes. It is in
 * `KanaheiStationeryMascot.jsx`, and it is what every page now
 * shows. The old sixteen-by-sixteen pixel grid looked harsh next to a
 * rounded card, so it is kept as `variant="pixel"` rather than
 * thrown away.
 *
 * The behaviour is the same for both drawings:
 *
 * - it blinks, and it bobs;
 * - it has four states: at rest, happy, celebrating and alarmed;
 * - it says the words the page gives it, one after the other, when
 *   it is clicked;
 * - and a page can make it cheer through the ref:
 *
 *     mascot.current.cheer('Kode disalin!')
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
import KanaheiStationeryMascot from './KanaheiStationeryMascot.jsx';
import ClampShoujoMascot from './ClampShoujoMascot.jsx';

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
    // `mood` is the older name for the same thing; both are accepted.
    mood,
    mode = 'family',
    size = 72,
    message = '',
    // What it says when it is clicked, one after the other.
    lines = [],
    label = 'Mascot',
    className = '',
    // The first frame to draw. The timer takes over from there.
    initialFrame = 0,
    // `shoujo` is the semi-chibi shoujo companion, and it is what a
    // page gets when it does not ask for anything. `kanahei` is the
    // flat stationery drawing it replaced; `pixel` is the old
    // sixteen-by-sixteen grid. Both are still reachable by name.
    variant = 'shoujo',
    // Passed through to the shoujo companion: whether it strolls, and
    // whether it can be asked a question.
    roaming = false,
    interactive = true,
    persona,
    onClick,
  },
  ref
) {
  const [frame, setFrame] = useState(initialFrame === 1 ? 1 : 0);
  const [activeMood, setActiveMood] = useState(null);
  const [jumping, setJumping] = useState(false);
  const [burst, setBurst] = useState(0);
  const [said, setSaid] = useState('');
  const lineIndex = useRef(0);
  const timers = useRef({});

  const wanted = STATES.includes(state) ? state : STATES.includes(mood) ? mood : 'idle';
  const current = activeMood || wanted;

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
      setActiveMood(nextMood);
      later('mood', () => setActiveMood(null), MOOD_MS);
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

  const onMascotClick = () => {
    const text = lines.length ? lines[lineIndex.current % lines.length] : '';
    lineIndex.current += 1;
    react('happy', text, { sparks: true });
    if (onClick) onClick();
  };

  const motion = jumping
    ? current === 'alert'
      ? 'mascot-shake'
      : 'mascot-jump'
    : 'mascot-float';

  // The shoujo companion - the default drawing.
  if (variant === 'shoujo') {
    return (
      <span
        className={`mascot-root ${className}`}
        data-state={current}
        data-mode={mode}
        data-frame={frame}
        data-variant="shoujo"
      >
        <span className={`mascot-figure ${motion}`}>
          <ClampShoujoMascot
            persona={persona}
            mood={current}
            size={size}
            label={label}
            said={said}
            roaming={roaming}
            interactive={interactive}
            onClick={onMascotClick}
          />
        </span>

        {burst ? (
          <span className="mascot-sparkles" key={burst} aria-hidden="true">
            {SPARKS.map((spark) => (
              <Spark key={spark.id} spark={spark} />
            ))}
          </span>
        ) : null}
      </span>
    );
  }

  // The flat stationery drawing.
  if (variant !== 'pixel') {
    return (
      <span
        className={`mascot-root ${className}`}
        data-state={current}
        data-mode={mode}
        data-frame={frame}
        data-variant="kanahei"
      >
        {/* The flat companion says what it has to say inside the hover
            board, so there is one card above it rather than two. */}
        <span className={`mascot-figure ${motion}`}>
          <KanaheiStationeryMascot
            mood={current}
            mode={mode}
            size={size}
            label={label}
            said={said}
            onClick={onMascotClick}
          />
        </span>

        {burst ? (
          <span className="mascot-sparkles" key={burst} aria-hidden="true">
            {SPARKS.map((spark) => (
              <Spark key={spark.id} spark={spark} />
            ))}
          </span>
        ) : null}
      </span>
    );
  }

  // The old pixel grid, kept for anyone who asks for it.
  return (
    <span
      className={`mascot-root ${className}`}
      data-state={current}
      data-mode={mode}
      data-frame={frame}
      data-variant="pixel"
    >
      {said ? (
        <span className="mascot-bubble" role="status" aria-live="polite">
          {said}
        </span>
      ) : null}

      <button type="button" className="mascot-button" onClick={onMascotClick} aria-label={label}>
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
