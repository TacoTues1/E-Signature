import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { documentId, emailTo, fields, signedDocumentBase64 } = await request.json();

    console.log('=== Email Send Request ===');
    console.log('Document ID:', documentId);
    console.log('Recipient:', emailTo);
    console.log('Fields count:', fields?.length);
    console.log('Has signed document:', !!signedDocumentBase64);
    if (signedDocumentBase64) {
      console.log('Document base64 length:', signedDocumentBase64.length);
    }

    // Verify env setup
    if (!process.env.BREVO_API_KEY) {
      console.error("BREVO_API_KEY is not set in environment variables!");
      return NextResponse.json({ error: "Brevo API key not configured", simulated: true }, { status: 500 });
    }

    if (!emailTo) {
      console.error("No recipient email provided!");
      return NextResponse.json({ error: "No recipient email provided" }, { status: 400 });
    }

    // Format the fields for the email body to show the signed values
    const fieldsFormatted = fields.map((f: any) => {
      if (f.type === 'name') {
        return `<p style="margin: 8px 0;">✅ <strong>Name Field</strong>: ${f.value}</p>`;
      } else if (f.type === 'signature') {
        return `<p style="margin: 8px 0;">✅ <strong>Signature</strong>: Captured and verified</p>`;
      }
      return '';
    }).join('');

    // Build the email HTML — include inline image of the signed document if available
    const signedDocImageHtml = signedDocumentBase64 
      ? `
        <div style="margin: 20px 0;">
          <p style="color: #374151; font-weight: bold; font-size: 14px; margin-bottom: 10px;">📎 Signed Document Preview:</p>
          <img src="cid:signed_document" alt="Signed Document" style="max-width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;" />
        </div>
      `
      : '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
        <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 30px; border-radius: 12px 12px 0 0;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">📄 Document Signed!</h2>
        </div>
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="color: #4b5563; font-size: 16px; margin-bottom: 20px;">
            The document has been successfully signed by the recipient.
          </p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; text-align: left; margin: 20px 0; border: 1px solid #e5e7eb;">
            ${fieldsFormatted}
          </div>
          ${signedDocImageHtml}
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            Document ID: ${documentId}
          </p>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            Sent via E-Signature System
          </p>
        </div>
      </div>
    `;

    const brevoPayload: any = {
      sender: { name: 'E-Signature System', email: 'alfnzperez@gmail.com' }, // Must match verified Brevo sender
      to: [{ email: emailTo }],
      subject: `Document Signed Successfully! (ID: ${documentId})`,
      htmlContent
    };

    // Attach the signed document as a downloadable file AND as inline image
    if (signedDocumentBase64) {
      brevoPayload.attachment = [
        {
          name: `Signed_Document_${documentId}.jpg`,
          content: signedDocumentBase64
        }
      ];
      // Also set as inline image for the email body preview
      brevoPayload.messageVersions = undefined; // not needed
      // Use headers to embed inline image
      brevoPayload.attachment.push({
        name: 'signed_document.jpg',
        content: signedDocumentBase64,
        contentId: 'signed_document'
      });
    }

    console.log('Sending to Brevo API...');
    console.log('Sender:', brevoPayload.sender.email);
    console.log('To:', brevoPayload.to[0].email);
    console.log('Attachments:', brevoPayload.attachment?.length || 0);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(brevoPayload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Brevo API error:", response.status, responseData);
      return NextResponse.json({ error: "Brevo delivery failed", details: responseData }, { status: 500 });
    }

    console.log('✅ Email sent successfully!', responseData);
    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error("Email sending exception:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: String(error) },
      { status: 500 }
    );
  }
}
