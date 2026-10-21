import {useDownloads} from '@/hooks/usePlatform'
import {trackDownloadClick} from '@/services/landingAnalytics'
export function DownloadLink({className='',source}:{className?:string;source:string}){
 const {primaryDownload}=useDownloads()
 return <a className={className} href={primaryDownload?.downloadUrl || 'https://github.com/snowdamiz/clippster-releases/releases/latest'} onClick={()=>{if(primaryDownload)trackDownloadClick(primaryDownload,source,'Download')}}>{primaryDownload?'Download for '+primaryDownload.label:'Download for Mac or Windows'} <span aria-hidden="true">↗</span></a>
}