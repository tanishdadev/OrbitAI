import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "../../../../lib/auth";
import { GoogleGenerativeAI } from '@google/generative-ai'

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

// Simple pattern-based parser as fallback when AI fails
function parseCommandFallback(command) {
  const lowerCommand = command.toLowerCase()
  
  // Email patterns
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/
  const emailMatch = command.match(emailRegex)
  
  if ((lowerCommand.includes('email') || lowerCommand.includes('send')) && emailMatch) {
    // Extract subject and body from command
    let subject = 'Message from AI Assistant'
    let body = 'Hello, this message was sent via AI Assistant.'
    
    if (lowerCommand.includes('about')) {
      const aboutIndex = lowerCommand.indexOf('about')
      const afterAbout = command.substring(aboutIndex + 5).trim()
      subject = `About ${afterAbout}`
      body = `Hi,\n\nI wanted to reach out about ${afterAbout}.\n\nBest regards`
    }
    
    return {
      action: 'email',
      data: {
        to: emailMatch[0],
        subject: subject,
        body: body
      }
    }
  }
  
  // Calendar patterns
  if (lowerCommand.includes('schedule') || lowerCommand.includes('meeting') || lowerCommand.includes('calendar')) {
    return {
      action: 'calendar',
      data: {
        summary: lowerCommand.includes('meeting') ? 'Team Meeting' : 'Scheduled Event',
        description: 'Event created via AI Assistant'
      }
    }
  }
  
  // Summarize patterns
  if (lowerCommand.includes('summarize') || lowerCommand.includes('summary') || lowerCommand.includes('unread') || 
      lowerCommand.includes('emails') || lowerCommand.includes('check emails')) {
    return { action: 'summarize', data: {} }
  }
  
  // Default to general
  return { action: 'general', data: { query: command } }
}

// Simple AI fallback for when Gemini fails
function generateSimpleResponse(command) {
  const lowerCommand = command.toLowerCase()
  
  if (lowerCommand.includes('weather')) {
    return 'I apologize, but I cannot access real-time weather data. Please check a weather app or website for current conditions.'
  }
  
  if (lowerCommand.includes('time')) {
    return `The current time is ${new Date().toLocaleTimeString()}.`
  }
  
  if (lowerCommand.includes('date')) {
    return `Today's date is ${new Date().toLocaleDateString()}.`
  }
  
  if (lowerCommand.includes('hello') || lowerCommand.includes('hi')) {
    return 'Hello! How can I help you today? I can assist with emails, calendar events, and general questions.'
  }
  
  return 'I apologize, but I am having trouble connecting to AI services right now. Please try again in a moment, or try a more specific command like "send email to someone@example.com" or "schedule a meeting".'
}

