import { NextResponse } from 'next/server'
import { getGoogleClient } from '../../../../../lib/google-client'
import { GoogleGenerativeAI } from '@google/generative-ai'

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Try Gemini with multiple fallbacks
async function tryGeminiWithFallbacks(prompt) {
  const availableModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ];

  for (const model of availableModels) {
    try {
      console.log(`Attempting ${model} for email generation...`);
      const geminiModel = gemini.getGenerativeModel({
        model: model,
        generationConfig: { 
          temperature: 0.3,
          topK: 40,
          topP: 0.95 
        },
      });

      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();
      console.log(`${model} succeeded for email generation`);
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
    const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let { to, subject, body, originalCommand } = await req.json()
    
    if (!to) {
      return NextResponse.json({ 
        error: 'Missing required field: to (recipient email address)' 
      }, { status: 400 })
    }

    // Check if we need to generate subject and/or body using AI
    const needsSubject = !subject || subject === 'Message from AI Assistant' || subject.length < 5
    const needsBody = !body || 
                     body.includes('This message was sent via AI Assistant') ||
                     body.includes('Hello,\n\nThis message was sent via AI Assistant') ||
                     body.length < 50

    if ((needsSubject || needsBody) && originalCommand) {
      try {
        console.log('Generating AI email content for:', originalCommand)
        
        const emailPrompt = `You are a professional email assistant. Based on the user's request, generate a complete email with both subject line and body.

User's original request: "${originalCommand}"
Email recipient: ${to}

GUIDELINES:
- Generate a clear, professional subject line (max 60 characters)
- Write a comprehensive, well-structured email body
- Match the tone to the context (business, educational, casual, formal, etc.)
- If explaining a topic, provide detailed but accessible information
- If it's a pitch/proposal, include compelling details and value propositions
- If it's a meeting request, include relevant scheduling details
- Use proper email formatting with greeting and professional closing
- Make it engaging and informative

Format your response EXACTLY like this:
SUBJECT: [Your generated subject line]

BODY:
[Your generated email body with proper greeting and closing]

Example topics and how to handle them:
- "explain quantum mechanics" → Educational email with detailed explanation of quantum mechanics principles
- "pitch our new app to investors" → Professional pitch with features, market opportunity, competitive advantage
- "ask for a meeting about project updates" → Meeting request with context and proposed times
- "thank them for the interview" → Professional thank you with next steps

Generate the email now:`.trim()

        const aiResponse = await tryGeminiWithFallbacks(emailPrompt)
        
        // Parse AI response
        const subjectMatch = aiResponse.match(/SUBJECT:\s*(.+)/i)
        const bodyMatch = aiResponse.match(/BODY:\s*([\s\S]+)/i)
        
        if (needsSubject && subjectMatch && subjectMatch[1]) {
          subject = subjectMatch[1].trim()
          console.log('AI generated subject:', subject)
        }
        
        if (needsBody && bodyMatch && bodyMatch[1]) {
          body = bodyMatch[1].trim()
          console.log('AI generated body length:', body.length)
        }
        
      } catch (aiError) {
        console.error('AI email generation failed:', aiError)
        
        // Fallback generation based on original command
        if (needsSubject) {
          let topicMatch = originalCommand.match(/about (.+)|regarding (.+)|for (.+)|on (.+)/i)
          if (topicMatch) {
            const topic = (topicMatch[1] || topicMatch[2] || topicMatch[3] || topicMatch[4]).trim()
            subject = `Regarding ${topic.charAt(0).toUpperCase() + topic.slice(1)}`
          } else {
            subject = 'Important Message'
          }
        }
        
        if (needsBody) {
          let topic = 'this matter'
          let topicMatch = originalCommand.match(/about (.+)|regarding (.+)|explain (.+)|discuss (.+)/i)
          if (topicMatch) {
            topic = (topicMatch[1] || topicMatch[2] || topicMatch[3] || topicMatch[4]).trim()
          }
          
          body = `Hello,

I hope this email finds you well. I wanted to reach out regarding ${topic}.

I'd be happy to discuss this further at your convenience.

Best regards`
        }
      }
    }

    // Final fallbacks
    if (!subject) {
      subject = 'Important Message'
    }
    
    if (!body) {
      body = `Hello,

I hope this email finds you well.

Best regards`
    }

    console.log('Final email details:')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('Body length:', body.length)

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
      message: `✅ Email sent successfully to ${to}\n📧 Subject: "${subject}"\n📝 ${needsSubject || needsBody ? 'Generated with AI assistance' : 'Sent with provided content'}`,
      messageId: result.data.id,
      generatedSubject: needsSubject,
      generatedBody: needsBody
    })
  } catch (error) {
    console.error('Gmail Send Error:', error)
    
    if (error.code === 401 || error.status === 401) {
      return NextResponse.json({ 
        error: 'Gmail authentication failed. Please re-authenticate with Google.' 
      }, { status: 401 })
    }
    
    if (error.code === 403 || error.status === 403) {
      return NextResponse.json({ 
        error: 'Access denied. Please check your Gmail permissions.' 
      }, { status: 403 })
    }
    
    const msg = error?.message || 'Failed to send email. Please check your permissions and try again.'
    return NextResponse.json({ 
      error: msg
    }, { status: 500 })
  }
}