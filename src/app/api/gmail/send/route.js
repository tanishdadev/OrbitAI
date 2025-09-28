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
      message: `Email sent successfully to ${to} with subject "${subject}"`,
      messageId: result.data.id
    })
  } catch (error) {
    console.error('Gmail Send Error:', error)
    // surface the underlying error message when possible (helpful while debugging)
    const msg = error?.message || 'Failed to send email. Please check your permissions and try again.'
    return NextResponse.json({ 
      error: msg
    }, { status: 500 })
  }
}
