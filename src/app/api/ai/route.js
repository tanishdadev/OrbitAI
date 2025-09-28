import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "../../../../lib/auth";
import { GoogleGenerativeAI } from '@google/generative-ai'

// pass key string (SDK expects raw string)
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// helper: pick a base URL for internal API calls
const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

// strict JSON parser system prompt (used to convert natural language -> structured action)
const PARSER_SYSTEM_PROMPT = `You are a strict command parser. ALWAYS output ONLY valid JSON (no extra text, no markdown, no backticks).
Output must be a single JSON object with exactly these keys:
- "action": one of "email", "calendar", "summarize", or "general"
- "data": an object with fields appropriate for the action

Rules & examples:
- For email: 
  { "action": "email", "data": { "to": "email@example.com", "subject": "subject here", "body": "email content" } }
- For calendar:
  { "action": "calendar", "data": { "summary": "Meeting title", "description": "Description", "startTime": "ISO datetime", "endTime": "ISO datetime", "attendees": ["a@b.com"] } }
- For summarize:
  { "action": "summarize", "data": {} }
- For general:
  { "action": "general", "data": { "query": "original user query" } }

If fields are missing (for example "to" in email), return the JSON with missing fields as empty strings.
Do NOT write anything besides the single JSON object.`

// system prompt for detailed general replies (no markdown bold)
const GENERAL_SYSTEM_PROMPT = `You are a helpful, concise but detailed AI assistant. Answer the user's question on-point and thoroughly.
Do NOT use Markdown (no **, no backticks, no triple backticks). Use plain text. If lists are useful, use simple lines or numbered lists without Markdown symbols.
Be precise, informative, and use examples when helpful.`

/**
 * askGemini helper
 * @param {string} modelName - Gemini model
 * @param {Array<{role: string, content: string}>} messages - chat history
 * @param {number} temperature - sampling temp
 */
