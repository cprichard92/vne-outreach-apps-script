/*** LEAD GENERATION WITH ADAPTIVE STRATEGY ***********************************/
function appendNewNCLeads(sheet, colIndex, apiKey) 
  const values = sheet.getDataRange().getValues();
  const header = values[0], rows = values.slice(1);

  const existingNames = new Set(), existingEmails = new Set();
  const nameIdx  = (colIndex['Business'] || 1) - 1;
  const emailIdx = (colIndex['Email']   || 1) - 1;

  rows.forEach(r => 
    const nm = (r[nameIdx]  || '').toString().trim().toLowerCase();
    const em = (r[emailIdx] || '').toString().trim().toLowerCase();
    if (nm) existingNames.add(nm);
    if (em) existingEmails.add(em);
  );

  // Check recent performance to decide strategy
  const strategy = determineStrategy();
  Logger.log('Using strategy: ' + JSON.stringify(strategy));

  const raleighCities = strategy.raleighExpanded 
    ? ['Raleigh','Durham','Cary','Chapel Hill']
    : ['Raleigh'];

  const block = loadClientBlocklist();
  const merged = [];
  let attempts = 0;

  function pushUnique(list) 
    for (const L of list) 
      if (!L || typeof L !== 'object') continue;
      const name  = (L.business || '').trim();
      const email = (L.email    || '').trim();
      const site  = (L.website  || '').trim();
      const typ   = (L.type     || '').trim().toLowerCase();
      
      if (!name) continue;
      if (!ALLOWED_SALES_TYPES.includes(typ)) continue;
      if (isBlockedByClients(block, name, email, site)) continue;

      const nameKey = name.toLowerCase();
      const emailKey = email.toLowerCase();
      if (existingNames.has(nameKey) || (email && existingEmails.has(emailKey))) continue;

      merged.push(L);
      existingNames.add(nameKey);
      if (email) existingEmails.add(emailKey);
      if (merged.length >= MAX_NEW_LEADS_PER_RUN) return true;
    
    return false;
  

  while (merged.length < MAX_NEW_LEADS_PER_RUN && attempts < MAX_RETRY_ATTEMPTS) 
    attempts++;
    Logger.log('Lead gen attempt ' + attempts + '/' + MAX_RETRY_ATTEMPTS + ', current: ' + merged.length);

    try 
      const obxNeeded = Math.min(strategy.obxQuota, MAX_NEW_LEADS_PER_RUN - merged.length);
      const raleighNeeded = merged.length < (strategy.obxQuota + strategy.raleighQuota) ? strategy.raleighQuota : 0;
      const anywhereNeeded = merged.length < MAX_NEW_LEADS_PER_RUN ? strategy.anywhereQuota : 0;

      if (obxNeeded > 0) 
        const leadsOBX = fetchLeadsForArea(apiKey, OUTER_BANKS_CITIES, obxNeeded * 2, strategy.obxRadius);
        if (pushUnique(leadsOBX)) break;
      

      if (raleighNeeded > 0 && merged.length < MAX_NEW_LEADS_PER_RUN) 
        const leadsRaleigh = fetchLeadsForArea(apiKey, raleighCities, raleighNeeded * 2, '30-minute');
        if (pushUnique(leadsRaleigh)) break;
      

      if (anywhereNeeded > 0 && merged.length < MAX_NEW_LEADS_PER_RUN) 
        const leadsNC = fetchLeadsForArea(apiKey, [], anywhereNeeded * 2, 'statewide');
        if (pushUnique(leadsNC)) break;
      

      if (strategy && strategy.obxQuota) 
        Logger.log('OBX diagnostics: ' + JSON.stringify(
          obxQuota: strategy.obxQuota,
          mergedCount: merged ? merged.length : 0,
          dedupeNames: existingNames ? existingNames.size : 0,
          dedupeEmails: existingEmails ? existingEmails.size : 0
        ));
      

      if (merged.length >= MAX_NEW_LEADS_PER_RUN) break;

      if (merged.length < MAX_NEW_LEADS_PER_RUN && attempts < MAX_RETRY_ATTEMPTS) 
        const backoff = Math.min(500 * Math.pow(1.5, attempts), 5000);
        Utilities.sleep(backoff);
      
     catch (e) 
      Logger.log('Error in attempt ' + attempts + ': ' + e);
      const backoff = Math.min(1000 * Math.pow(1.5, attempts), 8000);
      Utilities.sleep(backoff);
    
  

  Logger.log('Lead generation complete. Found ' + merged.length + ' leads after ' + attempts + ' attempts.');

  const toAppend = merged.map(L => buildRowFromLead(L, header, 
    Status: 'Lead',
    'Opportunity Type': 'Distribution',
    State: 'North Carolina',
    'Auto-Added': 'TRUE',
    Source: 'Gemini LeadGen NC',
    'Follow-Up Count': 0,
    'Priority': determinePriority(L)
  ));

  if (toAppend.length) 
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, header.length).setValues(toAppend);
  
  return toAppend.length;
