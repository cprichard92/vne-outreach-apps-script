/*** OUTREACH *****************************************************************/
function sendOutreachToEligibleRows(sheet, colIndex, apiKey, limit) 
  const reasons =  blackout:0, opted:0, winery:0, status:0, blocked:0, noEmail:0, emailQuality:0, followupWindow:0 ;
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);
  let sent = 0, followups = 0;
  const errors = [];
  const details = [];
  const block = loadClientBlocklist();

  for (let i = 0; i < rows.length && sent < limit; i++) 
    const r = rows[i], rowIndex = i + 2;

    const business = getCell(r, colIndex['Business']);
    const email    = (getCell(r, colIndex['Email']) || '').toString().trim().toLowerCase();
    const website  = (getCell(r, colIndex['Website']) || '').toString().trim();
    const type     = (getCell(r, colIndex['Type']) || '').toString().trim().toLowerCase();
    const statusRaw = getCell(r, colIndex['Status']);
    const status   = normStatus_(statusRaw);
    const opted    = toBool(getCell(r, colIndex['Opt-Out']));
    const lastSent = getCell(r, colIndex['Last Sent At']);
    const followCt = Number(getCell(r, colIndex['Follow-Up Count']) || 0);

    if (opted)  reasons.opted++; continue; 
    if (type.includes('winery') || type.includes('vineyard'))  reasons.winery++; continue; 
    if (SKIP_STATUSES.has(status))  reasons.status++; continue; 

    if (isBlockedByClients(block, business, email, website)) 
      setStatusSafe_(sheet, rowIndex, colIndex, 'Blocked');
      appendActionNote(sheet, rowIndex, colIndex, 'Blocked – existing client/domain');
      reasons.blocked++; 
      continue;
    

    if (!email)  appendActionNote(sheet, rowIndex, colIndex, 'Skipped – no email'); reasons.noEmail++; continue; 

    const quality = assessEmailQuality(email, website);
    // allow common free domains often used by small businesses
    const allowFreeDomain = /@(gmail|yahoo|outlook|icloud|aol)./i.test(email);

    if (!quality.preferred && !allowFreeDomain) 
      appendActionNote(sheet, rowIndex, colIndex, 'Sent despite needing email verification (may bounce)');
      reasons.emailQuality++; 
      // do NOT continue; proceed to send
     else if (allowFreeDomain) 
      appendActionNote(sheet, rowIndex, colIndex, 'Sent to small-business free email (allowed)');
    

    if (isBlackoutDate()) 
      appendActionNote(sheet, rowIndex, colIndex, 'Deferred – blackout period (will reattempt next non-blackout run)');
      sheet.getRange(rowIndex, colIndex['Blackout Reason']).setValue('Holiday/weekend/M/F window');
      reasons.blackout++;
      continue;
    

    const days = daysSince_(lastSent);
    const neverSent = !lastSent;
    const eligibleFollowUp = !neverSent && days >= FOLLOWUP_DAYS && followCt < 1;
    if (!neverSent && !eligibleFollowUp)  reasons.followupWindow++; continue; 

    // Resilient research + send
    try 
      const establishmentType = getEstablishmentTypeSafe(apiKey, business);
      const  insight, mode: insightMode  = getInsightSafe(apiKey, business, establishmentType);
      if (insightMode !== 'primary') appendActionNote(sheet, rowIndex, colIndex, 'Insight fallback used: ' + insightMode);

      const repNotes = generateRepTargetingNotes(apiKey, business, establishmentType, insight);
      const btgNotes = generateBTGOpportunityNotes(apiKey, business, establishmentType);

      const  subject, html  = generateEmailWithMode_(apiKey, 
        business, insight, establishmentType, isFollowUp: eligibleFollowUp
      );

      sendHtmlEmailFromInfoAlias(email, subject, html);

      details.push( business, email, subject, followUp: eligibleFollowUp );

      appendActionNote(sheet, rowIndex, colIndex, eligibleFollowUp ? 'Follow-up sent' : 'Initial email sent');
      setRoleByHeuristic_(sheet, rowIndex, colIndex, business, email, establishmentType, );
      sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue(establishmentType);
      sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(insight);
      sheet.getRange(rowIndex, colIndex['Rep Targeting Notes']).setValue(repNotes);
      if (btgNotes) sheet.getRange(rowIndex, colIndex['BTG Opportunity Notes']).setValue(btgNotes);
      sheet.getRange(rowIndex, colIndex['Email Summary']).setValue(subject);
      setStatusSafe_(sheet, rowIndex, colIndex, 'Follow Up');
      sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());
      if (eligibleFollowUp) 
        sheet.getRange(rowIndex, colIndex['Follow-Up Count']).setValue(followCt + 1);
        followups++;
      

      sent++;
      Utilities.sleep(200);
     catch (e) 
      // Log, then generic fallback send; do not abort run.
      appendActionNote(sheet, rowIndex, colIndex, 'Research error. Using generic outreach. ' + String(e).slice(0,120));
      try 
        const establishmentType = 'establishment';
        const genericInsight = 'We reviewed your program and think our portfolio could be a great fit.';
        const  subject, html  = safeParseEmailJSON('', business, genericInsight, establishmentType);
        sendHtmlEmailFromInfoAlias(email, subject, html);

        details.push( business, email, subject, followUp: eligibleFollowUp, generic: true );

        appendActionNote(sheet, rowIndex, colIndex, eligibleFollowUp ? 'Follow-up sent (generic)' : 'Initial email sent (generic)');
        setRoleByHeuristic_(sheet, rowIndex, colIndex, business, email, establishmentType, );
        if (!getCell(r, colIndex['Establishment Type'])) sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue(establishmentType);
        if (!getCell(r, colIndex['Personalization Insight'])) sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(genericInsight);
        sheet.getRange(rowIndex, colIndex['Email Summary']).setValue(subject);
        setStatusSafe_(sheet, rowIndex, colIndex, 'Follow Up');
        sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());
        if (eligibleFollowUp) 
          sheet.getRange(rowIndex, colIndex['Follow-Up Count']).setValue(followCt + 1);
          followups++;
        

        sent++;
        Utilities.sleep(200);
       catch (eSend) 
        setStatusSafe_(sheet, rowIndex, colIndex, 'Lead');
        appendActionNote(sheet, rowIndex, colIndex, 'Send failed after fallback: ' + String(eSend).slice(0,120));
        errors.push( row: rowIndex, business, error: String(eSend) );
      
    
  

  return  sent, followups, errors, details, reasons ;
