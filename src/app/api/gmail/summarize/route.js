import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '../../../../../lib/auth'
import { getGoogleClient } from '../../../../../lib/google-client'
import { GoogleGenerativeAI } from '@google/generative-ai'

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function GET(request) {
  try {
    console.log('Gmail summarize route called')
    
    // Check for authorization header first (when called from api/ai)
    const authHeader = request.headers.get('Authorization')
    let accessToken = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Called from another API route with token in header
      accessToken = authHeader.replace('Bearer ', '')
      console.log('Using access token from Authorization header')
    } else {
      // Called directly, try to get session
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === 'production'
      })
      
      console.log('Token:', token ? 'Found' : 'Not found')
      console.log('Token email:', token?.email)
      
      if (!token?.email) {
        console.log('No token or email found')
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      
      accessToken = token.accessToken
    }
    
    if (!accessToken) {
      console.log('No access token available')
      return NextResponse.json({ error: 'No access token available. Please sign out and sign back in.' }, { status: 401 })
    }

    console.log('Access token found, initializing Gmail client')
    const { gmail } = getGoogleClient(accessToken)

    // Fetch only unread emails from Primary inbox
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 15,
      q: 'is:unread category:primary'
    })

    const messages = response.data.messages || []

    if (messages.length === 0) {
      return NextResponse.json({ 
        summary: "You have no unread emails in your Primary inbox. Your inbox is all caught up!" 
      })
    }

    const emailContents = []

    for (const message of messages.slice(0, 6)) {
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
        
        if (email.data.payload?.parts) {
          for (const part of email.data.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64')
                .toString('utf-8')
                .substring(0, 200)
              break
            }
          }
        } else if (email.data.payload?.body?.data) {
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

    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
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
    
    if (error.code === 401 || error.status === 401) {
      return NextResponse.json({ 
        error: 'Gmail authentication failed. Please sign out and sign back in to refresh your access.' 
      }, { status: 401 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to summarize emails. Please check your permissions and try again.' 
    }, { status: 500 })
  }
}