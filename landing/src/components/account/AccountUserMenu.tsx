import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, LogOut, UserCircle, Settings } from 'lucide-react'
export function AccountUserMenu({ name, email, avatarUrl, onSignOut, onSettings }: { name: string; email?: string; avatarUrl?: string; onSignOut: () => void; onSettings: () => void }) {
  const [open,setOpen]=useState(false), root=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null)
  const [avatarFailed,setAvatarFailed]=useState(false)
  useEffect(()=>setAvatarFailed(false),[avatarUrl])
  useEffect(()=>{
    if(!open)return
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)}
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        const items=Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])
        const index=items.indexOf(document.activeElement as HTMLElement)
        event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()
      }
    }
    document.addEventListener('mousedown',outside);document.addEventListener('keydown',keys)
    return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',keys)}
  },[open])
  return <div ref={root} className="relative p-3 border-t border-zinc-800" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false)}}>
    <button ref={trigger} aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800/60">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-400 text-xs font-extrabold text-black">{avatarUrl&&!avatarFailed?<img src={avatarUrl} onError={()=>setAvatarFailed(true)} alt="" className="h-full w-full object-cover" />:name.slice(0,2).toUpperCase()}</span><span className="flex-1 truncate text-left text-xs">{name}</span><ChevronRight size={14} />
    </button>
    {open&&<div role="menu" aria-label="Account" className="absolute bottom-3 left-3 z-[260] w-56 rounded-lg border border-zinc-800 bg-[#111112] p-1 shadow-xl md:bottom-3 md:left-[calc(100%+12px)]">
      <div className="truncate px-3 py-2 text-xs text-zinc-500">{email || name}</div><div className="my-1 h-px bg-zinc-800" />
      <Link role="menuitem" to="/account/profile" onClick={()=>setOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-100 no-underline hover:bg-white/5 focus:bg-white/5"><UserCircle size={16} />Clipper Profile</Link>
      <div className="my-1 h-px bg-zinc-800" /><button role="menuitem" onClick={()=>{setOpen(false);onSettings()}} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"><Settings size={16} />Account Settings</button>
      <div className="my-1 h-px bg-zinc-800" /><button role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"><LogOut size={16} />Sign out</button>
    </div>}
  </div>
}
