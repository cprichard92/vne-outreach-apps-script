/*** TEST: END-TO-END WITH RESILIENCE *****************************************/
function test_NewCompanies_EndToEnd() 
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const  colIndex  = ensureHeadersAndCheckbox(sheet);

  const values = sheet.getDataRange().getValues();
  const header = values[0], rows = values.slice(1);
  const existingNames = new Set(), existingEmails = new Set();
  const iBiz = (colIndex['Business']||1)-1, iEmail=(colIndex['Email']||1)-1;
  rows.forEach(r=>
    const nm=(r[iBiz]||'').toString().trim().toLowerCase();
    const em=(r[iEmail]||'').toString().trim().toLowerCase();
    if(nm) existingNames.add(nm);
    if(em) existingEmails.add(em);
  );

  Logger.log('TEST: Starting smart retry...');
  const picked = [];
  let attempts = 0;
  const maxAttempts = 10;

  while (picked.length < 5 && attempts < maxAttempts) 
    attempts++;
    Logger.log('TEST attempt ' + attempts + ', current: ' + picked.length);
    
    const candidates = fetchLeadsForArea(apiKey, [], 10, 'statewide');
    for (const L of candidates) 
      if (!L || typeof L !== 'object') continue;
      const name=(L.business||'').trim();
      const email=(L.email||'').trim().toLowerCase();
      const type=(L.type||'').trim().toLowerCase();
      if (!name) continue;
      if (!ALLOWED_SALES_TYPES.includes(type)) continue;
      if (existingNames.has(name.toLowerCase())) continue;
      if (email && existingEmails.has(email)) continue;
      
      picked.push(L);
      existingNames.add(name.toLowerCase());
      if (email) existingEmails.add(email);
      if (picked.length === 5) break;
    
    
    if (picked.length < 5 && attempts < maxAttempts) 
      const backoff = Math.min(500 * Math.pow(1.5, attempts), 4000);
      Logger.log('Backing off ' + backoff + 'ms...');
      Utilities.sleep(backoff);
    
  

  if (picked.length === 0) throw new Error('No candidates after ' + attempts + ' attempts');
  Logger.log('TEST: Found ' + picked.length + ' leads after ' + attempts + ' attempts');

  const toAppend = picked.map(L => buildRowFromLead(L, header, 
    Status:'Lead','Opportunity Type':'Distribution',State:'North Carolina',
    'Auto-Added':'TRUE',Source:'Gemini LeadGen NC','Follow-Up Count':0,
    'Priority': determinePriority(L)
  ));
  sheet.getRange(sheet.getLastRow()+1, 1, toAppend.length, header.length).setValues(toAppend);

  const startRow = sheet.getLastRow() - toAppend.length + 1;
  const details = [];

  for (let offset=0; offset<toAppend.length; offset++) 
    const rowIndex = startRow + offset;
    const business = sheet.getRange(rowIndex, colIndex['Business']).getValue();
    const emailLead = String(sheet.getRange(rowIndex, colIndex['Email']).getValue()||'').toLowerCase();

    try 
      const establishmentType = getEstablishmentTypeSafe(apiKey, business);
      const  insight, mode: insightMode  = getInsightSafe(apiKey, business, establishmentType);
      if (insightMode !== 'primary') appendActionNote(sheet, rowIndex, colIndex, 'TEST insight fallback: ' + insightMode);

      const repNotes = generateRepTargetingNotes(apiKey, business, establishmentType, insight);
      const btgNotes = generateBTGOpportunityNotes(apiKey, business, establishmentType);

      const  subject, html  = generateEmailWithMode_(apiKey, 
        business, insight, establishmentType, isFollowUp: false
      );
      
      sendHtmlEmailFromInfoAlias(TEST_RECIPIENT, '[TEST] ' + subject, html);

      appendActionNote(sheet, rowIndex, colIndex, 'TEST email sent to ' + TEST_RECIPIENT);
      setRoleByHeuristic_(sheet, rowIndex, colIndex, business, emailLead, establishmentType, );
      sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue(establishmentType);
      sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(insight);
      sheet.getRange(rowIndex, colIndex['Rep Targeting Notes']).setValue(repNotes);
      if (btgNotes) sheet.getRange(rowIndex, colIndex['BTG Opportunity Notes']).setValue(btgNotes);
      sheet.getRange(rowIndex, colIndex['Email Summary']).setValue('[TEST] ' + subject);
      setStatusSafe_(sheet, rowIndex, colIndex, 'Follow Up');
      sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());

      details.push(
        business,
        email: TEST_RECIPIENT,
        city: sheet.getRange(rowIndex, colIndex['City']).getValue(),
        type: establishmentType,
        subject: '[TEST] ' + subject
      );
      Utilities.sleep(150);
     catch (e) 
      // Generic fallback path. Keep test running and send.
      appendActionNote(sheet, rowIndex, colIndex, 'TEST research error. Generic send. ' + String(e).slice(0,120));
      try 
        const establishmentType = 'establishment';
        const genericInsight = 'We reviewed your program and think our portfolio could be a great fit.';
        const  subject, html  = safeParseEmailJSON('', business, genericInsight, establishmentType);
        sendHtmlEmailFromInfoAlias(TEST_RECIPIENT, '[TEST] ' + subject, html);

        if (!sheet.getRange(rowIndex, colIndex['Establishment Type']).getValue()) sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue(establishmentType);
        if (!sheet.getRange(rowIndex, colIndex['Personalization Insight']).getValue()) sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(genericInsight);
        sheet.getRange(rowIndex, colIndex['Email Summary']).setValue('[TEST] ' + subject);
        setStatusSafe_(sheet, rowIndex, colIndex, 'Follow Up');
        sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());

        details.push(
          business,
          email: TEST_RECIPIENT,
          city: sheet.getRange(rowIndex, colIndex['City']).getValue(),
          type: establishmentType,
          subject: '[TEST] ' + subject + ' [generic]'
        );
        Utilities.sleep(150);
       catch (eSend) 
        appendActionNote(sheet, rowIndex, colIndex, 'TEST send failed after fallback: ' + String(eSend).slice(0,120));
      
    
  

  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit';
  const table = buildHtmlSummaryTable_(details);
  const bodyHtml =
    '<p><strong>VNE TEST:</strong> Created ' + picked.length + ' new leads, redirected emails to ' + TEST_RECIPIENT + '</p>' +
    table +
    '<p><a href="'+sheetUrl+'">Open Contacts Sheet</a></p>';
  GmailApp.sendEmail(TEST_RECIPIENT, 'VNE TEST: New Companies (' + picked.length + ')', 'See HTML',  htmlBody: bodyHtml );

