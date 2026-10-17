import {Link} from 'react-router-dom'
import {useDownloads} from '@/hooks/usePlatform'
import {DownloadLink} from './marketing/DownloadLink'
import {trackDownloadClick,trackLandingEvent} from '@/services/landingAnalytics'
export function CTA(){
 const {downloads}=useDownloads()
 return <section className="page-section download-section" id="download"><p className="eyebrow">YOUR NEXT MOMENT STARTS HERE</p><h2>Ready to make the cut?</h2><p>Clippster is in open beta. Available for macOS and Windows.</p><p className="publish-note">Publish to TikTok, YouTube Shorts, Instagram Reels, and X.</p><DownloadLink className="cta primary" source="cta_primary"/><details className="versions"><summary>Other versions</summary><p>{downloads.map(download=><a key={download.platform.os+'-'+download.platform.arch} href={download.downloadUrl} onClick={()=>trackDownloadClick(download,'cta_other_versions',download.label)}>{download.label}</a>)}</p></details><p className="fine">Choose the version for your Mac or Windows computer.</p><Link to="/pricing" onClick={()=>trackLandingEvent('landing_pricing_click',{source:'cta_pricing_link',button_label:'View pricing plans'})}>View pricing plans ↗</Link></section>
}