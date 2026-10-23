// The one Workers runtime module the Worker imports (worker/index.ts): the
// message Email Routing's send_email binding sends (worker/feedback.ts).
// The unit tests swap in tests/stubs/cloudflare-email.ts (vite.config.ts).
declare module 'cloudflare:email' {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
    readonly from: string;
    readonly to: string;
  }
}
