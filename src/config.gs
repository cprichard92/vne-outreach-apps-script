/*** CONFIG *******************************************************************/
const SPREADSHEET_ID = '1CEq_u2sXk0AeSj1tvJmmlNVVmvbp2gXFXJNS8BLVEZM';
const WINE_DATABASE_ID = '1D2a3NLR_puGXGRVqnGxIPpXfYyNgIZa96LoeSRGH9Jc';
const SHEET_NAME = 'Contacts';
const SETTINGS_SHEET_NAME = 'Settings';
const RUN_HISTORY_SHEET_NAME = 'Run History';
const WINE_DB_SHEET_NAME = 'Wine Database'; // Singular - matches actual tab name

const MAX_NEW_LEADS_PER_RUN = 5;
const MAX_OUTREACH_PER_RUN  = 5;
const RUN_HOUR_LOCAL        = 6;
const MAX_RETRY_ATTEMPTS    = 30;
const FOLLOWUP_DAYS         = 45;

// Venue type multipliers (wholesale × multiplier = retail/BTG price)
const VENUE_MULTIPLIERS = 
  'wine shop': 1.7,
  'bottle shop': 1.7,
  'grocery': 2.0,
  'restaurant': 2.5,
  'casual restaurant': 2.5,
  'upscale restaurant': 3.0,
  'fine dining': 3.0,
  'bar': 2.5,
  'wine bar': 2.5,
  'caterer': 2.5,
  'inn/hotel': 4.0,
  'hotel': 4.0,
  'inn': 4.0,
  'venue': 3.0,
  'luxury': 5.0
;

// BTG defaults
const DEFAULT_POUR_OZ = 5;
const POURS_PER_BOTTLE = 750 / (DEFAULT_POUR_OZ * 29.5735); // ~5 pours

// Links & contact
const SPEC_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vjYwIgkm49-rrH-1CgdGEUUX_VIkzovdHIx4LEI8asI/edit?gid=121429311#gid=121429311';
const BOOKING_URL    = 'https://calendar.app.google/ZWHcNuhsH6BsnBis5';
const VNE_PHONE      = '252-228-9132';
const VNE_EMAIL      = 'info@vneimporters.com';
const VNE_SITE       = 'https://vneimporters.com';
const VNE_LOGO       = 'https://static.wixstatic.com/media/3d137b_19d50e38bf65405e9969d4c6f4066765~mv2.jpg/v1/fit/w_2500,h_1330,al_c/3d137b_19d50e38bf65405e9969d4c6f4066765~mv2.jpg';
const USA_WINE_ARTICLE = 'https://usawineratings.com/en/blog/interviews-3362/vin-noir-explorers-the-boutique-wine-importers-championing-hidden-vineyards-and-honest-stories-562.htm';

// Socials
const IG_HANDLE      = '@vneimporters';
const FB_HANDLE      = '@vneimporters';
const IG_URL         = 'https://instagram.com/vneimporters';
const FB_URL         = 'https://facebook.com/vneimporters';
const LINKEDIN_URL   = 'https://www.linkedin.com/company/vneimporters/';

// Gemini
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

// Notifications
const ADMIN_EMAILS = [VNE_EMAIL];
const REPS_EMAILS = (PropertiesService.getScriptProperties()
  .getProperty('REPS_LIST') || '')
  .split(',')
  .map(e => e.trim())
  .filter(e => e);

// Allowed statuses
const ALLOWED_STATUS = new Set([
  'Lead','Contact','Offerings','Contracting','Onboarded','Blocked','Follow Up','Loss','No Response','Met with','ON HOLD - RISK','ACTIVE'
]);

// Skip outreach statuses
const SKIP_STATUSES = new Set([
  'blocked',
  'onboarded',
  'contracting',
  'offerings',
  'met with',
  'contacted',
  'no response',
  'loss'
]);

function normStatus_(s) 
  s = String(s||'').trim().toLowerCase();
  if (s.startsWith('error')) return 'error';
  return s;

// Targetable types (wine-selling establishments)
const ALLOWED_SALES_TYPES = [
  'wine bar','restaurant','bar','wine shop','grocery','bottle shop','caterer','inn/hotel','hotel','inn','venue'
];

// Free email domains
const FREE_DOMAINS = new Set([
  'gmail.com','yahoo.com','outlook.com','hotmail.com','aol.com','proton.me','icloud.com','ymail.com','live.com'
]);

// Required headers (29 columns: A-AC)
const REQUIRED_HEADERS = [
  'Business','Type','Status','Opportunity Type','POC','Role','VNE POC','Email','Phone',
  'Website','Last Contact','City','State','In Person Event?','Notes','States',
  'Personalization Insight','Establishment Type','Email Summary','Last Sent At','Opt-Out','Auto-Added','Source',
  'Follow-Up Count','Rep Targeting Notes','Priority','Seasonality Window','Blackout Reason','BTG Opportunity Notes'
];

// Expanded Outer Banks cities
const OUTER_BANKS_CITIES = [
  'Kitty Hawk','Nags Head','Kill Devil Hills','Manteo','Duck','Corolla','Southern Shores',
  'Rodanthe','Avon','Buxton','Hatteras','Frisco','Waves','Salvo','Ocracoke',
  'Moyock','Currituck','Harbinger','Poplar Branch','Grandy','Jarvisburg','Powells Point','Point Harbor',
  'Elizabeth City','Edenton','Hertford','Plymouth','Columbia','Belhaven','Washington','Bath',
  'New Bern','Morehead City','Beaufort','Atlantic Beach','Emerald Isle','Swansboro','Cedar Island'
];

// Federal holidays (no outreach 2 days before/after)
const FEDERAL_HOLIDAYS_2025 = [
  new Date('2025-01-01'), // New Year's
  new Date('2025-01-20'), // MLK Day
  new Date('2025-02-17'), // Presidents Day
  new Date('2025-05-26'), // Memorial Day
  new Date('2025-07-04'), // Independence Day
  new Date('2025-09-01'), // Labor Day
  new Date('2025-11-27'), // Thanksgiving
  new Date('2025-12-25')  // Christmas
];
