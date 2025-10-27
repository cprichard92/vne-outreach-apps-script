/*** BTG OPPORTUNITY NOTES ****************************************************/
function generateBTGOpportunityNotes(apiKey, business, establishmentType) 
  const typeLower = establishmentType.toLowerCase();
  
  // Only generate BTG notes for relevant venue types
  if (!typeLower.includes('restaurant') && !typeLower.includes('bar') && 
      !typeLower.includes('inn') && !typeLower.includes('hotel') && 
      !typeLower.includes('venue')) 
    return ''; // Not BTG-relevant
  

  try 
    // Get wine database
    const wines = loadWineDatabase();
    if (!wines || wines.length === 0) 
      return 'BTG analysis pending - Wine Database unavailable.';
    

    // Get venue multiplier
    let multiplier = 2.5; // Default casual
    for (const key in VENUE_MULTIPLIERS) 
      if (typeLower.includes(key)) 
        multiplier = VENUE_MULTIPLIERS[key];
        break;
      
    

    // Pick 2-3 wines suitable for BTG
    const btgCandidates = wines.filter(w => 
      const price = parseFloat(w.price || 0);
      return price > 0 && price < 50; // Reasonable BTG wholesale range
    ).slice(0, 3);

    if (btgCandidates.length === 0) 
      return 'BTG candidates pending - check Wine Database.';
    

    let notes = `**BTG Opportunities** ($DEFAULT_POUR_OZoz pours, ~$POURS_PER_BOTTLE.toFixed(0) per bottle):`;

    btgCandidates.forEach((wine, idx) => 
      const wholesale = parseFloat(wine.price || 0);
      const btgPrice = (wholesale * multiplier / POURS_PER_BOTTLE).toFixed(2);
      const bottleRetail = (wholesale * multiplier).toFixed(2);
      const margin = (((multiplier - 1) / multiplier) * 100).toFixed(0);

      notes += `$idx + 1. **$wine.wine** ($wine.varietal || 'N/A', $wine.region || 'N/A')`;
      notes += `   - Wholesale: $wholesale.toFixed(2)/bottle`;
      notes += `   - Suggested BTG: $btgPrice/glass ($margin% margin)`;
      notes += `   - Bottle price: $bottleRetail`;
      notes += `   - Notes: $wine.tasting_notes || 'Story-driven, small-batch producer'`;
    );

    notes += `**Venue Type:** $establishmentType ($multiplierx multiplier)`;
    notes += `**Source:** VNE Wine Database, industry standard BTG pricing ($formatDateISO(new Date()).split('T')[0])`;

    return normalizeAsciiPunctuation(notes);
   catch (e) 
    Logger.log('Error generating BTG notes: ' + e);
    return 'BTG analysis available - contact rep for pricing.';
  

/*** LOAD WINE DATABASE — FLEX HEADERS + NUMBER CLEANING ***/
function loadWineDatabase() 
  try 
    const sh = SpreadsheetApp.openById(WINE_DATABASE_ID).getSheetByName(WINE_DB_SHEET_NAME);
    if (!sh)  Logger.log(' Tab not found: ' + WINE_DB_SHEET_NAME); return []; 

    const data = sh.getDataRange().getValues();
    if (data.length < 2)  Logger.log(' No data rows'); return []; 

    const rawHeaders = data[0].map(h => String(h||'').trim());
    const headers = rawHeaders.map(h => h.toLowerCase());

    const findCol = (cands) => 
      for (const c of cands) 
        const i = headers.indexOf(c.toLowerCase());
        if (i !== -1) return i;
      
      return -1;
    ;

    const wineIdx = findCol(['wine','wine name','label','product','item']);
    const priceIdx = findCol([
      'vne price','b2c pricing (usd)','price','wholesale','wholesale price','bottle price','price per bottle','cost','retail','list price'
    ]);

    if (wineIdx === -1 || priceIdx === -1) 
      Logger.log(' Missing wine/price columns. Headers: ' + JSON.stringify(rawHeaders));
      return [];
    

    const cleanNum = (v) => 
      const s = String(v==null?'':v).replace(/[^0-9.-]/g,'');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    ;

    const varietalIdx = findCol(['varietal','grape variety','grape','variety']);
    const regionIdx   = findCol(['region','country','appellation']);
    const vintageIdx  = findCol(['vintage','vintage year']);
    const notesIdx    = findCol(['tasting notes','notes/history','notes']);

    const rows = data.slice(1);
    const wines = [];

    for (const r of rows) 
      const name = String(r[wineIdx]||'').trim();
      const price = cleanNum(r[priceIdx]);
      if (!name || price == null || price <= 0) continue;

      const obj = ;
      headers.forEach((h,i)=> obj[h] = r[i]);

      wines.push(
        wine: name,
        price: price,
        varietal: varietalIdx>-1 ? String(r[varietalIdx]||'').trim() : '',
        region:   regionIdx  >-1 ? String(r[regionIdx]  ||'').trim() : '',
        vintage:  vintageIdx >-1 ? String(r[vintageIdx] ||'').trim() : '',
        tasting_notes: notesIdx>-1 ? String(r[notesIdx] ||'').trim() : ''
      );
    

    Logger.log(` Loaded $wines.length wines from "$sh.getName()"`);
    if (!wines.length) Logger.log(' All rows skipped due to blank names or non-numeric/zero prices.');
    return wines;
   catch (e) 
    Logger.log(' Error loading Wine DB: ' + e);
    return [];
