/*** BOUNCE RETRY HANDLING ****************************************************/
const BOUNCE_LOOKBACK_HOURS = 72;
const BOUNCE_PROCESSED_LABEL = 'VNE/Bounce-Processed';

function processBounceBackRetries(sheet, colIndex, apiKey) {
  const stats = {
    processed: 0,
    resent: 0,
    resolved: 0,
    unresolved: 0,
    items: [],
    details: [],
    error: ''
  };

  try {
    const bounces = fetchRecentBounceNotifications_();
    if (!bounces.length) return stats;

    const data = sheet.getDataRange().getValues();
    const emailCol = colIndex['Email'] - 1;
    const rowMap = {};
    for (let i = 1; i < data.length; i++) {
      const email = (data[i][emailCol] || '').toString().trim().toLowerCase();
      if (email) {
        rowMap[email] = {
          values: data[i],
          rowIndex: i + 1
        };
      }
    }

    for (let i = 0; i < bounces.length; i++) {
      const bounce = bounces[i];
      const normalizedEmail = (bounce.email || '').toLowerCase();
      stats.processed++;

      const item = {
        email: normalizedEmail,
        business: '',
        reason: bounce.reason || '',
        status: '',
        searchSummary: ''
      };
      stats.items.push(item);

      const rowEntry = rowMap[normalizedEmail];
      if (!rowEntry) {
        item.status = 'Email not found on sheet';
        stats.unresolved++;
        stats.details.push({
          business: '',
          email: normalizedEmail,
          source: '',
          status: 'not-in-sheet',
          subject: ''
        });
        continue;
      }

      const rowIndex = rowEntry.rowIndex;
      const rowValues = rowEntry.values;
      const business = getCell(rowValues, colIndex['Business']) || '';
      const website = getCell(rowValues, colIndex['Website']) || '';
      item.business = business;

      appendActionNote(sheet, rowIndex, colIndex, 'Bounce detected for ' + normalizedEmail + (item.reason ? ' (' + item.reason + ')' : '') + '.');

      const candidates = buildBounceEmailCandidates_(rowValues, colIndex, website, normalizedEmail);
      if (!candidates.length) {
        item.status = 'No alternate contact found';
        item.searchSummary = 'notes/domain scans';
        appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry – no alternate contact found after scanning notes and domain guesses.');
        stats.unresolved++;
        stats.details.push({
          business: business,
          email: normalizedEmail,
          source: '',
          status: 'not-found',
          subject: ''
        });
        continue;
      }

      const attemptSummary = [];
      let resolved = false;

      for (let j = 0; j < candidates.length; j++) {
        const candidate = candidates[j];
        attemptSummary.push(candidate.source + ':' + candidate.email);

        const result = retryBounceOutreach_(sheet, rowIndex, colIndex, apiKey, candidate.email, candidate.source, business);
        stats.resent++;

        if (result.success) {
          stats.resolved++;
          item.status = 'Resent to ' + candidate.email + ' (' + candidate.source + ')';
          stats.details.push({
            business: business,
            email: candidate.email,
            source: candidate.source,
            status: 'resent',
            subject: result.subject || ''
          });
          rowMap[candidate.email.toLowerCase()] = rowEntry;
          resolved = true;
          break;
        }

        appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry send failed for ' + candidate.email + ': ' + result.error);
        stats.details.push({
          business: business,
          email: candidate.email,
          source: candidate.source,
          status: 'send-failed',
          subject: result.subject || ''
        });
      }

      if (!resolved) {
        item.status = item.status || 'All alternate contacts failed';
        stats.unresolved++;
      }

      item.searchSummary = attemptSummary.join('; ');
    }
  } catch (err) {
    stats.error = String(err);
    Logger.log('processBounceBackRetries error: ' + err);
  }

  return stats;
}

function fetchRecentBounceNotifications_() {
  const results = [];
  try {
    const label = ensureBounceProcessedLabel_();
    const query = 'from:(mailer-daemon OR postmaster) subject:("Delivery Status Notification" OR "Undelivered Mail Returned to Sender" OR "Mail delivery failed") newer_than:' + BOUNCE_LOOKBACK_HOURS + 'h -label:"' + BOUNCE_PROCESSED_LABEL + '"';
    const threads = GmailApp.search(query, 0, 20);

    for (let t = 0; t < threads.length; t++) {
      const thread = threads[t];
      const messages = thread.getMessages();
      for (let m = 0; m < messages.length; m++) {
        const message = messages[m];
        if (message.hasLabel(label)) continue;
        const body = message.getPlainBody() || message.getBody();
        const email = extractBounceRecipientFromBody_(body);
        if (!email) continue;
        results.push({
          email: email.toLowerCase(),
          reason: extractBounceReason_(body)
        });
        message.addLabel(label);
        message.markRead();
      }
      thread.addLabel(label);
    }
  } catch (err) {
    Logger.log('fetchRecentBounceNotifications_ error: ' + err);
  }
  return results;
}

