import { useEffect, useState } from 'react';
import styled from 'styled-components';

// a game icon in the npc's colour, drawn at its native size so its pixels stay crisp

// 32px icons drawn at their native size in a 1080px room (2.963cqh): every 1px line
// stays one crisp pixel instead of being thinned and blurred by scaling
const CrispIcon = styled.img`
  display: block;
  width: 2.9636cqh;
  height: 2.9636cqh;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
`;

// the icon in the npc's colour: its white fill takes the colour, its black line art stays black
// (white x colour = colour, black x colour = black). tinted once on a canvas per icon and colour,
// and kept: a picture costs nothing after, where a live blend mode had to be composited on every
// frame the cloud moved
const tints = new Map<string, string | Promise<string>>();
const tintIcon = (src: string, accent: string) => {
  const key = `${src}|${accent}`;
  const have = tints.get(key);
  if (have) return have;
  const tinting = new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const g = canvas.getContext('2d');
      if (!g) return resolve(src);
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = accent;
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.globalCompositeOperation = 'destination-in'; /* cut back to the icon's own shape */
      g.drawImage(img, 0, 0);
      const url = canvas.toDataURL();
      tints.set(key, url);
      resolve(url);
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
  tints.set(key, tinting);
  return tinting;
};
const useTintedIcon = (src: string, accent: string) => {
  const have = tints.get(`${src}|${accent}`);
  const [url, setUrl] = useState(typeof have === 'string' ? have : undefined);
  useEffect(() => {
    let live = true;
    Promise.resolve(tintIcon(src, accent)).then((tinted) => live && setUrl(tinted));
    return () => {
      live = false;
    };
  }, [src, accent]);
  return url;
};

// until the tint is ready (the first open only), the colour is painted under the icon, cut to
// its shape, and the icon multiplied over it
const IconTint = styled.span<{ $accent: string; $src: string }>`
  display: block;
  background: ${({ $accent }) => $accent};
  mask: url(${({ $src }) => $src}) center / 100% 100% no-repeat;
  & img {
    mix-blend-mode: multiply;
  }
`;

export const TintedIcon = ({ src, alt, accent }: { src: string; alt: string; accent: string }) => {
  const tinted = useTintedIcon(src, accent);
  if (tinted) return <CrispIcon src={tinted} alt={alt} />;
  return (
    <IconTint $accent={accent} $src={src}>
      <CrispIcon src={src} alt={alt} />
    </IconTint>
  );
};
