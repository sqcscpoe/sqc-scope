import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SYSTEM_PROMPT } from '@/lib/prompt'

export const maxDuration = 300
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('ANTHROPIC_API_KEY not configured', { status: 500 })
  }

  const contentType = req.headers.get('content-type') || ''
  let pdfFileId: string | null = null
  let message = 'REVISAR PAQUETE'
  let history: any[] = []

  if (contentType.includes('multipart/form-data')) {
    // PDF uploaded as FormData
    const formData = await req.formData()
    const pdfFile = formData.get('pdf') as File | null
    message = (formData.get('message') as string) || 'REVISAR PAQUETE'
    const histRaw = formData.get('history') as string | null
    if (histRaw) try { history = JSON.parse(histRaw) } catch {}

    if (pdfFile) {
      // Upload to Anthropic Files API
      const uploadFD = new FormData()
      uploadFD.append('file', pdfFile)
      const uploadRes = await fetch('https://api.anthropic.com/v1/files', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'files-api-2025-04-14'
        },
        body: uploadFD as any
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.text()
        return new Response('Upload failed: ' + err, { status: 500 })
      }
      const uploadData = await uploadRes.json()
      pdfFileId = uploadData.id
    }
  } else {
    // JSON body for follow-up messages (no PDF)
    const body = await req.json()
    message = body.message || 'REVISAR PAQUETE'
    history = body.history || []
    pdfFileId = body.pdfFileId || null
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: { 'anthropic-beta': 'files-api-2025-04-14' }
  })

  const messages: any[] = []
  if (history && Array.isArray(history)) messages.push(...history)

  const userContent: any[] = []
  if (pdfFileId) {
    userContent.push({
      type: 'document',
      source: { type: 'file', file_id: pdfFileId }
    })
  }
  userContent.push({ type: 'text', text: message })
  messages.push({ role: 'user', content: userContent })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send the file_id as first chunk so the client can keep it for follow-ups
        if (pdfFileId && contentType.includes('multipart/form-data')) {
          controller.enqueue(encoder.encode('__FILE_ID__:' + pdfFileId + '__\n'))
        }

        const s = await client.messages.stream({
          model: 'claude-opus-4-5-20251101',
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages
        } as any)
        for await (const chunk of s) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (err: any) {
        controller.enqueue(encoder.encode('ERROR: ' + err.message))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache'
    }
  })
}