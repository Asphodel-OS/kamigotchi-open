import { CSSProperties } from 'react';

// a small picture drawn inline as svg pixels, `cell` wide each, in colours the page sets
// (currentColor, var(--accent)), which a picture as a data url (PixelSprite) can't read. rows: one
// character per pixel, '.' for none; colours: the fill for each character. flipped, it faces the
// other way
export const PixelGrid = ({
  rows,
  colours,
  cell,
  flip = false,
  style,
}: {
  rows: string[];
  colours: Record<string, string>;
  cell: string;
  flip?: boolean;
  style?: CSSProperties;
}) => {
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      viewBox={`0 0 ${w} ${rows.length}`}
      shapeRendering='crispEdges'
      style={{
        display: 'block',
        width: `calc(${w} * ${cell})`,
        height: `calc(${rows.length} * ${cell})`,
        ...style,
      }}
    >
      {rows.flatMap((row, y) =>
        [...row].flatMap((c, x) =>
          colours[c]
            ? [
                <rect
                  key={`${x},${y}`}
                  x={flip ? w - 1 - x : x}
                  y={y}
                  width={1.02}
                  height={1.02}
                  fill={colours[c]}
                />,
              ]
            : []
        )
      )}
    </svg>
  );
};
