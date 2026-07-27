import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Download,
  FileJson,
  FileImage,
  Globe2,
  KeyRound,
  Plus,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  Trash2,
} from 'lucide-react'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent } from 'react'
import './App.css'
import {
  MAX_POINTS,
  SAMPLE_PAYLOADS,
  clamp,
  clampByte,
  encodeFzoneProfile,
  parseFzonePayload,
  parseFzoneJsonProfile,
  profileToJson,
} from './fzone'
import type { ChannelKey, FzonePoint, FzoneProfile } from './fzone'

type CommunityProfile = {
  id: string
  name: string
  description: string
  modelLabel: string
  prefix: string
  profileId: number
  pointCount: number
  startTime: string
  endTime: string
  checksum: string
  tags: string
  createdAt: string
}

const channelMeta: Array<{ key: ChannelKey; label: string; color: string }> = [
  { key: 'white', label: 'W', color: '#f8fafc' },
  { key: 'red', label: 'R', color: '#ef4444' },
  { key: 'green', label: 'G', color: '#22c55e' },
  { key: 'blue', label: 'B', color: '#3b82f6' },
]

const MAX_INTENSITY_PERCENT = 100

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
  const [communityProfiles, setCommunityProfiles] = useState<CommunityProfile[]>([])
  const [communityMessage, setCommunityMessage] = useState('Community-Speicher wird verbunden.')
  const [communityAvailable, setCommunityAvailable] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishName, setPublishName] = useState(() => suggestProfileName(parseFzonePayload(SAMPLE_PAYLOADS[1].value)))
  const [publishDescription, setPublishDescription] = useState('')
  const [publishTags, setPublishTags] = useState('')
  const [communityQuery, setCommunityQuery] = useState('')
  const [communityModel, setCommunityModel] = useState('Alle Modelle')
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('fzone-admin-token') ?? '')
  const [jsonDataUrl, setJsonDataUrl] = useState('')
  const [chartViewMode, setChartViewMode] = useState<'day' | 'points'>('day')
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const encodedPayload = useMemo(() => {
    try {
      return encodeFzoneProfile(profile)
    } catch {
      return ''
    }
  }, [profile])

  const jsonExport = useMemo(() => JSON.stringify(profileToJson(profile), null, 2), [profile])
  const jsonFileName = useMemo(() => `${slugify(profile.modelLabel)}.json`, [profile.modelLabel])

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([jsonExport], { type: 'application/json' }))
    setJsonDataUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [jsonExport])

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

  const modelOptions = useMemo(
    () => ['Alle Modelle', ...Array.from(new Set(communityProfiles.map((item) => item.modelLabel))).sort()],
    [communityProfiles],
  )

  const filteredCommunityProfiles = useMemo(() => {
    const query = communityQuery.trim().toLowerCase()

    return communityProfiles.filter((item) => {
      const matchesModel = communityModel === 'Alle Modelle' || item.modelLabel === communityModel
      const searchable = `${item.name} ${item.description} ${item.tags} ${item.modelLabel} ${item.prefix}`.toLowerCase()

      return matchesModel && (!query || searchable.includes(query))
    })
  }, [communityProfiles, communityModel, communityQuery])

  const unknownModel = profile.modelLabel.startsWith('Unbekanntes Modell')

  useEffect(() => {
    loadCommunityProfiles()
  }, [])

  function importPayload(payload: string, source = 'Payload importiert.') {
    try {
      const nextProfile = parseFzonePayload(payload)
      setProfile(nextProfile)
      setRawInput(payload)
      setPublishName(suggestProfileName(nextProfile))
      setPublishDescription('')
      setPublishTags('')
      setError('')
      setNotice(
        nextProfile.modelLabel.startsWith('Unbekanntes Modell')
          ? `${source} Modell ist noch nicht bekannt.`
          : source,
      )
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
          key === 'hour'
            ? clamp(value, 0, 23)
            : key === 'minute'
              ? clamp(value, 0, 59)
              : clamp(value, 0, MAX_INTENSITY_PERCENT)

        return { ...point, [key]: nextValue }
      }),
    }))
  }

  function updatePointFields(id: string, updates: Partial<Pick<FzonePoint, 'hour' | 'minute' | ChannelKey>>) {
    setProfile((current) => ({
      ...current,
      points: current.points.map((point) => {
        if (point.id !== id) {
          return point
        }

        return {
          ...point,
          hour: updates.hour === undefined ? point.hour : clamp(updates.hour, 0, 23),
          minute: updates.minute === undefined ? point.minute : clamp(updates.minute, 0, 59),
          white: updates.white === undefined ? point.white : clamp(updates.white, 0, MAX_INTENSITY_PERCENT),
          red: updates.red === undefined ? point.red : clamp(updates.red, 0, MAX_INTENSITY_PERCENT),
          green: updates.green === undefined ? point.green : clamp(updates.green, 0, MAX_INTENSITY_PERCENT),
          blue: updates.blue === undefined ? point.blue : clamp(updates.blue, 0, MAX_INTENSITY_PERCENT),
        }
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

  async function importJsonFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const json = JSON.parse(await file.text()) as unknown
      const nextProfile = parseFzoneJsonProfile(json)
      const nextPayload = encodeFzoneProfile(nextProfile)

      setProfile(nextProfile)
      setRawInput(nextPayload)
      setPublishName(suggestProfileName(nextProfile))
      setPublishDescription('')
      setPublishTags('')
      setError('')
      setNotice(`${file.name} importiert.`)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Die JSON-Datei konnte nicht gelesen werden.')
      setNotice('')
    } finally {
      event.target.value = ''
    }
  }

  async function loadCommunityProfiles() {
    try {
      const response = await fetch('/api/profiles')

      if (!response.ok) {
        throw new Error('Community-API nicht erreichbar.')
      }

      const data = (await response.json()) as { profiles?: CommunityProfile[] }
      setCommunityProfiles(data.profiles ?? [])
      setCommunityAvailable(true)
      setCommunityMessage((data.profiles ?? []).length ? 'Community-Profile geladen.' : 'Noch keine Community-Profile gespeichert.')
    } catch {
      setCommunityAvailable(false)
      setCommunityMessage('Community-Speicher ist auf diesem Hosting noch nicht verbunden.')
    }
  }

  async function publishProfile() {
    if (!encodedPayload || isPublishing) {
      return
    }

    setIsPublishing(true)
    setCommunityMessage('Profil wird veröffentlicht.')

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: publishName,
          description: publishDescription,
          tags: publishTags,
          payload: encodedPayload,
          website: '',
        }),
      })

      const data = (await response.json()) as { error?: string; duplicateProfile?: CommunityProfile }

      if (!response.ok) {
        throw new Error(
          data.duplicateProfile
            ? `Dieses Profil existiert bereits: ${data.duplicateProfile.name}.`
            : data.error ?? 'Das Profil konnte nicht gespeichert werden.',
        )
      }

      setCommunityAvailable(true)
      setCommunityMessage('Profil wurde veröffentlicht.')
      await loadCommunityProfiles()
    } catch (exception) {
      setCommunityMessage(exception instanceof Error ? exception.message : 'Das Profil konnte nicht gespeichert werden.')
    } finally {
      setIsPublishing(false)
    }
  }

  async function loadCommunityProfile(id: string) {
    try {
      const response = await fetch(`/api/profiles/${id}`)
      const data = (await response.json()) as { profile?: CommunityProfile & { payload?: string }; error?: string }

      if (!response.ok || !data.profile?.payload) {
        throw new Error(data.error ?? 'Das Profil konnte nicht geladen werden.')
      }

      importPayload(data.profile.payload, `${data.profile.name} geladen.`)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Das Profil konnte nicht geladen werden.')
      setNotice('')
    }
  }

  async function deleteCommunityProfile(id: string, name: string) {
    if (!adminToken.trim()) {
      setCommunityMessage('Bitte zuerst den Admin-Code eintragen.')
      return
    }

    if (!window.confirm(`Profil "${name}" wirklich löschen?`)) {
      return
    }

    try {
      const response = await fetch(`/api/profiles/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken.trim() },
      })
      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Das Profil konnte nicht gelöscht werden.')
      }

      setCommunityProfiles((items) => items.filter((item) => item.id !== id))
      setCommunityMessage(`Profil gelöscht: ${name}`)
      await loadCommunityProfiles()
    } catch (exception) {
      setCommunityMessage(exception instanceof Error ? exception.message : 'Das Profil konnte nicht gelöscht werden.')
    }
  }

  function updateAdminToken(value: string) {
    setAdminToken(value)

    if (value.trim()) {
      localStorage.setItem('fzone-admin-token', value.trim())
    } else {
      localStorage.removeItem('fzone-admin-token')
    }
  }

  async function copyModelSuggestion() {
    const header = `04 ${profile.profileId.toString(16).padStart(2, '0').toUpperCase()}`
    const suggestion = [
      'Unknown FZone model suggestion',
      `Prefix: ${profile.prefix}`,
      `Header: ${header}`,
      `Points: ${profile.points.length}`,
      `Payload: ${encodedPayload}`,
    ].join('\n')

    await navigator.clipboard.writeText(suggestion)
    setNotice('Modellvorschlag in die Zwischenablage kopiert.')
  }

  return (
    <main className="app-shell">
      <section className="app-hero">
        <div>
          <p className="eyebrow">FZone Light Lab (by User60311)</p>
          <h1>Lichtprofile einfach bauen.</h1>
          <p className="hero-copy">
            Importieren, anpassen, speichern und wieder als QR-Code ausgeben.
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
            <h2>Import/Export</h2>
          </div>

          <label className="file-drop">
            <FileImage size={22} aria-hidden="true" />
            <span>QR-Bild hochladen</span>
            <input type="file" accept="image/*" onChange={decodeImage} />
          </label>

          <label className="file-drop">
            <FileJson size={22} aria-hidden="true" />
            <span>JSON-Datei importieren</span>
            <input type="file" accept="application/json,.json" onChange={importJsonFile} />
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
              <p className="section-kicker">Kurvenerstellung</p>
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

          {unknownModel && (
            <div className="unknown-model">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>Unbekanntes Modell erkannt</strong>
                <p>
                  Prefix <code>{profile.prefix}</code> mit Header{' '}
                  <code>04 {profile.profileId.toString(16).padStart(2, '0').toUpperCase()}</code> ist noch nicht zugeordnet.
                </p>
              </div>
              <button type="button" className="ghost" onClick={copyModelSuggestion}>
                <Copy size={16} aria-hidden="true" />
                Modell vorschlagen
              </button>
            </div>
          )}

          <ProfileChart
            points={profile.points}
            viewMode={chartViewMode}
            onToggleViewMode={() => setChartViewMode((mode) => (mode === 'day' ? 'points' : 'day'))}
            onChangePoint={updatePointFields}
          />

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
                            max={MAX_INTENSITY_PERCENT}
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
            <a className="button" href={jsonDataUrl} download={jsonFileName}>
              <FileJson size={17} aria-hidden="true" />
              JSON
            </a>
          </div>

          <div className="publish-box">
            <div className="panel-heading mini">
              <Globe2 size={18} aria-hidden="true" />
              <h3>Profil veröffentlichen</h3>
            </div>
            <label className="field">
              <span>Profilname</span>
              <input value={publishName} maxLength={80} onChange={(event) => setPublishName(event.target.value)} />
            </label>
            <label className="field">
              <span>Beschreibung</span>
              <textarea
                className="compact-textarea"
                value={publishDescription}
                maxLength={360}
                onChange={(event) => setPublishDescription(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Tags</span>
              <input value={publishTags} maxLength={120} placeholder="Low-Tech, CO2, Nano" onChange={(event) => setPublishTags(event.target.value)} />
            </label>
            <button type="button" onClick={publishProfile} disabled={!encodedPayload || isPublishing}>
              <Globe2 size={17} aria-hidden="true" />
              {isPublishing ? 'Speichern' : 'Veröffentlichen'}
            </button>
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

        <aside className="panel storage-panel">
          <div className="panel-heading">
            <Database size={20} aria-hidden="true" />
            <h2>Profil-Speicher/Suche</h2>
          </div>
          <p className={communityAvailable ? 'community-status online' : 'community-status'}>
            {communityMessage}
          </p>
          <div className="community-tools">
            <label className="field">
              <span>Suchen</span>
              <div className="input-with-icon">
                <Search size={15} aria-hidden="true" />
                <input value={communityQuery} onChange={(event) => setCommunityQuery(event.target.value)} placeholder="Name, Tag, Modell" />
              </div>
            </label>
            <label className="field">
              <span>Modell</span>
              <select value={communityModel} onChange={(event) => setCommunityModel(event.target.value)}>
                {modelOptions.map((model) => (
                  <option key={model}>{model}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Admin-Code</span>
              <div className="input-with-icon">
                <KeyRound size={15} aria-hidden="true" />
                <input type="password" value={adminToken} onChange={(event) => updateAdminToken(event.target.value)} placeholder="optional" />
              </div>
            </label>
            <p className={adminToken.trim() ? 'admin-status active' : 'admin-status'}>
              {adminToken.trim() ? 'Admin-Modus aktiv. Löschbuttons sind eingeblendet.' : 'Ohne Admin-Code sind Profile nur lesbar.'}
            </p>
          </div>
          <div className="community-list" aria-label="Community-Profile">
            {filteredCommunityProfiles.map((item) => (
              <article className={adminToken.trim() ? 'community-card admin-enabled' : 'community-card'} key={item.id}>
                <button type="button" className="community-load" onClick={() => loadCommunityProfile(item.id)}>
                  <strong>{item.name}</strong>
                  <span>{item.modelLabel}</span>
                  <small>
                    {item.pointCount} Punkte / {item.startTime}-{item.endTime}
                  </small>
                  <small>
                    Prefix {item.prefix} / Header 04 {item.profileId.toString(16).padStart(2, '0').toUpperCase()}
                  </small>
                  {item.description && <small>{item.description}</small>}
                  <CommunityMeta item={item} />
                </button>
                {adminToken.trim() && (
                  <div className="community-actions">
                    <button
                      type="button"
                      className="community-delete"
                      onClick={() => deleteCommunityProfile(item.id, item.name)}
                      aria-label={`${item.name} löschen`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Löschen
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!filteredCommunityProfiles.length && <p className="empty-state">Keine passenden Profile gefunden.</p>}
          </div>
        </aside>
      </section>
      <footer className="app-footer">
        Inoffizielles Community-Tool von User60311. Nicht verbunden mit FZone; QR-Profile werden nur freiwillig veröffentlicht.
      </footer>
    </main>
  )
}

function CommunityMeta({ item }: { item: CommunityProfile }) {
  const date = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(item.createdAt))

  return (
    <div className="community-meta">
      <span>{date}</span>
      <span>Checksumme {item.checksum}</span>
      {item.tags && <span>{item.tags}</span>}
    </div>
  )
}

function suggestProfileName(profile: FzoneProfile) {
  const sorted = [...profile.points].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const first = sorted[0]
  const last = sorted.at(-1)!

  return `${profile.modelLabel} / ${sorted.length} Punkte / ${formatPointTime(first)}-${formatPointTime(last)}`
}

function formatPointTime(point: FzonePoint) {
  return `${point.hour.toString().padStart(2, '0')}:${point.minute.toString().padStart(2, '0')}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fzone-light-profile'
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

function ProfileChart({
  points,
  viewMode,
  onToggleViewMode,
  onChangePoint,
}: {
  points: FzonePoint[]
  viewMode: 'day' | 'points'
  onToggleViewMode: () => void
  onChangePoint: (id: string, updates: Partial<Pick<FzonePoint, 'hour' | 'minute' | ChannelKey>>) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragTarget, setDragTarget] = useState<{ pointId: string; channel: ChannelKey } | null>(null)
  const sorted = [...points].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const firstMinute = sorted[0] ? sorted[0].hour * 60 + sorted[0].minute : 0
  const lastMinute = sorted.at(-1) ? sorted.at(-1)!.hour * 60 + sorted.at(-1)!.minute : 1440
  const zoomPaddingMinutes = 60
  const domainStart = viewMode === 'points' ? clamp(firstMinute - zoomPaddingMinutes, 0, 1440) : 0
  const domainEnd =
    viewMode === 'points'
      ? Math.max(domainStart + 1, clamp(lastMinute + zoomPaddingMinutes, 0, 1440))
      : 1440
  const chartSize = { width: 1200, height: 420 }
  const plot = { left: 72, right: 1172, top: 26, bottom: 342 }
  const plotWidth = plot.right - plot.left
  const plotHeight = plot.bottom - plot.top
  const x = (point: FzonePoint) => plot.left + (((point.hour * 60 + point.minute) - domainStart) / (domainEnd - domainStart)) * plotWidth
  const y = (value: number) => plot.bottom - (clamp(value, 0, MAX_INTENSITY_PERCENT) / MAX_INTENSITY_PERCENT) * plotHeight
  const xTicks = buildHourTicks(domainStart, domainEnd)
  const yTicks = [0, 25, 50, 75, 100]

  function updateFromPointer(event: PointerEvent<SVGElement>, target: { pointId: string; channel: ChannelKey }) {
    const box = svgRef.current?.getBoundingClientRect()

    if (!box) {
      return
    }

    const pointerX = ((event.clientX - box.left) / box.width) * chartSize.width
    const pointerY = ((event.clientY - box.top) / box.height) * chartSize.height
    const minuteOfDay = clamp(
      ((pointerX - plot.left) / plotWidth) * (domainEnd - domainStart) + domainStart,
      0,
      1439,
    )
    const value = clamp(((plot.bottom - pointerY) / plotHeight) * MAX_INTENSITY_PERCENT, 0, MAX_INTENSITY_PERCENT)

    onChangePoint(target.pointId, {
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
      [target.channel]: value,
    })
  }

  function startDrag(event: PointerEvent<SVGCircleElement>, pointId: string, channel: ChannelKey) {
    const target = { pointId, channel }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDragTarget(target)
    updateFromPointer(event, target)
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    if (!dragTarget) {
      return
    }

    updateFromPointer(event, dragTarget)
  }

  return (
    <div className="chart-panel" aria-label="WRGB Tagesverlauf">
      <div className="chart-toolbar">
        <div>
          <strong>Lichtkurve</strong>
          <span>Punkte ziehen, um Zeit und Intensität zu ändern.</span>
        </div>
        <button type="button" className="ghost" onClick={onToggleViewMode}>
          {viewMode === 'day' ? 'Auf Schaltpunkte zoomen' : '24 Stunden anzeigen'}
        </button>
      </div>
      <div className="chart">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
          role="img"
          onPointerMove={moveDrag}
          onPointerUp={() => setDragTarget(null)}
          onPointerLeave={() => setDragTarget(null)}
        >
          <title>WRGB Tagesverlauf</title>
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} className="axis-line" />
          <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="axis-line" />
          {xTicks.map((minute) => (
            <g key={minute}>
              <line x1={minuteToChartX(minute, domainStart, domainEnd, plot.left, plotWidth)} x2={minuteToChartX(minute, domainStart, domainEnd, plot.left, plotWidth)} y1={plot.top} y2={plot.bottom} className="grid-line" />
              <text x={minuteToChartX(minute, domainStart, domainEnd, plot.left, plotWidth)} y="375" className="axis-label">
                {formatAxisTime(minute)}
              </text>
            </g>
          ))}
          {yTicks.map((percent) => {
            const tickY = plot.bottom - (percent / 100) * plotHeight

            return (
              <g key={percent}>
                <line x1={plot.left} x2={plot.right} y1={tickY} y2={tickY} className="grid-line horizontal" />
                <text x="18" y={tickY + 5} className="axis-label percent">
                  {percent}%
                </text>
              </g>
            )
          })}
          {channelMeta.map((channel) => (
            <g key={channel.key}>
              <polyline
                points={sorted.map((point) => `${x(point)},${y(point[channel.key])}`).join(' ')}
                className={`chart-line ${channel.key}`}
                vectorEffect="non-scaling-stroke"
              />
              {sorted.map((point) => (
                <circle
                  key={`${point.id}-${channel.key}`}
                  cx={x(point)}
                  cy={y(point[channel.key])}
                  r="6"
                  className={`chart-handle ${channel.key}`}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => startDrag(event, point.id, channel.key)}
                />
              ))}
            </g>
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
    </div>
  )
}

function buildHourTicks(domainStart: number, domainEnd: number) {
  const span = domainEnd - domainStart
  const step = span <= 180 ? 30 : span <= 480 ? 60 : span <= 900 ? 180 : 360
  const first = Math.ceil(domainStart / step) * step
  const ticks = [domainStart, ...Array.from({ length: Math.floor((domainEnd - first) / step) + 1 }, (_, index) => first + index * step), domainEnd]

  return Array.from(new Set(ticks.filter((minute) => minute >= domainStart && minute <= domainEnd)))
}

function minuteToChartX(minute: number, domainStart: number, domainEnd: number, left: number, width: number) {
  return left + ((minute - domainStart) / (domainEnd - domainStart)) * width
}

function formatAxisTime(minute: number) {
  if (minute >= 1440) {
    return '24:00'
  }

  return `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`
}

export default App
