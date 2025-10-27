/*** UNIFIED SUMMARY EMAIL ****************************************************/
function sendUnifiedSummary(added, stats, extraStats, startTime, endTime) 
  const strategy = determineStrategy();
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit';
  const historyUrl = sheetUrl + '#gid=' + getSheetIdByName(RUN_HISTORY_SHEET_NAME);
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  const subject = stats.errors.length > 0
    ? 'VNE Outreach: Completed with Errors (' + stats.errors.length + ')'
    : 'VNE Outreach SUCCESS: ' + added + ' added, ' + (stats.sent + extraStats.extraSent) + ' sent';

  let body = '=== VNE OUTREACH SUMMARY ===';
  body += 'Run Start: ' + formatDateISO(startTime) + '';
  body += 'Run End: ' + formatDateISO(endTime) + '';
  body += 'Duration: ' + duration + ' seconds';
  
  body += '--- LEAD GENERATION ---';
  body += 'New contacts added: ' + added + '';
  body += 'Target: ' + MAX_NEW_LEADS_PER_RUN + ' (' + strategy.obxQuota + ' OBX, ' + strategy.raleighQuota + ' Raleigh, ' + strategy.anywhereQuota + ' Elsewhere)';
  
  body += '--- OUTREACH ---';
  body += 'Emails sent: ' + stats.sent + '';
  body += 'Follow-ups: ' + stats.followups + '';
  if (extraStats.extraSent > 0) 
    body += 'Extra outreach (risk cleared): ' + extraStats.extraSent + '';
  
  body += 'Total outreach: ' + (stats.sent + extraStats.extraSent) + '';
  body += 'Errors: ' + stats.errors.length + '';
  
  if (stats && stats.reasons && (stats.reasons.blackout || stats.reasons.emailQuality)) 
  body += ': ';
  if (stats.reasons.blackout) body += stats.reasons.blackout + ' blackout (will reattempt next non-blackout run); ';
  if (stats.reasons.emailQuality) body += stats.reasons.emailQuality + ' sent despite needing email verification; ';
  body += '';

  
  if (stats.details && stats.details.length) 
    body += '--- RECIPIENTS ---';
    stats.details.forEach((d, i) => 
      body += (i + 1) + '. ' + d.business + ' <' + d.email + '>' + 
              (d.followUp ? ' [follow-up]' : ' [initial]') + '' +
              '   Subject: ' + d.subject + '';
    );
    body += '';
  

  if (stats.reasons) 
  body += '--- WHY NO SENDS / SKIPS ---';
  Object.entries(stats.reasons).forEach(([k,v]) => body += (v? (k+': '+v+'') : ''));
  body += '';

  if (extraStats.extraDetails && extraStats.extraDetails.length) 
    body += '--- EXTRA OUTREACH (RISK CLEARED) ---';
    extraStats.extraDetails.forEach((d, i) => 
      body += (i + 1) + '. ' + d.business + ' <' + d.email + '> (cleared ' + d.clearDate + ')';
    );
    body += '';
  
  
  body += '--- STRATEGY ---';
  body += 'Active Strategy: ' + strategy.reason + '';
  body += 'OBX Radius: ' + strategy.obxRadius + '';
  body += 'Raleigh Expanded: ' + (strategy.raleighExpanded ? 'Yes (Durham/Chapel Hill/Cary)' : 'No') + '';
  
  if (stats.errors.length > 0) 
    body += '--- ERRORS ---';
    stats.errors.slice(0, 3).forEach(err => 
      body += 'Row ' + err.row + ' (' + err.business + '): ' + err.error + '';
    );
    if (stats.errors.length > 3) 
      body += '... and ' + (stats.errors.length - 3) + ' more errors';
    
    body += '';
  
  
  body += '--- LINKS ---';
  body += 'Contacts Sheet: ' + sheetUrl + '';
  body += 'Run History: ' + historyUrl + '';

  const recipients = stats.errors.length > 0
    ? uniq_(ADMIN_EMAILS).join(',')
    : uniq_(ADMIN_EMAILS.concat(REPS_EMAILS)).join(',');

  GmailApp.sendEmail(recipients, subject, body);
  Logger.log(' Summary email sent to: ' + recipients);

function getSheetIdByName(sheetName) 
  try 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    return sheet ? sheet.getSheetId() : 0;
   catch 
    return 0;
