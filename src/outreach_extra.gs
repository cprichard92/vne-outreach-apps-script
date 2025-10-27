/*** EXTRA OUTREACH FOR RISK-CLEARED LEADS ************************************/
function sendExtraOutreachForClearedRisks(sheet, colIndex, apiKey) 
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);
  let extraSent = 0;
  const extraDetails = [];

  for (let i = 0; i < rows.length; i++) 
    const r = rows[i], rowIndex = i + 2;

    const status = (getCell(r, colIndex['Status']) || '').toString().trim();
    const notes  = (getCell(r, colIndex['Notes'])  || '').toString();

    // Trigger: previously on hold for risk, now ACTIVE, and not already messaged.
    const wasRisk = /HOLD - RISK/i.test(notes);
    const already = /Extra outreach sent/i.test(notes);
    if (status !== 'ACTIVE' || !wasRisk || already) continue;
    if (status === 'error' || SKIP_STATUSES.has(status)) 
      appendActionNote(sheet, rowIndex, colIndex, 'Skipped – status gated: ' + (statusRaw||''));
      reasons.status++;
      continue;
    

    const business = getCell(r, colIndex['Business']) || '';
    const email    = (getCell(r, colIndex['Email']) || '').toString().trim().toLowerCase();
    if (!email)  appendActionNote(sheet, rowIndex, colIndex, 'Risk cleared but no email on file'); continue; 
    if (isBlackoutDate())  appendActionNote(sheet, rowIndex, colIndex, 'Risk cleared, deferred due to blackout'); continue; 

    try 
      // Safe lookups with fallbacks
      const establishmentType = getEstablishmentTypeSafe(apiKey, business);
      const  insight, mode: insightMode  = getInsightSafe(apiKey, business, establishmentType);
      if (insightMode !== 'primary') appendActionNote(sheet, rowIndex, colIndex, 'Risk-clear insight fallback: ' + insightMode);

      // Build and send
      const  subject, html  = generateEmailWithMode_(apiKey, 
        business, insight, establishmentType, isFollowUp: false
      );
      sendHtmlEmailFromInfoAlias(email, subject, html);

      const stamp = formatDateISO(new Date());
      appendActionNote(sheet, rowIndex, colIndex, 'Risk cleared on ' + stamp + '. Extra outreach sent.');
      if (!getCell(r, colIndex['Establishment Type'])) sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue(establishmentType);
      if (!getCell(r, colIndex['Personalization Insight'])) sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(insight);
      sheet.getRange(rowIndex, colIndex['Email Summary']).setValue(subject);
      sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());

      extraDetails.push( business, email, clearDate: stamp );
      extraSent++;
      Utilities.sleep(200);
     catch (e) 
      // Generic fallback. Do not abort the run.
      appendActionNote(sheet, rowIndex, colIndex, 'Risk-clear research error. Using generic outreach. ' + String(e).slice(0,120));
      try 
        const genericInsight = 'We reviewed your program and think our portfolio could be a strong fit for your guests.';
        const  subject, html  = safeParseEmailJSON('', business, genericInsight, 'establishment');
        sendHtmlEmailFromInfoAlias(email, subject, html);

        const stamp = formatDateISO(new Date());
        appendActionNote(sheet, rowIndex, colIndex, 'Risk cleared on ' + stamp + '. Generic extra outreach sent.');
        if (!getCell(r, colIndex['Establishment Type'])) sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue('establishment');
        if (!getCell(r, colIndex['Personalization Insight'])) sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(genericInsight);
        sheet.getRange(rowIndex, colIndex['Email Summary']).setValue(subject);
        sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());

        extraDetails.push( business, email, clearDate: stamp, generic: true );
        extraSent++;
        Utilities.sleep(200);
       catch (eSend) 
        appendActionNote(sheet, rowIndex, colIndex, 'Risk-clear send failed after fallback: ' + String(eSend).slice(0,120));
      
    
  

  return  extraSent, extraDetails ;
