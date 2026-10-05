# Contact form email delivery

The contact form sends messages server-side through Resend to `mv164466@gmail.com`.
The sender address must belong to a domain verified with Resend; visitor email
addresses are set as `Reply-To`, not `From`, to preserve sender authentication.

## Vercel configuration

1. Add and verify `protovium.in` in Resend. Publish the DNS records Resend
   provides, including SPF and DKIM. Keep any existing mail-provider SPF records
   intact and merge them as directed by your DNS provider.
2. Create a Resend API key with permission to send email.
3. In Vercel project settings, add these environment variables for Production
   (and Preview if needed):
   - `RESEND_API_KEY`: the Resend API key.
   - `RESEND_FROM_EMAIL`: a sender address on the verified domain, for example
     `PROTOVIUM Website <website@protovium.in>`.
4. Redeploy the site after setting the variables.
5. Submit a test from `/connect` and confirm delivery to `mv164466@gmail.com`.

Never commit the API key to the repository. The API endpoint returns a clear
configuration error until both environment variables are set.
