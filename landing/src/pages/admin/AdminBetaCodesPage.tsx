import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle, Copy, KeyRound, Loader2, Plus, RefreshCw, XCircle } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { generateBetaCodes, listBetaCodes, type BetaCode, type BetaCodeStats } from '@/services/adminApi'
import './AdminBetaCodesPage.css'

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

export function AdminBetaCodesPage() {
  const [betaCodes, setBetaCodes] = useState<BetaCode[]>([])
  const [betaCodeStats, setBetaCodeStats] = useState<BetaCodeStats>({ total: 0, used: 0, available: 0 })
  const [loading, setLoading] = useState(false)
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [generateCodeCount, setGenerateCodeCount] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null)

  const availableBetaCodes = useMemo(() => betaCodes.filter((code) => !code.used), [betaCodes])

  const fetchBetaCodes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await listBetaCodes()
      setBetaCodes(result.codes)
      setBetaCodeStats(result.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleGenerateCodes = useCallback(async () => {
    if (generateCodeCount < 1 || generateCodeCount > 100) {
      setError('Please enter a number between 1 and 100')
      return
    }

    setGeneratingCodes(true)
    setError(null)

    try {
      await generateBetaCodes(generateCodeCount)
      await fetchBetaCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setGeneratingCodes(false)
    }
  }, [fetchBetaCodes, generateCodeCount])

  const copyBetaCode = useCallback(async (code: string, codeId: number) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCodeId(codeId)
      window.setTimeout(() => {
        setCopiedCodeId(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }, [])

  const copyAllAvailableCodes = useCallback(async () => {
    const availableCodes = betaCodes
      .filter((code) => !code.used)
      .map((code) => code.code)
      .join('\n')

    if (!availableCodes) {
      setError('No available codes to copy')
      return
    }

    try {
      await navigator.clipboard.writeText(availableCodes)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }, [betaCodes])

  useEffect(() => {
    void fetchBetaCodes()
  }, [fetchBetaCodes])

  return (
    <PageLayout
      title="Beta Codes"
      icon={KeyRound}
      actions={
        <button className="admin-beta__action-btn" disabled={loading} onClick={() => void fetchBetaCodes()}>
          {!loading ? (
            <RefreshCw className="admin-beta__action-icon" />
          ) : (
            <Loader2 className="admin-beta__action-icon admin-beta__action-icon--spin" />
          )}
          Refresh Codes
        </button>
      }
    >
      <div className="admin-beta-page">
        <div className="admin-beta">
          <div className="admin-beta__heading">
            <h1 className="admin-beta__title">Beta Codes</h1>
            <p className="admin-beta__subtitle">Generate and manage beta access codes</p>
          </div>

          <div className="admin-beta__cards">
            <div className="admin-beta__card">
              <div className="admin-beta__card-header">
                <div className="admin-beta__card-icon admin-beta__card-icon--amber">
                  <KeyRound className="admin-beta__card-icon-svg" />
                </div>
                <h3 className="admin-beta__card-label">Total Codes</h3>
              </div>
              <p className="admin-beta__card-value">{betaCodeStats.total}</p>
            </div>

            <div className="admin-beta__card">
              <div className="admin-beta__card-header">
                <div className="admin-beta__card-icon admin-beta__card-icon--green">
                  <CheckCircle className="admin-beta__card-icon-svg" />
                </div>
                <h3 className="admin-beta__card-label">Available</h3>
              </div>
              <p className="admin-beta__card-value admin-beta__card-value--green">{betaCodeStats.available}</p>
            </div>

            <div className="admin-beta__card">
              <div className="admin-beta__card-header">
                <div className="admin-beta__card-icon admin-beta__card-icon--amber">
                  <XCircle className="admin-beta__card-icon-svg" />
                </div>
                <h3 className="admin-beta__card-label">Used</h3>
              </div>
              <p className="admin-beta__card-value admin-beta__card-value--amber">{betaCodeStats.used}</p>
            </div>
          </div>

          <div className="admin-beta__generate">
            <div className="admin-beta__generate-info">
              <div className="admin-beta__generate-icon">
                <KeyRound className="admin-beta__generate-icon-svg" />
              </div>
              <div>
                <h2 className="admin-beta__generate-title">Generate Beta Codes</h2>
                <p className="admin-beta__generate-desc">Create new codes for beta testers</p>
              </div>
            </div>

            <div className="admin-beta__generate-actions">
              <input
                value={generateCodeCount}
                type="number"
                min={1}
                max={100}
                className="admin-beta__generate-input"
                onChange={(event) => setGenerateCodeCount(Number(event.target.value))}
              />

              <button className="admin-beta__generate-btn" disabled={generatingCodes} onClick={() => void handleGenerateCodes()}>
                {generatingCodes ? (
                  <Loader2 className="admin-beta__generate-btn-icon admin-beta__generate-btn-icon--spin" />
                ) : (
                  <Plus className="admin-beta__generate-btn-icon" />
                )}
                Generate
              </button>

              {availableBetaCodes.length > 0 ? (
                <button className="admin-beta__copy-all-btn" onClick={() => void copyAllAvailableCodes()}>
                  <Copy className="admin-beta__copy-all-icon" />
                  Copy All
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="admin-beta__error">
              <AlertTriangle className="admin-beta__error-icon" />
              <p className="admin-beta__error-text">{error}</p>
            </div>
          ) : null}

          {loading && !betaCodes.length ? (
            <div className="admin-beta__loading">
              <Loader2 className="admin-beta__loading-icon" />
              <p className="admin-beta__loading-text">Loading beta codes...</p>
            </div>
          ) : betaCodes.length > 0 ? (
            <div className="admin-beta__table-wrapper">
              <div className="admin-beta__table-scroll">
                <table className="admin-beta__table">
                  <thead className="admin-beta__thead">
                    <tr>
                      <th className="admin-beta__th">Code</th>
                      <th className="admin-beta__th">Status</th>
                      <th className="admin-beta__th">Used By</th>
                      <th className="admin-beta__th">Created</th>
                      <th className="admin-beta__th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="admin-beta__tbody">
                    {betaCodes.map((code) => (
                      <tr key={code.id} className="admin-beta__row">
                        <td className="admin-beta__td">
                          <code className="admin-beta__code">{code.code}</code>
                        </td>
                        <td className="admin-beta__td">
                          {code.used ? (
                            <span className="admin-beta__status admin-beta__status--used">
                              <XCircle className="admin-beta__status-icon" />
                              Used
                            </span>
                          ) : (
                            <span className="admin-beta__status admin-beta__status--available">
                              <CheckCircle className="admin-beta__status-icon" />
                              Available
                            </span>
                          )}
                        </td>
                        <td className="admin-beta__td">
                          {code.used_by ? (
                            code.used_by.email ? (
                              <span className="admin-beta__user">{code.used_by.email}</span>
                            ) : code.used_by.wallet_address ? (
                              <code className="admin-beta__wallet">{formatWalletAddress(code.used_by.wallet_address)}</code>
                            ) : (
                              <span className="admin-beta__user">User #{code.used_by.id}</span>
                            )
                          ) : (
                            <span className="admin-beta__no-user">-</span>
                          )}
                        </td>
                        <td className="admin-beta__td">
                          <span className="admin-beta__date">{formatDate(code.created_at)}</span>
                        </td>
                        <td className="admin-beta__td">
                          {!code.used ? (
                            <button className="admin-beta__copy-btn" onClick={() => void copyBetaCode(code.code, code.id)}>
                              {copiedCodeId === code.id ? (
                                <Check className="admin-beta__copy-icon admin-beta__copy-icon--success" />
                              ) : (
                                <Copy className="admin-beta__copy-icon" />
                              )}
                              {copiedCodeId === code.id ? 'Copied!' : 'Copy'}
                            </button>
                          ) : (
                            <span className="admin-beta__used-at">Used {code.used_at ? formatDate(code.used_at) : ''}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="admin-beta__empty">
              <div className="admin-beta__empty-icon">
                <KeyRound className="admin-beta__empty-icon-svg" />
              </div>
              <p className="admin-beta__empty-text">No beta codes generated yet</p>
              <button className="admin-beta__empty-btn" disabled={generatingCodes} onClick={() => void handleGenerateCodes()}>
                Generate Your First Codes
              </button>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
