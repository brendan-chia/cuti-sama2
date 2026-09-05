import type { QuestCountryCode } from './quest';

export type Attraction = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  description: string;
  sourceUrl?: string;
};

export type Country = {
  code: QuestCountryCode;
  name: string;
  flag: string;
  tagline: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  zoom: number;
  attractions: Attraction[];
};

type Stop = [slug: string, name: string, category: string, latitude: number, longitude: number, description: string, sourceUrl?: string];
const heritage = (id: number) => `https://whc.unesco.org/en/list/${id}/`;

// Representative discovery coordinates, not entrance locations or navigation directions.
// UNESCO property records and the linked attraction operators provide the location references.
function country(code: QuestCountryCode, name: string, flag: string, tagline: string, latitude: number, longitude: number, zoom: number, stops: Stop[], photo?: string): Country {
  return {
    code, name, flag, tagline, latitude, longitude, zoom,
    imageUrl: photo
      ? `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1200&q=80`
      : `https://loremflickr.com/1200/800/${encodeURIComponent(name)},landscape?lock=${code.charCodeAt(0) * 100 + code.charCodeAt(1)}`,
    attractions: stops.map(([slug, stopName, category, lat, lon, description, sourceUrl]) => ({
      id: `${code.toLowerCase()}-${slug}`, name: stopName, category, latitude: lat, longitude: lon, description, sourceUrl,
    })),
  };
}

