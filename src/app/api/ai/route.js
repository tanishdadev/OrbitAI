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
  
  // Check for name/identity questions
  if (lowerCommand.includes('what is your name') || lowerCommand.includes("what's your name") || 
      lowerCommand.includes('who are you') || lowerCommand.includes('your name')) {
    return {
      action: 'general',
      data: { query: command, isIdentityQuestion: true }
    }
  }
  
  // Enhanced email patterns
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/
  const emailMatch = command.match(emailRegex)
  
  if ((lowerCommand.includes('email') || lowerCommand.includes('send') || lowerCommand.includes('mail')) && emailMatch) {
    let subject = null
    let body = null
    
    // Try to extract subject from various patterns
    const subjectPatterns = [
      /subject[:\s]+([^,\n]+)/i,
      /with subject[:\s]+([^,\n]+)/i,
      /titled[:\s]+([^,\n]+)/i,
      /about[:\s]+([^,\n]+)/i,
      /regarding[:\s]+([^,\n]+)/i
    ]
    
    for (const pattern of subjectPatterns) {
      const match = command.match(pattern)
      if (match && match[1]) {
        subject = match[1].trim().replace(/['"]/g, '')
        break
      }
    }
    
    // If no explicit subject found, let AI generate it
    if (!subject) {
      // Extract topic after "about", "regarding", "on", etc.
      const topicMatch = command.match(/(?:about|regarding|on|for|concerning)\s+([^,\n.]+)/i)
      if (topicMatch) {
        subject = null // Let AI generate based on topic
      }
    }
    
    return {
      action: 'email',
      data: {
        to: emailMatch[0],
        subject: subject,
        body: body // Let AI generate
      }
    }
  }
  
  // Calendar patterns
  if (lowerCommand.includes('schedule') || lowerCommand.includes('meeting') || lowerCommand.includes('calendar')) {
    return {
      action: 'calendar',
      data: {
        summary: 'Meeting',
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
  
  // Handle identity questions
  if (lowerCommand.includes('what is your name') || lowerCommand.includes("what's your name") || 
      lowerCommand.includes('who are you') || lowerCommand.includes('your name')) {
    return 'I am OrbitAI, your intelligent assistant.'
  }
  
  if (lowerCommand.includes('weather')) {
    return 'I cannot access real-time weather data. Please check a weather app or website for current conditions.'
  }
  
  if (lowerCommand.includes('time')) {
    return `The current time is ${new Date().toLocaleTimeString()}.`
  }
  
  if (lowerCommand.includes('date')) {
    return `Today's date is ${new Date().toLocaleDateString()}.`
  }
  
  if (lowerCommand.includes('hello') || lowerCommand.includes('hi')) {
    return 'Hello! I can help you with emails, calendar events, and general questions.'
  }
  
  return 'I am having trouble connecting to AI services right now. Please try again in a moment.'
}

// Try Gemini with multiple fallbacks
async function tryGeminiWithFallbacks(prompt, isParser = false) {
  const availableModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ];

  for (const model of availableModels) {
    try {
      console.log(`Attempting ${model}...`);
      const geminiModel = gemini.getGenerativeModel({
        model: model,
        generationConfig: { 
          temperature: isParser ? 0.1 : 0.3,
          topK: 40,
          topP: 0.95 
        },
      });

      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();
      console.log(`${model} succeeded`);
      return text;
    } catch (error) {
      console.error(`${model} failed:`, error.status, error.message);
      
      if (error.status === 401 || error.status === 403) {
        throw new Error('AI service authentication failed. Please check API key.');
      }

      if (error.status === 503 || error.status === 429 || error.status === 500) {
        console.log(`${model} temporarily unavailable, trying next...`);
        continue;
      }

      console.log(`${model} failed with ${error.status}, trying next...`);
      continue;
    }
  }

  throw new Error('All AI models are currently unavailable');
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

    // Get current date/time context for AI
    const now = new Date()
    const currentDateTime = now.toISOString()
    const currentLocalTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })
    const userTimeZone = 'Asia/Calcutta'

    // Parse command - try AI first, fallback to pattern matching
    let parsedCommand
    
    try {
      console.log('Trying AI parser with enhanced context...')
      const parserPrompt = `You are OrbitAI, a smart assistant that parses user commands. Today's date is ${currentDateTime} (${currentLocalTime} in Asia/Calcutta timezone).

Parse this command into JSON format. Return ONLY the JSON, nothing else.

For email commands:
- Extract recipient email address
- Extract subject if explicitly mentioned (with words like "subject:", "titled:", "about:", "regarding:")
- If subject is not explicitly mentioned, set it to null (the email system will generate it using AI)
- Set body to null (the email system will generate appropriate content using AI)

For calendar events:
- Extract the EXACT date and time the user wants
- Convert to ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
- If year not specified, use 2025 (current context)
- Default to Asia/Calcutta timezone
- If no duration specified, make it 1 hour
- Extract meeting title/summary accurately

Examples:
"send email to john@example.com about quantum mechanics" → {"action": "email", "data": {"to": "john@example.com", "subject": null, "body": null}}

"email sarah@company.com with subject 'Project Update' about our progress" → {"action": "email", "data": {"to": "sarah@company.com", "subject": "Project Update", "body": null}}

"send email to investor@fund.com pitching our new AI startup" → {"action": "email", "data": {"to": "investor@fund.com", "subject": null, "body": null}}

"schedule meeting called Test Meeting for October 5th, 2025 at 5:00 PM" → {"action": "calendar", "data": {"summary": "Test Meeting", "startTime": "2025-10-05T17:00:00", "endTime": "2025-10-05T18:00:00", "timeZone": "Asia/Calcutta"}}

"what's your name" → {"action": "general", "data": {"query": "what's your name", "isIdentityQuestion": true}}

"summarize my emails" → {"action": "summarize", "data": {}}

"explain machine learning" → {"action": "general", "data": {"query": "explain machine learning"}}

Be very careful with date parsing:
- "5th October" = October 5th
- "October 5th" = October 5th  
- "tomorrow" = ${new Date(now.getTime() + 24*60*60*1000).toISOString().split('T')[0]}
- "next week" = add 7 days from today
- "5 PM" = 17:00 in 24-hour format
- "5:30 PM" = 17:30 in 24-hour format

User command: "${command}"`

      const parseResult = await tryGeminiWithFallbacks(parserPrompt, true)
      
      console.log('Raw AI response:', parseResult)
      
      // Extract JSON from response
      const jsonMatch = parseResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedCommand = JSON.parse(jsonMatch[0])
        console.log('AI parser succeeded:', parsedCommand)
        
        if (!parsedCommand.action || !parsedCommand.data) {
          throw new Error('Invalid JSON structure from AI')
        }
      } else {
        throw new Error('No JSON found in AI response')
      }
    } catch (parseError) {
      console.log('AI parser failed:', parseError.message)
      console.log('Using pattern matching fallback')
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

        console.log('Sending email to:', data.to, 'subject:', data.subject || 'AI Generated')

        const sendRes = await fetch(`${baseUrl}/api/gmail/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify({
            to: data.to,
            subject: data.subject,
            body: data.body,
            originalCommand: command  // Pass original command for AI generation
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
        
        console.log('Calendar data from AI:', JSON.stringify(data, null, 2))
        
        if (!data.summary) {
          data.summary = 'Meeting'
        }

        if (!data.startTime || !data.endTime) {
          return NextResponse.json({ 
            error: 'I need more details about when to schedule this meeting. Please specify the date and time. For example: "Schedule meeting for October 5th at 3 PM"' 
          }, { status: 400 })
        }

        const startDate = new Date(data.startTime)
        const endDate = new Date(data.endTime)
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return NextResponse.json({ 
            error: 'Invalid date/time format detected. Please try again with a clearer date and time.' 
          }, { status: 400 })
        }

        if (!data.timeZone) {
          data.timeZone = 'Asia/Calcutta'
        }

        console.log('Final calendar data being sent:', JSON.stringify(data, null, 2))

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
        
        const sumRes = await fetch(`${baseUrl}/api/gmail/summarize`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`
          }
        })

        if (!sumRes.ok) {
          const errorText = await sumRes.text()
          console.error('Summarize failed:', errorText)
          return NextResponse.json({ 
            error: `Failed to summarize emails. Please check your Gmail permissions.` 
          }, { status: 500 })
        }

        const sumData = await sumRes.json()
        return NextResponse.json({ result: sumData.summary })
      }

      case 'general':
      default: {
        console.log('Handling general query:', command)
        
        // Handle identity questions first
        if (parsedCommand.data?.isIdentityQuestion || 
            command.toLowerCase().includes('what is your name') || 
            command.toLowerCase().includes("what's your name") || 
            command.toLowerCase().includes('who are you')) {
          return NextResponse.json({ result: 'I am OrbitAI, your intelligent assistant.' })
        }
        
        try {
          const generalPrompt = `You are OrbitAI, an AI that is intelligent and can cater to every need of the user.         
  GUIDELINES:
- Be conversational and natural, like a helpful friend
- Match the user's tone and energy level
- Be concise for simple questions, detailed only when needed
- Don't over-explain common words or expressions
- If someone uses casual language like "damn", respond naturally without lectures
- Avoid being overly formal or robotic, be natural like a human
- Give practical and useful answers
- Don't explain obvious things unless specifically asked

Examples of good responses:
User: "damn, it's hot today" → "Yeah, it's really hot! Stay hydrated buddy."
User: "what's 2+2?" → "It's 4."
User: "explain quantum physics" → [Give a detailed explanation]
User: "hi" → "Hey! How can I help you?"

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