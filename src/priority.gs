/*** PRIORITY DETERMINATION ***************************************************/
function determinePriority(lead) 
  const city = (lead.city || '').toLowerCase();
  const month = new Date().getMonth() + 1; // 1-12
  
  // ASAP: OBX during seasonal prep windows
  if (OUTER_BANKS_CITIES.map(c => c.toLowerCase()).includes(city)) 
    if ((month >= 1 && month <= 5) || (month >= 7 && month <= 9)) 
      return 'ASAP';
    
  
  
  return 'STANDARD';
