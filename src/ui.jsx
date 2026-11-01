import { useCallback, useEffect, useRef, useState } from 'react'

let openSheets = 0

export function Sheet({ title, sub, onClose, children, footer, tall }) {
  useEffect(() => {
    // Lock the page behind the sheet so it doesn't scroll on iPhone.
    if (openSheets++ === 0) { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden' }
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (--openSheets === 0) { document.documentElement.style.overflow = ''; document.body.style.overflow = '' }
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${tall ? ' tall' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-head">
          <div className="grab" />
          {title && <h3>{title}</h3>}
          {sub && <p className="sub">{sub}</p>}
          <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ emoji, text, cta, onCta }) {
  return (
    <div className="empty">
      <div className="big">{emoji}</div>
      <p>{text}</p>
      {cta && <button className="btn btn-primary" onClick={onCta}>{cta}</button>}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((message, undo) => {
    clearTimeout(timer.current)
    setToast({ message, undo, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), 5000)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const node = toast && (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.message}</span>
      {toast.undo && <button onClick={() => { toast.undo(); setToast(null) }}>Undo</button>}
    </div>
  )
  return [show, node]
}

export const todayName = () => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
