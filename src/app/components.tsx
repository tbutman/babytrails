import { disclaimer } from '../core/ui/copy'

export function Disclaimer() {
  return <p className="hint disclaimer">{disclaimer('BabyTrails', "your baby's doctor")}</p>
}
