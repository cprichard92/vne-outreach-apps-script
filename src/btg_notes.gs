/*** BTG OPPORTUNITY NOTES ****************************************************/
const BTG_STYLE_KEYWORDS = [
  { style: 'sparkling', label: 'sparkling', keywords: ['sparkling', 'bubbles', 'bubbly', 'champagne', 'prosecco', 'cava', 'franciacorta', 'pet-nat', 'cremant'] },
  { style: 'rose', label: 'rosé', keywords: ['rosé', 'rose'] },
  { style: 'orange', label: 'skin-contact', keywords: ['orange wine', 'skin contact', 'amber'] },
  { style: 'white', label: 'crisp whites', keywords: ['white wine', 'chardonnay', 'sauvignon blanc', 'pinot grigio', 'albariño', 'riesling', 'vermentino', 'viognier', 'white blend'] },
  { style: 'red', label: 'food-friendly reds', keywords: ['red wine', 'pinot noir', 'gamay', 'grenache', 'tempranillo', 'barbera', 'cabernet', 'merlot', 'malbec', 'syrah', 'sangiovese', 'nebbiolo', 'zinfandel'] },
  { style: 'dessert', label: 'dessert / fortified', keywords: ['dessert wine', 'sweet wine', 'port', 'sherry', 'late harvest', 'vin santo', 'madeira'] }
];

const BTG_INTEREST_STOPWORDS = new Set([
  'about', 'after', 'amazing', 'award', 'bar', 'because', 'best', 'brunch', 'carolina', 'chef', 'classics', 'coast',
  'cocktail', 'craft', 'culinary', 'dining', 'dinner', 'experience', 'favorite', 'flavor', 'flight', 'focus', 'glass',
  'guest', 'guests', 'hand', 'house', 'list', 'local', 'menu', 'north', 'offer', 'offers', 'offering', 'program',
  'restaurant', 'seasonal', 'selection', 'service', 'small', 'story', 'style', 'tasting', 'their', 'unique', 'wine',
  'wines'
]);

function generateBTGOpportunityNotes(apiKey, business, establishmentType, venueInsight) {
  const typeLower = (establishmentType || '').toLowerCase();

  // Only generate BTG notes for relevant venue types
  if (!typeLower.includes('restaurant') && !typeLower.includes('bar') &&
      !typeLower.includes('inn') && !typeLower.includes('hotel') &&
      !typeLower.includes('venue')) {
    return '';
  }

  try {
    const wines = loadWineDatabase();
    if (!wines || wines.length === 0) {
      return 'BTG analysis pending - Wine Database unavailable.';
    }

    let multiplier = 2.5; // Default casual
    for (const key in VENUE_MULTIPLIERS) {
      if (Object.prototype.hasOwnProperty.call(VENUE_MULTIPLIERS, key) && typeLower.includes(key)) {
        multiplier = VENUE_MULTIPLIERS[key];
        break;
      }
    }

    const normalizedInsight = normalizeForBTGMatch_(venueInsight || '');
    const styleSignals = extractBTGStyleSignals_(normalizedInsight);
    const interestTokens = extractBTGInterestTokens_(normalizedInsight);
    const targetGlass = estimateIdealBTGGlassPrice_(multiplier, typeLower);

    const scored = wines
      .map((wine) => scoreWineForVenue_(wine, multiplier, normalizedInsight, styleSignals, interestTokens, targetGlass))
      .filter(Boolean);

    if (!scored.length) {
      return 'BTG candidates pending - check Wine Database.';
    }

    const top = scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.targetDiff !== b.targetDiff) return a.targetDiff - b.targetDiff;
        if (b.matchWeight !== a.matchWeight) return b.matchWeight - a.matchWeight;
        return a.wholesale - b.wholesale;
      })
      .slice(0, 3);

    let notes = `**BTG Opportunities** (${DEFAULT_POUR_OZ}oz pours, ~${POURS_PER_BOTTLE.toFixed(0)} per bottle):`;

    top.forEach((entry, idx) => {
      notes += `\n${idx + 1}. **${entry.wine.wine}** (${entry.wine.varietal || 'N/A'}, ${entry.wine.region || 'N/A'})`;
      notes += `\n      - Wholesale: $${entry.wholesale.toFixed(2)}/bottle`;
      notes += `\n      - Suggested BTG: $${entry.btgPrice.toFixed(2)}/glass (${entry.margin}% margin)`;
      notes += `\n      - Bottle price: $${entry.bottleRetail.toFixed(2)}`;
      if (entry.tastingNotes) {
        notes += `\n      - Notes: ${entry.tastingNotes}`;
      }
      if (entry.reasons.length) {
        notes += `\n      - Match: ${entry.reasons.join('; ')}`;
      }
    });

    notes += `\n**Venue Type:** ${establishmentType || 'establishment'} (${multiplier}x multiplier)`;
    notes += `\n**Source:** VNE Wine Database, industry standard BTG pricing (${formatDateISO(new Date()).split('T')[0]})`;

    return normalizeAsciiPunctuation(notes);
  } catch (e) {
    Logger.log('Error generating BTG notes: ' + e);
    return 'BTG analysis available - contact rep for pricing.';
  }
}

