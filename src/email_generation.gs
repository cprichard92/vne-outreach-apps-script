/*** EMAIL GENERATION *********************************************************/
function generateEmailWithMode_(apiKey, ctx) 
  const  business, insight, establishmentType, isFollowUp  = ctx;
  
  try 
    const emailJsonStr = callGemini(apiKey, buildEmailGenerationPrompt(
      business, insight, establishmentType,
      specUrl: SPEC_SHEET_URL, bookingUrl: BOOKING_URL,
      phone: VNE_PHONE, email: VNE_EMAIL, site: VNE_SITE,
      igHandle: IG_HANDLE, fbHandle: FB_HANDLE,
      igUrl: IG_URL, fbUrl: FB_URL, linkedin: LINKEDIN_URL,
      logo: VNE_LOGO, article: USA_WINE_ARTICLE,
      isFollowUp: !!isFollowUp
    )).trim();

    return safeParseEmailJSON(emailJsonStr, business, insight, establishmentType);
   catch (e) 
    Logger.log('Email gen error: ' + e + ', using fallback');
    return safeParseEmailJSON('', business, insight, establishmentType);
  

function buildEmailGenerationPrompt(ctx) 
  const 
    business, insight, establishmentType,
    specUrl, bookingUrl, phone, email, site,
    igHandle, fbHandle, igUrl, fbUrl, linkedin, logo, article,
    isFollowUp
   = ctx;

  // Determine greeting based on current time
  const hour = new Date().getHours();
  let greeting = 'Good afternoon,';
  if (hour < 12) greeting = 'Good morning,';
  else if (hour >= 17) greeting = 'Good evening,';

  const subjectLead = isFollowUp
    ? 'Following up: Wine Partnership Opportunity'
    : 'Wine Partnership Opportunity with VNE Importers';

  return `
  Write a crisp, professional B2B sales email for Vin Noir Explorers and Importers (VNE Importers) to a buyer at $business (a $establishmentType).

  CRITICAL: Use proper UTF-8 encoding. Convert all special characters correctly (é, ñ, ú, etc.).

  STRUCTURE (natural flow, avoid run-ons):

  1. GREETING: "$greeting"

  2. OPENING (2-3 short paragraphs):
    - Para 1: "$insight" (use verbatim)
    - Para 2: $isFollowUp ? ""Following up on our earlier note—we know schedules get packed and wanted to make this easy."" : ""We're reaching out because we think our portfolio could complement what you offer at ' + business + '.""
    - Para 3 (if needed): Brief natural transition

  3. COMPANY INTRO (single paragraph):
    "We're <a href="$site">Vin Noir Explorers and Importers</a>, the only Black-owned wine importer and wholesaler specializing in small-batch, family-owned wines from Argentina, Chile, Italy, Spain, Switzerland, and the U.S. (Read more about us in <a href="$article">USA Wine Ratings</a>.) We handle all deliveries and logistics so you can focus on what matters most."

  4. VALUE PROPS (clean bullets):
    <strong>What we can do for $business:</strong>
    <ul style="margin-top:8px;">
      <li>Curate wines that fit your program and price points</li>
      <li>Handle deliveries and logistics seamlessly</li>
      <li>Provide staff education and private tasting events</li>
    </ul>

  5. NEXT STEPS (clean bullets):
    <strong>Getting started is easy:</strong>
    <ul style="margin-top:8px;">
      <li>Browse our <a href="$specUrl">portfolio and spec sheets</a> — submit orders directly from the sheet</li>
      <li>Book a <a href="$bookingUrl">15-minute intro call</a> at your convenience</li>
      <li>Reply to this email or text us at <strong>$phone</strong></li>
    </ul>

  6. PAYMENT INFO (single paragraph):
    "We make purchasing convenient—pay by invoice, credit card, check, or FinTech. If you'd like to use FinTech, just let us know your business name and location, and we'll send a connection request."

  7. SIGNATURE:
    <p style="margin-top:16px;">Looking forward to connecting,<br>
    <strong>Vin Noir Explorers and Importers</strong><br>
    <a href="mailto:$email">$email</a> | <a href="tel:$phone">$phone</a> | <a href="$site">vneimporters.com</a></p>
    
    <p style="margin-top:8px;">
    <a href="$igUrl">Instagram</a> | <a href="$fbUrl">Facebook</a> | <a href="$linkedin">LinkedIn</a><br>
    <em>"Every Glass, a Chapter. Every Bottle, a Story."</em></p>
    
    <p style="margin-top:12px;"><a href="$site"><img src="$logo" alt="VNE Importers" style="max-width:200px; height:auto;" /></a></p>
    
    <p style="font-size:11px; color:#666; margin-top:12px;">Not licensed to sell alcohol in North Carolina, or prefer not to receive these emails? Reply "opt out" and we'll remove you promptly.</p>

  SUBJECT LINE:
  "$subjectLead - $business"

  REQUIREMENTS:
  - Clean HTML with proper UTF-8 encoding
  - Under 150 words (excluding signature)
  - Natural tone, NO run-ons
  - First company mention links to $site
  - Second company mention links to $article

  OUTPUT: Return STRICT JSON:  "subject": "<string>", "html": "<string>" 
  `;
  

  function safeParseEmailJSON(s, business, insight, establishmentType) 
    const hour = new Date().getHours();
    let greeting = 'Good afternoon,';
    if (hour < 12) greeting = 'Good morning,';
    else if (hour >= 17) greeting = 'Good evening,';

    const baseSubject = 'Wine Partnership Opportunity with VNE Importers - ' + (business || 'Your Business');

    const fallbackHtml = `
      <p>$greeting</p>
      
      <p>$insight || 'We reviewed your establishment and were impressed by your commitment to quality.'</p>
      
      <p>We're reaching out because we think our portfolio could complement what you offer at $business || 'your establishment'.</p>
      
      <p>We're <a href="$VNE_SITE">Vin Noir Explorers and Importers</a>, the only Black-owned wine importer and wholesaler specializing in small-batch, family-owned wines from Argentina, Chile, Italy, Spain, Switzerland, and the U.S. (Read more about us in <a href="$USA_WINE_ARTICLE">USA Wine Ratings</a>.) We handle all deliveries and logistics so you can focus on what matters most.</p>
      
      <strong>What we can do for $business || 'you':</strong>
      <ul style="margin-top:8px;">
        <li>Curate wines that fit your program and price points</li>
        <li>Handle deliveries and logistics seamlessly</li>
        <li>Provide staff education and private tasting events</li>
      </ul>
      
      <strong>Getting started is easy:</strong>
      <ul style="margin-top:8px;">
        <li>Browse our <a href="$SPEC_SHEET_URL">portfolio and spec sheets</a> — submit orders directly from the sheet</li>
        <li>Book a <a href="$BOOKING_URL">15-minute intro call</a> at your convenience</li>
        <li>Reply to this email or text us at <strong>$VNE_PHONE</strong></li>
      </ul>
      
      <p>We make purchasing convenient—pay by invoice, credit card, check, or FinTech. If you'd like to use FinTech, just let us know your business name and location, and we'll send a connection request.</p>
      
      <p style="margin-top:16px;">Looking forward to connecting,<br>
      <strong>Vin Noir Explorers and Importers</strong><br>
      <a href="mailto:$VNE_EMAIL">$VNE_EMAIL</a> | <a href="tel:$VNE_PHONE">$VNE_PHONE</a> | <a href="$VNE_SITE">vneimporters.com</a></p>
      
      <p style="margin-top:8px;">
      <a href="$IG_URL">Instagram</a> | <a href="$FB_URL">Facebook</a> | <a href="$LINKEDIN_URL">LinkedIn</a><br>
      <em>"Every Glass, a Chapter. Every Bottle, a Story."</em></p>
      
      <p style="margin-top:12px;"><a href="$VNE_SITE"><img src="$VNE_LOGO" alt="VNE Importers" style="max-width:200px; height:auto;" /></a></p>
      
      <p style="font-size:11px; color:#666; margin-top:12px;">Not licensed to sell alcohol in North Carolina, or prefer not to receive these emails? Reply "opt out" and we'll remove you promptly.</p>
    `;

    // Insert required links/logo if the model output omits them
    function ensureLinksAndAssets(html) 
      let out = html || '';
      // site link on first mention
      if (!/href="https?://[^"]*vneimporters.com/i.test(out)) 
        out = out.replace(/Vin Noir Explorers and Importers/i, `<a href="$VNE_SITE">Vin Noir Explorers and Importers</a>`);
        if (!/href="https?://[^"]*vneimporters.com/i.test(out)) 
          out = `<p><a href="$VNE_SITE">Vin Noir Explorers and Importers</a></p>` + out;
        
      
      // USA Wine Ratings article
      if (!/USA Wine Ratings/i.test(out)) 
        out += `<p>Read more about us in <a href="$USA_WINE_ARTICLE">USA Wine Ratings</a>.</p>`;
      
      // spec sheet link
      if (!/href="https?://[^"]*google.com/spreadsheets/i.test(out)) 
        out += `<p>View our <a href="$SPEC_SHEET_URL">portfolio and spec sheets</a>.</p>`;
      
      // booking link
      if (!/href="https?://[^"]*(calendly|calendar)./i.test(out)) 
        out += `<p>Book a <a href="$BOOKING_URL">15-minute intro call</a>.</p>`;
      
      // logo image
      if (!/<img[^>]+src="[^"]+"/i.test(out) || !/VNE Importers/i.test(out)) 
        out += `<p style="margin-top:12px;"><a href="$VNE_SITE"><img src="$VNE_LOGO" alt="VNE Importers" style="max-width:200px;height:auto;"></a></p>`;
      
      return out;
    

  try 
    let cleaned = (s || '').trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
    cleaned = cleaned.trim();
    
    const obj = JSON.parse(cleaned);
    let subject = String(obj.subject || '').trim() || baseSubject;
    let html    = String(obj.html || '').trim() || fallbackHtml;
    
    // Normalize encoding
    subject = normalizeAsciiPunctuation(subject);
    html    = normalizeAsciiPunctuation(html);

    // Guarantee links/logo
    html = ensureLinksAndAssets(html);
    
    return  subject, html ;
   catch 
    const subject = normalizeAsciiPunctuation(baseSubject);
    const html    = ensureLinksAndAssets(normalizeAsciiPunctuation(fallbackHtml));
    return  subject, html ;
