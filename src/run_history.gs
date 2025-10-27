/*** RUN HISTORY LOGGING ******************************************************/
function logRunHistory(added, stats, extraStats, duration) 
  try 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const historySheet = ss.getSheetByName(RUN_HISTORY_SHEET_NAME);
    if (!historySheet) 
      Logger.log('Run History sheet not found, skipping log');
      return;
    

    const strategy = determineStrategy();
    const runData = [
      new Date(),
      strategy.obxQuota, // OBX Leads target
      stats.sent - stats.followups - (extraStats.extraSent || 0), // New leads sent
      stats.followups, // Follow-ups
      stats.sent + (extraStats.extraSent || 0), // Total Sent
      extraStats.extraSent || 0, // Extra Outreach
      stats.errors.length, // Errors
      strategy.reason || 'Standard', // Strategy Active
      'Duration: ' + duration + 's. Added: ' + added // Notes
    ];

    historySheet.appendRow(runData);
    Logger.log(' Run history logged');
   catch (e) 
    Logger.log('Error logging run history: ' + e);
