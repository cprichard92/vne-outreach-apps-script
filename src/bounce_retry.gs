/*** BOUNCE RETRY HANDLING ****************************************************/
const BOUNCE_LOOKBACK_HOURS = 168;
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
    const rows = data.slice(1);
    const emailMap = {};
    for (let i = 0; i < rows.length; i++) {
      const emailCell = (getCell(rows[i], colIndex['Email']) || '').toString().trim().toLowerCase();
      if (!emailCell) continue;
      emailMap[emailCell] = {
        row: rows[i],
        index: i + 2
      };
    }

    for (let i = 0; i < bounces.length; i++) {
      const bounce = bounces[i];
      stats.processed++;
      const item = {
        email: bounce.email,
        reason: bounce.reason || '',
        business: '',
        status: '',
        subject: '',
        searchSummary: ''
      };
      stats.items.push(item);

      const match = emailMap[bounce.email];
      if (!match) {
        item.status = 'No matching row for bounced email';
        stats.unresolved++;
        const missingDetail = {
          business: '',
          email: bounce.email,
          source: '',
          status: 'not-in-sheet',
          subject: ''
        };
        stats.details.push(missingDetail);
        continue;
      }

      const rowIndex = match.index;
      const rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
      const business = getCell(rowValues, colIndex['Business']) || '';
      const website = getCell(rowValues, colIndex['Website']) || '';
      const city = getCell(rowValues, colIndex['City']) || '';
      const state = getCell(rowValues, colIndex['State']) || '';
      item.business = business;

      const reasonNote = bounce.reason ? ' Reason: ' + bounce.reason : '';
      appendActionNote(sheet, rowIndex, colIndex, 'Bounce detected for ' + bounce.email + '.' + reasonNote + ' Triggering smart contact research.');

      const research = performSmartContactResearch_(business, website, city, state, bounce.email);
      item.searchSummary = formatSearchSummary_(research.attempts);

      if (research.sources && research.sources.length) {
        appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry searched: ' + research.sources.join(', '));
      }

      if (research.bestEmail) {
        if (research.bestEmail !== bounce.email) {
          sheet.getRange(rowIndex, colIndex['Email']).setValue(research.bestEmail);
          appendActionNote(sheet, rowIndex, colIndex, 'Updated email after bounce retry: ' + research.bestEmail + ' (source: ' + research.bestSource + ')');
        }
        item.status = 'Found alternate contact: ' + research.bestEmail + ' (source: ' + research.bestSource + ')';

        const sendResult = retryBounceOutreach_(sheet, rowIndex, colIndex, apiKey, research.bestEmail, research.bestSource);
        stats.resent++;
        item.subject = sendResult.subject || '';

        const detail = {
          business: business,
          email: research.bestEmail,
          source: research.bestSource || '',
          status: sendResult.success ? 'resent' : 'send-failed',
          subject: sendResult.subject || ''
        };
        stats.details.push(detail);

        if (sendResult.success) {
          stats.resolved++;
          appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry email sent to ' + research.bestEmail + '.');
        } else {
          stats.unresolved++;
          item.status = 'Send failed after finding ' + research.bestEmail + ': ' + sendResult.error;
          appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry send failed: ' + sendResult.error);
        }
      } else {
        stats.unresolved++;
        item.status = 'No alternate contact found. Sources searched: ' + research.sources.join(', ');
        const detail = {
          business: business,
          email: bounce.email,
          source: '',
          status: 'not-found',
          subject: ''
        };
        stats.details.push(detail);
        appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry could not locate a new contact. Sources: ' + research.sources.join(', '));
      }
    }
  } catch (e) {
    stats.error = String(e);
    Logger.log('processBounceBackRetries error: ' + e);
  }

  return stats;
}

