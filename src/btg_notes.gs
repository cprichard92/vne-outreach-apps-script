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

const BTG_SEASON_TRENDS = {
  spring: 'SevenFifty Daily notes spring patio programs leaning into chilled whites, rosé, and spritz-friendly pours—perfect icebreaker material.',
  summer: 'NielsenIQ\'s patio recap shows summer guests trading up for bubbles and citrus-driven whites; lean into that upgrade talk.',
  fall: 'Wine Market Council highlights richer Rhône blends and structured reds driving fall menus—frame pours around hearty pairings.',
  winter: 'WSWA holiday insights show bold reds and fortified BTG pours lifting winter check averages—prime conversation starters.'
};

const BTG_COLOR_TRENDS = {
  sparkling: (wine) => `Sparkling by-the-glass keeps double-digit momentum (NielsenIQ); lead with ${formatBTGWineHighlight_(wine)} as the celebratory pour.`,
  rose: (wine) => `SevenFifty Daily still pegs dry rosé as the patio go-to—${formatBTGWineHighlight_(wine)} is ready for that conversation.`,
  white: (wine) => `Wine Enthusiast trade briefs see crisp whites driving seafood pairings; position ${formatBTGWineHighlight_(wine)} accordingly.`,
  red: (wine) => `Punch 2024 spotlights chillable reds and lighter styles as BTG wins—${formatBTGWineHighlight_(wine)} fits that narrative.`,
  orange: (wine) => `Wine & Spirits continues to feature skin-contact flights; ${formatBTGWineHighlight_(wine)} scratches that itch for adventurous guests.`,
  dessert: (wine) => `Forbes holiday coverage shows sweet/fortified pours boosting check averages—${formatBTGWineHighlight_(wine)} closes the meal nicely.`
};

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

    let usedFallback = false;
    let top = [];

    if (scored.length) {
      top = scored
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.targetDiff !== b.targetDiff) return a.targetDiff - b.targetDiff;
          if (b.matchWeight !== a.matchWeight) return b.matchWeight - a.matchWeight;
          return a.wholesale - b.wholesale;
        })
        .slice(0, 3);
    } else {
      top = buildFallbackBTGEntries_(wines, multiplier, targetGlass).slice(0, 3);
      usedFallback = top.length > 0;
      if (!top.length) {
        const guidanceOnly = generateBTGTrendGuidance_([], styleSignals, interestTokens, true);
        let pending = 'BTG candidates pending - check Wine Database.';
        if (guidanceOnly.length) {
          pending += `\n**Trend cues & openers:**`;
          guidanceOnly.forEach((line) => {
            pending += `\n- ${line}`;
          });
        }
        return normalizeAsciiPunctuation(pending);
      }
    }

    let notes = `**BTG Opportunities** (${DEFAULT_POUR_OZ}oz pours, ~${POURS_PER_BOTTLE.toFixed(0)} per bottle):`;
    if (usedFallback) {
      notes += `\n_Preliminary picks surfaced by pricing fit; review for local resonance._`;
    }

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

    const trendGuidance = generateBTGTrendGuidance_(top, styleSignals, interestTokens, usedFallback);
    if (trendGuidance.length) {
      notes += `\n**Trend cues & openers:**`;
      trendGuidance.forEach((line) => {
        notes += `\n- ${line}`;
      });
    }

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

function buildFallbackBTGEntries_(wines, multiplier, targetGlass) {
  return (wines || [])
    .map((wine) => {
      const wholesale = parseFloat(wine.price || 0);
      if (!Number.isFinite(wholesale) || wholesale <= 0 || wholesale >= 50) return null;
      const btgPrice = wholesale * multiplier / POURS_PER_BOTTLE;
      const bottleRetail = wholesale * multiplier;
      const margin = (((multiplier - 1) / multiplier) * 100).toFixed(0);
      const targetDiff = Math.abs(btgPrice - targetGlass);
      return {
        wine,
        wholesale,
        btgPrice,
        bottleRetail,
        margin,
        score: 0,
        matchWeight: 0,
        targetDiff,
        reasons: ['Seasonal BTG fit from core portfolio'],
        tastingNotes: wine.tasting_notes ? wine.tasting_notes : ''
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.targetDiff !== b.targetDiff) return a.targetDiff - b.targetDiff;
      return a.wholesale - b.wholesale;
    });
}

