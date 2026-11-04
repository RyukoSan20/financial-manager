/**
 * The pins on the map.
 *
 * A marker on a map has two jobs, and they are not the same job.
 *
 * The upper layer is the pin itself: the shape of the thing the pin
 * stands for. A minimarket is a shopfront, a supermarket is a
 * basket, a restaurant is a plate and a fork, and fresh produce is
 * a leaf and a round thing. The reader tells them apart before
 * reading a word of the label underneath.
 *
 * The lower layer is the size of the spending: a circle that grows
 * with the money. It is drawn under the pin, so it reads as the
 * ground the pin stands on rather than as another thing on the map.
 *
 * The pins are the ones the generator made, so that the drawing on
 * the map is the drawing that was drawn for it. The two cannot
 * drift apart, because there is only one of them.
 */

import { useMemo } from 'react';
import L from 'leaflet';

import { circleColor, circleSize, pinFor } from '../../utils/mapPins';

/**
 * The pin file for a kind of place.
 */
function pinUrl(name) {
  return `${import.meta.env.BASE_URL}assets/generated/pin/${name}.svg`;
}

/**
 * The icon of a place: a circle of spending with the pin on top.
 *
 * Leaflet takes one element for a marker, so the two layers are put
 * together here: the circle underneath, the pin above it, and the
 * point of the pin on the place itself.
 */
export function placeIcon({ kind, pin, totalSpent, maxSpent, selected }) {
  const diameter = circleSize(totalSpent, maxSpent);
  const color = circleColor(kind);
  const file = pinFor({ kind, pin });

  return L.divIcon({
    className: 'map-pin',
    html: `
      <span class="map-pin__ground" style="
        width: ${diameter}px;
        height: ${diameter}px;
        background: ${color};
        opacity: 0.28;
        border: ${selected ? '3px solid #1e40af' : `2px solid ${color}`};
        transform: translate(-50%, -50%);
      "></span>
      <img class="map-pin__shape" src="${pinUrl(file)}" alt="" width="34" height="31"
           style="transform: translate(-50%, -100%);${selected ? 'filter: drop-shadow(0 2px 6px rgba(30,64,175,0.7));' : ''}" />
    `,
    iconSize: [diameter, diameter + 8],
    iconAnchor: [diameter / 2, diameter / 2 + 8],
    popupAnchor: [0, -diameter],
  });
}

/**
 * The pin of a place, without any of the map around it.
 *
 * The legend uses this, so that the key on the map is the same
 * drawing as the pin on the map.
 */
export function PinSwatch({ kind, pin, size = 26 }) {
  const file = pinFor({ kind, pin });
  return (
    <img
      src={pinUrl(file)}
      alt=""
      width={size}
      height={Math.round(size * 0.9)}
      className="map-pin__swatch"
      style={{ filter: `drop-shadow(0 1px 2px ${circleColor(kind)}55)` }}
    />
  );
}

/**
 * The biggest spending on the map, which sets the size of the ground
 * under every pin.
 */
export function useMaxSpent(markers) {
  return useMemo(() => {
    const amounts = (markers || []).map((marker) => marker.total_spent || 0);
    return amounts.length ? Math.max(...amounts, 1) : 1;
  }, [markers]);
}

export default placeIcon;
