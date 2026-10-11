// Temporary stand-ins for real SMS and email providers.
// Messages are printed to the server console so the flows can be tested locally.

export async function sendSms(phone: string, text: string): Promise<void> {
  console.log(`[SMS to ${phone}] ${text}`);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  console.log(`[EMAIL to ${to}] ${subject}\n${text}`);
}
