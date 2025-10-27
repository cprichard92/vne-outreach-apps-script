/*** HELPERS: SAFE CLASSIFICATION + INSIGHT ***********************************/
function getEstablishmentTypeSafe(apiKey, business) 
  try 
    const out = callGemini(apiKey,
      'Classify "' + business + '" in one or two words (wine bar, restaurant, bar, wine shop, bottle shop, caterer, inn/hotel, venue). Only the label.'
    ).trim();
    return normalizeAsciiPunctuation(out || 'establishment') || 'establishment';
   catch (_) 
    return 'establishment';
  

function getInsightSafe(apiKey, business, establishmentType) 
  // Primary: researchy prompt. Fallback: lighter generic compliment. Final: stock line.
  const primaryPrompt =
    'Write 2-3 short, specific sentences (50 words) about "' + business + '" showing genuine research. ' +
    'Reference their website, menu, wine selection, social media, or guest reviews if findable. ' +
    'If direct site is blocked or unavailable, infer from Google results, main brand site, or social profiles for that location. ' +
    'If nothing is verifiable, give a tasteful compliment relevant to a ' + establishmentType + ' in North Carolina. ' +
    'No links or hashtags. Natural, conversational.';
  try 
    const txt = callGemini(apiKey, primaryPrompt).trim();
    const norm = normalizeAsciiPunctuation(txt);
    if (norm) return  insight: norm, mode: 'primary' ;
   catch (_) 

  try 
    const lite = 'In 1-2 sentences, write a tasteful, venue-appropriate compliment for a ' + establishmentType +
                 ' in North Carolina, suitable for a cold outreach email. No links.';
    const txt2 = callGemini(apiKey, lite).trim();
    const norm2 = normalizeAsciiPunctuation(txt2);
    if (norm2) return  insight: norm2, mode: 'fallback-lite' ;
   catch (_) 

  return 
    insight: 'We reviewed your program and think our portfolio could be a great fit.',
    mode: 'generic'
  ;
