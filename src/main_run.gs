/*** MAIN DAILY RUN ***********************************************************/
function vneDailyProactiveRun() 
  const startTime = new Date();
  
  // Check emergency shut-off FIRST
  if (!checkEmergencyShutoff()) 
    Logger.log(' Emergency shut-off active. Skipping run.');
    return;
  
  
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing in Script Properties.');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + SHEET_NAME);
  
  const  colIndex  = ensureHeadersAndCheckbox(sheet);

  // Lead generation with adaptive strategy
  const added = appendNewNCLeads(sheet, colIndex, apiKey);
  
  // Outreach to eligible rows
  const stats = sendOutreachToEligibleRows(sheet, colIndex, apiKey, MAX_OUTREACH_PER_RUN);

  // Retry any bounced outreach with enhanced research
  const bounceStats = processBounceBackRetries(sheet, colIndex, apiKey);

  // Check for risk-cleared extra outreach
  const extraStats = sendExtraOutreachForClearedRisks(sheet, colIndex, apiKey);
  
  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  // Log to Run History
  logRunHistory(added, stats, extraStats, bounceStats, duration);

  // Send unified summary
  sendUnifiedSummary(added, stats, extraStats, bounceStats, startTime, endTime);
  
  Logger.log(' Daily run complete in ' + duration + 's');
