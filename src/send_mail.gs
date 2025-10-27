/*** SENDING WITH UTF-8 ENCODING **********************************************/
function sendHtmlEmailFromInfoAlias(to, subject, html) 
  const fromName = 'Vin Noir Explorers and Importers';

  // Normalize UTF-8 and punctuation
  subject = normalizeUTF8(subject);
  html = normalizeUTF8(html);

  // Guarantee key links and logo are present
  html = html.replace(/Vin Noir Explorers and Importers(?!</a>)/g, `<a href="$VNE_SITE">Vin Noir Explorers and Importers</a>`);
  if (!/USA Wine Ratings/i.test(html)) 
    html += `<p>Read more about us in <a href="$USA_WINE_ARTICLE">USA Wine Ratings</a>.</p>`;
  
  if (!/portfolio and spec sheets/i.test(html)) 
    html += `<p>View our <a href="$SPEC_SHEET_URL">portfolio and spec sheets</a>.</p>`;
  
  if (!/15-minute intro call/i.test(html)) 
    html += `<p>Book a <a href="$BOOKING_URL">15-minute intro call</a>.</p>`;
  

  // Inject inline image with CID tag if missing
  if (!/<img[^>]+src="cid:vneLogo"/i.test(html)) 
    html = html.replace(
      /<img[^>]+alt="VNE Importers"[^>]*>/i,
      `<img src="cid:vneLogo" alt="VNE Importers" style="max-width:200px;height:auto;">`
    );
    if (!/cid:vneLogo/.test(html)) 
      html += `<p style="margin-top:12px;"><a href="$VNE_SITE"><img src="cid:vneLogo" alt="VNE Importers" style="max-width:200px;height:auto;"></a></p>`;
    
  

  // Generate plain-text fallback
  const textBody = html
    .replace(/<style[]*?</style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/+/g, ' ')
    .trim();

  // Fetch and attach logo image
  let inlineImages = ;
  try 
    const logoBlob = UrlFetchApp.fetch(VNE_LOGO).getBlob();
    inlineImages =  vneLogo: logoBlob ;
   catch (e) 
    Logger.log(' Failed to fetch logo image: ' + e);
  

  GmailApp.sendEmail(to, subject, textBody, 
    htmlBody: html,
    inlineImages: inlineImages,
    name: fromName,
    replyTo: VNE_EMAIL
  );
