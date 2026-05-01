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

  const body = await req.json()
  const { pdfFileId, message, history } = body

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
  userContent.push({ type: 'text', text: message || 'REVISAR PAQUETE' })
  messages.push({ role: 'user', content: userContent })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
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