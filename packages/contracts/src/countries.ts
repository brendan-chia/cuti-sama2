import type { QuestCountryCode } from './quest';
import { bundledPlanningMetadata, type AttractionPlanningMetadata } from './attraction-planning';

export type Attraction = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  description: string;
  sourceUrl?: string;
} & Partial<AttractionPlanningMetadata>;

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
      id: `${code.toLowerCase()}-${slug}`, name: stopName, category, latitude: lat, longitude: lon, description, sourceUrl, ...bundledPlanningMetadata(code.toLowerCase() + '-' + slug, code, category),
    })),
  };
}

export const countries: Country[] = [
  country('MY', 'Malaysia', '🇲🇾', 'City lights, rainforest trails, and a table for everyone.', 4.2, 109.5, 4, [
    ["exchange-trx", "The Exchange TRX", "Shopping", 3.1425, 101.7188, "Browse contemporary brands, stop for food, and unwind in the rooftop city park.", "https://www.theexchange.my/"],
    ["sunway-lagoon", "Sunway Lagoon", "Theme park", 3.0696, 101.6073, "Make a day of water slides, rides, and group-friendly adventures near Kuala Lumpur.", "https://sunwaylagoon.com/"],
    ['petronas-towers', 'Petronas Twin Towers', 'City', 3.1579, 101.7117, 'See Kuala Lumpur from its unmistakable twin towers.', 'https://www.petronastwintowers.com.my/'],
    ['george-town', 'George Town', 'Culture', 5.4141, 100.3288, 'Explore heritage streets and Penang food stops.', heritage(1223)],
    ['kinabalu-park', 'Kinabalu Park', 'Nature', 6.147, 116.642, 'Make room for mountain views and Borneo rainforest.', heritage(1012)],
  ], 'photo-1596422846543-75c6fc197f07'),
  country('TH', 'Thailand', '🇹🇭', 'Golden temples, street food, and island days.', 15.5, 101, 5, [
    ["iconsiam", "ICONSIAM", "Shopping", 13.7265, 100.5103, "Combine riverside shopping, Thai food, and skyline photos in Bangkok.", "https://www.iconsiam.com/en"],
    ["mahanakhon-skywalk", "Mahanakhon SkyWalk", "City", 13.7235, 100.5283, "Head above Bangkok for panoramic views and the glass-floor experience.", "https://kingpowermahanakhon.co.th/"],
    ['wat-arun', 'Wat Arun', 'Culture', 13.7437, 100.4889, 'Visit the riverside temple on Bangkok’s Chao Phraya.', 'https://www.tourismthailand.org/Attraction/wat-arun-ratchawararam-ratchawaramahawihan'],
    ['ayutthaya', 'Ayutthaya Historical Park', 'History', 14.356, 100.558, 'Wander temple ruins in Thailand’s former capital.', heritage(576)],
    ['sukhothai', 'Sukhothai Historical Park', 'History', 17.016, 99.703, 'Discover old temples, lotus ponds, and spacious grounds.', heritage(574)],
  ], 'photo-1508009603885-50cf7c579365'),
  country('ID', 'Indonesia', '🇮🇩', 'Temple mornings and a whole archipelago to explore.', -3, 117, 4, [
    ["waterbom-bali", "Waterbom Bali", "Theme park", -8.7286, 115.1693, "Cool off with water slides and tropical pools in Kuta.", "https://www.waterbom-bali.com/"],
    ["grand-indonesia", "Grand Indonesia", "Shopping", -6.195, 106.8208, "Explore Jakarta shopping, restaurants, and an easy indoor city break.", "https://www.grand-indonesia.com/"],
    ['borobudur', 'Borobudur', 'Culture', -7.6079, 110.2038, 'Discover the stone terraces of Java’s Buddhist monument.', heritage(592)],
    ['prambanan', 'Prambanan', 'Culture', -7.752, 110.4915, 'Explore the towering Hindu temple compound near Yogyakarta.', heritage(642)],
    ['komodo', 'Komodo National Park', 'Nature', -8.55, 119.4833, 'Add volcanic island scenery and marine landscapes.', heritage(609)],
  ], 'photo-1537996194471-e657df975ab4'),
  country('VN', 'Vietnam', '🇻🇳', 'Lantern-lit evenings and limestone horizons.', 16.2, 106.3, 5, [
    ["ba-na-hills", "Ba Na Hills & Golden Bridge", "Entertainment", 15.995, 107.996, "Ride into the hills for the Golden Bridge, mountain views, and amusement attractions.", "https://www.vietnam.travel/things-to-do/explore-ba-na-hills"],
    ["vinwonders-phu-quoc", "VinWonders Phu Quoc", "Theme park", 10.3388, 103.8915, "Add rides, themed worlds, and water-park fun to an island trip.", "https://vinwonders.com/en/vinwonders-phu-quoc/"],
    ['ha-long-bay', 'Ha Long Bay', 'Nature', 20.91, 107.183, 'Picture limestone islands rising out of the bay.', heritage(672)],
    ['hoi-an', 'Hoi An Ancient Town', 'Culture', 15.8801, 108.338, 'Explore riverside lanes and historic merchant houses.', heritage(948)],
    ['my-son', 'My Son Sanctuary', 'History', 15.7642, 108.1242, 'Discover Cham temple ruins in a green valley.', heritage(949)],
  ], 'photo-1528127269322-539801943592'),
  country('JP', 'Japan', '🇯🇵', 'Shrine paths, city discoveries, and mountain air.', 37, 138, 5, [
    ["teamlab-borderless", "teamLab Borderless, Azabudai Hills", "Immersive art", 35.6605, 139.741, "Step into connected digital artworks and immersive light installations in Tokyo.", "https://www.teamlab.art/e/tokyo/"],
    ["shibuya-sky", "SHIBUYA SKY", "City", 35.6585, 139.7022, "Take in Tokyo from the rooftop above Shibuya Scramble Square.", "https://www.gotokyo.org/en/spot/1749/index.html"],
    ['fushimi-inari', 'Fushimi Inari Taisha', 'Culture', 34.9671, 135.7727, 'Follow Kyoto’s paths through vermilion torii gates.', 'https://www.japan.travel/en/spot/1128/'],
    ['sensoji', 'Sensoji Temple', 'Culture', 35.7148, 139.7967, 'Explore Asakusa’s temple grounds and shopping streets.', 'https://www.japan.travel/en/spot/1691/'],
    ['mount-fuji', 'Mount Fuji', 'Nature', 35.3606, 138.7274, 'Give Japan’s iconic mountain a place on your wish list.', heritage(1418)],
  ], 'photo-1493976040374-85c8e12f0c0e'),
  country('KR', 'South Korea', '🇰🇷', 'Palace walks, creative cities, and volcanic coastlines.', 36.2, 127.8, 6, [
    ["seongsu-dong", "Seongsu-dong", "Cafes & shopping", 37.5445, 127.0557, "Cafe-hop through converted factories, concept stores, and creative streets in Seoul.", "https://english.visitseoul.net/editorspicks/2026-Seongsu/ENNky3epf"],
    ["lotte-world", "Lotte World Adventure", "Theme park", 37.5111, 127.0982, "Mix indoor rides and outdoor thrills into a Seoul city break.", "https://adventure.lotteworld.com/eng/main/index.do"],
    ['changdeokgung', 'Changdeokgung Palace', 'Culture', 37.5794, 126.991, 'Explore a royal palace in the heart of Seoul.', heritage(816)],
    ['bulguksa', 'Bulguksa Temple', 'Culture', 35.79, 129.332, 'Discover Gyeongju’s temple courtyards and stone pagodas.', heritage(736)],
    ['seongsan-ilchulbong', 'Seongsan Ilchulbong', 'Nature', 33.4581, 126.9425, 'See the volcanic tuff cone on Jeju’s eastern coast.', heritage(1264)],
  ], 'photo-1517154421773-0529f29ea451'),
  country('SG', 'Singapore', '🇸🇬', 'Garden adventures with a side of hawker food.', 1.34, 103.82, 10, [
    ["jewel-changi", "Jewel Changi Airport", "City", 1.3602, 103.9898, "See the Rain Vortex, explore indoor gardens, and browse shops and dining.", "https://www.jewelchangiairport.com/"],
    ["universal-studios", "Universal Studios Singapore", "Theme park", 1.254, 103.8238, "Spend a Sentosa day on movie-themed rides and entertainment.", "https://www.rwsentosa.com/en/play/universal-studios-singapore"],
    ['gardens-by-the-bay', 'Gardens by the Bay', 'Nature', 1.2816, 103.8636, 'Explore the gardens and Supertrees beside Marina Bay.', 'https://www.gardensbythebay.com.sg/'],
    ['merlion-park', 'Merlion Park', 'City', 1.2868, 103.8545, 'Stop by Singapore’s waterfront landmark.', 'https://www.visitsingapore.com/see-do-singapore/recreation-leisure/viewpoints/merlion-park/'],
    ['botanic-gardens', 'Singapore Botanic Gardens', 'Nature', 1.3138, 103.8159, 'Take a slower walk through tropical garden collections.', heritage(1483)],
  ], 'photo-1525625293386-3f8f99389edd'),
  country('TW', 'Taiwan', '🇹🇼', 'Night-market energy and green mountain escapes.', 23.7, 121, 7, [
    ["ximending", "Ximending", "Shopping", 25.0422, 121.5077, "Explore Taipei street fashion, anime shops, snacks, and bright pedestrian streets.", "https://www.travel.taipei/en/attraction/details/1694"],
    ["raohe-night-market", "Raohe Street Night Market", "Food", 25.0509, 121.5775, "Share a snack crawl through one of Taipei’s established night markets.", "https://travel.taipei/en/attraction/details/1691"],
    ['taipei-101', 'Taipei 101', 'City', 25.0339, 121.5645, 'Look across Taipei from its signature skyscraper.', 'https://www.taipei-101.com.tw/en/'],
    ['sun-moon-lake', 'Sun Moon Lake', 'Nature', 23.865, 120.915, 'Plan a lakeside break among the central mountains.', 'https://www.sunmoonlake.gov.tw/en'],
    ['national-palace-museum', 'National Palace Museum', 'Culture', 25.1024, 121.5485, 'Explore art and historical objects in Taipei.', 'https://www.npm.gov.tw/?l=2'],
  ], 'photo-1572715381359-002b1eabd56b'),
  country('PH', 'Philippines', '🇵🇭', 'Reef blues, rice terraces, and island adventures.', 12.7, 122, 5, [
    ["enchanted-kingdom", "Enchanted Kingdom", "Theme park", 14.2826, 121.0977, "Plan a day of rides and entertainment in Santa Rosa, south of Manila.", "https://www.enchantedkingdom.ph/"],
    ["manila-ocean-park", "Manila Ocean Park", "Entertainment", 14.5792, 120.9721, "Explore marine exhibits and indoor attractions beside Manila Bay.", "https://manilaoceanpark.com/"],
    ['tubbataha', 'Tubbataha Reefs', 'Nature', 8.9533, 119.8675, 'Dream up a marine adventure in the Sulu Sea.', heritage(653)],
    ['batad-rice-terraces', 'Batad Rice Terraces', 'Nature', 16.922, 121.136, 'See mountainsides shaped into remarkable rice terraces.', heritage(722)],
    ['underground-river', 'Puerto Princesa Underground River', 'Nature', 10.2, 118.9167, 'Discover Palawan’s limestone cave and river landscape.', heritage(652)],
  ], 'photo-1658694532749-ba717cad8efd'),
  country('KH', 'Cambodia', '🇰🇭', 'Temple discoveries and stories carved in stone.', 12.8, 104.9, 6, [
    ["phare-circus", "Phare, The Cambodian Circus", "Entertainment", 13.3557, 103.8447, "Enjoy contemporary circus, acrobatics, and storytelling in Siem Reap.", "https://pharecircus.org/"],
    ["aeon-mall-phnom-penh", "AEON Mall Phnom Penh", "Shopping", 11.5479, 104.9339, "Take a city break for shopping, restaurants, and indoor entertainment.", "https://www.aeonmallcambodia.com/"],
    ['angkor-wat', 'Angkor Wat', 'Culture', 13.4125, 103.867, 'Explore the monumental temple near Siem Reap.', heritage(668)],
    ['preah-vihear', 'Preah Vihear Temple', 'History', 14.3906, 104.6803, 'Discover the temple on the Dangrek mountain edge.', heritage(1224)],
    ['sambor-prei-kuk', 'Sambor Prei Kuk', 'History', 12.8667, 105.05, 'Visit ancient brick sanctuaries among the trees.', heritage(1532)],
  ]),
  country('LA', 'Laos', '🇱🇦', 'River towns, quiet temples, and slower days.', 18.4, 103.3, 6, [
    ["vang-vieng", "Vang Vieng", "Adventure", 18.9242, 102.4478, "Base an outdoor day around riverside scenery, kayaking, and nearby lagoons.", "https://www.tourismlaos.org/central-provinces/vientiane-province/"],
    ["vientiane-night-market", "Vientiane Night Market", "Shopping", 17.9625, 102.6026, "Browse evening stalls beside the Mekong and enjoy a waterfront stroll.", "https://www.tourismlaos.org/central-provinces/vientiane-capital/"],
    ['luang-prabang', 'Luang Prabang', 'Culture', 19.89, 102.135, 'Explore temple streets where the Mekong and Nam Khan meet.', heritage(479)],
    ['vat-phou', 'Vat Phou', 'History', 14.8483, 105.8222, 'Discover a Khmer sanctuary below the mountain.', heritage(481)],
    ['plain-of-jars', 'Plain of Jars', 'History', 19.431, 103.153, 'See the ancient stone jars of Xiengkhuang.', heritage(1587)],
  ]),
  country('IN', 'India', '🇮🇳', 'Grand monuments, layered history, and bold flavours.', 23.5, 80, 4, [
    ["wonderla-bengaluru", "Wonderla Bengaluru", "Theme park", 12.834, 77.4009, "Add roller coasters and water rides to a Bengaluru getaway.", "https://www.wonderla.com/"],
    ["imagicaa", "Imagicaa", "Entertainment", 18.7678, 73.279, "Choose theme-park thrills and water attractions near Khopoli, outside Mumbai.", "https://www.imagicaaworld.com/"],
    ['taj-mahal', 'Taj Mahal', 'Culture', 27.1751, 78.0421, 'See Agra’s marble mausoleum beside the Yamuna.', heritage(252)],
    ['agra-fort', 'Agra Fort', 'History', 27.1795, 78.0211, 'Explore the palaces behind the fort’s red walls.', heritage(251)],
    ['ajanta-caves', 'Ajanta Caves', 'Culture', 20.5525, 75.7033, 'Discover rock-cut Buddhist caves and wall paintings.', heritage(242)],
  ]),
  country('LK', 'Sri Lanka', '🇱🇰', 'Rock fortresses, tea-country roads, and coastal walks.', 7.8, 80.7, 7, [
    ["lotus-tower", "Colombo Lotus Tower", "City", 6.9272, 79.8585, "See Colombo from its contemporary skyline landmark and observation deck.", "https://colombolotustower.lk/"],
    ["colombo-city-centre", "Colombo City Centre", "Shopping", 6.9176, 79.8552, "Combine shopping, a food stop, and cinema time beside Beira Lake.", "https://www.colombocitycentre.lk/"],
    ['sigiriya', 'Sigiriya', 'History', 7.957, 80.7603, 'Explore the gardens and rock fortress of Sigiriya.', heritage(202)],
    ['kandy', 'Sacred City of Kandy', 'Culture', 7.2936, 80.6413, 'Visit the lakeside city and Temple of the Tooth precinct.', heritage(450)],
    ['galle-fort', 'Galle Fort', 'History', 6.0267, 80.217, 'Walk the coastal fort and its historic streets.', heritage(451)],
  ]),
  country('NP', 'Nepal', '🇳🇵', 'Himalayan horizons and sacred places.', 28.2, 84.3, 6, [
    ["pokhara-lakeside", "Pokhara Lakeside", "Adventure", 28.2096, 83.9595, "Mix lakeside cafes and boat outings with nearby outdoor adventures.", "https://tourism.pokharamun.gov.np/"],
    ["chandragiri-cable-car", "Chandragiri Hills Cable Car", "Adventure", 27.6868, 85.2141, "Ride from the Kathmandu Valley toward hilltop views and a mountain-air escape.", "https://www.chandragirihills.com/"],
    ['lumbini', 'Lumbini', 'Culture', 27.4694, 83.2756, 'Explore the gardens around the birthplace of Buddha.', heritage(666)],
    ['sagarmatha', 'Sagarmatha National Park', 'Nature', 27.9653, 86.9131, 'Add the dramatic Everest region to your adventure ideas.', heritage(120)],
    ['chitwan', 'Chitwan National Park', 'Nature', 27.5, 84.3333, 'Discover the forest and grassland landscapes of the Terai.', heritage(284)],
  ]),
  country('AU', 'Australia', '🇦🇺', 'Harbour days, reef adventures, and wide-open space.', -26, 134, 3, [
    ["darling-harbour", "Darling Harbour", "Food & leisure", -33.8737, 151.2006, "Build a Sydney afternoon around waterfront dining and contemporary entertainment.", "https://www.darlingharbour.com/"],
    ["movie-world", "Warner Bros. Movie World", "Theme park", -27.9073, 153.313, "Head to the Gold Coast for movie-themed rides and stunt-show entertainment.", "https://movieworld.com.au/"],
    ['sydney-opera-house', 'Sydney Opera House', 'Culture', -33.8568, 151.2153, 'Put Sydney’s harbour-side landmark on the map.', heritage(166)],
    ['great-barrier-reef', 'Great Barrier Reef', 'Nature', -18.2861, 147.7, 'Plan a reef experience off Queensland’s coast.', heritage(154)],
    ['royal-exhibition-building', 'Royal Exhibition Building', 'Culture', -37.8047, 144.9717, 'Explore Melbourne’s grand exhibition building and gardens.', heritage(1131)],
  ], 'photo-1506973035872-a4ec16b8e8d9'),
  country('NZ', 'New Zealand', '🇳🇿', 'Volcanic trails, glowworm caves, and fjord views.', -41, 173, 5, [
    ["skyline-queenstown", "Skyline Queenstown", "Adventure", -45.0267, 168.6569, "Pair gondola views with luge runs above Queenstown.", "https://queenstown.skyline.co.nz/"],
    ["hobbiton", "Hobbiton Movie Set", "Entertainment", -37.8721, 175.683, "Explore the movie-set village near Matamata on a guided experience.", "https://www.hobbitontours.com/"],
    ['tongariro', 'Tongariro National Park', 'Nature', -39.2, 175.5833, 'Discover volcanic landscapes in the central North Island.', heritage(421)],
    ['milford-sound', 'Milford Sound / Piopiotahi', 'Nature', -44.671, 167.925, 'Make room for the dramatic cliffs of Fiordland.', 'https://www.doc.govt.nz/parks-and-recreation/places-to-go/fiordland/places/milford-sound-piopiotahi/'],
    ['waitomo-caves', 'Waitomo Glowworm Caves', 'Nature', -38.2608, 175.1031, 'Discover the limestone caves beneath Waitomo.', 'https://www.waitomo.com/glowworms-and-caves/waitomo-glowworm-caves'],
  ], 'photo-1469521669194-babb45599def'),
  country('GB', 'United Kingdom', '🇬🇧', 'Castle stories, ancient stones, and city strolls.', 54.5, -3, 5, [
    ["london-eye", "London Eye", "City", 51.5033, -0.1196, "Ride above the Thames for broad views across central London.", "https://www.londoneye.com/"],
    ["warner-bros-studio", "Warner Bros. Studio Tour London", "Entertainment", 51.6904, -0.4177, "Discover Harry Potter film sets, props, and behind-the-scenes craft near Watford.", "https://www.wbstudiotour.co.uk/"],
    ['tower-of-london', 'Tower of London', 'History', 51.5081, -0.0759, 'Explore the fortress on the banks of the Thames.', heritage(488)],
    ['stonehenge', 'Stonehenge', 'History', 51.1789, -1.8262, 'See the prehistoric stone circle on Salisbury Plain.', heritage(373)],
    ['edinburgh-old-town', 'Edinburgh Old Town', 'Culture', 55.9497, -3.1909, 'Wander historic streets along Edinburgh’s Royal Mile.', heritage(728)],
  ], 'photo-1513635269975-59663e0ac1ad'),
  country('FR', 'France', '🇫🇷', 'Riverside walks, beautiful gardens, and long lunches.', 46.8, 2.3, 5, [
    ["disneyland-paris", "Disneyland Paris", "Theme park", 48.8722, 2.7758, "Set aside a day for themed rides and Disney entertainment outside Paris.", "https://www.disneylandparis.com/en-gb"],
    ["atelier-des-lumieres", "Atelier des Lumières", "Immersive art", 48.8619, 2.3801, "Experience large-scale digital art projections in a converted Paris foundry.", "https://www.atelier-lumieres.com/fr"],
    ['eiffel-tower', 'Eiffel Tower', 'City', 48.8584, 2.2945, 'See the Paris landmark beside the Seine.', 'https://www.toureiffel.paris/en'],
    ['mont-saint-michel', 'Mont-Saint-Michel', 'History', 48.636, -1.5114, 'Discover the abbey rising above a tidal bay.', heritage(80)],
    ['versailles', 'Palace of Versailles', 'Culture', 48.8049, 2.1204, 'Explore the palace and its expansive formal gardens.', heritage(83)],
  ], 'photo-1502602898657-3e91760cbb34'),
  country('IT', 'Italy', '🇮🇹', 'Ancient streets, piazza breaks, and one more gelato.', 42.8, 12.5, 5, [
    ["gardaland", "Gardaland", "Theme park", 45.4559, 10.713, "Add rides and themed attractions to a Lake Garda trip.", "https://www.gardaland.it/en/home-2/"],
    ["eataly-milano", "Eataly Milano Smeraldo", "Food", 45.4806, 9.1882, "Browse Italian ingredients and stop for a meal at this Milan food destination.", "https://www.eataly.net/eu_en/stores/milan-smeraldo"],
    ['colosseum', 'Colosseum', 'History', 41.8902, 12.4922, 'Discover Rome’s ancient amphitheatre.', 'https://colosseo.it/en/'],
    ['leaning-tower', 'Leaning Tower of Pisa', 'Culture', 43.723, 10.3966, 'Explore Pisa’s cathedral square and famous tower.', heritage(395)],
    ['pompeii', 'Pompeii', 'History', 40.7508, 14.4869, 'Walk the excavated streets of the Roman city.', heritage(829)],
  ], 'photo-1515542622106-78bda8ba0e5b'),
  country('ES', 'Spain', '🇪🇸', 'Extraordinary architecture and unhurried evenings.', 40, -3.5, 5, [
    ["portaventura", "PortAventura Park", "Theme park", 41.0877, 1.1572, "Plan a day of themed rides and shows near Salou.", "https://www.portaventuraworld.com/en"],
    ["city-arts-sciences", "City of Arts and Sciences", "Science & design", 39.4549, -0.3505, "Explore futuristic architecture and hands-on science in Valencia.", "https://www.visitvalencia.com/en/what-to-do-valencia/valencian-culture/monuments-in-valencia/ciudad-artes-ciencias-city-arts-and-sciences"],
    ['sagrada-familia', 'Sagrada Família', 'Culture', 41.4036, 2.1744, 'Discover Gaudí’s basilica in Barcelona.', 'https://sagradafamilia.org/en/'],
    ['alhambra', 'Alhambra', 'History', 37.1761, -3.5881, 'Explore Granada’s palace complex and gardens.', heritage(314)],
    ['cordoba-mosque-cathedral', 'Mosque-Cathedral of Córdoba', 'Culture', 37.8789, -4.7794, 'See Córdoba’s celebrated arches and historic centre.', heritage(313)],
  ], 'photo-1539037116277-4db20889f2d4'),
  country('TR', 'Türkiye', '🇹🇷', 'City stories, cave valleys, and bright blue coastlines.', 39, 35, 5, [
    ["galataport", "Galataport Istanbul", "Food & shopping", 41.0268, 28.9822, "Walk the Bosphorus waterfront, browse shops, and stop for a meal.", "https://galataport.com/en"],
    ["land-of-legends", "The Land of Legends", "Theme park", 36.8767, 31.0044, "Add rides, water attractions, and entertainment to a Belek holiday.", "https://www.thelandoflegends.com/en"],
    ['hagia-sophia', 'Hagia Sophia', 'Culture', 41.0086, 28.9802, 'Visit a defining landmark of historic Istanbul.', heritage(356)],
    ['goreme', 'Göreme', 'Nature', 38.6431, 34.8289, 'Explore Cappadocia’s rock formations and cave heritage.', heritage(357)],
    ['pamukkale', 'Pamukkale', 'Nature', 37.9204, 29.121, 'See white mineral terraces beside ancient Hierapolis.', heritage(485)],
  ], 'photo-1541432901042-2d8bd64b4a9b'),
  country('AE', 'United Arab Emirates', '🇦🇪', 'Skyline moments, desert light, and oasis walks.', 24, 54.2, 6, [
    ["museum-future", "Museum of the Future", "Science & design", 25.2195, 55.2818, "Explore future-focused experiences inside a distinctive Dubai landmark.", "https://museumofthefuture.ae/en"],
    ["dubai-mall", "Dubai Mall", "Shopping", 25.1972, 55.2796, "Combine shopping, restaurants, and indoor entertainment in Downtown Dubai.", "https://www.thedubaimall.com/"],
    ['burj-khalifa', 'Burj Khalifa', 'City', 25.1972, 55.2744, 'Take in the skyline from Dubai’s landmark tower.', 'https://www.burjkhalifa.ae/'],
    ['sheikh-zayed-mosque', 'Sheikh Zayed Grand Mosque', 'Culture', 24.4128, 54.4749, 'Discover the mosque’s courtyards and architecture in Abu Dhabi.', 'https://www.szgmc.gov.ae/en/'],
    ['al-ain-oasis', 'Al Ain Oasis', 'Nature', 24.2173, 55.7614, 'Walk shaded paths through a historic date-palm oasis.', heritage(1343)],
  ], 'photo-1512453979798-5ea266f8880c'),
  country('US', 'United States', '🇺🇸', 'Big landscapes and city moments worth sharing.', 39, -98, 3, [
    ["universal-orlando", "Universal Orlando Resort", "Theme park", 28.473, -81.467, "Build an Orlando getaway around film-inspired parks and entertainment.", "https://www.universalorlando.com/web/en/us"],
    ["high-line", "The High Line", "City", 40.748, -74.0048, "Walk New York’s elevated park for urban gardens, art, and city views.", "https://www.thehighline.org/"],
    ['statue-of-liberty', 'Statue of Liberty', 'History', 40.6892, -74.0445, 'See the New York Harbor landmark on Liberty Island.', heritage(307)],
    ['grand-canyon', 'Grand Canyon', 'Nature', 36.1008, -112.0906, 'Discover the immense canyon landscape in Arizona.', heritage(75)],
    ['yellowstone', 'Yellowstone National Park', 'Nature', 44.46, -110.828, 'Make room for geysers and volcanic landscapes.', 'https://www.nps.gov/yell/index.htm'],
  ], 'photo-1485738422979-f5c462d49f74'),
  country('CA', 'Canada', '🇨🇦', 'Mountain lakes, heritage streets, and fresh air.', 56, -106, 2, [
    ["cn-tower", "CN Tower", "City", 43.6426, -79.3871, "Take in Toronto and Lake Ontario from the tower’s observation areas.", "https://www.cntower.ca/"],
    ["granville-island", "Granville Island Public Market", "Food", 49.2723, -123.1353, "Browse food stalls and local makers on Vancouver’s waterfront.", "https://granvilleisland.com/"],
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
