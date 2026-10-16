import type {ReactNode} from 'react'
import {useLocation} from 'react-router-dom'
import {getPage} from '@/seo/content'
export function MarketingTheme({children}:{children:ReactNode}){
 const {pathname}=useLocation()
 const enabled=!!getPage(pathname)||/^\/(clippers|orgs)\//.test(pathname)
 return <div className={enabled?'marketing-site'+(pathname==='/'?' marketing-home':''):undefined}>{children}</div>
}