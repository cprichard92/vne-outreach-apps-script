/*** BLOCKLIST ****************************************************************/
function loadClientBlocklist() 
  const block =  names: new Set(), emails: new Set(), domains: new Set() ;
  try 
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const vals = sh.getDataRange().getValues();
    const header = vals[0] || [];
    const rows = vals.slice(1);
    const idx = (h) => header.indexOf(h) + 1;
    const iBiz = idx('Business'), iEmail = idx('Email'), iStatus = idx('Status'), iSite = idx('Website');

    rows.forEach(r => 
      const status = (r[iStatus - 1] || '').toString().trim().toLowerCase();
      if (SKIP_STATUSES.has(status) || status === 'follow up') 
        const nm = normalizeName(r[iBiz - 1]);
        const em = (r[iEmail - 1] || '').toString().trim().toLowerCase();
        const site = (r[iSite - 1] || '').toString().trim().toLowerCase();
        if (nm) block.names.add(nm);
        if (em) block.emails.add(em);
        const d1 = extractDomain(em);
        const d2 = extractDomain(site);
        if (d1) block.domains.add(d1);
        if (d2) block.domains.add(d2);
      
    );
   catch (_) 
  return block;

function isBlockedByClients(block, business, email, website) 
  const nm = normalizeName(business);
  const em = (email || '').toString().trim().toLowerCase();
  const site = (website || '').toString().trim().toLowerCase();
  if (nm && block.names.has(nm)) return true;
  if (em && block.emails.has(em)) return true;
  const d1 = extractDomain(em);
  const d2 = extractDomain(site);
  return (d1 && block.domains.has(d1)) || (d2 && block.domains.has(d2));
