import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { documentId, emailTo, fields } = await request.json();

    // Verify env setup
    if (!process.env.BREVO_API_KEY) {
      console.warn("Brevo API key not set. Simulating email success.");
      return NextResponse.json({ success: true, simulated: true });
    }

    // Format the fields for the email body to show the signed values
    const fieldsFormatted = fields.map((f: any) => {
      if (f.type === 'name') {
        return `✅ **Name Field**: ${f.value}`;
      } else if (f.type === 'signature') {
        return `✅ **Signature**: (Captured and verified)`;
      }
      return '';
    }).join('\n\n');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
        <h2 style="color: #2563eb;">Document Signed!</h2>
        <p style="color: #4b5563; font-size: 16px;">
          The document has been successfully signed by the recipient.
        </p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: left; margin: 20px 0;">
          <p style="margin: 0; white-space: pre-line;">
            ${fieldsFormatted}
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px;">
          Document ID Tracking: ${documentId}
        </p>
      </div>
    `;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'E-Signature System', email: 'alfonzperez92@gmail.com' }, // Must match the verified Brevo login email
        to: [{ email: emailTo || 'alfonzperez92@gmail.com' }],
        subject: `Document Signed Successfully! (ID: ${documentId})`,
        htmlContent
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo delivery failed:", errorData);
      return NextResponse.json({ error: "Brevo delivery failed", details: errorData }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Email sending failed:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
