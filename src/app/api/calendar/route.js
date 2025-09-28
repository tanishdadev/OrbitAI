import { NextResponse } from 'next/server'
import { getGoogleClient } from '../../../../lib/google-client'

export async function POST(req) {
  try {
    const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { summary, description, startTime, endTime, attendees, timeZone } = await req.json()
    console.log('=== CALENDAR API REQUEST DEBUG ===')
    console.log('Received data:', { summary, description, startTime, endTime, attendees, timeZone })
    console.log('Current server time:', new Date().toISOString())
    console.log('User timezone:', timeZone || 'Not provided')
    
    if (!summary) {
      return NextResponse.json({ 
        error: 'Event summary is required'
      }, { status: 400 })
    }

    if (!startTime || !endTime) {
      return NextResponse.json({ 
        error: 'Both startTime and endTime are required in ISO format (e.g., 2025-10-02T15:00:00)' 
      }, { status: 400 })
    }

    const startDateTime = new Date(startTime)
    const endDateTime = new Date(endTime)
    console.log('Parsed dates:')
    console.log('- Start:', startDateTime.toISOString(), '(Local:', startDateTime.toString(), ')')
    console.log('- End:', endDateTime.toISOString(), '(Local:', endDateTime.toString(), ')')

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json({ 
        error: 'Invalid date format. Please use ISO 8601 format, e.g., 2025-10-02T15:00:00' 
      }, { status: 400 })
    }

    const { calendar } = getGoogleClient(accessToken)
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
    console.log('Final timezone being used:', tz)

    const event = {
      summary,
      description: description || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: tz,
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
    
    console.log('Event object being sent to Google:', JSON.stringify(event, null, 2))

    console.log('Creating calendar event with token:', accessToken.substring(0, 10) + '...')
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendNotifications: true
    })

    const meetLink = response.data.hangoutLink || 
                    response.data.conferenceData?.entryPoints?.[0]?.uri

    const formattedStartDate = new Date(response.data.start.dateTime)
    const formattedDate = formattedStartDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const formattedTime = formattedStartDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    })

    let message = `✅ Meeting "${summary}" scheduled for ${formattedDate} at ${formattedTime} (${tz}).`
    
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
    console.error('Calendar Error Details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data
    })
    
    if (error.code === 401 || error.status === 401) {
      return NextResponse.json({ 
        error: 'Authentication failed. Please re-authenticate with Google.' 
      }, { status: 401 })
    }
    
    if (error.code === 403 || error.status === 403) {
      return NextResponse.json({ 
        error: 'Access denied. Please check your Google Calendar permissions.' 
      }, { status: 403 })
    }
    
    return NextResponse.json({ 
      error: `Failed to create calendar event: ${error.message}` 
    }, { status: 500 })
  }
}