function ensureBounceProcessedLabel_() {
  const existing = GmailApp.getUserLabelByName(BOUNCE_PROCESSED_LABEL);
  if (existing) return existing;
  return GmailApp.createLabel(BOUNCE_PROCESSED_LABEL);
}

function extractBounceRecipientFromBody_(text) {
  if (!text) return '';
  const patterns = [
    /Final-Recipient: rfc822;\s*([^\s]+)/i,
    /Original-Recipient: rfc822;\s*([^\s]+)/i,
    /Diagnostic-Code: smtp;\s*550[^<]*<([^>]+)>/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match && match[1]) {
      const candidate = match[1].replace(/[<>]/g, '').trim();
      if (isDeliverableCandidate_(candidate)) return candidate;
    }
  }
  const allEmails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  for (let j = 0; j < allEmails.length; j++) {
    const candidate = allEmails[j];
    if (isDeliverableCandidate_(candidate)) return candidate;
  }
  return '';
}

function extractBounceReason_(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/Diagnostic-Code/i.test(line)) return line;
    if (/Status:/i.test(line)) return line;
    if (/Reason:/i.test(line)) return line;
  }
  return '';
}

function buildBounceEmailCandidates_(rowValues, colIndex, website, bouncedEmail) {
  const seen = new Set();
  seen.add((bouncedEmail || '').toLowerCase());
  const candidates = [];

  function addCandidate(email, source) {
    const normalized = (email || '').toString().trim().toLowerCase();
    if (!normalized) return;
    if (seen.has(normalized)) return;
    if (!isDeliverableCandidate_(normalized)) return;
    seen.add(normalized);
    candidates.push({ email: normalized, source: source });
  }

  const textColumns = ['POC', 'Notes', 'Rep Targeting Notes', 'BTG Opportunity Notes', 'Source'];
  for (let i = 0; i < textColumns.length; i++) {
    const name = textColumns[i];
    const col = colIndex[name];
    if (!col) continue;
    const value = getCell(rowValues, col);
    const emails = extractEmailsFromTextForBounce_(value);
    for (let j = 0; j < emails.length; j++) addCandidate(emails[j], name.toLowerCase());
  }

  const domain = extractDomain(website || bouncedEmail);
  if (domain) {
    const guesses = ['info', 'contact', 'hello', 'sales', 'beverage', 'gm', 'events'];
    for (let k = 0; k < guesses.length; k++) {
      addCandidate(guesses[k] + '@' + domain, 'domain-guess');
    }
  }

  return candidates;
}

function extractEmailsFromTextForBounce_(text) {
  if (!text) return [];
  const matches = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (!matches) return [];
  const out = [];
  for (let i = 0; i < matches.length; i++) {
    out.push(matches[i].toLowerCase());
  }
  return out;
}

function isDeliverableCandidate_(email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (lower.includes('mailer-daemon')) return false;
  if (lower.includes('postmaster')) return false;
  if (lower === (VNE_EMAIL || '').toLowerCase()) return false;
  if (lower.endsWith('@gmail.com') && lower.startsWith('no-reply')) return false;
  return true;
}

function retryBounceOutreach_(sheet, rowIndex, colIndex, apiKey, email, source, business) {
  try {
    const rowRange = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
    const rowValues = rowRange.getValues()[0];

    const establishmentTypeCell = getCell(rowValues, colIndex['Establishment Type']);
    let establishmentType = establishmentTypeCell || '';
    if (!establishmentType) {
      establishmentType = getEstablishmentTypeSafe(apiKey, business);
      sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue(establishmentType);
    }

    let insight = getCell(rowValues, colIndex['Personalization Insight']) || '';
    if (!insight) {
      const insightResult = getInsightSafe(apiKey, business, establishmentType);
      insight = insightResult.insight;
      sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(insight);
      if (insightResult.mode && insightResult.mode !== 'primary') {
        appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry insight fallback used: ' + insightResult.mode);
      }
    }

    const emailResult = generateEmailWithMode_(apiKey, {
      business: business,
      insight: insight,
      establishmentType: establishmentType,
      isFollowUp: false
    });

    sendHtmlEmailFromInfoAlias(email, emailResult.subject, emailResult.html);

    sheet.getRange(rowIndex, colIndex['Email']).setValue(email);
    sheet.getRange(rowIndex, colIndex['Email Summary']).setValue(emailResult.subject);
    sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());
    if (colIndex['Follow-Up Count']) {
      sheet.getRange(rowIndex, colIndex['Follow-Up Count']).setValue(0);
    }
    setStatusSafe_(sheet, rowIndex, colIndex, 'Follow Up');
    appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry email sent to ' + email + ' (' + source + ').');

    return {
      success: true,
      subject: emailResult.subject,
      error: ''
    };
  } catch (err) {
    return {
      success: false,
      subject: '',
      error: String(err)
    };
  }
}
