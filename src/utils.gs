/*** UTILITY FUNCTIONS ********************************************************/
function getCell(row, colNum)  return colNum ? row[colNum - 1] : ''; 

function toBool(v) 
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s==='true'||s==='yes'||s==='y'||s==='1';

function titleCase(s) 
  return (s||'').toLowerCase().replace(//g,m=>m.toUpperCase()); 

function normalizeAsciiPunctuation(s) 
  if (s == null) return s;
  const map =  
    '':"'", '':"'", 'C':'"', 'D':'"', 
    '':'-', '':'-', 'A0':' ' 
  ;
  return String(s).replace(/[CDA0]/g, c => map[c] || c);

function normalizeUTF8(s) 
  if (!s) return s;
  // First normalize ASCII punctuation
  s = normalizeAsciiPunctuation(s);
  // Ensure proper UTF-8 encoding
  try 
    return decodeURIComponent(encodeURIComponent(s));
   catch 
    return s;
  

function formatDateISO(d) 
  const tz = Session.getScriptTimeZone ? Session.getScriptTimeZone() : 'America/New_York';
  const dt = d || new Date();
  return Utilities.formatDate(dt, tz, "yyyy-MM-dd'T'HH:mm:ss");

function normalizeName(s)  
  return (s || '').toString().trim().toLowerCase().replace(/+/g, ' '); 

function uniq_(arr) 
  const s=new Set(arr.filter(Boolean).map(x=>x.trim()).filter(Boolean)); 
  return Array.from(s); 

function extractDomain(emailOrUrl) 
  const s = (emailOrUrl || '').toString().trim().toLowerCase();
  if (!s) return '';
  if (s.includes('@')) return s.split('@')[1].replace(/^www./, '');
  try  
    const u = new URL(s.startsWith('http') ? s : 'https://' + s); 
    return u.hostname.replace(/^www./, ''); 
   catch  
    return s.replace(/^www./, ''); 
  

function assessEmailQuality(email, website) 
  const em = (email || '').toLowerCase();
  const site = (website || '').toLowerCase();
  const emDom = extractDomain(em);
  const siteDom = extractDomain(site);
  const isFree = FREE_DOMAINS.has(emDom);
  const domainMatch = siteDom && emDom && emDom === siteDom;
  const preferred = domainMatch || (!isFree && !siteDom);
  return  preferred, domainMatch, isFree, emDom, siteDom ;

function daysSince_(dateLike) 
  if (!dateLike) return Number.POSITIVE_INFINITY;
  try 
    const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
    return Math.floor((Date.now() - d.getTime()) / (1000*60*60*24));
   catch  
    return Number.POSITIVE_INFINITY; 
  

function safeConcatNote(existing, add)  
  const base = (existing || '').toString().trim(); 
  return base ? base + '' + add : add; 

function appendActionNote(sheet, rowIndex, colIndex, action) 
  const line = '[' + formatDateISO(new Date()) + '] ' + action;
  const existing = sheet.getRange(rowIndex, colIndex['Notes']).getValue();
  sheet.getRange(rowIndex, colIndex['Notes']).setValue(safeConcatNote(existing, line));

function setStatusSafe_(sheet, rowIndex, colIndex, value) 
  const v = (value || '').toString();
  const OK = ALLOWED_STATUS.has(v) ? v : 'Lead';
  sheet.getRange(rowIndex, colIndex['Status']).setValue(OK);

function deriveProposedPOC(establishmentType) 
  const t = (establishmentType || '').toLowerCase();
  if (t.includes('wine shop') || t.includes('bottle')) return 'Owner/Buyer';
  if (t.includes('restaurant')) return 'Beverage Director or GM';
  if (t.includes('wine bar') || t.includes('bar')) return 'Bar Manager';
  if (t.includes('inn') || t.includes('hotel')) return 'Food & Beverage Manager';
  if (t.includes('caterer')) return 'Owner/Buyer';
  if (t.includes('venue')) return 'Events/Banquet Manager';
  return 'Owner/Buyer';

function inferRole(business, email, establishmentType) 
  const e = (email || '').toLowerCase();
  if (e.startsWith('buyer@') || e.includes('beverage')) return 'Buyer';
  if (e.startsWith('wine@')  || e.includes('wine'))     return 'Wine Buyer';
  if (e.startsWith('bar@')   || e.includes('bar'))      return 'Bar Manager';
  if (e.startsWith('gm@')    || e.includes('manager'))  return 'General Manager';
  if (e.startsWith('owner@') || e.includes('owner'))    return 'Owner';
  if (e.startsWith('sommelier@') || e.includes('sommelier')) return 'Sommelier';

  const t = (establishmentType || '').toLowerCase();
  if (t.includes('restaurant')) return 'Beverage Director or GM';
  if (t.includes('wine bar') || t.includes('bar')) return 'Bar Manager';
  if (t.includes('wine shop') || t.includes('bottle')) return 'Owner/Buyer';
  if (t.includes('inn') || t.includes('hotel')) return 'F&B Manager';
  if (t.includes('caterer')) return 'Owner/Buyer';
  if (t.includes('venue')) return 'Events/Banquet Manager';
  return '';

function setRoleByHeuristic_(sheet, rowIndex, colIndex, business, email, establishmentType, flags) 
  if (flags && flags.conflict) 
    sheet.getRange(rowIndex, colIndex['Role']).setValue('Verification needed');
    return;
  
  const guess = inferRole(business, email, establishmentType);
  sheet.getRange(rowIndex, colIndex['Role']).setValue(guess || 'Not able to identify');
