import type { Brand } from '../core/ui/components'

export const BRAND: Brand = {
  name: 'BabyTrails',
  prefix: 'baby',
  home: '/',
  sister: { name: 'LabTrails', prefix: 'lab', url: 'https://labtrails.app', tagline: 'blood test results over time' },
  repo: 'https://github.com/tbutman/babytrails',
}

/** Where the app itself lives; the landing page is at /. */
export const APP = '/app'

export const childPath = (id: string, rest = '') => `${APP}/child/${id}${rest ? `/${rest}` : ''}`
