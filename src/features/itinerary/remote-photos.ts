const KUALA_LUMPUR_HERO = 'https://images.pexels.com/photos/32644036/pexels-photo-32644036/free-photo-of-kuala-lumpur-skyline-featuring-petronas-towers.jpeg?auto=compress&fit=crop&w=1400&q=82';
const PETRONAS = 'https://upload.wikimedia.org/wikipedia/commons/0/04/The_Petronas_Twin_Towers_in_Kuala_Lumpur_%28Malaysia%29.JPG';
const JALAN_ALOR = 'https://upload.wikimedia.org/wikipedia/commons/d/db/Jalan_Alor_-_Kuala_Lumpur.jpg';

function stableSeed(value: string) {
  let seed = 17;
  for (const character of value) seed = (seed * 31 + character.charCodeAt(0)) % 10_000;
  return seed;
}

function discoveryUrl(query: string, width: number, height: number) {
  const cleaned = query.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').trim().replace(/\s+/g, ',');
  return `https://loremflickr.com/${width}/${height}/${encodeURIComponent(cleaned || 'travel,destination')}?lock=${stableSeed(query)}`;
}

export function destinationPhotoUrl(destination: string) {
  if (destination.toLowerCase().includes('kuala lumpur')) return KUALA_LUMPUR_HERO;
  return discoveryUrl(`${destination} skyline travel`, 1200, 720);
}

export function activityPhotoUrl(destination: string, title: string, tags: string[]) {
  const search = `${title} ${tags.join(' ')}`.toLowerCase();
  if (destination.toLowerCase().includes('kuala lumpur') && /(petronas|twin tower|klcc|city overview)/.test(search)) return PETRONAS;
  if (destination.toLowerCase().includes('kuala lumpur') && /(jalan alor|food|market|dining)/.test(search)) return JALAN_ALOR;
  return discoveryUrl(`${destination} ${title} ${tags.slice(0, 2).join(' ')}`, 640, 640);
}

export function photoFallbackUrl(seed: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/640`;
}