function fetchRecentBounceNotifications_() {
  const results = [];
  try {
    const label = ensureBounceProcessedLabel_();
    const query = 'from:(mailer-daemon OR postmaster) subject:("Delivery Status Notification" OR "Undelivered Mail Returned to Sender" OR "Mail delivery failed") newer_than:' + BOUNCE_LOOKBACK_HOURS + 'h -label:"' + BOUNCE_PROCESSED_LABEL + '"';
    const threads = GmailApp.search(query, 0, 50);
    for (let t = 0; t < threads.length; t++) {
      const thread = threads[t];
      const messages = thread.getMessages();
      for (let m = 0; m < messages.length; m++) {
        const message = messages[m];
        if (message.hasLabel(label)) continue;
        const body = message.getPlainBody() || message.getBody();
        const email = extractBounceRecipientFromBody_(body);
        if (!email) continue;
        const info = {
          email: email.toLowerCase(),
          reason: extractBounceReason_(body)
        };
        results.push(info);
        message.addLabel(label);
        message.markRead();
      }
      thread.addLabel(label);
    }
  } catch (e) {
    Logger.log('fetchRecentBounceNotifications_ error: ' + e);
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

function isDeliverableCandidate_(email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (lower.includes('mailer-daemon')) return false;
  if (lower.includes('postmaster')) return false;
  if (lower === (VNE_EMAIL || '').toLowerCase()) return false;
  if (lower.endsWith('@gmail.com') && lower.startsWith('no-reply')) return false;
  return true;
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

function performSmartContactResearch_(business, website, city, state, originalEmail) {
  const attempts = [];
  const candidateMap = {};
  const sourceSet = new Set();

  const normalizedBusiness = (business || '').toString().trim();
  const normalizedWebsite = normalizeWebsiteUrl_(website);
  const preferredDomain = extractDomain(normalizedWebsite || originalEmail);

  const targets = buildSearchTargets_(normalizedBusiness, normalizedWebsite, city, state, preferredDomain);
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (!target || !target.url) continue;

    const attempt = {
      source: target.source,
      url: target.url,
      status: '',
      emails: []
    };
    sourceSet.add(target.source);

    try {
      const response = UrlFetchApp.fetch(target.url, {
        muteHttpExceptions: true,
        followRedirects: true,
        timeout: 20000
      });
      attempt.status = 'HTTP ' + response.getResponseCode();
      const body = response.getContentText();
      const emails = extractEmailsFromText_(body);
      attempt.emails = emails;
      for (let j = 0; j < emails.length; j++) {
        const email = emails[j].toLowerCase();
        if (email === originalEmail) continue;
        if (!candidateMap[email]) {
          candidateMap[email] = {
            email: email,
            sources: new Set()
          };
        }
        candidateMap[email].sources.add(target.source);
      }
    } catch (err) {
      attempt.status = 'error: ' + String(err).slice(0, 120);
    }

    attempts.push(attempt);
    Utilities.sleep(100);
  }

  const candidates = [];
  Object.keys(candidateMap).forEach(function(key) {
    const candidate = candidateMap[key];
    const sourceList = Array.from(candidate.sources || []);
    candidate.sourceList = sourceList;
    candidate.score = scoreEmailCandidate_(candidate.email, preferredDomain, normalizedBusiness);
    candidates.push(candidate);
  });

  candidates.sort(function(a, b) {
    return b.score - a.score;
  });

  const result = {
    attempts: attempts,
    candidates: candidates,
    sources: Array.from(sourceSet),
    bestEmail: '',
    bestSource: ''
  };

  if (candidates.length > 0) {
    const best = candidates[0];
    result.bestEmail = best.email;
    result.bestSource = (best.sourceList || []).join(', ');
  }

  return result;
}

function buildSearchTargets_(business, website, city, state, preferredDomain) {
  const targets = [];
  const locationParts = [];
  if (city) locationParts.push(city);
  if (state) locationParts.push(state);
  const locationString = locationParts.join(' ');
  const queryBase = (business + ' ' + locationString).trim();

  if (website) {
    const base = website.replace(/\/$/, '');
    addSearchTarget_(targets, 'Website homepage', base);
    addSearchTarget_(targets, 'Website contact page', base + '/contact');
    addSearchTarget_(targets, 'Website about page', base + '/about');
    addSearchTarget_(targets, 'Website team page', base + '/team');
    addSearchTarget_(targets, 'Website staff page', base + '/staff');
    if (preferredDomain) {
      addSearchTarget_(targets, 'Google site email search', 'https://www.google.com/search?q=' + encodeURIComponent('site:' + preferredDomain + ' email'));
    }
  }

  if (queryBase) {
    const encoded = encodeURIComponent(queryBase + ' contact email');
    addSearchTarget_(targets, 'Google search', 'https://www.google.com/search?q=' + encoded);
    addSearchTarget_(targets, 'Bing search', 'https://www.bing.com/search?q=' + encoded);
    addSearchTarget_(targets, 'DuckDuckGo search', 'https://duckduckgo.com/?q=' + encoded);
    addSearchTarget_(targets, 'Google phone search', 'https://www.google.com/search?q=' + encodeURIComponent(queryBase + ' phone email'));
    addSearchTarget_(targets, 'Google staff search', 'https://www.google.com/search?q=' + encodeURIComponent(queryBase + ' beverage director email'));
    addSearchTarget_(targets, 'LinkedIn search', 'https://www.linkedin.com/search/results/all/?keywords=' + encodeURIComponent(queryBase + ' beverage director email'));
    addSearchTarget_(targets, 'Facebook search', 'https://www.facebook.com/search/top/?q=' + encodeURIComponent(queryBase));
    addSearchTarget_(targets, 'Instagram search', 'https://www.instagram.com/web/search/topsearch/?context=blended&query=' + encodeURIComponent(queryBase));
    addSearchTarget_(targets, 'Twitter search', 'https://nitter.net/search?f=tweets&q=' + encodeURIComponent(queryBase + ' email'));
    addSearchTarget_(targets, 'Generic email pattern search', 'https://www.google.com/search?q=' + encodeURIComponent(queryBase + ' email format'));
  }

  return targets;
}

function addSearchTarget_(targets, source, url) {
  if (!url) return;
  const trimmed = url.trim();
  if (!trimmed) return;
  targets.push({ source: source, url: trimmed });
}

function normalizeWebsiteUrl_(website) {
  if (!website) return '';
  let url = website.toString().trim();
  if (!url) return '';
  if (!/^https?:/i.test(url)) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

function extractEmailsFromText_(text) {
  if (!text) return [];
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const unique = new Set();
  const results = [];
  for (let i = 0; i < matches.length; i++) {
    const email = matches[i].toLowerCase();
    if (!isDeliverableCandidate_(email)) continue;
    if (unique.has(email)) continue;
    unique.add(email);
    results.push(email);
  }
  return results;
}

function scoreEmailCandidate_(email, preferredDomain, business) {
  let score = 0;
  const domain = extractDomain(email);
  if (preferredDomain && domain === preferredDomain) score += 5;
  if (domain && !FREE_DOMAINS.has(domain)) score += 2;
  if (/owner@|buyer@|beverage|wine|sommelier|gm@|manager@/i.test(email)) score += 2;
  if (/info@|hello@|contact@|support@|reservations@/i.test(email)) score -= 1;
  if (business) {
    const firstWord = business.split(' ')[0];
    if (firstWord && email.includes(firstWord.toLowerCase())) score += 1;
  }
  return score;
}

function formatSearchSummary_(attempts) {
  if (!attempts || !attempts.length) return '';
  const lines = [];
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    let line = attempt.source + ': ';
    if (attempt.emails && attempt.emails.length) {
      line += attempt.emails.join(', ');
    } else if (attempt.status) {
      line += attempt.status;
    } else {
      line += 'no result';
    }
    lines.push(line);
  }
  return lines.join(' | ');
}

function retryBounceOutreach_(sheet, rowIndex, colIndex, apiKey, email, source) {
  const result = {
    success: false,
    subject: '',
    error: ''
  };

  try {
    const range = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
    const rowValues = range.getValues()[0];
    const business = getCell(rowValues, colIndex['Business']) || '';
    const statusRaw = getCell(rowValues, colIndex['Status']);
    const lastSent = getCell(rowValues, colIndex['Last Sent At']);
    const followCt = Number(getCell(rowValues, colIndex['Follow-Up Count']) || 0);
    const neverSent = !lastSent || normStatus_(statusRaw) === 'error';
    const eligibleFollowUp = !neverSent && daysSince_(lastSent) >= FOLLOWUP_DAYS && followCt < 1;
    const isFollowUp = eligibleFollowUp && !neverSent;

    const establishmentType = getEstablishmentTypeSafe(apiKey, business);
    const insightPayload = getInsightSafe(apiKey, business, establishmentType);
    const insight = insightPayload.insight;
    const insightMode = insightPayload.mode;
    if (insightMode && insightMode !== 'primary') {
      appendActionNote(sheet, rowIndex, colIndex, 'Bounce retry insight fallback: ' + insightMode);
    }

    const repNotes = generateRepTargetingNotes(apiKey, business, establishmentType, insight);
    const btgNotes = generateBTGOpportunityNotes(apiKey, business, establishmentType, insight);
    const emailPayload = generateEmailWithMode_(apiKey, business, insight, establishmentType, isFollowUp);
    const subject = emailPayload.subject;
    const html = emailPayload.html;

    sendHtmlEmailFromInfoAlias(email, subject, html);
    result.success = true;
    result.subject = subject;

    sheet.getRange(rowIndex, colIndex['Email']).setValue(email);
    sheet.getRange(rowIndex, colIndex['Establishment Type']).setValue(establishmentType);
    sheet.getRange(rowIndex, colIndex['Personalization Insight']).setValue(insight);
    sheet.getRange(rowIndex, colIndex['Rep Targeting Notes']).setValue(repNotes);
    if (btgNotes) sheet.getRange(rowIndex, colIndex['BTG Opportunity Notes']).setValue(btgNotes);
    sheet.getRange(rowIndex, colIndex['Email Summary']).setValue(subject);
    sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());
    if (colIndex['Follow-Up Count']) {
      const nextFollow = isFollowUp ? followCt + 1 : followCt;
      sheet.getRange(rowIndex, colIndex['Follow-Up Count']).setValue(nextFollow);
    }
    setStatusSafe_(sheet, rowIndex, colIndex, 'Follow Up');
    setRoleByHeuristic_(sheet, rowIndex, colIndex, business, email, establishmentType);
  } catch (err) {
    result.error = String(err);
    try {
      const range = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
      const rowValues = range.getValues()[0];
      const business = getCell(rowValues, colIndex['Business']) || '';
      const fallbackInsight = 'We reviewed your program and think our portfolio could be a great fit for your guests.';
      const fallbackPayload = safeParseEmailJSON('', business, fallbackInsight, 'establishment');
      sendHtmlEmailFromInfoAlias(email, fallbackPayload.subject, fallbackPayload.html);
      sheet.getRange(rowIndex, colIndex['Email Summary']).setValue(fallbackPayload.subject);
      sheet.getRange(rowIndex, colIndex['Last Sent At']).setValue(new Date());
      setStatusSafe_(sheet, rowIndex, colIndex, 'Follow Up');
      setRoleByHeuristic_(sheet, rowIndex, colIndex, business, email, 'establishment');
      result.success = true;
      result.subject = fallbackPayload.subject;
      result.error = '';
    } catch (fallbackErr) {
      result.error = 'Primary+fallback failure: ' + String(fallbackErr);
    }
  }

  return result;
}