/*** LOAD WINE DATABASE — FLEX HEADERS + NUMBER CLEANING ***/
function loadWineDatabase() {
  try {
    const sh = SpreadsheetApp.openById(WINE_DATABASE_ID).getSheetByName(WINE_DB_SHEET_NAME);
    if (!sh) {
      Logger.log(' Tab not found: ' + WINE_DB_SHEET_NAME);
      return [];
    }

    const data = sh.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log(' No data rows');
      return [];
    }

    const rawHeaders = data[0].map((h) => String(h || '').trim());
    const headers = rawHeaders.map((h) => h.toLowerCase());

    const findCol = (cands) => {
      for (const c of cands) {
        const i = headers.indexOf(c.toLowerCase());
        if (i !== -1) return i;
      }
      return -1;
    };

    const wineIdx = findCol(['wine', 'wine name', 'label', 'product', 'item']);
    const priceIdx = findCol([
      'vne price', 'b2c pricing (usd)', 'price', 'wholesale', 'wholesale price', 'bottle price', 'price per bottle', 'cost', 'retail', 'list price'
    ]);

    if (wineIdx === -1 || priceIdx === -1) {
      Logger.log(' Missing wine/price columns. Headers: ' + JSON.stringify(rawHeaders));
      return [];
    }

    const cleanNum = (v) => {
      const s = String(v == null ? '' : v).replace(/[^0-9.-]/g, '');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };

    const varietalIdx = findCol(['varietal', 'grape variety', 'grape', 'variety']);
    const regionIdx = findCol(['region', 'country', 'appellation']);
    const vintageIdx = findCol(['vintage', 'vintage year']);
    const notesIdx = findCol(['tasting notes', 'notes/history', 'notes']);

    const rows = data.slice(1);
    const wines = [];

    for (const r of rows) {
      const name = String(r[wineIdx] || '').trim();
      const price = cleanNum(r[priceIdx]);
      if (!name || price == null || price <= 0) continue;

      wines.push({
        wine: name,
        price: price,
        varietal: varietalIdx > -1 ? String(r[varietalIdx] || '').trim() : '',
        region: regionIdx > -1 ? String(r[regionIdx] || '').trim() : '',
        vintage: vintageIdx > -1 ? String(r[vintageIdx] || '').trim() : '',
        tasting_notes: notesIdx > -1 ? String(r[notesIdx] || '').trim() : ''
      });
    }

    Logger.log(` Loaded ${wines.length} wines from "${sh.getName()}"`);
    if (!wines.length) Logger.log(' All rows skipped due to blank names or non-numeric/zero prices.');
    return wines;
  } catch (e) {
    Logger.log(' Error loading Wine DB: ' + e);
    return [];
  }
}

