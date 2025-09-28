import { NextResponse } from 'next/server'
import { getGoogleClient } from '@/app/lib/google-client'

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

    // Create the event object
    const event = {
      summary: summary || 'New Meeting',
      description: description || '',
      start: {
        dateTime: startTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime || new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
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