function test_SummaryTableOnly() 
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const header = data[0]||[];
  const rows = data.slice(1);
  const idx = n => header.indexOf(n);
  const iBusiness = idx('Business'), iEmail = idx('Email'), iCity = idx('City'),
        iType = idx('Establishment Type'), iSource = idx('Source'), iSummary = idx('Email Summary');

  const filtered = [];
  for (let i = rows.length - 1; i >= 0 && filtered.length < 5; i--) 
    const r = rows[i];
    if (String(r[iSource]||'') === 'Gemini LeadGen NC') 
      filtered.push(
        business: r[iBusiness]||'',
        email: r[iEmail]||'',
        city: r[iCity]||'',
        type: r[iType]||'',
        subject: r[iSummary]||''
      );
    
  
  filtered.reverse();
  if (!filtered.length) throw new Error('No "Gemini LeadGen NC" rows found.');

  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit';
  const table = buildHtmlSummaryTable_(filtered);
  const bodyHtml = '<p>Last 5 "Gemini LeadGen NC" entries:</p>' + table + '<p><a href="'+sheetUrl+'">Sheet Link</a></p>';

  GmailApp.sendEmail(TEST_RECIPIENT, 'VNE TEST: Summary Table', 'See HTML',  htmlBody: bodyHtml );

function test_WineDatabaseAccess() 
  Logger.log('Testing Wine Database access...');
  const wines = loadWineDatabase();
  if (wines.length > 0) 
    Logger.log(' Successfully loaded ' + wines.length + ' wines');
    Logger.log('Sample wine: ' + JSON.stringify(wines[0]));
   else 
    Logger.log(' Failed to load Wine Database or no wines found');
  

function test_EmergencyShutoff() 
  Logger.log('Testing emergency shut-off...');
  const isActive = checkEmergencyShutoff();
  Logger.log('System active: ' + isActive);
  if (isActive) 
    Logger.log(' Shut-off check working. System would run.');
   else 
    Logger.log(' Shut-off active. System would NOT run.');
  

function test_UTF8Encoding() 
  Logger.log('Testing UTF-8 encoding...');
  const testCases = [
    'Cúrate Bar de Tapas',
    'Café Español',
    'Vin Château',
    'Naïve Wine Bar'
  ];
  
  testCases.forEach(test => 
    const normalized = normalizeUTF8(test);
    Logger.log('Original: ' + test + '  Normalized: ' + normalized);
  );
  Logger.log(' UTF-8 encoding test complete');

function test_InitialOutreachEmail() 
  Logger.log('Testing initial outreach email with links and images...');
  
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');
  
  const testBusiness = 'The Wine Shop at Green Hills';
  const testEstablishmentType = 'Wine Shop';
  const testInsight = 'The Wine Shop at Green Hills boasts a curated selection, specializing in smaller vineyards. Their website highlights unique tasting events, creating an engaging experience for both novice and seasoned wine enthusiasts.';
  
  const  subject, html  = generateEmailWithMode_(apiKey, 
    business: testBusiness,
    insight: testInsight,
    establishmentType: testEstablishmentType,
    isFollowUp: false
  );
  
  // Send to yourself
  sendHtmlEmailFromInfoAlias(TEST_RECIPIENT, '[TEST - INITIAL] ' + subject, html);
  
  Logger.log(' Initial outreach test email sent to: ' + TEST_RECIPIENT);
  Logger.log('Subject: ' + subject);
  Logger.log('Check your inbox for the email with working links and logo!');

function test_FollowUpEmail() 
  Logger.log('Testing follow-up email with links and images...');
  
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');
  
  const testBusiness = 'Cúrate Bar de Tapas';
  const testEstablishmentType = 'Restaurant';
  const testInsight = 'Cúrate Bar de Tapas in Asheville is renowned for authentic Spanish tapas and an impressive wine selection. Their commitment to traditional preparation methods and seasonal ingredients creates a memorable dining experience.';
  
  const  subject, html  = generateEmailWithMode_(apiKey, 
    business: testBusiness,
    insight: testInsight,
    establishmentType: testEstablishmentType,
    isFollowUp: true
  );
  
  // Send to yourself
  sendHtmlEmailFromInfoAlias(TEST_RECIPIENT, '[TEST - FOLLOW-UP] ' + subject, html);
  
  Logger.log(' Follow-up test email sent to: ' + TEST_RECIPIENT);
  Logger.log('Subject: ' + subject);
  Logger.log('Check your inbox for the follow-up email with working links and logo!');
