import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileImage,
  Plus,
  QrCode,
  RotateCcw,
  ScanLine,
  Trash2,
} from 'lucide-react'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import {
  MAX_POINTS,
  SAMPLE_PAYLOADS,
  clamp,
  clampByte,
  encodeFzoneProfile,
  parseFzonePayload,
} from './fzone'
import type { ChannelKey, FzonePoint, FzoneProfile } from './fzone'

const channelMeta: Array<{ key: ChannelKey; label: string; color: string }> = [
  { key: 'white', label: 'W', color: '#f8fafc' },
  { key: 'red', label: 'R', color: '#ef4444' },
  { key: 'green', label: 'G', color: '#22c55e' },
  { key: 'blue', label: 'B', color: '#3b82f6' },
]

const emptyPoint = (): FzonePoint => ({
  id: crypto.randomUUID(),
  hour: 12,
  minute: 0,
  white: 30,
  red: 20,
  green: 20,
  blue: 25,
})

function App() {
  const [rawInput, setRawInput] = useState(SAMPLE_PAYLOADS[1].value)
  const [profile, setProfile] = useState<FzoneProfile>(() => parseFzonePayload(SAMPLE_PAYLOADS[1].value))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('Beispielprofil geladen.')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const encodedPayload = useMemo(() => {
    try {
      return encodeFzoneProfile(profile)
    } catch {
      return ''
    }
  }, [profile])

  useEffect(() => {
    if (!encodedPayload || !qrCanvasRef.current) {
      return
    }

    QRCode.toCanvas(qrCanvasRef.current, encodedPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 340,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    }).then(() => {
      setQrDataUrl(qrCanvasRef.current?.toDataURL('image/png') ?? '')
    })
  }, [encodedPayload])

  const generatedProfile = useMemo(() => {
    if (!encodedPayload) {
      return null
    }

    try {
      return parseFzonePayload(encodedPayload)
    } catch {
      return null
    }
  }, [encodedPayload])

  function importPayload(payload: string, source = 'Payload importiert.') {
    try {
      const nextProfile = parseFzonePayload(payload)
      setProfile(nextProfile)
      setRawInput(payload)
      setError('')
      setNotice(source)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Der QR-Code konnte nicht gelesen werden.')
      setNotice('')
    }
  }

  async function decodeImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const imageUrl = URL.createObjectURL(file)

    try {
      const image = await loadImage(imageUrl)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas konnte nicht vorbereitet werden.')
      }

      context.drawImage(image, 0, 0)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height)

      if (!qrCode) {
        throw new Error('Kein QR-Code gefunden.')
      }

      importPayload(qrCode.data, 'QR-Bild erfolgreich dekodiert.')
    } catch {
      setError('In diesem Bild konnte kein QR-Code erkannt werden.')
      setNotice('')
    } finally {
      URL.revokeObjectURL(imageUrl)
      event.target.value = ''
    }
  }

  function updatePoint(id: string, key: keyof FzonePoint, value: number) {
    setProfile((current) => ({
      ...current,
      points: current.points.map((point) => {
        if (point.id !== id) {
          return point
        }

        const nextValue =
          key === 'hour' ? clamp(value, 0, 23) : key === 'minute' ? clamp(value, 0, 59) : clampByte(value)

        return { ...point, [key]: nextValue }
      }),
    }))
  }

  function addPoint() {
    setProfile((current) => ({
      ...current,
      points: [...current.points, emptyPoint()].slice(0, MAX_POINTS),
    }))
  }

  function removePoint(id: string) {
    setProfile((current) => ({
      ...current,
      points: current.points.length > 1 ? current.points.filter((point) => point.id !== id) : current.points,
    }))
  }

  function updateProfileMeta(key: 'prefix' | 'profileId', value: string) {
    setProfile((current) => ({
      ...current,
      [key]: key === 'profileId' ? clampByte(Number.parseInt(value || '0', 16)) : value.trim(),
    }))
  }

  async function copyPayload() {
    await navigator.clipboard.writeText(encodedPayload)
    setNotice('Payload in die Zwischenablage kopiert.')
  }

  return (
    <main className="app-shell">
      <section className="app-hero">
        <div>
          <p className="eyebrow">FZone Bright Light Lab</p>
          <h1>QR-Profile lesen, verstehen und neu erzeugen.</h1>
          <p className="hero-copy">
            Präzise Tageskurven für FZone Lichtprofile: importieren, feinjustieren und als scanbaren QR-Code ausgeben.
          </p>
        </div>
        <div className="hero-status" aria-label="Profilstatus">
          <StatusPill ok={profile.checksumValid} label="Checksumme" />
          <StatusPill ok={profile.lengthValid} label="Länge" />
          <div className="metric">
            <strong>{profile.points.length}</strong>
            <span>Schaltpunkte</span>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="panel import-panel">
          <div className="panel-heading">
            <ScanLine size={20} aria-hidden="true" />
            <h2>Import</h2>
          </div>

          <label className="file-drop">
            <FileImage size={22} aria-hidden="true" />
            <span>QR-Bild hochladen</span>
            <input type="file" accept="image/*" onChange={decodeImage} />
          </label>

          <label className="field">
            <span>QR-Rohdaten</span>
            <textarea value={rawInput} onChange={(event) => setRawInput(event.target.value)} spellCheck={false} />
          </label>

          <div className="button-row">
            <button type="button" onClick={() => importPayload(rawInput)}>
              <QrCode size={17} aria-hidden="true" />
              Dekodieren
            </button>
            <button type="button" className="ghost" onClick={() => importPayload(SAMPLE_PAYLOADS[1].value)}>
              <RotateCcw size={17} aria-hidden="true" />
              Reset
            </button>
          </div>

          <div className="sample-list" aria-label="Beispielprofile">
            {SAMPLE_PAYLOADS.map((sample) => (
              <button type="button" className="sample-button" key={sample.label} onClick={() => importPayload(sample.value, `${sample.label} geladen.`)}>
                {sample.label}
              </button>
            ))}
          </div>

          {(error || notice) && (
            <div className={error ? 'message error' : 'message'}>
              {error ? <AlertTriangle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
              <span>{error || notice}</span>
            </div>
          )}
        </aside>

        <section className="panel editor-panel">
          <div className="panel-heading split">
            <div>
              <h2>{profile.modelLabel}</h2>
              <p>
                Prefix <code>{profile.prefix}</code> / Header <code>04 {profile.profileId.toString(16).padStart(2, '0').toUpperCase()}</code>
              </p>
            </div>
            <button type="button" onClick={addPoint} disabled={profile.points.length >= MAX_POINTS}>
              <Plus size={17} aria-hidden="true" />
              Punkt
            </button>
          </div>

          <div className="meta-grid">
            <label className="field">
              <span>Prefix</span>
              <input value={profile.prefix} onChange={(event) => updateProfileMeta('prefix', event.target.value)} />
            </label>
            <label className="field">
              <span>Profil-ID hex</span>
              <input
                value={profile.profileId.toString(16).padStart(2, '0').toUpperCase()}
                maxLength={2}
                onChange={(event) => updateProfileMeta('profileId', event.target.value)}
              />
            </label>
          </div>

          <ProfileChart points={profile.points} />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>W</th>
                  <th>R</th>
                  <th>G</th>
                  <th>B</th>
                  <th aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {[...profile.points]
                  .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
                  .map((point) => (
                    <tr key={point.id}>
                      <td className="time-cell">
                        <input
                          aria-label="Stunde"
                          type="number"
                          min={0}
                          max={23}
                          value={point.hour}
                          onChange={(event) => updatePoint(point.id, 'hour', Number(event.target.value))}
                        />
                        <span>:</span>
                        <input
                          aria-label="Minute"
                          type="number"
                          min={0}
                          max={59}
                          value={point.minute}
                          onChange={(event) => updatePoint(point.id, 'minute', Number(event.target.value))}
                        />
                      </td>
                      {channelMeta.map((channel) => (
                        <td key={channel.key}>
                          <input
                            aria-label={`${channel.label} Intensität`}
                            type="number"
                            min={0}
                            max={255}
                            value={point[channel.key]}
                            onChange={(event) => updatePoint(point.id, channel.key, Number(event.target.value))}
                          />
                        </td>
                      ))}
                      <td>
                        <button type="button" className="icon-button" onClick={() => removePoint(point.id)} aria-label="Schaltpunkt löschen">
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel export-panel">
          <div className="panel-heading">
            <QrCode size={20} aria-hidden="true" />
            <h2>Export</h2>
          </div>

          <div className="qr-box">
            <canvas ref={qrCanvasRef} aria-label="Generierter FZone QR-Code" />
          </div>

          <div className="button-row">
            <button type="button" onClick={copyPayload} disabled={!encodedPayload}>
              <Copy size={17} aria-hidden="true" />
              Kopieren
            </button>
            <a className="button" href={qrDataUrl} download="fzone-lichtprofil.png">
              <Download size={17} aria-hidden="true" />
              PNG
            </a>
          </div>

          <div className="checksum-box">
            <div>
              <span>Neue Länge</span>
              <strong>{generatedProfile?.declaredLength ?? '-'}</strong>
            </div>
            <div>
              <span>Neue Checksumme</span>
              <strong>{generatedProfile ? generatedProfile.checksumActual.toString(16).padStart(2, '0').toUpperCase() : '-'}</strong>
            </div>
          </div>

          <label className="field">
            <span>Generierter Payload</span>
            <textarea className="payload-output" value={encodedPayload} readOnly spellCheck={false} />
          </label>
        </aside>
      </section>
    </main>
  )
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'))
    image.src = src
  })
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? 'status-pill ok' : 'status-pill warn'}>
      {ok ? <Check size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
      {label}
    </span>
  )
}

function ProfileChart({ points }: { points: FzonePoint[] }) {
  const sorted = [...points].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const x = (point: FzonePoint) => ((point.hour * 60 + point.minute) / 1440) * 100
  const y = (value: number) => 92 - (clampByte(value) / 255) * 84

  return (
    <div className="chart" aria-label="WRGB Tagesverlauf">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
        <title>WRGB Tagesverlauf</title>
        {[0, 6, 12, 18, 24].map((hour) => (
          <line key={hour} x1={(hour / 24) * 100} x2={(hour / 24) * 100} y1="8" y2="92" className="grid-line" />
        ))}
        {channelMeta.map((channel) => (
          <polyline
            key={channel.key}
            points={sorted.map((point) => `${x(point)},${y(point[channel.key])}`).join(' ')}
            className={`chart-line ${channel.key}`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="chart-legend">
        {channelMeta.map((channel) => (
          <span key={channel.key}>
            <i style={{ background: channel.color }} />
            {channel.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default App
