// What the unit tests import for the Workers runtime's cloudflare:email
// (vite.config.ts, test.alias): a message that only remembers what it was
// given, so a test can read the raw e-mail the Worker would send.
export class EmailMessage {
  constructor(
    readonly from: string,
    readonly to: string,
    readonly raw: string
  ) {}
}
