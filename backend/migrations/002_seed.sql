-- 002_seed.sql: Realistic seed data for Eneba Marketplace clone

-- Clean existing data for idempotency
TRUNCATE TABLE homepage_blocks, digital_keys, order_items, orders, seller_offers, products, users CASCADE;

-- 1. SEED TEST USERS
-- Password for demo users is: Password123! (bcrypt hash: $2a$10$tZ2yDky2b9m/X0h7o7VpIenxJmsXoX1k1V5NsznN74L1rW9yH50eK)
INSERT INTO users (id, email, password_hash, full_name) VALUES
('a0000000-0000-0000-0000-000000000001', 'gamer@eneba-demo.com', '$2a$10$tZ2yDky2b9m/X0h7o7VpIenxJmsXoX1k1V5NsznN74L1rW9yH50eK', 'Alex Gamer'),
('a0000000-0000-0000-0000-000000000002', 'intern@eneba-demo.com', '$2a$10$tZ2yDky2b9m/X0h7o7VpIenxJmsXoX1k1V5NsznN74L1rW9yH50eK', 'Eneba Candidate');

-- 2. SEED 16 REALISTIC DIGITAL GAMES
INSERT INTO products (id, title, slug, description, cover_image_url, platform, region, genre, release_date) VALUES
(
    '11111111-0000-0000-0000-000000000001',
    'Cyberpunk 2077: Phantom Liberty Bundle',
    'cyberpunk-2077-phantom-liberty-bundle',
    'Cyberpunk 2077 is an open-world, action-adventure RPG set in the megalopolis of Night City, where you play as a cyberpunk mercenary wrapped up in a do-or-die fight for survival. Upgraded with next-gen in mind and featuring free additional content.',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'GLOBAL',
    'Action RPG',
    '2023-09-26'
),
(
    '11111111-0000-0000-0000-000000000002',
    'Elden Ring: Shadow of the Erdtree Edition',
    'elden-ring-shadow-of-the-erdtree',
    'Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between. A vast world where open fields with a variety of situations and huge dungeons with complex and three-dimensional designs are seamlessly connected.',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'GLOBAL',
    'Action RPG',
    '2024-06-21'
),
(
    '11111111-0000-0000-0000-000000000003',
    'The Witcher 3: Wild Hunt - Complete Edition',
    'the-witcher-3-wild-hunt-complete-edition',
    'You are Geralt of Rivia, mercenary monster slayer. Before you stands a war-torn, monster-infested continent you can explore at will. Your current contract? Tracking down Ciri — the Child of Prophecy, a living weapon that can alter the shape of the world.',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'EUROPE',
    'Open World RPG',
    '2022-12-14'
),
(
    '11111111-0000-0000-0000-000000000004',
    'EA SPORTS FC 25 Standard Edition',
    'ea-sports-fc-25',
    'EA SPORTS FC 25 gives you more ways to win for the club. Team up with friends in your favorite modes with the new 5v5 Rush, and manage your club to victory as FC IQ delivers more tactical control than ever before.',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    'PSN',
    'EUROPE',
    'Sports',
    '2024-09-27'
),
(
    '11111111-0000-0000-0000-000000000005',
    'Grand Theft Auto V: Premium Online Edition',
    'grand-theft-auto-v-premium-edition',
    'When a young street hustler, a retired bank robber and a terrifying psychopath land themselves in trouble, they must pull off a series of dangerous heists to survive in a city in which they can trust nobody, least of all each other.',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'GLOBAL',
    'Action Adventure',
    '2015-04-14'
),
(
    '11111111-0000-0000-0000-000000000006',
    'Helldivers 2 Super Citizen Edition',
    'helldivers-2-super-citizen',
    'The Galaxy’s Last Line of Offence. Enlist in the Helldivers and join the fight for freedom across a hostile galaxy in a fast, frantic, and ferocious third-person shooter.',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'GLOBAL',
    'Shooter Co-op',
    '2024-02-08'
),
(
    '11111111-0000-0000-0000-000000000007',
    'Red Dead Redemption 2: Ultimate Edition',
    'red-dead-redemption-2-ultimate-edition',
    'America, 1899. Arthur Morgan and the Van der Linde gang are outlaws on the run. With federal agents and the best bounty hunters in the nation massing on their heels, the gang must rob, steal and fight their way across the rugged heartland of America.',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    'Xbox',
    'GLOBAL',
    'Open World Adventure',
    '2019-11-05'
),
(
    '11111111-0000-0000-0000-000000000008',
    'Baldur''s Gate 3 Digital Deluxe',
    'baldurs-gate-3-deluxe',
    'Gather your party and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival, and the lure of absolute power. Mysterious abilities are awakening inside you, drawn from a mind flayer parasite planted in your brain.',
    'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'GLOBAL',
    'Turn-Based RPG',
    '2023-08-03'
),
(
    '11111111-0000-0000-0000-000000000009',
    'God of War Ragnarök Digital Deluxe Edition',
    'god-of-war-ragnarok',
    'Kratos and Atreus must journey to each of the Nine Realms in search of answers as Asgardian forces prepare for a prophesied battle that will end the world.',
    'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=800&q=80',
    'PSN',
    'EUROPE',
    'Action Adventure',
    '2024-09-19'
),
(
    '11111111-0000-0000-0000-000000000010',
    'Hogwarts Legacy Deluxe Edition',
    'hogwarts-legacy-deluxe-edition',
    'Hogwarts Legacy is an open-world action RPG set in the world first introduced in the Harry Potter books. Now you can take control of the action and be at the center of your own adventure in the wizarding world.',
    'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'GLOBAL',
    'Fantasy RPG',
    '2023-02-10'
),
(
    '11111111-0000-0000-0000-000000000011',
    'Forza Horizon 5 Premium Edition',
    'forza-horizon-5-premium',
    'Your Ultimate Horizon Adventure awaits! Explore the vibrant and ever-evolving open world landscapes of Mexico with limitless, fun driving action in hundreds of the world’s greatest cars.',
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
    'Xbox',
    'GLOBAL',
    'Racing',
    '2021-11-09'
),
(
    '11111111-0000-0000-0000-000000000012',
    'Marvel''s Spider-Man Remastered',
    'marvels-spider-man-remastered',
    'In Marvel’s Spider-Man Remastered, the worlds of Peter Parker and Spider-Man collide in an original action-packed story. Play as an experienced Peter Parker, fighting big crime and iconic villains in Marvel’s New York.',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'US',
    'Superhero Action',
    '2022-08-12'
),
(
    '11111111-0000-0000-0000-000000000013',
    'Resident Evil 4 Remake Gold Edition',
    'resident-evil-4-remake-gold',
    'Survival is only the beginning. Six years have passed since the biological disaster in Raccoon City. Agent Leon S. Kennedy, one of the survivors of the incident, has been sent to rescue the president''s kidnapped daughter.',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'EUROPE',
    'Survival Horror',
    '2024-02-09'
),
(
    '11111111-0000-0000-0000-000000000014',
    'Diablo IV: Vessel of Hatred Expansion',
    'diablo-iv-vessel-of-hatred',
    'Unearth the next chapter of Diablo IV as you pursue Neyrelle into the ancient region of Nahantu and uncover Mephisto’s sinister plot. Battle demonic hordes with the new Spiritborn class.',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    'Xbox',
    'GLOBAL',
    'ARPG Hack & Slash',
    '2024-10-08'
),
(
    '11111111-0000-0000-0000-000000000015',
    'The Legend of Zelda: Tears of the Kingdom',
    'zelda-tears-of-the-kingdom',
    'An epic adventure across the land and skies of Hyrule awaits in The Legend of Zelda: Tears of the Kingdom. In this sequel, you’ll decide your own path through the sprawling landscapes of Hyrule and the mysterious floating islands.',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    'Nintendo Switch',
    'GLOBAL',
    'Action Adventure',
    '2023-05-12'
),
(
    '11111111-0000-0000-0000-000000000016',
    'Black Myth: Wukong Deluxe Edition',
    'black-myth-wukong-deluxe',
    'Black Myth: Wukong is an action RPG rooted in Chinese mythology. You shall set out as the Destined One to venture into the challenges and marvels ahead, to uncover the obscured truth beneath the veil of a glorious legend from the past.',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    'Steam',
    'GLOBAL',
    'Action RPG',
    '2024-08-20'
);

