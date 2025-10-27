/*** STRATEGY DETERMINATION ***************************************************/
function determineStrategy() 
  try 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const historySheet = ss.getSheetByName(RUN_HISTORY_SHEET_NAME);
    if (!historySheet || historySheet.getLastRow() < 8) 
      // Not enough history, use default 3/1/1
      return 
        obxQuota: 3,
        raleighQuota: 1,
        anywhereQuota: 1,
        obxRadius: '1-hour',
        raleighExpanded: false,
        reason: 'Default strategy (insufficient history)'
      ;
    

    // Get last 7 runs
    const lastRows = historySheet.getRange(Math.max(2, historySheet.getLastRow() - 6), 1, 7, 10).getValues();
    const obxCounts = lastRows.map(r => r[1] || 0); // Column B: OBX Leads
    const raleighCounts = lastRows.map(r => r[2] || 0); // Column C: Raleigh Leads

    // Count consecutive low OBX runs
    let consecutiveLowOBX = 0;
    for (let i = obxCounts.length - 1; i >= 0; i--) 
      if (obxCounts[i] < 2) consecutiveLowOBX++;
      else break;
    

    // Count consecutive zero Raleigh runs
    let consecutiveZeroRaleigh = 0;
    for (let i = raleighCounts.length - 1; i >= 0; i--) 
      if (raleighCounts[i] === 0) consecutiveZeroRaleigh++;
      else break;
    

    let strategy = 
      obxQuota: 3,
      raleighQuota: 1,
      anywhereQuota: 1,
      obxRadius: '1-hour',
      raleighExpanded: false,
      reason: 'Standard 3/1/1'
    ;

    // Adjust OBX strategy
    if (consecutiveLowOBX >= 1) 
      strategy.obxQuota = 2;
      strategy.raleighQuota = 2;
      strategy.anywhereQuota = 1;
      strategy.obxRadius = '90-minute';
      strategy.reason = 'OBX <2 for 1 runs  shifted to 2/2/1, expanded radius to 90min';
     else if (consecutiveLowOBX >= 3) 
      strategy.obxRadius = '90-minute';
      strategy.reason = 'OBX <2 for 3 runs  expanded radius to 90min';
    

    // Adjust Raleigh strategy
    if (consecutiveZeroRaleigh >= 2) 
      strategy.raleighExpanded = true;
      strategy.reason += (strategy.reason.includes('') ? ' AND ' : '') + 'Raleigh 0 for 2 runs  added Durham/Chapel Hill/Cary';
    

    return strategy;
   catch (e) 
    Logger.log('Error in strategy determination: ' + e);
    return 
      obxQuota: 3,
      raleighQuota: 1,
      anywhereQuota: 1,
      obxRadius: '1-hour',
      raleighExpanded: false,
      reason: 'Default (error in analysis)'
    ;