export const countries: Country[] = [
  country('MY', 'Malaysia', '🇲🇾', 'City lights, rainforest trails, and a table for everyone.', 4.2, 109.5, 4, [
    ['petronas-towers', 'Petronas Twin Towers', 'City', 3.1579, 101.7117, 'See Kuala Lumpur from its unmistakable twin towers.', 'https://www.petronastwintowers.com.my/'],
    ['george-town', 'George Town', 'Culture', 5.4141, 100.3288, 'Explore heritage streets and Penang food stops.', heritage(1223)],
    ['kinabalu-park', 'Kinabalu Park', 'Nature', 6.147, 116.642, 'Make room for mountain views and Borneo rainforest.', heritage(1012)],
  ], 'photo-1596422846543-75c6fc197f07'),
  country('TH', 'Thailand', '🇹🇭', 'Golden temples, street food, and island days.', 15.5, 101, 5, [
    ['wat-arun', 'Wat Arun', 'Culture', 13.7437, 100.4889, 'Visit the riverside temple on Bangkok’s Chao Phraya.', 'https://www.tourismthailand.org/Attraction/wat-arun-ratchawararam-ratchawaramahawihan'],
    ['ayutthaya', 'Ayutthaya Historical Park', 'History', 14.356, 100.558, 'Wander temple ruins in Thailand’s former capital.', heritage(576)],
    ['sukhothai', 'Sukhothai Historical Park', 'History', 17.016, 99.703, 'Discover old temples, lotus ponds, and spacious grounds.', heritage(574)],
  ], 'photo-1508009603885-50cf7c579365'),
  country('ID', 'Indonesia', '🇮🇩', 'Temple mornings and a whole archipelago to explore.', -3, 117, 4, [
    ['borobudur', 'Borobudur', 'Culture', -7.6079, 110.2038, 'Discover the stone terraces of Java’s Buddhist monument.', heritage(592)],
    ['prambanan', 'Prambanan', 'Culture', -7.752, 110.4915, 'Explore the towering Hindu temple compound near Yogyakarta.', heritage(642)],
    ['komodo', 'Komodo National Park', 'Nature', -8.55, 119.4833, 'Add volcanic island scenery and marine landscapes.', heritage(609)],
  ], 'photo-1537996194471-e657df975ab4'),
  country('VN', 'Vietnam', '🇻🇳', 'Lantern-lit evenings and limestone horizons.', 16.2, 106.3, 5, [
    ['ha-long-bay', 'Ha Long Bay', 'Nature', 20.91, 107.183, 'Picture limestone islands rising out of the bay.', heritage(672)],
    ['hoi-an', 'Hoi An Ancient Town', 'Culture', 15.8801, 108.338, 'Explore riverside lanes and historic merchant houses.', heritage(948)],
    ['my-son', 'My Son Sanctuary', 'History', 15.7642, 108.1242, 'Discover Cham temple ruins in a green valley.', heritage(949)],
  ], 'photo-1528127269322-539801943592'),
  country('JP', 'Japan', '🇯🇵', 'Shrine paths, city discoveries, and mountain air.', 37, 138, 5, [
    ['fushimi-inari', 'Fushimi Inari Taisha', 'Culture', 34.9671, 135.7727, 'Follow Kyoto’s paths through vermilion torii gates.', 'https://www.japan.travel/en/spot/1128/'],
    ['sensoji', 'Sensoji Temple', 'Culture', 35.7148, 139.7967, 'Explore Asakusa’s temple grounds and shopping streets.', 'https://www.japan.travel/en/spot/1691/'],
    ['mount-fuji', 'Mount Fuji', 'Nature', 35.3606, 138.7274, 'Give Japan’s iconic mountain a place on your wish list.', heritage(1418)],
  ], 'photo-1493976040374-85c8e12f0c0e'),
  country('KR', 'South Korea', '🇰🇷', 'Palace walks, creative cities, and volcanic coastlines.', 36.2, 127.8, 6, [
    ['changdeokgung', 'Changdeokgung Palace', 'Culture', 37.5794, 126.991, 'Explore a royal palace in the heart of Seoul.', heritage(816)],
    ['bulguksa', 'Bulguksa Temple', 'Culture', 35.79, 129.332, 'Discover Gyeongju’s temple courtyards and stone pagodas.', heritage(736)],
    ['seongsan-ilchulbong', 'Seongsan Ilchulbong', 'Nature', 33.4581, 126.9425, 'See the volcanic tuff cone on Jeju’s eastern coast.', heritage(1264)],
  ], 'photo-1517154421773-0529f29ea451'),
  country('SG', 'Singapore', '🇸🇬', 'Garden adventures with a side of hawker food.', 1.34, 103.82, 10, [
    ['gardens-by-the-bay', 'Gardens by the Bay', 'Nature', 1.2816, 103.8636, 'Explore the gardens and Supertrees beside Marina Bay.', 'https://www.gardensbythebay.com.sg/'],
    ['merlion-park', 'Merlion Park', 'City', 1.2868, 103.8545, 'Stop by Singapore’s waterfront landmark.', 'https://www.visitsingapore.com/see-do-singapore/recreation-leisure/viewpoints/merlion-park/'],
    ['botanic-gardens', 'Singapore Botanic Gardens', 'Nature', 1.3138, 103.8159, 'Take a slower walk through tropical garden collections.', heritage(1483)],
  ], 'photo-1525625293386-3f8f99389edd'),
  country('TW', 'Taiwan', '🇹🇼', 'Night-market energy and green mountain escapes.', 23.7, 121, 7, [
    ['taipei-101', 'Taipei 101', 'City', 25.0339, 121.5645, 'Look across Taipei from its signature skyscraper.', 'https://www.taipei-101.com.tw/en/'],
    ['sun-moon-lake', 'Sun Moon Lake', 'Nature', 23.865, 120.915, 'Plan a lakeside break among the central mountains.', 'https://www.sunmoonlake.gov.tw/en'],
    ['national-palace-museum', 'National Palace Museum', 'Culture', 25.1024, 121.5485, 'Explore art and historical objects in Taipei.', 'https://www.npm.gov.tw/?l=2'],
  ]),
  country('PH', 'Philippines', '🇵🇭', 'Reef blues, rice terraces, and island adventures.', 12.7, 122, 5, [
    ['tubbataha', 'Tubbataha Reefs', 'Nature', 8.9533, 119.8675, 'Dream up a marine adventure in the Sulu Sea.', heritage(653)],
    ['batad-rice-terraces', 'Batad Rice Terraces', 'Nature', 16.922, 121.136, 'See mountainsides shaped into remarkable rice terraces.', heritage(722)],
    ['underground-river', 'Puerto Princesa Underground River', 'Nature', 10.2, 118.9167, 'Discover Palawan’s limestone cave and river landscape.', heritage(652)],
  ]),
  country('KH', 'Cambodia', '🇰🇭', 'Temple discoveries and stories carved in stone.', 12.8, 104.9, 6, [
    ['angkor-wat', 'Angkor Wat', 'Culture', 13.4125, 103.867, 'Explore the monumental temple near Siem Reap.', heritage(668)],
    ['preah-vihear', 'Preah Vihear Temple', 'History', 14.3906, 104.6803, 'Discover the temple on the Dangrek mountain edge.', heritage(1224)],
    ['sambor-prei-kuk', 'Sambor Prei Kuk', 'History', 12.8667, 105.05, 'Visit ancient brick sanctuaries among the trees.', heritage(1532)],
  ]),
  country('LA', 'Laos', '🇱🇦', 'River towns, quiet temples, and slower days.', 18.4, 103.3, 6, [
    ['luang-prabang', 'Luang Prabang', 'Culture', 19.89, 102.135, 'Explore temple streets where the Mekong and Nam Khan meet.', heritage(479)],
    ['vat-phou', 'Vat Phou', 'History', 14.8483, 105.8222, 'Discover a Khmer sanctuary below the mountain.', heritage(481)],
    ['plain-of-jars', 'Plain of Jars', 'History', 19.431, 103.153, 'See the ancient stone jars of Xiengkhuang.', heritage(1587)],
  ]),
  country('IN', 'India', '🇮🇳', 'Grand monuments, layered history, and bold flavours.', 23.5, 80, 4, [
    ['taj-mahal', 'Taj Mahal', 'Culture', 27.1751, 78.0421, 'See Agra’s marble mausoleum beside the Yamuna.', heritage(252)],
    ['agra-fort', 'Agra Fort', 'History', 27.1795, 78.0211, 'Explore the palaces behind the fort’s red walls.', heritage(251)],
    ['ajanta-caves', 'Ajanta Caves', 'Culture', 20.5525, 75.7033, 'Discover rock-cut Buddhist caves and wall paintings.', heritage(242)],
  ]),
  country('LK', 'Sri Lanka', '🇱🇰', 'Rock fortresses, tea-country roads, and coastal walks.', 7.8, 80.7, 7, [
    ['sigiriya', 'Sigiriya', 'History', 7.957, 80.7603, 'Explore the gardens and rock fortress of Sigiriya.', heritage(202)],
    ['kandy', 'Sacred City of Kandy', 'Culture', 7.2936, 80.6413, 'Visit the lakeside city and Temple of the Tooth precinct.', heritage(450)],
    ['galle-fort', 'Galle Fort', 'History', 6.0267, 80.217, 'Walk the coastal fort and its historic streets.', heritage(451)],
  ]),
  country('NP', 'Nepal', '🇳🇵', 'Himalayan horizons and sacred places.', 28.2, 84.3, 6, [
    ['lumbini', 'Lumbini', 'Culture', 27.4694, 83.2756, 'Explore the gardens around the birthplace of Buddha.', heritage(666)],
    ['sagarmatha', 'Sagarmatha National Park', 'Nature', 27.9653, 86.9131, 'Add the dramatic Everest region to your adventure ideas.', heritage(120)],
    ['chitwan', 'Chitwan National Park', 'Nature', 27.5, 84.3333, 'Discover the forest and grassland landscapes of the Terai.', heritage(284)],
  ]),
  country('AU', 'Australia', '🇦🇺', 'Harbour days, reef adventures, and wide-open space.', -26, 134, 3, [
    ['sydney-opera-house', 'Sydney Opera House', 'Culture', -33.8568, 151.2153, 'Put Sydney’s harbour-side landmark on the map.', heritage(166)],
    ['great-barrier-reef', 'Great Barrier Reef', 'Nature', -18.2861, 147.7, 'Plan a reef experience off Queensland’s coast.', heritage(154)],
    ['royal-exhibition-building', 'Royal Exhibition Building', 'Culture', -37.8047, 144.9717, 'Explore Melbourne’s grand exhibition building and gardens.', heritage(1131)],
  ], 'photo-1506973035872-a4ec16b8e8d9'),
  country('NZ', 'New Zealand', '🇳🇿', 'Volcanic trails, glowworm caves, and fjord views.', -41, 173, 5, [
    ['tongariro', 'Tongariro National Park', 'Nature', -39.2, 175.5833, 'Discover volcanic landscapes in the central North Island.', heritage(421)],
    ['milford-sound', 'Milford Sound / Piopiotahi', 'Nature', -44.671, 167.925, 'Make room for the dramatic cliffs of Fiordland.', 'https://www.doc.govt.nz/parks-and-recreation/places-to-go/fiordland/places/milford-sound-piopiotahi/'],
    ['waitomo-caves', 'Waitomo Glowworm Caves', 'Nature', -38.2608, 175.1031, 'Discover the limestone caves beneath Waitomo.', 'https://www.waitomo.com/glowworms-and-caves/waitomo-glowworm-caves'],
  ], 'photo-1469521669194-babb45599def'),
  country('GB', 'United Kingdom', '🇬🇧', 'Castle stories, ancient stones, and city strolls.', 54.5, -3, 5, [
    ['tower-of-london', 'Tower of London', 'History', 51.5081, -0.0759, 'Explore the fortress on the banks of the Thames.', heritage(488)],
    ['stonehenge', 'Stonehenge', 'History', 51.1789, -1.8262, 'See the prehistoric stone circle on Salisbury Plain.', heritage(373)],
    ['edinburgh-old-town', 'Edinburgh Old Town', 'Culture', 55.9497, -3.1909, 'Wander historic streets along Edinburgh’s Royal Mile.', heritage(728)],
  ], 'photo-1513635269975-59663e0ac1ad'),
  country('FR', 'France', '🇫🇷', 'Riverside walks, beautiful gardens, and long lunches.', 46.8, 2.3, 5, [
    ['eiffel-tower', 'Eiffel Tower', 'City', 48.8584, 2.2945, 'See the Paris landmark beside the Seine.', 'https://www.toureiffel.paris/en'],
    ['mont-saint-michel', 'Mont-Saint-Michel', 'History', 48.636, -1.5114, 'Discover the abbey rising above a tidal bay.', heritage(80)],
    ['versailles', 'Palace of Versailles', 'Culture', 48.8049, 2.1204, 'Explore the palace and its expansive formal gardens.', heritage(83)],
  ], 'photo-1502602898657-3e91760cbb34'),
  country('IT', 'Italy', '🇮🇹', 'Ancient streets, piazza breaks, and one more gelato.', 42.8, 12.5, 5, [
    ['colosseum', 'Colosseum', 'History', 41.8902, 12.4922, 'Discover Rome’s ancient amphitheatre.', 'https://colosseo.it/en/'],
    ['leaning-tower', 'Leaning Tower of Pisa', 'Culture', 43.723, 10.3966, 'Explore Pisa’s cathedral square and famous tower.', heritage(395)],
    ['pompeii', 'Pompeii', 'History', 40.7508, 14.4869, 'Walk the excavated streets of the Roman city.', heritage(829)],
  ], 'photo-1515542622106-78bda8ba0e5b'),
  country('ES', 'Spain', '🇪🇸', 'Extraordinary architecture and unhurried evenings.', 40, -3.5, 5, [
    ['sagrada-familia', 'Sagrada Família', 'Culture', 41.4036, 2.1744, 'Discover Gaudí’s basilica in Barcelona.', 'https://sagradafamilia.org/en/'],
    ['alhambra', 'Alhambra', 'History', 37.1761, -3.5881, 'Explore Granada’s palace complex and gardens.', heritage(314)],
    ['cordoba-mosque-cathedral', 'Mosque-Cathedral of Córdoba', 'Culture', 37.8789, -4.7794, 'See Córdoba’s celebrated arches and historic centre.', heritage(313)],
  ], 'photo-1539037116277-4db20889f2d4'),
  country('TR', 'Türkiye', '🇹🇷', 'City stories, cave valleys, and bright blue coastlines.', 39, 35, 5, [
    ['hagia-sophia', 'Hagia Sophia', 'Culture', 41.0086, 28.9802, 'Visit a defining landmark of historic Istanbul.', heritage(356)],
    ['goreme', 'Göreme', 'Nature', 38.6431, 34.8289, 'Explore Cappadocia’s rock formations and cave heritage.', heritage(357)],
    ['pamukkale', 'Pamukkale', 'Nature', 37.9204, 29.121, 'See white mineral terraces beside ancient Hierapolis.', heritage(485)],
  ], 'photo-1541432901042-2d8bd64b4a9b'),
  country('AE', 'United Arab Emirates', '🇦🇪', 'Skyline moments, desert light, and oasis walks.', 24, 54.2, 6, [
    ['burj-khalifa', 'Burj Khalifa', 'City', 25.1972, 55.2744, 'Take in the skyline from Dubai’s landmark tower.', 'https://www.burjkhalifa.ae/'],
    ['sheikh-zayed-mosque', 'Sheikh Zayed Grand Mosque', 'Culture', 24.4128, 54.4749, 'Discover the mosque’s courtyards and architecture in Abu Dhabi.', 'https://www.szgmc.gov.ae/en/'],
    ['al-ain-oasis', 'Al Ain Oasis', 'Nature', 24.2173, 55.7614, 'Walk shaded paths through a historic date-palm oasis.', heritage(1343)],
  ], 'photo-1512453979798-5ea266f8880c'),
  country('US', 'United States', '🇺🇸', 'Big landscapes and city moments worth sharing.', 39, -98, 3, [
    ['statue-of-liberty', 'Statue of Liberty', 'History', 40.6892, -74.0445, 'See the New York Harbor landmark on Liberty Island.', heritage(307)],
    ['grand-canyon', 'Grand Canyon', 'Nature', 36.1008, -112.0906, 'Discover the immense canyon landscape in Arizona.', heritage(75)],
    ['yellowstone', 'Yellowstone National Park', 'Nature', 44.46, -110.828, 'Make room for geysers and volcanic landscapes.', 'https://www.nps.gov/yell/index.htm'],
  ], 'photo-1485738422979-f5c462d49f74'),
  country('CA', 'Canada', '🇨🇦', 'Mountain lakes, heritage streets, and fresh air.', 56, -106, 2, [
    ['lake-louise', 'Lake Louise', 'Nature', 51.4167, -116.2167, 'Discover the lake and mountain scenery of Banff.', 'https://parks.canada.ca/pn-np/ab/banff/visit/les10-top10/louise'],
    ['old-quebec', 'Old Québec', 'Culture', 46.8139, -71.2075, 'Explore the fortified city’s streets beside the St Lawrence.', heritage(300)],
    ['rideau-canal', 'Rideau Canal', 'History', 45.425, -75.697, 'Take a canalside walk through Ottawa’s historic locks.', heritage(1221)],
  ], 'photo-1503614472-8c93d56e92ce'),
];

export function countryByCode(code: string | null | undefined): Country | undefined {
  return countries.find((item) => item.code === code?.toUpperCase());
}

const countryAliases: Partial<Record<QuestCountryCode, string[]>> = {
  GB: ['UK', 'United Kingdom', 'Great Britain', 'Britain'],
  US: ['USA', 'United States of America', 'America'],
  AE: ['UAE', 'Emirates'],
  TR: ['Turkey', 'Turkiye'],
  KR: ['Korea', 'Republic of Korea'],
  VN: ['Viet Nam'],
  LA: ['Lao PDR'],
};

const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim().toLowerCase();

export function searchCountries(query: string): Country[] {
  const term = normalizeSearch(query);
  return countries.filter((item) => normalizeSearch(item.code) === term
    || [item.name, ...(countryAliases[item.code] ?? [])].some((name) => normalizeSearch(name).includes(term)));
}