-- 3. SEED 2 TO 4 SELLER OFFERS PER GAME
-- Offers for Game 1 (Cyberpunk 2077)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000001-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'PixelVault Deals', 4.96, 1420, 2899, 5999, true),
('20000001-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'KeyMaster EU', 4.88, 890, 2999, 5999, false),
('20000001-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'GamerStop Pro', 4.79, 320, 3150, 5999, false);

-- Offers for Game 2 (Elden Ring)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000002-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'NexusGaming', 4.98, 3810, 4499, 7999, true),
('20000002-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'SpeedyKeys LTD', 4.91, 1150, 4650, 7999, false),
('20000002-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'AlphaKeys Global', 4.85, 410, 4799, 7999, false);

-- Offers for Game 3 (The Witcher 3)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000003-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'GamerStop Pro', 4.92, 2350, 999, 4999, true),
('20000003-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'PixelVault Deals', 4.96, 1420, 1149, 4999, false);

-- Offers for Game 4 (EA SPORTS FC 25)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000004-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 'EuroPlay Keys', 4.90, 780, 3999, 6999, true),
('20000004-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000004', 'ConsoleHaven', 4.87, 620, 4150, 6999, false);

-- Offers for Game 5 (Grand Theft Auto V)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000005-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000005', 'SpeedyKeys LTD', 4.95, 4100, 1450, 2999, true),
('20000005-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000005', 'KeyMaster EU', 4.88, 890, 1599, 2999, false),
('20000005-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000005', 'PixelVault Deals', 4.96, 1420, 1620, 2999, false);

-- Offers for Game 6 (Helldivers 2)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000006-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000006', 'NexusGaming', 4.97, 2190, 2999, 4999, true),
('20000006-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000006', 'SuperEarth Vault', 4.93, 850, 3199, 4999, false);

-- Offers for Game 7 (Red Dead Redemption 2)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000007-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000007', 'AlphaKeys Global', 4.94, 1890, 1899, 5999, true),
('20000007-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000007', 'GamerStop Pro', 4.89, 740, 1999, 5999, false);

-- Offers for Game 8 (Baldur's Gate 3)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000008-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000008', 'NexusGaming', 4.99, 5200, 4899, 6999, true),
('20000008-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000008', 'PixelVault Deals', 4.96, 1420, 5050, 6999, false),
('20000008-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000008', 'KeyMaster EU', 4.88, 890, 5199, 6999, false);

-- Offers for Game 9 (God of War Ragnarök)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000009-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000009', 'EuroPlay Keys', 4.95, 1200, 4599, 6999, true),
('20000009-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000009', 'ConsoleHaven', 4.88, 430, 4750, 6999, false);

-- Offers for Game 10 (Hogwarts Legacy)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000010-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000010', 'PixelVault Deals', 4.94, 980, 2499, 5999, true),
('20000010-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000010', 'SpeedyKeys LTD', 4.90, 810, 2650, 5999, false);

-- Offers for Game 11 (Forza Horizon 5)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000011-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000011', 'ConsoleHaven', 4.93, 1120, 2799, 5999, true),
('20000011-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000011', 'AlphaKeys Global', 4.86, 650, 2999, 5999, false);

-- Offers for Game 12 (Marvel's Spider-Man)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000012-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000012', 'NexusGaming', 4.96, 1780, 3199, 5999, true),
('20000012-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000012', 'KeyMaster EU', 4.89, 740, 3350, 5999, false);

-- Offers for Game 13 (Resident Evil 4 Remake)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000013-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000013', 'GamerStop Pro', 4.93, 910, 2699, 4999, true),
('20000013-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000013', 'SpeedyKeys LTD', 4.91, 560, 2850, 4999, false);

-- Offers for Game 14 (Diablo IV)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000014-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000014', 'AlphaKeys Global', 4.91, 1340, 3899, 6999, true),
('20000014-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000014', 'ConsoleHaven', 4.88, 490, 4050, 6999, false);

-- Offers for Game 15 (Zelda: Tears of the Kingdom)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000015-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000015', 'PixelVault Deals', 4.97, 2900, 4999, 6999, true),
('20000015-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000015', 'KeyMaster EU', 4.90, 840, 5299, 6999, false);

-- Offers for Game 16 (Black Myth: Wukong)
INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured) VALUES
('20000016-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000016', 'NexusGaming', 4.98, 4400, 4799, 6999, true),
('20000016-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000016', 'SpeedyKeys LTD', 4.92, 1260, 4950, 6999, false),
('20000016-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000016', 'AlphaKeys Global', 4.87, 510, 5100, 6999, false);

-- 4. SEED 3 TO 4 DIGITAL KEYS FOR EACH SELLER OFFER (FORMAT: XXXX-YYYY-ZZZZ)
INSERT INTO digital_keys (seller_offer_id, license_key, status) VALUES
-- Game 1 offers
('20000001-0000-0000-0000-000000000001', 'CP77-PV01-9X82', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000001', 'CP77-PV01-K39M', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000001', 'CP77-PV01-W72L', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000002', 'CP77-KM02-P81A', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000002', 'CP77-KM02-F49X', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000002', 'CP77-KM02-N20Y', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000003', 'CP77-GS03-T65K', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000003', 'CP77-GS03-Q19Z', 'AVAILABLE'),
('20000001-0000-0000-0000-000000000003', 'CP77-GS03-L84C', 'AVAILABLE'),

-- Game 2 offers
('20000002-0000-0000-0000-000000000001', 'ELDR-NX01-77BA', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000001', 'ELDR-NX01-44VC', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000001', 'ELDR-NX01-99ZZ', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000002', 'ELDR-SK02-12LK', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000002', 'ELDR-SK02-88PL', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000002', 'ELDR-SK02-33WW', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000003', 'ELDR-AK03-66DD', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000003', 'ELDR-AK03-21MM', 'AVAILABLE'),
('20000002-0000-0000-0000-000000000003', 'ELDR-AK03-59QQ', 'AVAILABLE'),

-- Game 3 offers
('20000003-0000-0000-0000-000000000001', 'WCH3-GS01-55FF', 'AVAILABLE'),
('20000003-0000-0000-0000-000000000001', 'WCH3-GS01-71AA', 'AVAILABLE'),
('20000003-0000-0000-0000-000000000001', 'WCH3-GS01-93XX', 'AVAILABLE'),
('20000003-0000-0000-0000-000000000002', 'WCH3-PV02-11BB', 'AVAILABLE'),
('20000003-0000-0000-0000-000000000002', 'WCH3-PV02-84CC', 'AVAILABLE'),
('20000003-0000-0000-0000-000000000002', 'WCH3-PV02-47ZZ', 'AVAILABLE'),

-- Game 4 offers
('20000004-0000-0000-0000-000000000001', 'FC25-EP01-3829', 'AVAILABLE'),
('20000004-0000-0000-0000-000000000001', 'FC25-EP01-7193', 'AVAILABLE'),
('20000004-0000-0000-0000-000000000001', 'FC25-EP01-6452', 'AVAILABLE'),
('20000004-0000-0000-0000-000000000002', 'FC25-CH02-9901', 'AVAILABLE'),
('20000004-0000-0000-0000-000000000002', 'FC25-CH02-4412', 'AVAILABLE'),
('20000004-0000-0000-0000-000000000002', 'FC25-CH02-8371', 'AVAILABLE'),

-- Game 5 offers
('20000005-0000-0000-0000-000000000001', 'GTA5-SK01-0918', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000001', 'GTA5-SK01-4471', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000001', 'GTA5-SK01-8319', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000002', 'GTA5-KM02-6125', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000002', 'GTA5-KM02-7719', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000002', 'GTA5-KM02-3091', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000003', 'GTA5-PV03-1284', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000003', 'GTA5-PV03-9943', 'AVAILABLE'),
('20000005-0000-0000-0000-000000000003', 'GTA5-PV03-5167', 'AVAILABLE'),

-- Game 6 offers
('20000006-0000-0000-0000-000000000001', 'HLD2-NX01-5128', 'AVAILABLE'),
('20000006-0000-0000-0000-000000000001', 'HLD2-NX01-9982', 'AVAILABLE'),
('20000006-0000-0000-0000-000000000001', 'HLD2-NX01-3147', 'AVAILABLE'),
('20000006-0000-0000-0000-000000000002', 'HLD2-SE02-6631', 'AVAILABLE'),
('20000006-0000-0000-0000-000000000002', 'HLD2-SE02-8819', 'AVAILABLE'),
('20000006-0000-0000-0000-000000000002', 'HLD2-SE02-4421', 'AVAILABLE'),

-- Game 7 offers
('20000007-0000-0000-0000-000000000001', 'RDR2-AK01-7712', 'AVAILABLE'),
('20000007-0000-0000-0000-000000000001', 'RDR2-AK01-8843', 'AVAILABLE'),
('20000007-0000-0000-0000-000000000001', 'RDR2-AK01-3319', 'AVAILABLE'),
('20000007-0000-0000-0000-000000000002', 'RDR2-GS02-9912', 'AVAILABLE'),
('20000007-0000-0000-0000-000000000002', 'RDR2-GS02-5541', 'AVAILABLE'),
('20000007-0000-0000-0000-000000000002', 'RDR2-GS02-1189', 'AVAILABLE'),

-- Game 8 offers
('20000008-0000-0000-0000-000000000001', 'BG03-NX01-1928', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000001', 'BG03-NX01-8837', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000001', 'BG03-NX01-5521', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000002', 'BG03-PV02-7714', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000002', 'BG03-PV02-3392', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000002', 'BG03-PV02-6641', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000003', 'BG03-KM03-2219', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000003', 'BG03-KM03-9983', 'AVAILABLE'),
('20000008-0000-0000-0000-000000000003', 'BG03-KM03-4418', 'AVAILABLE'),

-- Game 9 offers
('20000009-0000-0000-0000-000000000001', 'GOWR-EP01-1192', 'AVAILABLE'),
('20000009-0000-0000-0000-000000000001', 'GOWR-EP01-6631', 'AVAILABLE'),
('20000009-0000-0000-0000-000000000001', 'GOWR-EP01-8842', 'AVAILABLE'),
('20000009-0000-0000-0000-000000000002', 'GOWR-CH02-5519', 'AVAILABLE'),
('20000009-0000-0000-0000-000000000002', 'GOWR-CH02-2283', 'AVAILABLE'),
('20000009-0000-0000-0000-000000000002', 'GOWR-CH02-7741', 'AVAILABLE'),

-- Game 10 offers
('20000010-0000-0000-0000-000000000001', 'HWLG-PV01-4412', 'AVAILABLE'),
('20000010-0000-0000-0000-000000000001', 'HWLG-PV01-8893', 'AVAILABLE'),
('20000010-0000-0000-0000-000000000001', 'HWLG-PV01-2231', 'AVAILABLE'),
('20000010-0000-0000-0000-000000000002', 'HWLG-SK02-6671', 'AVAILABLE'),
('20000010-0000-0000-0000-000000000002', 'HWLG-SK02-9918', 'AVAILABLE'),
('20000010-0000-0000-0000-000000000002', 'HWLG-SK02-3342', 'AVAILABLE'),

-- Game 11 offers
('20000011-0000-0000-0000-000000000001', 'FH05-CH01-1294', 'AVAILABLE'),
('20000011-0000-0000-0000-000000000001', 'FH05-CH01-7731', 'AVAILABLE'),
('20000011-0000-0000-0000-000000000001', 'FH05-CH01-5582', 'AVAILABLE'),
('20000011-0000-0000-0000-000000000002', 'FH05-AK02-8819', 'AVAILABLE'),
('20000011-0000-0000-0000-000000000002', 'FH05-AK02-3347', 'AVAILABLE'),
('20000011-0000-0000-0000-000000000002', 'FH05-AK02-9921', 'AVAILABLE'),

-- Game 12 offers
('20000012-0000-0000-0000-000000000001', 'SPDM-NX01-3312', 'AVAILABLE'),
('20000012-0000-0000-0000-000000000001', 'SPDM-NX01-6649', 'AVAILABLE'),
('20000012-0000-0000-0000-000000000001', 'SPDM-NX01-9928', 'AVAILABLE'),
('20000012-0000-0000-0000-000000000002', 'SPDM-KM02-4418', 'AVAILABLE'),
('20000012-0000-0000-0000-000000000002', 'SPDM-KM02-7729', 'AVAILABLE'),
('20000012-0000-0000-0000-000000000002', 'SPDM-KM02-1184', 'AVAILABLE'),

-- Game 13 offers
('20000013-0000-0000-0000-000000000001', 'RE04-GS01-5591', 'AVAILABLE'),
('20000013-0000-0000-0000-000000000001', 'RE04-GS01-8823', 'AVAILABLE'),
('20000013-0000-0000-0000-000000000001', 'RE04-GS01-2218', 'AVAILABLE'),
('20000013-0000-0000-0000-000000000002', 'RE04-SK02-7749', 'AVAILABLE'),
('20000013-0000-0000-0000-000000000002', 'RE04-SK02-3312', 'AVAILABLE'),
('20000013-0000-0000-0000-000000000002', 'RE04-SK02-9984', 'AVAILABLE'),

-- Game 14 offers
('20000014-0000-0000-0000-000000000001', 'DB04-AK01-1148', 'AVAILABLE'),
('20000014-0000-0000-0000-000000000001', 'DB04-AK01-6629', 'AVAILABLE'),
('20000014-0000-0000-0000-000000000001', 'DB04-AK01-8893', 'AVAILABLE'),
('20000014-0000-0000-0000-000000000002', 'DB04-CH02-4419', 'AVAILABLE'),
('20000014-0000-0000-0000-000000000002', 'DB04-CH02-7721', 'AVAILABLE'),
('20000014-0000-0000-0000-000000000002', 'DB04-CH02-2284', 'AVAILABLE'),

-- Game 15 offers
('20000015-0000-0000-0000-000000000001', 'ZLDA-PV01-9912', 'AVAILABLE'),
('20000015-0000-0000-0000-000000000001', 'ZLDA-PV01-3384', 'AVAILABLE'),
('20000015-0000-0000-0000-000000000001', 'ZLDA-PV01-7749', 'AVAILABLE'),
('20000015-0000-0000-0000-000000000002', 'ZLDA-KM02-5518', 'AVAILABLE'),
('20000015-0000-0000-0000-000000000002', 'ZLDA-KM02-8829', 'AVAILABLE'),
('20000015-0000-0000-0000-000000000002', 'ZLDA-KM02-2231', 'AVAILABLE'),

-- Game 16 offers
('20000016-0000-0000-0000-000000000001', 'BMWK-NX01-4491', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000001', 'BMWK-NX01-7718', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000001', 'BMWK-NX01-1182', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000002', 'BMWK-SK02-6639', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000002', 'BMWK-SK02-9941', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000002', 'BMWK-SK02-3328', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000003', 'BMWK-AK03-8812', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000003', 'BMWK-AK03-5594', 'AVAILABLE'),
('20000016-0000-0000-0000-000000000003', 'BMWK-AK03-2271', 'AVAILABLE');

-- 5. SEED 4 DYNAMIC HOMEPAGE BLOCKS
INSERT INTO homepage_blocks (id, block_type, title, sort_order, config, is_active) VALUES
(
    '30000000-0000-0000-0000-000000000001',
    'hero_banner',
    'Epic Deals of the Week',
    1,
    jsonb_build_object(
        'autoplay_interval_ms', 5000,
        'tagline', 'Get instant digital key delivery on thousands of top games',
        'items', jsonb_build_array(
            jsonb_build_object(
                'product_id', '11111111-0000-0000-0000-000000000016',
                'headline', 'Black Myth: Wukong',
                'subheading', 'Save up to 31% on Steam Global Keys',
                'badge', 'HOT RELEASE',
                'banner_image', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1400&q=80',
                'cta_text', 'Buy Now from €47.99'
            ),
            jsonb_build_object(
                'product_id', '11111111-0000-0000-0000-000000000002',
                'headline', 'Elden Ring: Shadow of the Erdtree',
                'subheading', 'The masterpiece expansion Tarnished have awaited',
                'badge', 'GOTY NOMINEE',
                'banner_image', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1400&q=80',
                'cta_text', 'Explore Offers'
            ),
            jsonb_build_object(
                'product_id', '11111111-0000-0000-0000-000000000001',
                'headline', 'Cyberpunk 2077: Phantom Liberty',
                'subheading', 'Overhaul your Night City journey with 50% discount',
                'badge', 'SPECIAL DEAL',
                'banner_image', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1400&q=80',
                'cta_text', 'Grab Key from €28.99'
            )
        )
    ),
    true
),
(
    '30000000-0000-0000-0000-000000000002',
    'best_sellers',
    'Best Sellers Across All Platforms',
    2,
    jsonb_build_object(
        'layout', 'grid',
        'limit', 8,
        'product_ids', jsonb_build_array(
            '11111111-0000-0000-0000-000000000008', -- Baldur''s Gate 3
            '11111111-0000-0000-0000-000000000002', -- Elden Ring
            '11111111-0000-0000-0000-000000000016', -- Black Myth: Wukong
            '11111111-0000-0000-0000-000000000004', -- EA SPORTS FC 25
            '11111111-0000-0000-0000-000000000006', -- Helldivers 2
            '11111111-0000-0000-0000-000000000005', -- GTA V
            '11111111-0000-0000-0000-000000000001', -- Cyberpunk 2077
            '11111111-0000-0000-0000-000000000009'  -- God of War Ragnarök
        )
    ),
    true
),
(
    '30000000-0000-0000-0000-000000000003',
    'flash_deals',
    'Flash Deals & Massive Discounts',
    3,
    jsonb_build_object(
        'countdown_end_hours', 48,
        'badge', 'LIMITED TIME',
        'product_ids', jsonb_build_array(
            '11111111-0000-0000-0000-000000000003', -- The Witcher 3 (80% off)
            '11111111-0000-0000-0000-000000000007', -- Red Dead Redemption 2 (68% off)
            '11111111-0000-0000-0000-000000000010', -- Hogwarts Legacy (58% off)
            '11111111-0000-0000-0000-000000000011', -- Forza Horizon 5 (53% off)
            '11111111-0000-0000-0000-000000000013', -- Resident Evil 4 (46% off)
            '11111111-0000-0000-0000-000000000012'  -- Spider-Man Remastered (46% off)
        )
    ),
    true
),
(
    '30000000-0000-0000-0000-000000000004',
    'recommended',
    'Recommended For You',
    4,
    jsonb_build_object(
        'layout', 'carousel',
        'product_ids', jsonb_build_array(
            '11111111-0000-0000-0000-000000000015', -- Zelda: Tears of the Kingdom
            '11111111-0000-0000-0000-000000000014', -- Diablo IV
            '11111111-0000-0000-0000-000000000008', -- Baldur''s Gate 3
            '11111111-0000-0000-0000-000000000006'  -- Helldivers 2
        )
    ),
    true
);
