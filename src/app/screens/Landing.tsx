// BabyTrails' landing page (/), built from the shared Trails landing sections, with the same structure
// as LabTrails'. The hero shows live components drawn from the demo's made-up data, so it's always in
// step with the app.

import { Check, FileText, LineChart, Ruler, ScanText, Share2, Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ageInDays } from '../../growth/growth'
import { GrowthChart } from '../../growth/GrowthChart'
import { formatPercentile } from '../../growth/lms'
import { Chip, MetricCard, Sparkline } from '../../core/ui/components'
import { CtaBand, Faq, FeatureGrid, Hero, LandingNav, PrivacyPanel, Section, Showcase, SiteFooter, Steps } from '../../core/ui/landing'
import { APP, BRAND, childPath } from '../brand'
import { DEMO_CHILD_ID, demoData } from '../demo'
import { formatAge, formatDate } from '../format'
import { growthFor, useTables } from '../growthData'
import { useSession } from '../sessionContext'

function HeroPreview() {
  const tables = useTables()
  const { child, measurements, born } = demoData()
  const latest = measurements.at(-1)!
  const now = ageInDays(born, latest.date)
  const g = tables ? growthFor(tables, child, latest) : undefined
  const lengths = measurements.filter((m) => m.lengthCm !== undefined)
  return (
    <div className="preview" aria-label="A preview of BabyTrails with a made-up baby's measurements" role="img">
      <div className="preview-main device">
        <div className="preview-head">
          <div>
            <div className="metric-label">Weight</div>
            <div className="metric-value">
              {latest.weightKg!.toFixed(2)}
              <span className="unit">kg</span>
            </div>
          </div>
          {g?.wfa && (
            <div className="metric-flags">
              <Chip tone="accent">{formatPercentile(g.wfa.z)} percentile</Chip>
            </div>
          )}
        </div>
        {tables ? (
          <GrowthChart
            tables={tables}
            indicator="wfa"
            sex={child.sex}
            units="metric"
            ageDaysNow={now}
            caption={false}
            points={measurements.map((m) => ({ x: ageInDays(born, m.date), y: m.weightKg!, label: formatDate(m.date) }))}
          />
        ) : (
          <div className="skeleton loading-card" />
        )}
        <div className="metric-foot">WHO weight-for-age: shaded 3rd–97th and 15th–85th percentiles · made-up data</div>
      </div>
      <div className="preview-float">
        <MetricCard
          label="Length"
          value={latest.lengthCm!.toFixed(1)}
          unit="cm"
          chips={g?.lhfa && <Chip tone="accent">{formatPercentile(g.lhfa.z)} percentile</Chip>}
          foot={`At ${formatAge(born, latest.date)}`}
        >
          <Sparkline points={lengths.map((m) => ({ value: m.lengthCm! }))} />
        </MetricCard>
      </div>
    </div>
  )
}

