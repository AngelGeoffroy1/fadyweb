import { NextResponse } from 'next/server'

export async function GET() {
  const teamId = process.env.NEXT_PUBLIC_APPLE_TEAM_ID

  if (!teamId) {
    console.error('NEXT_PUBLIC_APPLE_TEAM_ID is not defined')
    return new NextResponse('Apple Team ID not configured', { status: 500 })
  }

  const appleAppSiteAssociation = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.com.fady.com.fady`,
          paths: ['/hairdresser/*']
        }
      ]
    }
  }

  return new NextResponse(JSON.stringify(appleAppSiteAssociation, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
