import { useCallback, useEffect, useState } from 'react'
import { Activity, BarChart3, Loader2, RefreshCw } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { getAnalyticsStats, type AnalyticsStats } from '@/services/adminApi'
import './AdminAnalyticsPage.css'

type AnalyticsStatsMap = Record<string, { total: number; today: number; this_week: number }>

function formatEventName(eventType: string): string {
  const names: Record<string, string> = {
    clip_detection: 'Clip Detection',
    clip_export: 'Clip Export',
    vod_download: 'VOD Download',
    user_created: 'User Created',
    credits_purchased: 'Credits Purchased',
    credits_spent: 'Credits Spent',
  }

  return names[eventType] || eventType
}

export function AdminAnalyticsPage() {
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStatsMap | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAnalyticsStats = useCallback(async () => {
    setLoading(true)
    try {
      const stats: AnalyticsStats = await getAnalyticsStats()
      setAnalyticsStats(Object.keys(stats).length > 0 ? stats : null)
    } catch (error) {
      console.error('Error fetching analytics stats:', error)
      setAnalyticsStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAnalyticsStats()
  }, [fetchAnalyticsStats])

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
            <p className="admin-analytics__subtitle">Track key user actions and events</p>
          </div>

          <div className="admin-analytics__stats-header">
            <div className="admin-analytics__stats-info">
              <div className="admin-analytics__stats-icon">
                <BarChart3 className="admin-analytics__stats-icon-svg" />
              </div>
              <div>
                <h2 className="admin-analytics__stats-title">Analytics</h2>
                <p className="admin-analytics__stats-desc">Track key user actions and events</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="admin-analytics__loading">
              <Loader2 className="admin-analytics__loading-icon" />
              <p className="admin-analytics__loading-text">Loading analytics...</p>
            </div>
          ) : analyticsStats ? (
            <div className="admin-analytics__grid">
              {Object.entries(analyticsStats).map(([eventType, stats]) => (
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
                      <p className="admin-analytics__stat-value">{stats.today}</p>
                    </div>
                    <div className="admin-analytics__stat">
                      <p className="admin-analytics__stat-label">This Week</p>
                      <p className="admin-analytics__stat-value">{stats.this_week}</p>
                    </div>
                    <div className="admin-analytics__stat admin-analytics__stat--highlight">
                      <p className="admin-analytics__stat-label">Total</p>
                      <p className="admin-analytics__stat-value admin-analytics__stat-value--highlight">{stats.total}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
