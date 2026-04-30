export interface Flag {
  severity: 'DISQUALIFYING' | 'REJECTION' | 'WARNING'
  ruleId: string
  category: string
  description: string
  page: string
  action: string
}

export interface Project {
  id: string
  company: string
  userId: string
  projectName: string
  system: string
  roofType: string
  result: 'APROBADO' | 'APROBADO_CON_WARNINGS' | 'RECHAZADO' | 'DESCALIFICADO' | 'EN_PROGRESO'
  flags: Flag[]
  summary: string
  totalDQ: number
  totalRejection: number
  totalWarning: number
  createdAt: string
  updatedAt: string
  pdfName?: string
}

const store: Map<string, Project[]> = new Map()

export function getProjects(company: string): Project[] {
  return (store.get(company) || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function saveProject(project: Project): void {
  const existing = store.get(project.company) || []
  const idx = existing.findIndex(p => p.id === project.id)
  if (idx >= 0) { existing[idx] = project } else { existing.push(project) }
  store.set(project.company, existing)
}

export function getProject(company: string, id: string): Project | undefined {
  return (store.get(company) || []).find(p => p.id === id)
}

export function parseReport(raw: string, projectName: string, company: string, userId: string, pdfName: string): Project {
  const id = Math.random().toString(36).slice(2)
  const now = new Date().toISOString()
  const result = extractBetween(raw, 'RESULTADO:', '\n')?.trim() as Project['result'] || 'EN_PROGRESO'
  const system = extractBetween(raw, 'SISTEMA:', '\n')?.trim() || ''
  const roofType = extractBetween(raw, 'TECHO:', '\n')?.trim() || ''
  const dq = parseInt(extractBetween(raw, 'DQ:', '\n')?.trim() || '0')
  const rejection = parseInt(extractBetween(raw, 'REJECTION:', '\n')?.trim() || '0')
  const warning = parseInt(extractBetween(raw, 'WARNING:', '\n')?.trim() || '0')
  const summary = extractBetween(raw, '---RESUMEN---', '---FIN_REPORTE---')?.trim() || ''
  const flagsRaw = extractBetween(raw, '---FLAGS---', '---RESUMEN---') || ''
  const flags: Flag[] = flagsRaw.split('\n').filter(l => l.trim() && l.includes('|')).map(line => {
    const parts = line.split('|')
    return { severity: (parts[0]?.trim() || 'WARNING') as Flag['severity'], ruleId: parts[1]?.trim() || '', category: parts[2]?.trim() || '', description: parts[3]?.trim() || '', page: parts[4]?.trim() || '', action: parts[5]?.trim() || '' }
  })
  return { id, company, userId, projectName, system, roofType, result, flags, summary, totalDQ: dq, totalRejection: rejection, totalWarning: warning, createdAt: now, updatedAt: now, pdfName }
}

function extractBetween(text: string, start: string, end: string): string | null {
  const si = text.indexOf(start)
  if (si === -1) return null
  const from = si + start.length
  const ei = text.indexOf(end, from)
  return ei === -1 ? text.slice(from) : text.slice(from, ei)
}