// Asks before the page is left or reloaded while a form holds typed values (X-05). Browsers show
// their own wording; a reload locks the vault, so what was typed would be lost.

import { useEffect } from 'react'

export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}
