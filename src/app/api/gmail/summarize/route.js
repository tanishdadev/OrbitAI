import { NextResponse } from 'next/server'
import { getGoogleClient } from '@/app/lib/google-client'
import { GoogleGenerativeAI } from '@google/generative-ai'

// 👇 FIXED: pass API key as string
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function GET(req) {
  try {
    const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gmail } = getGoogleClient(accessToken)

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'is:unread'
    })

    const messages = response.data.messages || []

    if (messages.length === 0) {
      return NextResponse.json({ 
        summary: "You have no unread emails. Your inbox is all caught up!" 
      })
    }

    const emailContents = []

    for (const message of messages.slice(0, 5)) {
      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        })

        const headers = email.data.payload?.headers || []
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject'
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown sender'
        const date = headers.find(h => h.name === 'Date')?.value || ''

        let body = ''
        const parts = email.data.payload?.parts || []
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64')
              .toString('utf-8')
              .substring(0, 200)
            break
          }
        }

        if (!body && email.data.payload?.body?.data) {
          body = Buffer.from(email.data.payload.body.data, 'base64')
            .toString('utf-8')
            .substring(0, 200)
        }

        emailContents.push(
          `From: ${from}\nSubject: ${subject}\nDate: ${date}\nPreview: ${body || 'No preview available'}\n`
        )
      } catch (err) {
        console.error('Error fetching email:', err)
      }
    }

    if (emailContents.length === 0) {
      return NextResponse.json({ 
        summary: "Unable to read email contents. Please check permissions." 
      })
    }

    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' }) // use 1.5 for stability
    const chat = model.startChat()

    const completion = await chat.sendMessage(
      `You are an email assistant. Summarize these emails concisely, highlighting important items and actions needed. Format the summary clearly.\n\n${emailContents.join('\n---\n')}`
    )

    // 👇 FIXED: access text from response.response.text()
    return NextResponse.json({ 
      summary: completion.response.text(),
      count: messages.length
    })
  } catch (error) {
    console.error('Gmail Summarize Error:', error)
    return NextResponse.json({ 
      error: 'Failed to summarize emails. Please check your permissions and try again.' 
    }, { status: 500 })
  }
}
