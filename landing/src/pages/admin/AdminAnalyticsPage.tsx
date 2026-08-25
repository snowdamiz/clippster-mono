import { useCallback, useEffect, useState } from 'react'
import { Activity, BarChart3, Download, Eye, Loader2, MousePointerClick, Percent, RefreshCw, Users } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  getAnalyticsStats,
  type AnalyticsBreakdownItem,
  type AnalyticsDashboard,
  type AnalyticsRange,
  type LandingAnalyticsRecentEvent,
} from '@/services/adminApi'
import './AdminAnalyticsPage.css'

function formatEventName(eventType: string): string {
  const names: Record<string, string> = {
    clip_detection: 'Clip Detection',
    clip_export: 'Clip Export',
    vod_download: 'VOD Download',
    user_created: 'User Created',
    credits_purchased: 'Credits Purchased',
    credits_spent: 'Credits Spent',
    landing_page_view: 'Landing Page View',
    landing_download_click: 'Landing Download Click',
    landing_download_disabled_click: 'Disabled Download Click',
    landing_nav_click: 'Landing Navigation Click',
    landing_cta_click: 'Landing CTA Click',
    landing_signup_click: 'Landing Signup Click',
    landing_pricing_click: 'Landing Pricing Click',
    landing_external_link_click: 'Landing External Link Click',
  }

  return names[eventType] || eventType.replaceAll('_', ' ')
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function MetricCard({
  icon: Icon,
  label,
  range,
  value,
  suffix = '',
}: {
  icon: typeof Eye
  label: string
  range?: AnalyticsRange
  value?: number
  suffix?: string
}) {
  const total = value ?? range?.total ?? 0

  return (
    <div className="admin-analytics__metric">
      <div className="admin-analytics__metric-top">
        <div className="admin-analytics__metric-icon">
          <Icon className="admin-analytics__metric-icon-svg" />
        </div>
        <span className="admin-analytics__metric-label">{label}</span>
      </div>
      <p className="admin-analytics__metric-value">
        {formatNumber(total)}
        {suffix}
      </p>
      {range ? (
        <p className="admin-analytics__metric-sub">
          {formatNumber(range.today)} today / {formatNumber(range.this_week)} this week
        </p>
      ) : null}
    </div>
  )
}

function BreakdownPanel({
  title,
  items,
  emptyLabel = 'No data yet',
}: {
  title: string
  items: AnalyticsBreakdownItem[]
  emptyLabel?: string
}) {
  const maxTotal = Math.max(...items.map((item) => item.total), 1)

  return (
    <section className="admin-analytics__panel">
      <div className="admin-analytics__panel-heading">
        <h3 className="admin-analytics__panel-title">{title}</h3>
      </div>
      {items.length > 0 ? (
        <div className="admin-analytics__breakdown-list">
          {items.map((item) => (
            <div key={item.label} className="admin-analytics__breakdown-row">
              <div className="admin-analytics__breakdown-label-row">
                <span className="admin-analytics__breakdown-label">{item.label}</span>
                <span className="admin-analytics__breakdown-count">{formatNumber(item.total)}</span>
              </div>
              <div className="admin-analytics__bar-track">
                <div className="admin-analytics__bar-fill" style={{ width: `${Math.max((item.total / maxTotal) * 100, 4)}%` }} />
              </div>
              <span className="admin-analytics__breakdown-sub">
                {formatNumber(item.today)} today / {formatNumber(item.this_week)} this week
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="admin-analytics__panel-empty">{emptyLabel}</p>
      )}
    </section>
  )
}

function describeEvent(event: LandingAnalyticsRecentEvent): string {
  const metadata = event.metadata || {}
  const parts = [
    metadata.download_label,
    metadata.button_label,
    metadata.source,
    metadata.path,
    metadata.referrer_host,
  ].filter((part): part is string | number | boolean => Boolean(part))

  return parts.length > 0 ? parts.map(String).join(' / ') : 'No metadata'
}

export function AdminAnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAnalyticsStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAnalyticsStats()
      setAnalyticsData(data)
    } catch (error) {
      console.error('Error fetching analytics stats:', error)
      setAnalyticsData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAnalyticsStats()
  }, [fetchAnalyticsStats])

  const landing = analyticsData?.landing
  const eventStats = analyticsData?.stats ?? {}
  const hasEventStats = Object.keys(eventStats).length > 0

  return (
    <PageLayout
      title="Analytics"
      icon={BarChart3}
      actions={
        <button className="admin-analytics__action-btn" disabled={loading} onClick={() => void fetchAnalyticsStats()}>
          {!loading ? (
            <RefreshCw className="admin-analytics__action-icon" />
          ) : (
            <Loader2 className="admin-analytics__action-icon admin-analytics__action-icon--spin" />
          )}
          Refresh Analytics
        </button>
      }
    >
      <div className="admin-analytics-page">
        <div className="admin-analytics">
          <div className="admin-analytics__heading">
            <h1 className="admin-analytics__title">Analytics</h1>
            <p className="admin-analytics__subtitle">Landing visits, downloads, conversion intent, and platform events</p>
          </div>

          <div className="admin-analytics__stats-header">
            <div className="admin-analytics__stats-info">
              <div className="admin-analytics__stats-icon">
                <BarChart3 className="admin-analytics__stats-icon-svg" />
              </div>
              <div>
                <h2 className="admin-analytics__stats-title">Landing Performance</h2>
                <p className="admin-analytics__stats-desc">Visits, visitor sessions, download clicks, and source breakdowns</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="admin-analytics__loading">
              <Loader2 className="admin-analytics__loading-icon" />
              <p className="admin-analytics__loading-text">Loading analytics...</p>
            </div>
          ) : analyticsData ? (
            <>
              {landing ? (
                <>
                  <div className="admin-analytics__metrics-grid">
                    <MetricCard icon={Eye} label="Page Views" range={landing.overview.page_views} />
                    <MetricCard icon={Users} label="Unique Visitors" range={landing.overview.unique_visitors} />
                    <MetricCard icon={Download} label="Download Clicks" range={landing.overview.download_clicks} />
                    <MetricCard icon={Percent} label="Download Conversion" value={landing.overview.conversion_rate} suffix="%" />
                  </div>

                  <div className="admin-analytics__panel-grid">
                    <BreakdownPanel title="Downloads By Platform" items={landing.downloads_by_platform} />
                    <BreakdownPanel title="Downloads By Source" items={landing.downloads_by_source} />
                    <BreakdownPanel title="Visits By Page" items={landing.visits_by_page} />
                    <BreakdownPanel title="Referrers" items={landing.referrers} />
                    <BreakdownPanel title="Devices" items={landing.devices} />
                    <BreakdownPanel title="Browsers" items={landing.browsers} />
                    <BreakdownPanel title="Campaigns" items={landing.campaigns} />
                  </div>

                  <section className="admin-analytics__panel">
                    <div className="admin-analytics__panel-heading">
                      <h3 className="admin-analytics__panel-title">Recent Landing Events</h3>
                    </div>
                    {landing.recent_events.length > 0 ? (
                      <div className="admin-analytics__events">
                        {landing.recent_events.map((event) => (
                          <div key={event.id} className="admin-analytics__event-row">
                            <div className="admin-analytics__event-icon">
                              <MousePointerClick className="admin-analytics__event-icon-svg" />
                            </div>
                            <div className="admin-analytics__event-body">
                              <div className="admin-analytics__event-main">
                                <span className="admin-analytics__event-name">{formatEventName(event.event_type)}</span>
                                <span className="admin-analytics__event-time">{formatDate(event.inserted_at)}</span>
                              </div>
                              <p className="admin-analytics__event-meta">{describeEvent(event)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-analytics__panel-empty">No landing events yet</p>
                    )}
                  </section>
                </>
              ) : null}

              {hasEventStats ? (
                <section className="admin-analytics__events-section">
                  <div className="admin-analytics__panel-heading">
                    <h3 className="admin-analytics__panel-title">All Event Totals</h3>
                  </div>
                  <div className="admin-analytics__grid">
                    {Object.entries(eventStats).map(([eventType, stats]) => (
                      <div key={eventType} className="admin-analytics__card">
                        <div className="admin-analytics__card-header">
                          <div className="admin-analytics__card-icon">
                            <Activity className="admin-analytics__card-icon-svg" />
                          </div>
                          <h3 className="admin-analytics__card-title">{formatEventName(eventType)}</h3>
                        </div>

                        <div className="admin-analytics__card-stats">
                          <div className="admin-analytics__stat">
                            <p className="admin-analytics__stat-label">Today</p>
                            <p className="admin-analytics__stat-value">{formatNumber(stats.today)}</p>
                          </div>
                          <div className="admin-analytics__stat">
                            <p className="admin-analytics__stat-label">This Week</p>
                            <p className="admin-analytics__stat-value">{formatNumber(stats.this_week)}</p>
                          </div>
                          <div className="admin-analytics__stat admin-analytics__stat--highlight">
                            <p className="admin-analytics__stat-label">Total</p>
                            <p className="admin-analytics__stat-value admin-analytics__stat-value--highlight">{formatNumber(stats.total)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="admin-analytics__empty">
              <div className="admin-analytics__empty-icon">
                <BarChart3 className="admin-analytics__empty-icon-svg" />
              </div>
              <p className="admin-analytics__empty-text">No analytics data available</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
