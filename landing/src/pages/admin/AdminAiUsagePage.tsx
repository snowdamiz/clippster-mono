import { useCallback, useEffect, useState } from 'react'
import { Activity, Layers, RefreshCw } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { getAiUsageStats, type AiUsageResponse } from '@/services/adminApi'
import './AdminAiUsagePage.css'

function formatNumber(num: number) {
  return new Intl.NumberFormat('en-US').format(num || 0)
}

function formatDuration(seconds: string | number) {
  const secs = Number(seconds) || 0
  if (secs < 60) return `${secs.toFixed(1)}s`

  const mins = Math.floor(secs / 60)
  const remainingSecs = (secs % 60).toFixed(0)
  return `${mins}m ${remainingSecs}s`
}

function formatWalletAddress(address: string) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(dateString: string) {
  if (!dateString) return 'N/A'

  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Invalid date'
  }
}

export function AdminAiUsagePage() {
  const [aiStats, setAiStats] = useState<AiUsageResponse | null>(null)

  const fetchAiStats = useCallback(async () => {
    try {
      const response = await getAiUsageStats()
      setAiStats(response)
    } catch (error) {
      console.error('Error fetching AI stats:', error)
    }
  }, [])

  useEffect(() => {
    void fetchAiStats()
  }, [fetchAiStats])

  return (
    <PageLayout
      title="AI Usage"
      icon={Activity}
      actions={
        <button className="admin-ai__action-btn" onClick={() => void fetchAiStats()}>
          <RefreshCw className="admin-ai__action-icon" />
          Refresh Stats
        </button>
      }
    >
      <div className="admin-ai-page">
        <div className="admin-ai">
          <div className="admin-ai__heading">
            <h1 className="admin-ai__title">AI Usage Stats</h1>
            <p className="admin-ai__subtitle">Monitor AI service consumption and performance</p>
          </div>

          <div className="admin-ai__stats-header">
            <div className="admin-ai__stats-icon">
              <Activity className="admin-ai__stats-icon-svg" />
            </div>
            <div>
              <h2 className="admin-ai__stats-title">AI Usage Stats</h2>
              <p className="admin-ai__stats-desc">Monitor AI service consumption and performance</p>
            </div>
          </div>

          {aiStats ? (
            <>
              <div className="admin-ai__cards">
                <div className="admin-ai__card">
                  <div className="admin-ai__card-header">
                    <div className="admin-ai__card-icon admin-ai__card-icon--blue">
                      <Activity className="admin-ai__card-icon-svg" />
                    </div>
                    <h3 className="admin-ai__card-label">Total Tokens</h3>
                  </div>
                  <p className="admin-ai__card-value">{formatNumber(aiStats.stats.total_tokens)}</p>
                </div>

                <div className="admin-ai__card">
                  <div className="admin-ai__card-header">
                    <div className="admin-ai__card-icon admin-ai__card-icon--green">
                      <Activity className="admin-ai__card-icon-svg" />
                    </div>
                    <h3 className="admin-ai__card-label">Total Duration</h3>
                  </div>
                  <p className="admin-ai__card-value">{formatDuration(aiStats.stats.total_duration)}</p>
                </div>

                <div className="admin-ai__card">
                  <div className="admin-ai__card-header">
                    <div className="admin-ai__card-icon admin-ai__card-icon--purple">
                      <Layers className="admin-ai__card-icon-svg" />
                    </div>
                    <h3 className="admin-ai__card-label">Active Providers</h3>
                  </div>
                  <p className="admin-ai__card-value">{aiStats.stats.provider_stats.length}</p>
                </div>
              </div>

              <div className="admin-ai__breakdown">
                <div className="admin-ai__breakdown-card">
                  <div className="admin-ai__breakdown-header">
                    <h3 className="admin-ai__breakdown-title">Usage by Model</h3>
                  </div>
                  <div className="admin-ai__breakdown-scroll">
                    <table className="admin-ai__breakdown-table">
                      <thead>
                        <tr>
                          <th className="admin-ai__breakdown-th">Model</th>
                          <th className="admin-ai__breakdown-th admin-ai__breakdown-th--right">Requests</th>
                          <th className="admin-ai__breakdown-th admin-ai__breakdown-th--right">Tokens</th>
                          <th className="admin-ai__breakdown-th admin-ai__breakdown-th--right">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiStats.stats.model_stats.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="admin-ai__breakdown-empty">
                              No usage data available
                            </td>
                          </tr>
                        ) : (
                          aiStats.stats.model_stats.map((stat) => (
                            <tr key={stat.model} className="admin-ai__breakdown-row">
                              <td className="admin-ai__breakdown-td">
                                <div className="admin-ai__breakdown-model">
                                  <span className="admin-ai__breakdown-model-name">{stat.model}</span>
                                  <span className="admin-ai__breakdown-model-provider">{stat.provider}</span>
                                </div>
                              </td>
                              <td className="admin-ai__breakdown-td admin-ai__breakdown-td--right">{formatNumber(stat.count)}</td>
                              <td className="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                                {stat.total_tokens ? formatNumber(stat.total_tokens) : '-'}
                              </td>
                              <td className="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                                {stat.total_duration && parseFloat(String(stat.total_duration)) > 0
                                  ? formatDuration(stat.total_duration)
                                  : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="admin-ai__breakdown-card">
                  <div className="admin-ai__breakdown-header">
                    <h3 className="admin-ai__breakdown-title">Usage by Operation</h3>
                  </div>
                  <div className="admin-ai__breakdown-scroll">
                    <table className="admin-ai__breakdown-table">
                      <thead>
                        <tr>
                          <th className="admin-ai__breakdown-th">Operation</th>
                          <th className="admin-ai__breakdown-th admin-ai__breakdown-th--right">Requests</th>
                          <th className="admin-ai__breakdown-th admin-ai__breakdown-th--right">Tokens</th>
                          <th className="admin-ai__breakdown-th admin-ai__breakdown-th--right">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiStats.stats.operation_stats.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="admin-ai__breakdown-empty">
                              No usage data available
                            </td>
                          </tr>
                        ) : (
                          aiStats.stats.operation_stats.map((stat) => (
                            <tr key={stat.operation} className="admin-ai__breakdown-row">
                              <td className="admin-ai__breakdown-td admin-ai__breakdown-td--capitalize">
                                {stat.operation.replace(/_/g, ' ')}
                              </td>
                              <td className="admin-ai__breakdown-td admin-ai__breakdown-td--right">{formatNumber(stat.count)}</td>
                              <td className="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                                {stat.total_tokens ? formatNumber(stat.total_tokens) : '-'}
                              </td>
                              <td className="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                                {stat.total_duration && parseFloat(String(stat.total_duration)) > 0
                                  ? formatDuration(stat.total_duration)
                                  : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {aiStats.recent_logs.length > 0 ? (
                <div className="admin-ai__logs">
                  <div className="admin-ai__logs-header">
                    <h3 className="admin-ai__logs-title">Recent Activity</h3>
                  </div>
                  <div className="admin-ai__logs-scroll">
                    <table className="admin-ai__logs-table">
                      <thead>
                        <tr>
                          <th className="admin-ai__logs-th">Time</th>
                          <th className="admin-ai__logs-th">User</th>
                          <th className="admin-ai__logs-th">Operation</th>
                          <th className="admin-ai__logs-th">Provider/Model</th>
                          <th className="admin-ai__logs-th">Usage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiStats.recent_logs.map((log) => (
                          <tr key={log.id} className="admin-ai__logs-row">
                            <td className="admin-ai__logs-td">{formatDate(log.created_at)}</td>
                            <td className="admin-ai__logs-td">
                              <code className="admin-ai__logs-wallet">{formatWalletAddress(log.user_wallet)}</code>
                            </td>
                            <td className="admin-ai__logs-td">
                              <span className="admin-ai__logs-operation">{log.operation}</span>
                            </td>
                            <td className="admin-ai__logs-td">
                              <div className="admin-ai__logs-provider">
                                <span className="admin-ai__logs-provider-name">{log.provider}</span>
                                <span className="admin-ai__logs-provider-model">{log.model}</span>
                              </div>
                            </td>
                            <td className="admin-ai__logs-td">
                              {log.tokens ? <div className="admin-ai__logs-usage">{formatNumber(log.tokens)} tokens</div> : null}
                              {log.duration ? <div className="admin-ai__logs-duration">{formatDuration(log.duration)}</div> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </PageLayout>
  )
}
