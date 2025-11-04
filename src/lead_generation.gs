/*** LEAD GENERATION WITH ADAPTIVE STRATEGY ***********************************/
function appendNewNCLeads(sheet, colIndex, apiKey) {
  const values = sheet.getDataRange().getValues();
  const header = values[0], rows = values.slice(1);

  const existingNameKeys = new Set();
  const existingNameLocationKeys = new Set();
  const existingEmails = new Set();
  const existingWebsites = new Set();
  const existingDomainKeys = new Set();
  const existingDomainLocationKeys = new Set();
  const existingPhones = new Set();

  const nameIdx = (colIndex['Business'] || 1) - 1;
  const emailIdx = (colIndex['Email'] || 1) - 1;
  const websiteIdx = (colIndex['Website'] || 1) - 1;
  const phoneIdx = (colIndex['Phone'] || 1) - 1;
  const cityIdx = (colIndex['City'] || 1) - 1;
  const stateIdx = (colIndex['State'] || 1) - 1;

  rows.forEach(r => {
    const nmRaw = (r[nameIdx] || '').toString();
    const cityRaw = cityIdx >= 0 ? (r[cityIdx] || '').toString() : '';
    const stateRaw = stateIdx >= 0 ? (r[stateIdx] || '').toString() : '';
    const em = (r[emailIdx] || '').toString().trim().toLowerCase();
    const site = websiteIdx >= 0 ? (r[websiteIdx] || '').toString().trim().toLowerCase() : '';
    const phoneRaw = phoneIdx >= 0 ? (r[phoneIdx] || '').toString() : '';

    const nameKey = canonicalizeBusinessName_(nmRaw, cityRaw);
    const locationKey = buildLeadLocationKey_(cityRaw, stateRaw);
    const phoneKey = canonicalizePhone_(phoneRaw);
    const domain = extractDomain(site || em);

    if (nameKey) existingNameKeys.add(nameKey);
    if (nameKey && locationKey) existingNameLocationKeys.add(nameKey + '|' + locationKey);
    if (em) existingEmails.add(em);
    if (site) existingWebsites.add(site);
    if (domain) {
      existingDomainKeys.add(domain);
      if (locationKey) existingDomainLocationKeys.add(domain + '|' + locationKey);
    }
    if (phoneKey) existingPhones.add(phoneKey);
  });

  // Check recent performance to decide strategy
  const strategy = determineStrategy();
  Logger.log('Using strategy: ' + JSON.stringify(strategy));

  const raleighCities = strategy.raleighExpanded
    ? ['Raleigh', 'Durham', 'Cary', 'Chapel Hill']
    : ['Raleigh'];

  const block = loadClientBlocklist();
  const merged = [];
  let attempts = 0;

  function pushUnique(list) {
    for (const L of list) {
      if (!L || typeof L !== 'object') continue;
      const name = (L.business || '').trim();
      const email = (L.email || '').trim();
      const site = (L.website || '').trim();
      const typ = (L.type || '').trim().toLowerCase();

      if (!name) continue;
      if (!ALLOWED_SALES_TYPES.includes(typ)) continue;
      if (isBlockedByClients(block, name, email, site)) continue;

      const nameKey = canonicalizeBusinessName_(name, L.city || '');
      const locationKey = buildLeadLocationKey_(L.city || '', L.state || '');
      const emailKey = email.toLowerCase();
      const websiteKey = site.toLowerCase();
      const domain = extractDomain(site || email);
      const phoneKey = canonicalizePhone_(L.phone || '');

      if (nameKey && existingNameKeys.has(nameKey)) continue;
      if (nameKey && locationKey && existingNameLocationKeys.has(nameKey + '|' + locationKey)) continue;
      if (email && existingEmails.has(emailKey)) continue;
      if (websiteKey && existingWebsites.has(websiteKey)) continue;
      if (domain) {
        if (locationKey && existingDomainLocationKeys.has(domain + '|' + locationKey)) continue;
        if (!locationKey && existingDomainKeys.has(domain)) continue;
      }
      if (phoneKey && existingPhones.has(phoneKey)) continue;

      merged.push(L);
      if (nameKey) existingNameKeys.add(nameKey);
      if (nameKey && locationKey) existingNameLocationKeys.add(nameKey + '|' + locationKey);
      if (email) existingEmails.add(emailKey);
      if (websiteKey) existingWebsites.add(websiteKey);
      if (domain) {
        existingDomainKeys.add(domain);
        if (locationKey) existingDomainLocationKeys.add(domain + '|' + locationKey);
      }
      if (phoneKey) existingPhones.add(phoneKey);
      if (merged.length >= MAX_NEW_LEADS_PER_RUN) return true;
    }

    return false;
  }

  while (merged.length < MAX_NEW_LEADS_PER_RUN && attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;
    Logger.log('Lead gen attempt ' + attempts + '/' + MAX_RETRY_ATTEMPTS + ', current: ' + merged.length);

    try {
      const obxNeeded = Math.min(strategy.obxQuota, MAX_NEW_LEADS_PER_RUN - merged.length);
      const raleighNeeded = merged.length < (strategy.obxQuota + strategy.raleighQuota)
        ? strategy.raleighQuota
        : 0;
      const anywhereNeeded = merged.length < MAX_NEW_LEADS_PER_RUN ? strategy.anywhereQuota : 0;

      if (obxNeeded > 0) {
        const leadsOBX = fetchLeadsForArea(apiKey, OUTER_BANKS_CITIES, obxNeeded * 2, strategy.obxRadius);
        if (pushUnique(leadsOBX)) break;
      }

      if (raleighNeeded > 0 && merged.length < MAX_NEW_LEADS_PER_RUN) {
        const leadsRaleigh = fetchLeadsForArea(apiKey, raleighCities, raleighNeeded * 2, '30-minute');
        if (pushUnique(leadsRaleigh)) break;
      }

      if (anywhereNeeded > 0 && merged.length < MAX_NEW_LEADS_PER_RUN) {
        const leadsNC = fetchLeadsForArea(apiKey, [], anywhereNeeded * 2, 'statewide');
        if (pushUnique(leadsNC)) break;
      }

      if (strategy && strategy.obxQuota) {
        Logger.log('OBX diagnostics: ' + JSON.stringify({
          obxQuota: strategy.obxQuota,
          mergedCount: merged ? merged.length : 0,
          dedupeNames: existingNameKeys ? existingNameKeys.size : 0,
          dedupeNameLocations: existingNameLocationKeys ? existingNameLocationKeys.size : 0,
          dedupeEmails: existingEmails ? existingEmails.size : 0,
          dedupeWebsites: existingWebsites ? existingWebsites.size : 0,
          dedupeDomains: existingDomainLocationKeys ? existingDomainLocationKeys.size : 0,
          dedupePhones: existingPhones ? existingPhones.size : 0
        }));
      }

      if (merged.length >= MAX_NEW_LEADS_PER_RUN) break;

      if (merged.length < MAX_NEW_LEADS_PER_RUN && attempts < MAX_RETRY_ATTEMPTS) {
        const backoff = Math.min(500 * Math.pow(1.5, attempts), 5000);
        Utilities.sleep(backoff);
      }
    } catch (e) {
      Logger.log('Error in attempt ' + attempts + ': ' + e);
      const backoff = Math.min(1000 * Math.pow(1.5, attempts), 8000);
      Utilities.sleep(backoff);
    }
  }

  Logger.log('Lead generation complete. Found ' + merged.length + ' leads after ' + attempts + ' attempts.');

  const toAppend = merged.map(L => buildRowFromLead(L, header, {
    Status: 'Lead',
    'Opportunity Type': 'Distribution',
    State: 'North Carolina',
    'Auto-Added': 'TRUE',
    Source: 'Gemini LeadGen NC',
    'Follow-Up Count': 0,
    Priority: determinePriority(L)
  }));

  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, header.length).setValues(toAppend);
  }

  return toAppend.length;
}

function canonicalizeBusinessName_(name, city) {
  const raw = (name || '').toString().trim().toLowerCase();
  if (!raw) return '';

  let clean = raw.replace(/[^a-z0-9]+/g, ' ').trim();
  if (!clean) return '';

  const cityToken = canonicalizeGeoToken_(city);
  if (cityToken) {
    const cityRegex = new RegExp('(,|\\s)+' + cityToken.replace(/[\[\]{}()*+?.\\^$|]/g, '\\$&') + '$');
    clean = clean.replace(cityRegex, '').trim();
    if (!clean) clean = raw.replace(/[^a-z0-9]+/g, ' ').trim();
  }

  return clean.replace(/\s+/g, ' ');
}

function buildLeadLocationKey_(city, state) {
  const cityKey = canonicalizeGeoToken_(city);
  const stateKey = canonicalizeGeoToken_(state);
  if (!cityKey && !stateKey) return '';
  return cityKey + '|' + stateKey;
}

function canonicalizeGeoToken_(value) {
  return (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalizePhone_(value) {
  if (!value) return '';
  const digits = value.toString().replace(/\D+/g, '');
  return digits.length >= 7 ? digits : '';
}

