/*** TEST FUNCTIONS ***********************************************************/
const TEST_RECIPIENT = Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail();

function buildHtmlSummaryTable_(rows) 
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let html = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">';
  html += '<thead><tr><th>#</th><th>Business</th><th>Email</th><th>City</th><th>Type</th><th>Subject</th></tr></thead><tbody>';
  rows.forEach((r, i) => 
    html += '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td>' + esc(r.business) + '</td>' +
      '<td>' + esc(r.email) + '</td>' +
      '<td>' + esc(r.city) + '</td>' +
      '<td>' + esc(r.type) + '</td>' +
      '<td>' + esc(r.subject) + '</td>' +
    '</tr>';
  );
  html += '</tbody></table>';
  return html;
