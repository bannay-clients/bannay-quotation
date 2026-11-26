'use strict';

// Supabase already returns Google sign-ins to the published site root.
// Keep that registered URL and let the quotation's existing client process the response.
const callback = new URL(window.location.href);
const fragment = new URLSearchParams(callback.hash.slice(1));
const isAuthResponse =
  (fragment.has('access_token') && fragment.has('refresh_token')) ||
  fragment.has('error_code') ||
  callback.searchParams.has('code') ||
  callback.searchParams.has('error_code');

if (isAuthResponse) {
  const quotation = new URL('quotation.html', callback);
  quotation.search = callback.search;
  quotation.hash = callback.hash;
  window.location.replace(quotation.href);
}
