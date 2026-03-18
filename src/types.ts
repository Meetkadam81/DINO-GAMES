export type DinoType = 'chicken' | 'triceratops' | 'trex' | 'stego' | 'raptor' | 'golden-trex';

export interface DinoData {
  type: DinoType;
  name: string;
  color: string;
  points: number;
  emoji: string;
}

export const DINO_TYPES: Record<DinoType, DinoData> = {
  chicken: { type: 'chicken', name: 'Chicken Dino', color: '#FCD34D', points: 1, emoji: '🐣' },
  triceratops: { type: 'triceratops', name: 'Triceratops', color: '#FB923C', points: 2, emoji: '🧡' },
  stego: { type: 'stego', name: 'Stego', color: '#4ADE80', points: 3, emoji: '🟢' },
  raptor: { type: 'raptor', name: 'Raptor', color: '#60A5FA', points: 4, emoji: '🔵' },
  trex: { type: 'trex', name: 'T-Rex', color: '#F87171', points: 5, emoji: '🔴' },
  'golden-trex': { type: 'golden-trex', name: 'Golden T-Rex', color: '#FBBF24', points: 50, emoji: '👑' },
};

export interface Egg {
  id: number;
  x: number;
  y: number;
  type: DinoType;
  speed: number;
  radius: number;
  customEmoji?: string;
  customColor?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Collection {
  [key: string]: number;
}

export interface ShopEgg {
  id: string;
  name: string;
  emoji: string;
  price: number;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
  color: string;
}

export const SHOP_EGGS: ShopEgg[] = Array.from({ length: 50 }, (_, i) => {
  const rarities: ShopEgg['rarity'][] = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const rarityIndex = Math.floor(i / 10);
  const rarity = rarities[rarityIndex];
  
  // Price curve: starts at 100, ends at 1,000,000
  const price = i === 49 ? 1000000 : Math.floor(100 + (999900 * Math.pow(i / 49, 3.5)));
  
  const emojis = ['🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚']; // Default
  const names = [
    "Stone", "Dirt", "Grass", "Sand", "Clay", "Wood", "Leaf", "Twig", "Pebble", "Dust",
    "Iron", "Copper", "Silver", "Gold", "Ruby", "Sapphire", "Emerald", "Topaz", "Onyx", "Quartz",
    "Cloud", "Rain", "Snow", "Wind", "Storm", "Thunder", "Lightning", "Frost", "Flame", "Magma",
    "Star", "Moon", "Sun", "Galaxy", "Nebula", "Comet", "Meteor", "Void", "Aura", "Spirit",
    "Dragon", "Phoenix", "Titan", "Godly", "Celestial", "Eternal", "Infinite", "Omega", "Alpha", "Ultimate"
  ];

  const eggEmojis = [
    '🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚', '🥚',
    '🥈', '🥉', '🥇', '💎', '💍', '🔮', '🧿', '🏺', '📜', '🗝️',
    '☁️', '🌧️', '❄️', '🌬️', '⛈️', '🌩️', '⚡', '🧊', '🔥', '🌋',
    '⭐', '🌙', '☀️', '🌌', '🌠', '☄️', '🌑', '🌀', '✨', '👻',
    '🐲', '🐦', '🗿', '🔱', '🪐', '♾️', '⚛️', '🧬', '👑', '🥚'
  ];

  const colors = [
    '#94A3B8', '#78350F', '#22C55E', '#FDE047', '#B45309', '#8B4513', '#166534', '#15803D', '#64748B', '#475569',
    '#CBD5E1', '#B45309', '#E2E8F0', '#FACC15', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#1E293B', '#F1F5F9',
    '#BAE6FD', '#0EA5E9', '#F0F9FF', '#94A3B8', '#334155', '#1E293B', '#FDE047', '#7DD3FC', '#F97316', '#DC2626',
    '#FDE047', '#F1F5F9', '#F59E0B', '#6366F1', '#A855F7', '#94A3B8', '#0F172A', '#312E81', '#E9D5FF', '#F3F4F6',
    '#059669', '#F43F5E', '#4B5563', '#F59E0B', '#4F46E5', '#6366F1', '#EC4899', '#111827', '#000000', '#FFD700'
  ];

  return {
    id: `egg-${i}`,
    name: `${names[i]} Egg`,
    emoji: eggEmojis[i],
    price,
    rarity,
    color: colors[i]
  };
});
