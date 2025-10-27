/*** TRIGGER ******************************************************************/
function setupDailyTrigger() 
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('vneDailyProactiveRun')
    .timeBased().atHour(RUN_HOUR_LOCAL).everyDays(1).create();
  Logger.log(' Daily trigger set for ' + RUN_HOUR_LOCAL + ':00 AM');
