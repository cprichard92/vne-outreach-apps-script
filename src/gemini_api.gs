/*** GEMINI API ***************************************************************/
function callGemini(apiKey, prompt) 
  const url = GEMINI_ENDPOINT + '?key=' + encodeURIComponent(apiKey);
  const payload =  
    contents: [ parts: [ text: prompt ]], 
    generationConfig:  
      temperature: 0.7,
      topP: 0.95,
      topK: 40
     
  ;
  const options =  
    method: 'post', 
    contentType: 'application/json', 
    payload: JSON.stringify(payload), 
    muteHttpExceptions: true, 
    followRedirects: true 
  ;

  const maxAttempts = 5;
  let attempt = 0, lastErr = null;

  while (attempt < maxAttempts) 
    try 
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      const text = res.getContentText() || '';

      if (code === 429 || code === 503) 
        attempt++;
        const backoff = Math.min(2000 * Math.pow(2, attempt - 1) + Math.floor(Math.random()*500), 15000);
        Logger.log('Rate limited (attempt ' + attempt + '), backing off ' + backoff + 'ms');
        Utilities.sleep(backoff);
        continue;
      
      
      if (code !== 200) 
        let msg = '';
        try  
          const errObj = JSON.parse(text);
          msg = (errObj.error && errObj.error.message) || text; 
         catch(e)
        throw new Error('Gemini API error ' + code + ': ' + msg);
      

      const json = JSON.parse(text);
      const out = json.candidates && json.candidates[0] && json.candidates[0].content && 
                  json.candidates[0].content.parts && json.candidates[0].content.parts[0] && 
                  json.candidates[0].content.parts[0].text;
      if (!out) throw new Error('Gemini: empty response');
      return out;
     catch (e) 
      lastErr = e;
      attempt++;
      if (attempt < maxAttempts) 
        const backoff = Math.min(1000 * attempt, 6000);
        Logger.log('Gemini error (attempt ' + attempt + '): ' + e + ', retrying in ' + backoff + 'ms');
        Utilities.sleep(backoff);
      
    
  
  throw new Error(lastErr ? String(lastErr) : 'Gemini failed after ' + maxAttempts + ' attempts');
