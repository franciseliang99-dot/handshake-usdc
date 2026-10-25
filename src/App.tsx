import { useState, useEffect } from 'react'
import Header from './components/Header'
import JobBoard from './components/JobBoard'
import JobPage from './components/JobPage'

type View = { page: 'board' } | { page: 'job'; id: bigint }

function parseView(): View {
  const hash = window.location.hash
  const m = hash.match(/^#\/job\/(\d+)$/)
  if (m) return { page: 'job', id: BigInt(m[1]) }
  return { page: 'board' }
}

export default function App() {
  const [view, setView] = useState<View>(parseView)

  useEffect(() => {
    const onHashChange = () => setView(parseView())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const goToJob = (id: bigint) => {
    window.location.hash = `/job/${id.toString()}`
    setView({ page: 'job', id })
  }

  const goToBoard = () => {
    window.location.hash = ''
    setView({ page: 'board' })
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <Header
        view={view.page}
        onBack={view.page === 'job' ? goToBoard : undefined}
      />
      {view.page === 'board' && <JobBoard onSelectJob={goToJob} />}
      {view.page === 'job' && <JobPage jobId={view.id} />}
    </div>
  )
}
