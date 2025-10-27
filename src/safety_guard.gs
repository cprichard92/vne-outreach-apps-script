/*** EMERGENCY SHUT-OFF CHECK *************************************************/
function checkEmergencyShutoff() 
  try 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
    if (!settingsSheet) 
      Logger.log(' Settings sheet not found. Proceeding with run.');
      return true; // Fail-safe: if Settings missing, allow run
    
    
    const shutoffValue = settingsSheet.getRange('A1').getValue();
    return shutoffValue === true; // Only run if checkbox is checked
   catch (e) 
    Logger.log(' Error checking shut-off: ' + e + '. Proceeding with run.');
    return true; // Fail-safe
