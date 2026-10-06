// Encourages installing the app. On iPhone this matters most: Safari can delete a website's data
// after 7 days without a visit, but not a Home Screen app's.

import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void> }

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function InstallHint() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  if (isIos()) {
    return (
      <div className="callout">
        <strong>Add BabyTrails to your Home Screen.</strong> In Safari, tap the Share button, then <em>Add to Home Screen</em>. Safari can
        delete a website's stored data after 7 days without a visit; apps on the Home Screen keep theirs. Keep backups either way.
      </div>
    )
  }
  if (event) {
    return (
      <div className="callout">
        <p>
          <strong>Install BabyTrails</strong> so it opens like an app, works offline, and your browser is more likely to keep its data.
        </p>
        <button type="button" className="button small primary" onClick={() => void event.prompt().then(() => setEvent(null))}>
          Install
        </button>
      </div>
    )
  }
  return null
}
