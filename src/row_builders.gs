/*** ROW BUILD ****************************************************************/
function buildRowFromLead(L, header, defaults) 
  const map = new Map(header.map((h, i) => [h, i]));
  const row = Array(header.length).fill('');
  const set = (k, v) =>  if (map.has(k)) row[map.get(k)] = v == null ? '' : v; ;

  const typeTc = titleCase(L.type || '');
  const proposedPOC = deriveProposedPOC(typeTc);

  set('Business', L.business || '');
  set('Type', typeTc);
  set('Website', L.website || '');
  set('Email', (L.email || '').toLowerCase());
  set('Phone', L.phone || '');
  set('City', L.city || '');
  set('State', L.state || '');
  set('POC', proposedPOC);
  set('Role', 'Not able to identify');
  set('Notes', (L.notes || ''));

  Object.keys(defaults || ).forEach(k => set(k, defaults[k]));
  return row;