// Try Gemini with multiple fallbacks - FIXED MODEL NAMES
async function tryGeminiWithFallbacks(prompt, isParser = false) {
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro'] // CORRECT NAMES
  
  for (const model of models) {
    try {
      console.log(`Attempting ${model}...`)
      const geminiModel = gemini.getGenerativeModel({
        model: model,
        generationConfig: { 
          temperature: isParser ? 0.0 : 0.3,
          topK: 40,
          topP: 0.95 
        },
      })

      const result = await geminiModel.generateContent(prompt)
      const text = result.response.text()
      console.log(`${model} succeeded`)
      return text
    } catch (error) {
      console.error(`${model} failed:`, error.status, error.message)
      
      // Don't continue if it's an auth error
      if (error.status === 401 || error.status === 403) {
        throw new Error('AI service authentication failed. Please check API key.')
      }
      
      // Continue to next model for 503, 429, 500 errors
      if (error.status === 503 || error.status === 429 || error.status === 500) {
        console.log(`${model} temporarily unavailable, trying next...`)
        continue
      }
      
      // For other errors, continue but log them
      console.log(`${model} failed with ${error.status}, trying next...`)
      continue
    }
  }
  
  throw new Error('All AI models are currently unavailable')
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized - Please sign in again' }, { status: 401 })
    }

    const { command } = await req.json()
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Missing command' }, { status: 400 })
    }

    const baseUrl = getBaseUrl()
    console.log('Processing command:', command)

    // Parse command - try AI first, fallback to pattern matching
    let parsedCommand
    
    try {
      console.log('Trying AI parser...')
      const parserPrompt = `Parse this command into JSON. Return only: {"action": "email|calendar|summarize|general", "data": {...}}

Examples:
- "send email to john@example.com about meeting" → {"action": "email", "data": {"to": "john@example.com", "subject": "About meeting", "body": "Hi,\n\nI wanted to reach out about the meeting.\n\nBest regards"}}
- "schedule meeting tomorrow" → {"action": "calendar", "data": {"summary": "Meeting"}}
- "summarize emails" → {"action": "summarize", "data": {}}
- "what's the weather" → {"action": "general", "data": {"query": "what's the weather"}}

Command: ${command}`

      const parseResult = await tryGeminiWithFallbacks(parserPrompt, true)
      
      // Extract JSON from response
      const jsonMatch = parseResult.match(/\{.*\}/s)
      if (jsonMatch) {
        parsedCommand = JSON.parse(jsonMatch[0])
        console.log('AI parser succeeded:', parsedCommand)
      } else {
        throw new Error('No JSON found in AI response')
      }
    } catch (parseError) {
      console.log('AI parser failed, using pattern matching fallback')
      parsedCommand = parseCommandFallback(command)
      console.log('Fallback parser result:', parsedCommand)
    }

    if (!parsedCommand || !parsedCommand.action) {
      parsedCommand = { action: 'general', data: { query: command } }
    }

    // Handle actions
    switch (parsedCommand.action) {
      case 'email': {
        const data = parsedCommand.data || {}
        
        if (!data.to) {
          return NextResponse.json({ 
            error: 'Please specify the email recipient (to address). Example: "send email to john@example.com about the project"' 
          }, { status: 400 })
        }

        if (!data.subject) {
          data.subject = 'Message from AI Assistant'
        }

        if (!data.body) {
          data.body = 'Hello,\n\nThis message was sent via AI Assistant.\n\nBest regards'
        }

        console.log('Sending email to:', data.to, 'subject:', data.subject)

        const sendRes = await fetch(`${baseUrl}/api/gmail/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify({
            to: data.to,
            subject: data.subject,
            body: data.body
          })
        })

        const sendData = await sendRes.json()
        
        if (!sendRes.ok) {
          console.error('Email send failed:', sendData)
          return NextResponse.json({ 
            error: `Failed to send email: ${sendData.error || 'Unknown error'}` 
          }, { status: sendRes.status })
        }

        return NextResponse.json({ result: sendData.message })
      }

      case 'calendar': {
        const data = parsedCommand.data || {}
        
        if (!data.summary) {
          data.summary = 'Meeting'
        }

        // Set default time if not provided
        if (!data.startTime) {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(14, 0, 0, 0)
          data.startTime = tomorrow.toISOString()
          
          const endTime = new Date(tomorrow)
          endTime.setHours(15, 0, 0, 0)
          data.endTime = endTime.toISOString()
        }

        console.log('Creating calendar event:', data.summary)

        const calendarRes = await fetch(`${baseUrl}/api/calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify(data)
        })

        const calendarData = await calendarRes.json()
        
        if (!calendarRes.ok) {
          console.error('Calendar creation failed:', calendarData)
          return NextResponse.json({ 
            error: `Failed to create calendar event: ${calendarData.error || 'Unknown error'}` 
          }, { status: calendarRes.status })
        }

        return NextResponse.json({ result: calendarData.message })
      }

      case 'summarize': {
        console.log('Summarizing emails...')
        
        const sumRes = await fetch(`${baseUrl}/api/summarize`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        })

        if (!sumRes.ok) {
          const errorText = await sumRes.text()
          console.error('Summarize failed:', errorText)
          return NextResponse.json({ 
            error: `Failed to summarize emails: API route not found` 
          }, { status: 500 })
        }

        const sumData = await sumRes.json()
        return NextResponse.json({ result: sumData.summary })
      }

      case 'general':
      default: {
        console.log('Handling general query:', command)
        
        try {
          const generalPrompt = `Answer this question helpfully and informatively. Use plain text only - NO markdown formatting like **bold** or *italic*. Use CAPITAL LETTERS for emphasis if needed.

Question: ${command}`

          const replyText = await tryGeminiWithFallbacks(generalPrompt, false)
          return NextResponse.json({ result: replyText })
        } catch (err) {
          console.error('General reply error:', err)
          const fallbackResponse = generateSimpleResponse(command)
          return NextResponse.json({ result: fallbackResponse })
        }
      }
    }
  } catch (error) {
    console.error('AI API Error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to process command. Please try again.'
    }, { status: 500 })
  }
}