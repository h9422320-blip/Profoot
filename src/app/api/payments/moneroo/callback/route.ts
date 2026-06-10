import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  // Moneroo might pass status or payment ID in the query params.
  // The definitive source of truth is the webhook, but we use this to show the success page.
  const status = url.searchParams.get('status') || url.searchParams.get('state');
  
  // baseUrl for redirection
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  // Simple redirection logic: if the payment wasn't explicitly cancelled or failed
  // we redirect to the success page which will tell the user their payment is processing
  if (status === 'cancelled' || status === 'failed') {
    return NextResponse.redirect(`${baseUrl}/payment-failed`);
  }

  // Otherwise, assume pending or success
  return NextResponse.redirect(`${baseUrl}/payment-success`);
}