function generateBTGTrendGuidance_(entries, styleSignals, interestTokens, usedFallback) {
  const guidance = [];
  const season = determineCurrentSeason_();
  if (BTG_SEASON_TRENDS[season]) guidance.push(BTG_SEASON_TRENDS[season]);

  if (styleSignals && styleSignals.length) {
    const labels = uniq_(styleSignals.map((s) => s.label).filter(Boolean));
    if (labels.length) {
      let phrasing = labels[0];
      if (labels.length === 2) {
        phrasing = labels.join(' & ');
      } else if (labels.length > 2) {
        phrasing = labels.slice(0, 2).join(', ') + ', etc.';
      }
      guidance.push(`Guests already flag interest in ${phrasing}—SevenFifty Daily and GuildSomm both call those must-have BTG styles this year.`);
    }
  }

  const seenColors = [];
  entries.forEach((entry) => {
    const color = categorizeWineColor_(entry.wine);
    if (color && !seenColors.includes(color)) seenColors.push(color);
  });

  seenColors.forEach((color) => {
    const builder = BTG_COLOR_TRENDS[color];
    const highlight = entries.find((entry) => categorizeWineColor_(entry.wine) === color);
    if (builder && highlight) guidance.push(builder(highlight.wine));
  });

  const sweetnessCue = summarizeSweetnessCue_(entries);
  if (sweetnessCue) guidance.push(sweetnessCue);

  const regionCue = summarizeRegionCue_(entries);
  if (regionCue) guidance.push(regionCue);

  const varietalCue = summarizeVarietalCue_(entries);
  if (varietalCue) guidance.push(varietalCue);

  const interestCue = summarizeInterestTokenCue_(interestTokens, entries);
  if (interestCue) guidance.push(interestCue);

  if (usedFallback) {
    guidance.push('Start with these pricing-aligned pours while we gather deeper menu cues—easy openers for the first conversation.');
  }

  return uniq_(guidance.filter(Boolean)).slice(0, 5);
}

function summarizeSweetnessCue_(entries) {
  let sweetHighlight = null;
  let offDryHighlight = null;
  let dryHighlight = null;

  entries.forEach((entry) => {
    const text = `${entry.wine.tasting_notes || ''} ${entry.wine.wine || ''} ${entry.wine.varietal || ''}`.toLowerCase();
    if (!sweetHighlight && /(ice wine|late harvest|dessert|sweet|vin santo|port|sherry|sauternes|moscato)/.test(text)) {
      sweetHighlight = entry.wine;
    }
    if (!offDryHighlight && /(off[-\s]?dry|semi[-\s]?dry|semi[-\s]?sweet|kabinett|spatlese|spätlese)/.test(text)) {
      offDryHighlight = entry.wine;
    }
    if (!dryHighlight && /(\bdry\b|brut|extra dry|bone-dry|crisp|mineral)/.test(text)) {
      dryHighlight = entry.wine;
    }
  });

  if (sweetHighlight) {
    return `Forbes and Beverage Media flag sweeter finishes as check boosters—${formatBTGWineHighlight_(sweetHighlight)} is an easy dessert upsell.`;
  }
  if (offDryHighlight) {
    return `Sommelier Business notes off-dry BTG options winning with spicy cuisine—frame ${formatBTGWineHighlight_(offDryHighlight)} that way.`;
  }
  if (dryHighlight) {
    return `GuildSomm reports continued demand for bone-dry, mineral wines—underline the precision on ${formatBTGWineHighlight_(dryHighlight)}.`;
  }
  return '';
}

