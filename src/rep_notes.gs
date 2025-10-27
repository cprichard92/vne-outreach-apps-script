/*** REP TARGETING NOTES GENERATION *******************************************/
function generateRepTargetingNotes(apiKey, business, establishmentType, insight) 
  const prompt = `
You are a wine sales strategist. Write actionable sales guidance for a rep targeting "$business" (a $establishmentType).

Based on this research: "$insight"

Provide in this format (80-120 words total):

**Contact:** [Suggest role to reach: owner, beverage director, GM, bar manager, sommelier]

**Pitch Angle:** [How VNE's boutique, story-driven portfolio fits this venue's style/clientele]

**Price Bands:** [Suggest retail or BTG price range based on venue type - use realistic NC market prices]

**Formats:** [Bottle, half-bottle, BTG (5oz), cans - what fits this venue best]

**Demo Idea:** [One specific tasting or pairing suggestion]

**Opener:** "[One sentence to start the conversation]"

**Follow-up Hook:** "[One sentence for second touchpoint]"

**Micro-Offer:** [Small, low-risk trial: sample case, tasting kit, staff training session]

**Sources:** [List any public sources used, or state "Based on industry knowledge of $establishmentTypes in NC"]

Be specific, actionable, and grounded in real wine distribution practices.`;

  try 
    const raw = callGemini(apiKey, prompt).trim();
    return normalizeAsciiPunctuation(raw);
   catch (e) 
    Logger.log('Error generating rep notes: ' + e);
    return 'Contact: Owner/Buyer. Pitch: Boutique portfolio for NC market. Demo: Staff tasting. Opener: "Quick question about your wine program." Follow-up: "Can we schedule a 15-min call?" Micro-offer: Sample case (3 bottles).';
