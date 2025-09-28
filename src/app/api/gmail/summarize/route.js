// 1. Fix src/app/api/summarize/route.js (create this file)
import { NextResponse } from 'next/server'
import { getGoogleClient } from '../../../../lib/google-client'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
        
        // Handle different email structures
        if (email.data.payload?.parts) {
          // Multi-part message
          for (const part of email.data.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64')
                .toString('utf-8')
                .substring(0, 200)
              break
            }
          }
        } else if (email.data.payload?.body?.data) {
          // Single part message
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

    // Use Gemini 1.5 Flash instead of 2.5
    const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    const prompt = `You are an email assistant. Summarize these ${emailContents.length} unread emails concisely, highlighting important items and actions needed. Format the summary clearly with bullet points if needed.

Emails:
${emailContents.join('\n---\n')}`

    const result = await model.generateContent(prompt)
    const summaryText = result.response.text()

    return NextResponse.json({ 
      summary: summaryText,
      count: messages.length
    })
  } catch (error) {
    console.error('Gmail Summarize Error:', error)
    return NextResponse.json({ 
      error: 'Failed to summarize emails. Please check your permissions and try again.' 
    }, { status: 500 })
  }
}

// 2. Fix lib/google-client.js (update import path)
import { google } from 'googleapis'

export function getGoogleClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  
  return {
    gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
    calendar: google.calendar({ version: 'v3', auth: oauth2Client })
  }
}

// 3. Fix src/app/api/gmail/send/route.js (update import path)
import { NextResponse } from 'next/server'
import { getGoogleClient } from '../../../../../lib/google-client'

export async function POST(req) {
  try {
    const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { to, subject, body } = await req.json()
    
    if (!to || !subject || !body) {
      return NextResponse.json({ 
        error: 'Missing required fields: to, subject, body' 
      }, { status: 400 })
    }

    const { gmail } = getGoogleClient(accessToken)

    // Create the email message (plain text)
    const message = [
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n')

    // Encode the message
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    })

    return NextResponse.json({ 
      message: `✅ Email sent successfully to ${to} with subject "${subject}"`,
      messageId: result.data.id
    })
  } catch (error) {
    console.error('Gmail Send Error:', error)
    const msg = error?.message || 'Failed to send email. Please check your permissions and try again.'
    return NextResponse.json({ 
      error: msg
    }, { status: 500 })
  }
}

// 4. Fix src/app/api/calendar/route.js (update import path)
import { NextResponse } from 'next/server'
import { getGoogleClient } from '../../../../lib/google-client'

export async function POST(req) {
  try {
    const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { summary, description, startTime, endTime, attendees } = await req.json()
    
    if (!summary) {
      return NextResponse.json({ 
        error: 'Event summary is required' 
      }, { status: 400 })
    }

    const { calendar } = getGoogleClient(accessToken)

    // Set default times if not provided
    const now = new Date()
    const defaultStart = startTime || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const defaultEnd = endTime || new Date(new Date(defaultStart).getTime() + 60 * 60 * 1000).toISOString()

    // Create the event object
    const event = {
      summary: summary || 'New Meeting',
      description: description || '',
      start: {
        dateTime: defaultStart,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: defaultEnd,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: attendees?.map(email => ({ email })) || [],
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 }
        ]
      }
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendNotifications: true
    })

    const meetLink = response.data.hangoutLink || 
                    response.data.conferenceData?.entryPoints?.[0]?.uri

    // Format the response message
    const startDate = new Date(response.data.start.dateTime)
    const formattedDate = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const formattedTime = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })

    let message = `✅ Meeting "${summary}" scheduled for ${formattedDate} at ${formattedTime}.`
    
    if (meetLink) {
      message += `\n📹 Google Meet link: ${meetLink}`
    }
    
    if (attendees && attendees.length > 0) {
      message += `\n👥 Invited: ${attendees.join(', ')}`
    }

    return NextResponse.json({ 
      message,
      eventId: response.data.id,
      meetLink,
      htmlLink: response.data.htmlLink
    })
  } catch (error) {
    console.error('Calendar Error:', error)
    return NextResponse.json({ 
      error: 'Failed to create calendar event. Please check your permissions and try again.' 
    }, { status: 500 })
  }
}