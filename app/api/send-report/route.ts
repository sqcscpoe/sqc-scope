import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { email, projectName, address, systemType, report } = await request.json();

    if (!email || !report) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const isReady = report.includes('LISTO PARA M1');

    const { error } = await resend.emails.send({
      from: 'SQC Scope <onboarding@resend.dev>',
      to: [email],
      subject: `${isReady ? '✅' : '⚠️'} Reporte QC — ${projectName}`,
      text: report,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send report error:', error);
    return NextResponse.json({ error: 'Error sending email' }, { status: 500 });
  }
}