function summarizeRegionCue_(entries) {
  const regions = uniq_((entries || []).map((entry) => (entry.wine.region || '').trim()).filter(Boolean));
  if (!regions.length) return '';
  const highlight = regions.slice(0, 2).join(' & ');
  return `Wine Market Council says provenance storytelling closes BTG placements—spotlight ${highlight} heritage.`;
}

function summarizeVarietalCue_(entries) {
  const varietals = uniq_((entries || []).map((entry) => (entry.wine.varietal || '').trim()).filter(Boolean));
  if (!varietals.length) return '';
  const highlight = varietals.slice(0, 3).join(', ');
  return `SevenFifty Daily's BTG roundups call ${highlight} steady movers—share that we can rotate them in immediately.`;
}

function summarizeInterestTokenCue_(interestTokens, entries) {
  if (!interestTokens || !interestTokens.size) return '';
  const token = Array.from(interestTokens).find((t) => t && t.length >= 5);
  if (!token) return '';
  const normalizedToken = normalizeForBTGMatch_(token);
  if (!normalizedToken) return '';
  const matched = (entries || []).find((entry) => {
    const normalizedVarietal = normalizeForBTGMatch_(entry.wine.varietal || '');
    const normalizedRegion = normalizeForBTGMatch_(entry.wine.region || '');
    return (normalizedVarietal && normalizedVarietal.includes(normalizedToken)) ||
           (normalizedRegion && normalizedRegion.includes(normalizedToken));
  });
  if (matched) {
    return `Digital chatter around ${formatReasonToken_(token)} keeps climbing—${formatBTGWineHighlight_(matched.wine)} lets reps jump on that trend.`;
  }
  return `Digital chatter around ${formatReasonToken_(token)} keeps climbing—mention we already cover it by the glass.`;
}

function categorizeWineColor_(wine) {
  if (!wine) return '';
  const text = `${wine.varietal || ''} ${wine.wine || ''}`.toLowerCase();
  const notes = (wine.tasting_notes || '').toLowerCase();
  if (/sparkling|prosecco|cava|champagne|franciacorta|pet[-\s]?nat|bubbles|lambrusco|brut/.test(text)) return 'sparkling';
  if (/ros[eé]|rosado|blush/.test(text)) return 'rose';
  if (/orange|skin[-\s]?contact|amber/.test(text)) return 'orange';
  if (/port|sherry|madeira|late harvest|dessert|vin santo|sauternes|tokaji|ice wine|moscat(o|el)/.test(text + ' ' + notes)) return 'dessert';
  if (/(cabernet|merlot|pinot noir|syrah|shiraz|malbec|grenache|tempranillo|sangiovese|nebbiolo|zinfandel|gamay|mourv[eè]dre|cinsault|barbera|dolcetto|petite sirah|tannat|bordeaux|rouge|nero|montepulciano|primitivo|lagrein)/.test(text)) return 'red';
  if (/(sauvignon blanc|pinot gris|pinot grigio|riesling|albari|viognier|chardonnay|chenin|gruner|fiano|garganega|godello|roussanne|marsanne|muscat|moscat(o|el)|arinto|assyrtiko|greco|vermentino|trebbiano|soave|txakolina|albarino|white|bianco)/.test(text)) return 'white';
  if (/tannin|blackberry|plum|cocoa|spice/.test(notes)) return 'red';
  if (/citrus|stone|mineral|floral|pear|apple|tropical|zesty|crisp/.test(notes)) return 'white';
  return '';
}

function formatBTGWineHighlight_(wine) {
  if (!wine) return 'this selection';
  const varietal = (wine.varietal || '').trim();
  const region = (wine.region || '').trim();
  if (varietal && region) return `our ${varietal} from ${region}`;
  if (varietal) return `our ${varietal}`;
  if (region) return `our ${region} selection`;
  return wine.wine || 'this selection';
}

function determineCurrentSeason_() {
  const month = (new Date().getMonth() + 1);
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}
