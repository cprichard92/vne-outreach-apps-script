/*** FETCH LEADS FOR AREA *****************************************************/
function fetchLeadsForArea(apiKey, cities, limit, radius) 
  const cityFilter = cities.length
    ? 'Focus PRIMARILY on these North Carolina coastal/Outer Banks cities (within ' + radius + ' drive): ' + cities.join(', ') + '.'
    : 'Anywhere in North Carolina (excluding already-covered Outer Banks and Raleigh areas).';
    
  const prompt = `
You are a business research assistant. Return a JSON array of $limit REAL, independent businesses in North Carolina that serve or sell wine to consumers.

TARGET BUSINESSES (wine-selling only):
- Wine bars, restaurants with wine programs, bars with wine selections
- Wine shops, bottle shops, wine retailers
- Upscale caterers that serve wine at events
- Inns/hotels with wine bars or restaurants
- Small event venues with liquor licenses

CRITICAL EXCLUSIONS:
- Wineries, vineyards, wine producers (they make wine, don't just sell it)
- Distributors, wholesalers
- Gas stations, convenience stores
- Big-box retailers: Costco, Walmart, Target, Kroger, Harris Teeter, Food Lion, Lowes Foods, Publix
- National chains: Applebee's, Olive Garden, Red Lobster, etc.
- Breweries, distilleries (unless they also have wine programs)

$cityFilter

For each business:

  "business": "exact business name",
  "type": "one of: wine bar, restaurant, bar, wine shop, bottle shop, caterer, inn/hotel, venue",
  "city": "city name",
  "state": "North Carolina",
  "website": "URL or empty",
  "email": "business email or empty",
  "phone": "phone or empty",
  "notes": "one sentence about their wine/alcohol sales"

Return ONLY valid JSON array. Ensure all are REAL, operating businesses.`;

  try 
    const raw = callGemini(apiKey, prompt).trim();
    
    let cleaned = raw;
    if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
    cleaned = cleaned.trim();
    
    const parsed = JSON.parse(cleaned);
    Logger.log('Fetched ' + (Array.isArray(parsed) ? parsed.length : 0) + ' candidates');
    return Array.isArray(parsed) ? parsed : [];
   catch (e) 
    Logger.log('Parse error: ' + e);
    return [];
  

function getEstablishmentTypeSafe(apiKey, business) 
  try 
    const out = callGemini(apiKey,
      'Classify "' + business + '" in one or two words (wine bar, restaurant, bar, wine shop, bottle shop, caterer, inn/hotel, venue). Only the label.'
    ).trim();
    return normalizeAsciiPunctuation(out || 'establishment') || 'establishment';
   catch (_) 
    return 'establishment';
  

function getInsightSafe(apiKey, business, establishmentType) 
  const primaryPrompt =
    'Write 2-3 short, specific sentences (50 words) about "' + business + '" showing genuine research. ' +
    'Reference their website, menu, wine selection, social media, or guest reviews if findable. ' +
    'If direct site is blocked or unavailable, infer from Google results, a main brand site, or social profiles for that location. ' +
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
