/*** HEADERS ******************************************************************/
function ensureHeadersAndCheckbox(sheet) 
  let header = sheet.getRange(1,1,1,Math.max(1, sheet.getLastColumn())).getValues()[0];
  const isBlank = header.every(h => !String(h||'').trim());
  if (isBlank) 
    sheet.getRange(1,1,1,REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
    header = REQUIRED_HEADERS.slice();
   else 
    const missing = REQUIRED_HEADERS.filter(h => !header.includes(h));
    if (missing.length) 
      sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
      header = header.concat(missing);
    
  
  const colIndex = ;
  header.forEach((h, i) => colIndex[h] = i + 1);

  const optCol = colIndex['Opt-Out'];
  const dv = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  const lastRow = Math.max(2, sheet.getMaxRows());
  sheet.getRange(2, optCol, lastRow - 1, 1).setDataValidation(dv);

  return  colIndex ;
