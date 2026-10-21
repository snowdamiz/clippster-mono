import { useEffect, useLayoutEffect, useRef } from 'react'
import { mountEmailComposer } from '../../../../packages/email-composer/src/composer'
import type { ComposerProps } from '../../../../packages/email-composer/src/composer'

export function EmailTemplateEditor(props: ComposerProps & { onChange: (body: string, valid: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const composer = useRef<ReturnType<typeof mountEmailComposer> | null>(null)
  const latest = useRef(props)
  useLayoutEffect(() => {
    latest.current = props
  })
  useEffect(() => {
    composer.current = mountEmailComposer(host.current!, latest.current, (body, valid) =>
      latest.current.onChange(body, valid)
    )
    return () => {
      composer.current?.destroy()
      composer.current = null
    }
  }, [])
  useEffect(() => {
    composer.current?.update(props)
  }, [props.body, props.subject, props.preheader, props.audience])
  return <div ref={host} />
}
