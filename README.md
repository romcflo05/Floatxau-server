# FloatXAU Quote Server

Automated quote generation server for FloatXAU.

## How it works
1. Customer submits quote form on floatxau.com (Wix)
2. Wix sends a webhook to this server
3. Server calculates materials (blocks, rollers, pins, bolts, airlift)
4. Server generates a pre-filled quote URL
5. You open the URL, review/edit, approve and download PDF

## Deploy to Render
1. Push this repo to GitHub
2. Connect GitHub repo to Render
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variable: `BASE_URL` = your Render URL (e.g. https://floatxau-quotes.onrender.com)

## Wix Setup
1. Go to Wix Automations
2. Create new automation
3. Trigger: "A visitor submits a form" → select Float X Quote Form
4. Action: "Send HTTP request"
   - URL: https://your-render-url.onrender.com/wix-webhook
   - Method: POST
   - Body type: JSON
   - Body: paste the field mapping from Wix

## Endpoints
- `GET /` — health check
- `POST /wix-webhook` — receives Wix form submission
- `GET /quote?data=xxx` — pre-filled quote page

## Pricing (update in server.js if prices change)
- Single blocks: $100
- Roller blocks: $200
- Flat pins: $25
- Bolts: $15
- Airlift: $5,000
- Install fee: $1,000
