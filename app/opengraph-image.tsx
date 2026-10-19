import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'Alubonets Self-Help Group - One Family, One Vision, Endless Possibilities.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Default link preview (WhatsApp, Facebook, X, LinkedIn) for every page that does not set its own. */
export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), 'public/icons/android-chrome-512x512.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 88px',
          background: 'linear-gradient(135deg, #001f50 0%, #003d82 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', width: 148, height: 148, borderRadius: 74, overflow: 'hidden', background: '#ffffff' }}>
            <img src={logoSrc} width={148} height={148} alt="" style={{ transform: 'scale(1.3)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>Alubonets SHG</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#fe8015', letterSpacing: 6, textTransform: 'uppercase', marginTop: 6 }}>
              Self-Help Group
            </div>
          </div>
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, marginTop: 56, color: '#ffffff' }}>
          One Family, One Vision, Endless Possibilities.
        </div>
        <div style={{ fontSize: 26, marginTop: 20, color: '#c7d2e5' }}>
          Uniting the Alubokho family · Butere, Kakamega County, Kenya
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 14,
            background: 'linear-gradient(90deg, #fe8015 0%, #f6b800 55%, #fe8015 100%)',
          }}
        />
      </div>
    ),
    size,
  )
}
