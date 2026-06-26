import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

export const size = {
  width: 64,
  height: 64,
};

export const contentType = 'image/png';

export default function Icon() {
  const logoPath = join(process.cwd(), 'public', 'logo.png');
  const logoData = readFileSync(logoPath);
  const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <img
          src={logoBase64}
          style={{
            width: '135%',
            height: '135%',
            objectFit: 'cover',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
