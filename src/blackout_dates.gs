/*** BLACKOUT DATE CHECK ******************************************************/
function isBlackoutDate() 
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Check if within 2 days of any federal holiday
  for (const holiday of FEDERAL_HOLIDAYS_2025) 
    const holidayDate = new Date(holiday.getFullYear(), holiday.getMonth(), holiday.getDate());
    const daysDiff = Math.abs((today - holidayDate) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 2) 
      Logger.log('Blackout: within 2 days of ' + holiday.toDateString());
      return true;
    
  
  
  // Check day of week (avoid Mon, Fri, weekends)
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 1 || dayOfWeek === 5) 
    Logger.log('Blackout: Monday/Friday/Weekend');
    return true;
  
  
  return false;
