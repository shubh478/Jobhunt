// Seed list of companies hiring through public ATS APIs. Each entry is the company's
// "board token" / slug used in their ATS API URL. No aggregators — these hit the
// company's real career page API and the apply URLs go straight to their ATS.
//
// To add more: visit a company's careers page. If it's hosted on boards.greenhouse.io
// the slug is in the URL. Same for jobs.lever.co and jobs.ashbyhq.com.

// Greenhouse public API: https://boards-api.greenhouse.io/v1/boards/{token}/jobs
const GREENHOUSE = [
  'airbnb', 'stripe', 'figma', 'discord', 'instacart', 'coinbase', 'doordash',
  'robinhood', 'gitlab', 'wealthfront', 'databricks', 'canva', 'deel',
  'mercury', 'notion', 'retool', 'linear', 'vercel', 'anthropic', 'webflow',
  'scale', 'ramp', 'brex', 'asana', 'samsara', 'rippling', 'benchling',
  'dbt', 'cloudflare', 'snyk', 'hashicorp', 'gusto', 'fivetran', 'segment',
  'zapier', 'getlago', 'posthog', 'retrain', 'plaid', 'hex', 'cruise',
  'toast', 'affirm', 'dropbox', 'chime', 'reddit', 'pinterest', 'squarespace',
  'mongodb', 'cockroachlabs', 'datadog', 'twilio', 'zendesk', 'atlassian',
  'greenhouse', 'sentry', 'datagrail', 'figshare', 'sourcegraph', 'applied',
  'spothero', 'thoughtspot', 'elastic', 'guardant', 'oyorooms',
  'zomato', 'freshworks', 'razorpay', 'cred', 'meesho', 'groww', 'postman',
  'browserstack', 'hasura', 'chargebee', 'zerodha', 'zeta', 'niyo',
  'urbancompany', 'dream11', 'phonepe', 'swiggy', 'licious', 'upgrad'
];

// Lever public API: https://api.lever.co/v0/postings/{slug}?mode=json
const LEVER = [
  'github', 'clickup', 'figma', 'netflix', 'spotify', 'uber', 'shopify',
  'booking', 'coursera', 'discord', 'mozilla', 'khanacademy', 'plaid', 'turing',
  'commandline', 'temporal', 'knowde', 'ashby', 'ramp', 'checkr', 'mercury',
  'recursion', 'grafana', 'levelup', 'typeform', 'fastly', 'cloudflare',
  'supabase', 'vercel', 'replit', 'cockroachlabs', 'duolingo', 'gopuff',
  'appzen', 'getmoloco', 'tripactions', 'getaround', 'signifyd'
];

// Ashby public API: https://api.ashbyhq.com/posting-api/job-board/{slug}
const ASHBY = [
  'ramp', 'linear', 'posthog', 'openai', 'anthropic', 'mercury', 'sourcegraph',
  'vercel', 'replit', 'retool', 'scale', 'gem', 'baseten', 'railway',
  'huntress', 'clearmatch', 'crusoeenergy', 'arcjet', 'ashby', 'readthedocs',
  'clipboardhealth', 'granola', 'browserbase', 'modal', 'mintlify', 'ctoai',
  'deepgram', 'huntress', 'finch', 'fly', 'notable', 'runwayml'
];

module.exports = { GREENHOUSE, LEVER, ASHBY };
