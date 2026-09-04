import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = (await request.json()) as {
      username?: string
      password?: string
    }

    const expectedUsername = process.env.APP_USERNAME || 'dev.amrelsherif'
    const expectedPassword = process.env.APP_PASSWORD || '010135'

    if (username?.trim() === expectedUsername && password?.trim() === expectedPassword) {
      return NextResponse.json(
        { ok: true, message: 'Authentication successful' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { ok: false, error: 'Access Denied: Invalid operator credentials.' },
      { status: 401 }
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Authentication service error' },
      { status: 500 }
    )
  }
}
