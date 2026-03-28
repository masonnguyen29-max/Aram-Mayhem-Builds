// ============================================================
//  SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = 'https://fngpjhyestdjxpxqgrmz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZ3BqaHllc3RkanhweHFncm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjgxNDEsImV4cCI6MjA5MDMwNDE0MX0.bi5UggBKKPHqbI44mV8x71CLfQP0lb7FOrGWlWvMH1g';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  AUGMENTS  (add more here as they are discovered)
// ============================================================
const AUGMENTS = {
  silver: [
    'ADAPt', 'Adamant', 'Blunt Force', 'Bread And Butter', 'Bread And Cheese',
    'Bread And Jam', 'Buff Buddies', 'Crack Open That Egg', "Crit 'n Cast",
    'Deft', 'Dive Bomber', "Don't Blink", 'Erosion', 'Escape Plan', 'EscAPADe',
    'Firefox', 'First-Aid Kit', 'Flash 2', 'Flashbang', 'Frost Wraith', 'Gash',
    'Goredrink', "Grandma's Chili Oil"
  ],
  gold: [
    'All For You', 'Apex Inventor', 'Back to Basics', 'Big Brain',
    'Biggest Snowball Ever', 'Celestial Body', 'Cheating', 'Circle of Death',
    'Courage of the Colossus', 'Critical Healing', 'Critical Missile',
    'Critical Rhythm', "Dawnbringer's Resolve", "Demon's Dance",
    'Devil on Your Shoulder', 'Divine Intervention', 'Donation', 'Double Tap',
    'Ethereal Weapon', 'Executioner', 'Firebrand', 'Flashy',
    'From Beginning to End', 'Get Excited', 'Goldrend'
  ],
  prismatic: [
    '??? (Enemy Missing)', 'Back to Basics', 'Biggest Snowball Ever', 'Blade Waltz',
    'Blunt Force', 'Bounce of the Poro King', "Can't Touch This", 'Cerberus',
    'Circle of Death', 'Clown College', 'Courage of the Colossus', 'Cruelty',
    'Dashing', 'Draw Your Sword', 'Dropkick', 'Droppybara', 'Dual Wield',
    'Earthwake', 'Eureka', 'Fan the Hammer', 'Fey Magic', 'Final Form',
    'Gash', 'Giant Slayer', 'Glass Cannon', 'Goldrend', 'Goliath'
  ]
};

// ============================================================
//  DATA DRAGON  (Riot's official static data CDN)
// ============================================================
let _ddVersion = null;
let _championsCache = null;
let _itemsCache = null;

async function getDDVersion() {
  if (_ddVersion) return _ddVersion;
  const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
  const versions = await res.json();
  _ddVersion = versions[0];
  return _ddVersion;
}

async function getChampions() {
  if (_championsCache) return _championsCache;
  const v = await getDDVersion();
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`);
  const data = await res.json();
  _championsCache = Object.values(data.data).sort((a, b) => a.name.localeCompare(b.name));
  return _championsCache;
}

async function getItems() {
  if (_itemsCache) return _itemsCache;
  const v = await getDDVersion();
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/item.json`);
  const data = await res.json();
  _itemsCache = Object.entries(data.data)
    .filter(([, item]) =>
      item.maps?.['12'] === true &&
      item.gold?.purchasable === true &&
      item.inStore !== false &&
      !item.requiredChampion &&
      item.gold?.total > 0
    )
    .map(([id, item]) => ({
      id,
      name: item.name,
      image: item.image?.full,
      gold: item.gold?.total
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _itemsCache;
}

function champImgUrl(championId) {
  return `https://ddragon.leagueoflegends.com/cdn/${_ddVersion}/img/champion/${championId}.png`;
}

function itemImgUrl(imageFilename) {
  return `https://ddragon.leagueoflegends.com/cdn/${_ddVersion}/img/item/${imageFilename}`;
}

// ============================================================
//  DATABASE HELPERS
// ============================================================
async function getBuildsForChampion(championId) {
  const { data, error } = await db
    .from('builds')
    .select('*')
    .eq('champion_id', championId)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function submitBuild(build) {
  const { data, error } = await db.from('builds').insert([build]).select();
  if (error) throw error;
  return data;
}

// ============================================================
//  UTILITIES
// ============================================================
function starsHTML(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function timeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}