export function Landing() {
  const { mode, startDemo, exitDemo } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const leaving = (location.state as { leaveDemo?: boolean } | null)?.leaveDemo === true
  useEffect(() => {
    if (leaving && mode === 'demo') exitDemo()
  }, [leaving, mode, exitDemo])
  const tryDemo = async () => {
    await startDemo()
    navigate(childPath(DEMO_CHILD_ID))
  }
  const appLabel = mode === 'locked' ? 'Unlock your vault' : mode === 'unlocked' ? 'Open your vault' : 'Set up your vault'

  return (
    <div className="landing">
      <LandingNav
        brand={BRAND}
        links={[
          { href: '#features', label: 'Features' },
          { href: '#how', label: 'How it works' },
          { href: '#privacy', label: 'Privacy' },
          { href: '#faq', label: 'FAQ' },
        ]}
        actions={
          <Link className="button small" to={APP}>
            Open app
          </Link>
        }
      />

      <main>
        <Hero
          eyebrow="Private by design · Free and open source"
          title={
            <>
              Every check-up,
              <br />
              on the growth charts.
            </>
          }
          lead="Keep your baby's measurements on the WHO growth charts, their growth reports and doctor's notes in one place, and get plain-language summaries of what's changed. Encrypted on your device."
          actions={
            <>
              <button className="button primary large" onClick={() => void tryDemo()}>
                Try the demo
              </button>
              <Link className="button large" to={APP}>
                {appLabel}
              </Link>
            </>
          }
          proof={[
            { value: 'No', label: 'account or server database' },
            { value: 'WHO', label: 'charts, birth to 5 years' },
            { value: 'MIT', label: 'open source' },
          ]}
          visual={<HeroPreview />}
        />

        <Section id="features" kicker="Features" title="Growth records you can actually read" lead="Weights, lengths and head sizes from every check-up, on the charts paediatricians use.">
          <FeatureGrid
            items={[
              { icon: LineChart, title: 'WHO growth charts', text: "Weight, length or height, head circumference, weight for length and BMI, from birth to 5 years, with percentiles worked out by WHO's own method." },
              { icon: Ruler, title: 'Quick entry at check-ups', text: 'Type the numbers on your phone and see the percentile as you type. Metric or imperial, and "7,25" works as well as "7.25".' },
              { icon: FileText, title: 'Documents in one place', text: "Growth reports, health booklet pages, doctor's notes and ultrasound images, stored encrypted and opened in the app." },
              { icon: ScanText, title: 'Reads growth reports', text: 'Optional, with your own key. The AI copies the measurements from a report or booklet page, Portuguese ones too; you check every value first.' },
              { icon: Sparkles, title: 'In plain words', text: "What changed since the last check-up, and questions for the next one. BabyTrails calculates the numbers; the AI only explains them." },
              { icon: Share2, title: 'A report card to share', text: 'The latest numbers, four WHO charts, gain over time and the history, as an image or PDF. Show the name, a nickname or no name.' },
            ]}
          />
        </Section>

        <Section id="how" tint kicker="How it works" title="From check-up to chart in a minute">
          <Steps
            items={[
              { title: 'Add your baby', text: 'Name, date of birth and sex, for the right WHO chart. Weeks of pregnancy at birth too, if you like.' },
              { title: 'Add the measurements', text: 'Type them in at the check-up, or add a growth report and let the AI read it for you to check.' },
              { title: 'See the trend', text: 'Every measurement on the WHO charts, the weight gained per week, and a page to share with family.' },
            ]}
          />
          <div className="showcases">
            <Showcase
              checkIcon={Check}
              title="The AI copies. You confirm."
              text="Reading a growth report sends it to Anthropic only after you agree, on a screen that lists exactly what goes and what doesn't."
              points={['Never your baby\'s name or date of birth in the prompt', 'Units converted by BabyTrails, not the AI', 'Every value sits next to the original page', 'Only the values you tick are saved']}
              visual={
                <div className="device">
                  <img src="/landing/review.png" alt="Checking measurements read from a made-up growth report, with the report page next to each value to confirm" loading="lazy" width="1280" height="860" />
                </div>
              }
            />
            <Showcase
              reverse
              checkIcon={Check}
              title="A report card for the grandparents"
              text="The latest weight, length and head circumference with their percentiles, four WHO charts, gain over time and the history, drawn from your records."
              points={['A phone-sized image to send, or an A4 PDF to print', 'A nickname or no name, and the age instead of the date of birth', 'Every number worked out by BabyTrails; the AI summary only if you add it', 'A file you share yourself, never a link to a server']}
              visual={
                <div className="device">
                  <img src="/landing/report.png" alt="A report card of a made-up baby: the latest numbers, four growth charts, gain over time and the history" loading="lazy" width="1080" height="1920" />
                </div>
              }
            />
          </div>
        </Section>

        <Section id="privacy">
          <PrivacyPanel
            checkIcon={Check}
            title="Your baby's records never reach our server"
            text="BabyTrails is a website that runs entirely in your browser. Everything you enter or upload is encrypted with a key made from your passphrase, and stays on your device."
            points={[
              'Encrypted at rest with AES-256-GCM; the key comes from your passphrase with Argon2id',
              'No account, no server database, no analytics, no cookies',
              'AI is optional and uses your own key; you see what is sent before it goes',
              'Open source, with a public threat model that explains the limits',
            ]}
            footer={
              <p>
                <a href={`${BRAND.repo}/blob/main/THREAT_MODEL.md`}>Read the threat model</a>
              </p>
            }
          />
        </Section>

        <Section id="faq" kicker="FAQ" title="Questions">
          <Faq
            items={[
              { q: 'Is this medical advice?', a: "No. BabyTrails keeps records, draws charts and explains numbers. It never says whether a baby is healthy and doesn't interpret images. Talk to your paediatrician about anything that worries you." },
              { q: 'Where are the records stored?', a: "Only in your browser, encrypted. There's no account and no copy on our server. To move them to another device, or keep them safe, download an encrypted backup." },
              { q: 'What if I forget my passphrase?', a: "Nobody can reset it, including us, so the records can't be recovered without a backup. Keep a backup somewhere other than your phone." },
              { q: 'Which charts does it use?', a: "The WHO Child Growth Standards, from birth to 5 years. The US CDC recommends them from birth to 2 years, and Portugal's national child health programme uses them. CDC charts for children over 2 aren't in BabyTrails yet." },
              { q: 'What does it cost?', a: 'BabyTrails is free. The AI features use your own Anthropic account: about 1 US cent for a summary and about 2 cents to read a two-page growth report, at current prices. Everything else works without a key.' },
              { q: 'Can both parents use it?', a: "Each phone has its own vault for now. You can export a backup on one phone and import it on another, but changes don't sync between them yet." },
              { q: 'Does it work on my phone?', a: 'Yes. It installs like an app and works offline. On iPhone, add it to your Home Screen so Safari keeps its data.' },
              { q: 'Who made it?', a: <>Thomas Butman, as an open-source project alongside its sister app, <a href={BRAND.sister.url}>{BRAND.sister.name}</a>. The code is on <a href={BRAND.repo}>GitHub</a>.</> },
            ]}
          />
        </Section>

        <Section>
          <CtaBand
            title="See it with a made-up baby first"
            text="The demo has six months of measurements and a sample growth report. No passphrase, no key."
            actions={
              <>
                <button className="button primary large" onClick={() => void tryDemo()}>
                  Try the demo
                </button>
                <Link className="button large" to={APP}>
                  {appLabel}
                </Link>
              </>
            }
          />
        </Section>
      </main>

      <SiteFooter
        brand={BRAND}
        product={[
          { label: 'Open the app', to: APP },
          { label: 'About the data and charts', to: `${APP}/about` },
        ]}
      />
    </div>
  )
}
