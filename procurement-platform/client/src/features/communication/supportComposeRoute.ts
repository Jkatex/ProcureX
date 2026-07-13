const supportComposeBody = 'Please describe the support issue you need admin help with.';

export function supportComposeRoute() {
  const params = new URLSearchParams({
    view: 'compose',
    support: 'true',
    category: 'Support',
    subject: 'Support request',
    body: supportComposeBody
  });
  return `/communication?${params.toString()}`;
}