async function askGemini(modelName, messages, temperature = 0.0) {
  const model = gemini.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature },
  })

  // Convert messages into history (system/user)
  const history = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

  // Pick last user message for sendMessage
  const lastUser = messages.findLast(m => m.role === 'user')
  if (!lastUser) throw new Error('No user message provided')

  const chat = model.startChat({
    history,
  })

  const response = await chat.sendMessage(lastUser.content)
  return response.response.text()
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { command } = await req.json()
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Missing command' }, { status: 400 })
    }

    const baseUrl = getBaseUrl()

    // --- 1) Parse incoming command into JSON action ---
    let rawParse = ''
    try {
      rawParse = await askGemini('gemini-2.5-pro', [
        { role: 'system', content: PARSER_SYSTEM_PROMPT },
        { role: 'user', content: command }
      ], 0.0)
    } catch (err) {
      try {
        rawParse = await askGemini('gemini-1.5-flash', [
          { role: 'system', content: PARSER_SYSTEM_PROMPT },
          { role: 'user', content: command }
        ], 0.0)
      } catch (err2) {
        console.error('Parser error (both models):', err2)
      }
    }

    let parsedCommand
    try {
      parsedCommand = JSON.parse(rawParse)
    } catch {
      const stricter = PARSER_SYSTEM_PROMPT +
        '\nIMPORTANT: If you cannot extract clear action/data, output {"action":"general","data":{"query":"' +
        command.replace(/"/g, '\\"') + '"}}'
      try {
        const raw2 = await askGemini('gemini-1.5-flash', [
          { role: 'system', content: stricter },
          { role: 'user', content: command }
        ], 0.0)
        parsedCommand = JSON.parse(raw2)
      } catch {
        parsedCommand = { action: 'general', data: { query: command } }
      }
    }

    if (!parsedCommand || typeof parsedCommand.action !== 'string') {
      parsedCommand = { action: 'general', data: { query: command } }
    }

    // --- 2) Handle actions ---
    switch (parsedCommand.action) {
      case 'email': {
        const data = parsedCommand.data || {}
        const to = data.to || ''
        const subject = data.subject || ''
        const body = data.body || ''

        if (!to) {
          return NextResponse.json({ error: 'Email "to" address missing. Please specify recipient.' }, { status: 400 })
        }

        if (!subject || !body) {
          try {
            const fillPrompt = `You are an assistant that fills missing email fields. Output ONLY JSON: {"subject":"...", "body":"..."}.
User command: ${command}
If you cannot infer subject or body, put empty strings.`
            let fillRaw = ''
            try {
              fillRaw = await askGemini('gemini-2.5-pro', [
                { role: 'system', content: fillPrompt },
                { role: 'user', content: command }
              ], 0.0)
            } catch {
              fillRaw = await askGemini('gemini-1.5-flash', [
                { role: 'system', content: fillPrompt },
                { role: 'user', content: command }
              ], 0.0)
            }
            const fillObj = JSON.parse(fillRaw || '{}')
            if (!subject) parsedCommand.data.subject = fillObj.subject || ''
            if (!body) parsedCommand.data.body = fillObj.body || ''
          } catch {}
        }

        const finalTo = parsedCommand.data.to
        const finalSubject = parsedCommand.data.subject
        const finalBody = parsedCommand.data.body

        if (!finalTo || !finalSubject || !finalBody) {
          return NextResponse.json({
            error: 'Unable to extract all email fields (to/subject/body). Please clarify the command.'
          }, { status: 400 })
        }

        const sendRes = await fetch(`${baseUrl}/api/gmail/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify({
            to: finalTo,
            subject: finalSubject,
            body: finalBody
          })
        })

        if (!sendRes.ok) {
          const errJson = await sendRes.json().catch(() => ({ error: 'send failed' }))
          return NextResponse.json({ error: errJson.error || 'Failed to send email' }, { status: sendRes.status })
        }

        const sendJson = await sendRes.json()
        return NextResponse.json({ result: sendJson.message })
      }

      case 'calendar': {
        const data = parsedCommand.data || {}
        if (!data.summary) {
          return NextResponse.json({ error: 'Calendar event missing "summary".' }, { status: 400 })
        }

        if (!data.startTime) {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(14, 0, 0, 0)
          data.startTime = tomorrow.toISOString()
          const endTime = new Date(tomorrow)
          endTime.setHours(15, 0, 0, 0)
          data.endTime = endTime.toISOString()
        }

        const calendarRes = await fetch(`${baseUrl}/api/calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify(data)
        })

        if (!calendarRes.ok) {
          const errJson = await calendarRes.json().catch(() => ({ error: 'calendar creation failed' }))
          return NextResponse.json({ error: errJson.error || 'Failed to create event' }, { status: calendarRes.status })
        }

        const calendarJson = await calendarRes.json()
        return NextResponse.json({ result: calendarJson.message })
      }

      case 'summarize': {
        const sumRes = await fetch(`${baseUrl}/api/summarize`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        })

        if (!sumRes.ok) {
          const errJson = await sumRes.json().catch(() => ({ error: 'summarize failed' }))
          return NextResponse.json({ error: errJson.error || 'Failed to summarize emails' }, { status: sumRes.status })
        }

        const sumJson = await sumRes.json()
        return NextResponse.json({ result: sumJson.summary })
      }

      case 'general':
      default: {
        let replyText = ''
        try {
          try {
            replyText = await askGemini('gemini-2.5-pro', [
              { role: 'system', content: GENERAL_SYSTEM_PROMPT },
              { role: 'user', content: command }
            ], 0.3)
          } catch {
            replyText = await askGemini('gemini-1.5-flash', [
              { role: 'system', content: GENERAL_SYSTEM_PROMPT },
              { role: 'user', content: command }
            ], 0.35)
          }
        } catch (err) {
          console.error('General reply error:', err)
          replyText = 'Sorry — I could not generate a reply right now.'
        }

        return NextResponse.json({ result: replyText })
      }
    }
  } catch (error) {
    console.error('AI API Error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to process command. Please try again.'
    }, { status: 500 })
  }
}