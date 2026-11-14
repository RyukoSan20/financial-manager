/**
 * The wave between two sections.
 *
 * A page that is a stack of rectangles reads as a list. A wave
 * between the sections says the page is something you move through.
 *
 * The curve is drawn rather than an image so it can take the colour
 * of the section it is handing over to, and so it costs nothing to
 * load. It is also given `preserveAspectRatio="none"` so it can be
 * stretched to whatever width the page is without the curve
 * distorting into a wave of the wrong shape.
 */

export default function OrganicWaveDivider({
  // The colour of the section BELOW the wave.
  tone = 'cream',
  // Which way the curve bends. 'up' is a hill, 'down' is a valley.
  direction = 'up',
  className = '',
}) {
  const classNameForTone = {
    cream: 'text-[#FAF9F6]',
    sage: 'text-[#E3F2EA]',
    sakura: 'text-[#FDE8E4]',
    oat: 'text-[#F4EFE6]',
  };

  const up = (
    <path
      d="M0,48 C240,112 480,0 720,32 C960,64 1200,16 1440,40 L1440,96 L0,96 Z"
      fill="currentColor"
    />
  );
  const down = (
    <path
      d="M0,40 C240,0 480,96 720,64 C960,32 1200,80 1440,56 L1440,0 L0,0 Z"
      fill="currentColor"
    />
  );

  return (
    <div
      className={`cute-wave ${classNameForTone[tone] || classNameForTone.cream} ${className}`}
      data-testid="organic-wave-divider"
      data-tone={tone}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 96"
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: '56px' }}
      >
        {direction === 'down' ? down : up}
      </svg>
    </div>
  );
}

export { OrganicWaveDivider };
