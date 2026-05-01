import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProjects, saveProject, parseReport } from '@/lib/storage'
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const company = (session.user as any).company
  return NextResponse.json(getProjects(company))
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { rawReport, projectName, pdfName } = await req.json()
  const company = (session.user as any).company
  const userId = (session.user as any).id || session.user?.email || ''
  const project = parseReport(rawReport, projectName, company, userId, pdfName)
  saveProject(project)
  return NextResponse.json(project)
}