function scoreWineForVenue_(wine, multiplier, normalizedInsight, styleSignals, interestTokens, targetGlass) {
  const wholesale = parseFloat(wine.price || 0);
  if (!Number.isFinite(wholesale) || wholesale <= 0 || wholesale >= 50) return null;

  const normalizedVarietal = normalizeForBTGMatch_(wine.varietal || '');
  const normalizedRegion = normalizeForBTGMatch_(wine.region || '');
  const normalizedName = normalizeForBTGMatch_(wine.wine || '');
  const normalizedNotes = normalizeForBTGMatch_(wine.tasting_notes || '');

  let score = 0;
  let matchWeight = 0;
  const reasons = [];

  if (normalizedVarietal && normalizedInsight.includes(normalizedVarietal)) {
    score += 6;
    matchWeight += 4;
    reasons.push(`Matches interest in ${wine.varietal}`);
  } else if (normalizedVarietal) {
    const varietalToken = findProminentToken_(normalizedVarietal);
    if (varietalToken && normalizedInsight.includes(varietalToken)) {
      score += 3;
      matchWeight += 2;
      reasons.push(`Varietal family aligns with ${formatReasonToken_(varietalToken)}`);
    }
  }

  if (normalizedRegion && normalizedInsight.includes(normalizedRegion)) {
    score += 4;
    matchWeight += 3;
    reasons.push(`Guests asking about ${wine.region}`);
  } else if (normalizedRegion) {
    const regionToken = findProminentToken_(normalizedRegion);
    if (regionToken && normalizedInsight.includes(regionToken)) {
      score += 2;
      matchWeight += 1.5;
      reasons.push(`Regional cue: ${formatReasonToken_(regionToken)}`);
    }
  }

  const matchedStyles = [];
  styleSignals.forEach((style) => {
    if (styleMatchesWine_(style, normalizedVarietal, normalizedRegion, normalizedName, normalizedNotes)) {
      score += 2.5;
      matchWeight += 1.5;
      matchedStyles.push(style.label);
    }
  });
  if (matchedStyles.length) {
    reasons.push(`Fits ${matchedStyles.join(', ')} focus`);
  }

  if (normalizedNotes) {
    for (const token of interestTokens) {
      if (token.length < 5) continue;
      if (normalizedNotes.includes(token)) {
        score += 1;
        matchWeight += 0.5;
        reasons.push(`Echoes menu language: ${formatReasonToken_(token)}`);
        break;
      }
    }
  }

  const btgPrice = wholesale * multiplier / POURS_PER_BOTTLE;
  const bottleRetail = wholesale * multiplier;
  const margin = (((multiplier - 1) / multiplier) * 100).toFixed(0);
  const targetDiff = Math.abs(btgPrice - targetGlass);
  const priceScore = Math.max(0, 3 - targetDiff / 2);
  score += priceScore;
  if (priceScore >= 2) {
    reasons.push(`Glass price near $${Math.round(targetGlass)}`);
  }

  if (wholesale >= 14 && wholesale <= 28) {
    score += 0.5;
  }

  return {
    wine,
    wholesale,
    btgPrice,
    bottleRetail,
    margin,
    score,
    matchWeight,
    targetDiff,
    reasons: uniq_(reasons).filter(Boolean),
    tastingNotes: wine.tasting_notes ? wine.tasting_notes : ''
  };
}

function normalizeForBTGMatch_(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractBTGStyleSignals_(normalizedInsight) {
  if (!normalizedInsight) return [];
  return BTG_STYLE_KEYWORDS
    .map((style) => {
      const normalizedKeywords = style.keywords.map((kw) => normalizeForBTGMatch_(kw)).filter(Boolean);
      const hit = normalizedKeywords.some((kw) => normalizedInsight.includes(kw));
      return hit ? { style: style.style, label: style.label, normalizedKeywords } : null;
    })
    .filter(Boolean);
}

function extractBTGInterestTokens_(normalizedInsight) {
  const tokens = new Set();
  if (!normalizedInsight) return tokens;
  normalizedInsight.split(/[^a-z0-9]+/).forEach((token) => {
    if (token.length < 4) return;
    if (BTG_INTEREST_STOPWORDS.has(token)) return;
    tokens.add(token);
  });
  return tokens;
}

function estimateIdealBTGGlassPrice_(multiplier, typeLower) {
  if (typeLower.includes('steak') || typeLower.includes('fine') || typeLower.includes('resort') || typeLower.includes('club')) {
    return 18;
  }
  if (typeLower.includes('wine bar') || typeLower.includes('cocktail') || typeLower.includes('tasting')) {
    return 16;
  }
  if (typeLower.includes('brewery') || typeLower.includes('taproom') || typeLower.includes('casual')) {
    return 12;
  }
  if (multiplier >= 3.2) return 17;
  if (multiplier >= 2.8) return 15;
  return 13;
}

function styleMatchesWine_(style, varietalText, regionText, nameText, notesText) {
  return style.normalizedKeywords.some((kw) =>
    (varietalText && varietalText.includes(kw)) ||
    (regionText && regionText.includes(kw)) ||
    (nameText && nameText.includes(kw)) ||
    (notesText && notesText.includes(kw))
  );
}

function findProminentToken_(normalizedText) {
  if (!normalizedText) return '';
  const tokens = normalizedText.split(' ').filter((t) => t.length >= 5);
  return tokens.length ? tokens[0] : '';
}

function formatReasonToken_(token) {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}
