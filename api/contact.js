const RECIPIENT = 'mv164466@gmail.com';
const MAX_LENGTHS = {
  name: 120,
  email: 254,
  subject: 200,
  message: 5000
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error('Contact email is not configured: missing Resend environment variables.');
    return res.status(503).json({
      error: 'The contact form is temporarily unavailable. Please email mv164466@gmail.com directly.'
    });
  }

  let data = req.body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return res.status(400).json({ error: 'Invalid form submission.' });
    }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid form submission.' });
  }

  if (typeof data.website === 'string' && data.website.trim()) {
    return res.status(202).json({ ok: true });
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const enquiry = typeof data.enquiry === 'string' ? data.enquiry.trim() : '';

  if (
    !name ||
    name.length > MAX_LENGTHS.name ||
    !email ||
    email.length > MAX_LENGTHS.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    subject.length > MAX_LENGTHS.subject ||
    !message ||
    message.length > MAX_LENGTHS.message ||
    !['collaboration', 'consulting', 'general'].includes(enquiry)
  ) {
    return res.status(400).json({ error: 'Please check your details and try again.' });
  }

  const emailSubject = (subject || `Protovium enquiry: ${enquiry}`).replace(/[\r\n]+/g, ' ');
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Enquiry type: ${enquiry}`,
    '',
    message
  ].join('\n');

  try {
    const providerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [RECIPIENT],
        reply_to: email,
        subject: emailSubject,
        text
      })
    });

    if (!providerResponse.ok) {
      console.error(`Resend email delivery failed with HTTP ${providerResponse.status}.`);
      return res.status(502).json({
        error: 'We could not deliver your message right now. Please try again or email mv164466@gmail.com.'
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact email delivery request failed.', error);
    return res.status(502).json({
      error: 'We could not deliver your message right now. Please try again or email mv164466@gmail.com.'
    });
  }
};
