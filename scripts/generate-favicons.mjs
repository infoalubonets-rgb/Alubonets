/**
 * Downloads SITE_LOGO and generates favicon / PWA icons.
 * Does not replace the remote logo used in the navbar/footer.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCnSzS3JcCrGOIYnlA_odPQfW_EPHR1u48LU3KS766KoVD3igIme0EQq0vqNQG3PooaTM2bQqbTmk0RImwZPTDU2sdNN8x8Ewm1oKnJaxZir_KAlNdgRMYz9EyDkfErXWWvZg0JTfdI-WD5J0fK-SLORJPmc2el4H64y1qLg_W15yfg59vO479BZ_O3blOrXFo_F3Ht3cNs44g0jJDLYDrGYmavEdni6HS_DFgt8SvyLJk8W-BIPKiPF2oGxWdN9ncMpZo'

const NAVY = { r: 0, g: 31, b: 80, alpha: 1 }

const SIZES = [
  { file: 'public/icons/favicon-16x16.png', size: 16 },
  { file: 'public/icons/favicon-32x32.png', size: 32 },
  { file: 'public/icons/favicon-48x48.png', size: 48 },
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
  { file: 'public/icons/android-chrome-192x192.png', size: 192 },
  { file: 'public/icons/android-chrome-512x512.png', size: 512 },
  { file: 'public/icons/mstile-150x150.png', size: 150 },
  { file: 'app/icon.png', size: 512 },
  { file: 'app/apple-icon.png', size: 180 },
]

async function pngToIco(png32, png16) {
  // Minimal ICO with two PNG images (modern browsers support PNG-in-ICO).
  const images = [
    { png: png16, width: 16, height: 16 },
    { png: png32, width: 32, height: 32 },
  ]
  const headerSize = 6
  const dirEntrySize = 16
  const dataOffset = headerSize + dirEntrySize * images.length
  let offset = dataOffset
  const entries = images.map((image) => {
    const entry = {
      width: image.width >= 256 ? 0 : image.width,
      height: image.height >= 256 ? 0 : image.height,
      bytes: image.png.length,
      offset,
    }
    offset += image.png.length
    return entry
  })

  const buf = Buffer.alloc(offset)
  buf.writeUInt16LE(0, 0) // reserved
  buf.writeUInt16LE(1, 2) // ICO type
  buf.writeUInt16LE(images.length, 4)

  entries.forEach((entry, index) => {
    const start = headerSize + index * dirEntrySize
    buf.writeUInt8(entry.width, start)
    buf.writeUInt8(entry.height, start + 1)
    buf.writeUInt8(0, start + 2) // color palette
    buf.writeUInt8(0, start + 3) // reserved
    buf.writeUInt16LE(1, start + 4) // color planes
    buf.writeUInt16LE(32, start + 6) // bits per pixel
    buf.writeUInt32LE(entry.bytes, start + 8)
    buf.writeUInt32LE(entry.offset, start + 12)
  })

  let writeAt = dataOffset
  for (const image of images) {
    image.png.copy(buf, writeAt)
    writeAt += image.png.length
  }
  return buf
}

async function squareIcon(source, size) {
  const pad = Math.round(size * 0.12)
  const inner = Math.max(1, size - pad * 2)
  const resized = await sharp(source)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer()
}

async function main() {
  console.log('Downloading logo…')
  const res = await fetch(LOGO_URL)
  if (!res.ok) throw new Error(`Failed to download logo (${res.status})`)
  const source = Buffer.from(await res.arrayBuffer())

  await mkdir(path.join(root, 'public/brand'), { recursive: true })
  await mkdir(path.join(root, 'public/icons'), { recursive: true })
  await writeFile(path.join(root, 'public/brand/logo-source.png'), source)
  console.log('Saved public/brand/logo-source.png (favicon source only)')

  const outputs = {}
  for (const item of SIZES) {
    const outPath = path.join(root, item.file)
    await mkdir(path.dirname(outPath), { recursive: true })
    const buf = await squareIcon(source, item.size)
    await writeFile(outPath, buf)
    outputs[item.file] = buf
    console.log(`Wrote ${item.file} (${item.size}x${item.size})`)
  }

  const ico = await pngToIco(outputs['public/icons/favicon-32x32.png'], outputs['public/icons/favicon-16x16.png'])
  await writeFile(path.join(root, 'public/favicon.ico'), ico)
  console.log('Wrote public/favicon.ico')

  const manifest = {
    name: 'Alubonets SHG',
    short_name: 'Alubonets',
    description: 'Alubonets Self-Help Group',
    start_url: '/',
    display: 'standalone',
    background_color: '#001f50',
    theme_color: '#001f50',
    icons: [
      {
        src: '/icons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
  await writeFile(path.join(root, 'public/site.webmanifest'), JSON.stringify(manifest, null, 2))
  console.log('Wrote public/site.webmanifest')
  console.log('Done. SITE_LOGO left unchanged for UI usage.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
