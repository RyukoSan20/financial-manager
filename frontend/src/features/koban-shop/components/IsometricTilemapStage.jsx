/**
 * The tilemap stage.
 *
 * It builds a room out of a map (store/shopMap.js), one cell at a
 * time: a grid of ground tiles, then the props that stand on the
 * grid. Nothing here is a photograph of a room; every cell is a tile
 * from /koban-assets/tiles/.
 *
 * The projection is parallel - front-on, top-down - which is the one
 * the reference game uses. The name of the file is the one the brief
 * gave it.
 *
 * Whatever stands up shares one stacking context and one rule:
 *     zIndex = Math.floor(base y in pixels)
 * The props are placed by that rule here; the actors passed as
 * children are placed by it too (see <Actor> and the simulation loop),
 * so a person above a counter is drawn behind it and a person below
 * it in front.
 */

import { memo } from 'react';
import { clsx } from 'clsx';
import { depthOf } from '../store/shopMap.js';

const tileUrl = (name) => `/koban-assets/tiles/tile_${name}.png`;

const Ground = memo(function Ground({ map }) {
  const cells = [];
  for (let r = 0; r < map.rows; r += 1) {
    for (let c = 0; c < map.cols; c += 1) {
      const tile = map.groundAt(c, r);
      cells.push(<span key={`${c}-${r}`} className="ktm-cell" data-tile={tile} style={{ backgroundImage: `url(${tileUrl(tile)})` }} />);
    }
  }
  return (
    <div className="ktm-ground" style={{ gridTemplateColumns: `repeat(${map.cols}, 1fr)`, gridTemplateRows: `repeat(${map.rows}, 1fr)` }} data-testid="tilemap-ground" aria-hidden="true">
      {cells}
    </div>
  );
});

const Props = memo(function Props({ map }) {
  return map.props.map((p) => (
    <img
      key={p.id}
      src={tileUrl(p.tile)}
      alt=""
      className="ktm-prop"
      data-prop={p.id}
      draggable="false"
      style={{
        left: `${((p.x - p.w / 2) / map.cols) * 100}%`,
        top: `${((p.y - p.h) / map.rows) * 100}%`,
        width: `${(p.w / map.cols) * 100}%`,
        height: `${(p.h / map.rows) * 100}%`,
        zIndex: depthOf(p.y),
      }}
    />
  ));
});

/** Where a point of the map is on the stage, as a transform. */
export const placeAt = (map, x, y) => `translate3d(${((x / map.cols) * 100).toFixed(3)}cqw, ${((y / map.rows) * 100).toFixed(3)}cqh, 0) translate(-50%, -100%)`;

/** Someone standing still on the map, feet at (x, y). */
export function Actor({ map, x, y, className = '', children, ...rest }) {
  return (
    <span className={clsx('ktm-actor', className)} style={{ transform: placeAt(map, x, y), zIndex: depthOf(y) }} {...rest}>
      {children}
    </span>
  );
}

export default function IsometricTilemapStage({ map, className = '', children, ...rest }) {
  return (
    <div className={clsx('ktm-stage', className)} style={{ aspectRatio: `${map.cols} / ${map.rows}` }} data-map={map.id} {...rest}>
      <Ground map={map} />
      <Props map={map} />
      {children}
    </div>
  );
}

export { IsometricTilemapStage };
