# Connecting the reports to your inbox, step by step

This is for doing it the first time. It takes about fifteen minutes in the
Cloudflare dashboard and the terminal, and costs nothing.

**Do step 1 before the feedback branch is merged into main.** A merge
deploys, and from then on the app, the crash screen, the privacy page and
GitHub all give `feedback@sudokui.app` as the address to write to. Until
step 1 is done that address cannot receive mail. Step 2 can come before
or after the merge: until it is done, the app's "Send feedback" says it
cannot send right now and offers the address and GitHub instead, so
nothing a player writes is lost to a stranger.

## What you are connecting, in plain words

- **The report dialog.** "Send feedback" in the footer and in Info, and
  "Looks wrong?" under a hint, open a form in the app (src/ui/ReportDialog.tsx).
  Pressing Send posts it to the Worker at `/api/feedback`
  (worker/feedback.ts), which checks every field and e-mails it to you.
  The Worker keeps no copy; the report exists as that e-mail. The privacy
  page lists exactly what a report carries.
- **Email Routing** is Cloudflare's free forwarding for your domain. It is
  not a mailbox and not a mail service you pay for: it takes mail sent to
  an address on sudokui.app, such as `feedback@sudokui.app`, and forwards
  it to the inbox you already use. The Worker sends the reports through
  it too, from `feedback@sudokui.app` to your inbox, also for free.
  Cloudflare keeps a log of each letter it handles (sender, recipient,
  subject) for 31 days, which clears itself; the privacy page says so.
- **Your own address is not in the code or on the site.** The Worker reads
  it from a secret, `FEEDBACK_TO`, stored with the Worker on Cloudflare,
  like the dashboard's secrets, and players are given only
  `feedback@sudokui.app`. When you answer a player, though, your reply
  goes out from your inbox's own address, unless your mail provider lets
  you send as `feedback@sudokui.app`.
- **sudokui.app receives no mail today** (it has no MX records), so
  turning Email Routing on changes nothing that already works.

## Step 1: turn on Email Routing and make the address

Cloudflare has moved Email Routing around its dashboard over time. Today
it lives at the account level; older dashboards show it on the domain as
**Email → Email Routing**. Either works; the steps are the same.

1. In the Cloudflare dashboard, go to **Compute → Email Service → Email
   Routing** (or, on the domain sudokui.app, **Email → Email Routing**),
   and choose **Onboard Domain** (or **Get started**) for sudokui.app.
2. It shows the DNS records it will add: three MX records and two TXT
   records (SPF and DKIM). Confirm. Nothing else on the domain changes.
3. **Destination addresses → Add destination address**: type the inbox
   you want reports in and submit. Cloudflare e-mails that inbox a link;
   open it and click **Verify email address**. The address now says
   **Verified**. (The rule in the next step can only send to a verified
   address.)
4. **Routing rules → Create routing rule** (older dashboards: **Custom
   addresses → Create address**):
   - Email pattern (custom address): `feedback`, on sudokui.app
   - Action: **Send to an email**
   - Destination: the inbox you just verified.
   - **Save**.

To check: from an address other than that inbox (some providers quietly
drop mail that seems to come from yourself), send a letter to
`feedback@sudokui.app`. It arrives within a few minutes, once DNS has
settled.

## Step 2: give the Worker your address

In PowerShell, inside the repository folder (after `git pull`), run the
command, and when it asks, paste exactly the inbox address you verified
in step 1:

```bash
npx wrangler secret put FEEDBACK_TO
```

It answers that the secret was uploaded. The code before this branch
ignores the secret, so it is safe to set at any time.

If it instead says the latest version of your Worker isn't currently
deployed, a pushed branch made a newer preview version than the live
one. Run the command again right after the next deploy of main (or
choose **Retry build** for the latest main build under **Workers & Pages →
sudokui → Deployments**), as with the dashboard's secrets
([connect-the-analytics.md](connect-the-analytics.md)).

## Step 3: send yourself a report

Open https://sudokui.app, scroll to the footer, press **Send feedback**,
write a line and press **Send**. The dialog says "Your report is on its
way", and the e-mail arrives from `sudokUI feedback
<feedback@sudokui.app>` with the subject `[sudokUI] Something is not
working`. When the player gave an address, replying answers them (the
e-mail's Reply-To is theirs), from your inbox's own address.

Then ask for a hint, press **Show me**, then **Looks wrong?**, and send
it: the e-mail carries the hint's line of notation, the settings it was
found under, whether the app found the step agrees with the solution,
and a link that opens the board exactly as it stood.

## Step 4: three labels on GitHub

The issue forms (in `.github/ISSUE_TEMPLATE/`) label what they file, but
GitHub only applies labels that exist. On
https://github.com/AImenes/sudokUI/labels, choose **New label** three
times: `hint`, `translation` and, if it is not there yet, `enhancement`
(GitHub's default for ideas). `bug` exists already.

## If something goes wrong

- **The dialog says it could not be sent right now.** One of these: the
  secret is missing or is not exactly the verified address (step 2; `npx
  wrangler secret list` names the secrets that exist, and putting it
  again replaces it); Email Routing is not on, or the destination is not
  verified (step 1); or the limits were reached, five reports from one
  address in ten minutes or thirty in the hour (wait and try again).
- **The dialog says the report is on its way, but nothing arrives.** Check
  the spam folder first. In Cloudflare, Email Routing's summary counts the
  Worker's reports as "dropped" even when they were delivered, so look at
  the activity log instead. And a report sent from another website's page,
  within two seconds of opening, or with the hidden field filled in (a
  password manager can do that) is answered as sent and goes nowhere, by
  design.
- **The test letter in step 1 never arrives.** Check your spam folder,
  send it from a different address than the inbox itself, then check
  that the destination says Verified and the rule for `feedback` is
  enabled.
- **Too many reports.** Each running copy of the Worker lets one address
  send five reports in ten minutes and sends at most thirty an hour;
  Cloudflare runs many copies, so these are brakes, not global caps.
  Robots that fill in the hidden field, send within two seconds, or post
  from another website's page are answered as if sent, and nothing goes
  out. If spam gets through anyway, say so, and the limits can be
  tightened.

## What you promised on the privacy page

Reports and letters are kept in your inbox until they have been dealt
with, at most 12 months, and then deleted, together with your answers to
them. Once a month, delete every report and letter that has been dealt
with, and anything older than 11 months, together with your answers in
the Sent folder, and then empty the Trash (Deleted items): that keeps the
promise. Anyone may ask for a copy of what they sent (also in a
machine-readable form), to have it corrected or deleted, or withdraw
their consent, by writing to `feedback@sudokui.app`; answer such a
request within a month. Cloudflare's own log of the letters it handles
clears itself after 31 days.
