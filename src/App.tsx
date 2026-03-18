/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, Home, Play, Star, Sparkles, Gift, AlertCircle, Download } from 'lucide-react';
import { DinoType, DINO_TYPES, Egg, Particle, Collection, SHOP_EGGS, ShopEgg } from './types';
import { soundService } from './services/soundService';

const EGG_COLORS = ['chicken', 'triceratops', 'stego', 'raptor', 'trex'] as DinoType[];
const AD_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REQUIRED_ADS = 3;

export default function App() {
  const [screen, setScreen] = useState<'start' | 'game' | 'nest' | 'boost' | 'mandatory_ad' | 'mystery_egg' | 'nest_full' | 'golden_egg' | 'collection'>('start');
  const [score, setScore] = useState(0);
  const [collection, setCollection] = useState<Collection>(() => {
    const saved = localStorage.getItem('dino_collection');
    return saved ? JSON.parse(saved) : {};
  });
  const [boostActive, setBoostActive] = useState(false);
  const [boostTime, setBoostTime] = useState(0);
  const [nestCapacity, setNestCapacity] = useState(() => {
    const saved = localStorage.getItem('nest_capacity');
    return saved ? parseInt(saved) : 20;
  });
  const [popCount, setPopCount] = useState(0);
  const [pendingMysteryDino, setPendingMysteryDino] = useState<DinoType | null>(null);
  const [luckMultiplier, setLuckMultiplier] = useState(1);
  const [sessionAdCount, setSessionAdCount] = useState(0);
  const [goldenEggAvailable, setGoldenEggAvailable] = useState(false);
  const [ownedEggIds, setOwnedEggIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('owned_egg_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedEggId, setSelectedEggId] = useState<string | null>(() => {
    return localStorage.getItem('selected_egg_id');
  });

  // PWA Install Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Check if in iframe
    setIsInIframe(window.self !== window.top);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handlePlayClick = async () => {
    if (deferredPrompt && !isInstalled && !isInIframe) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
    setScreen('game');
  };

  // Persistence
  useEffect(() => {
    localStorage.setItem('dino_collection', JSON.stringify(collection));
    localStorage.setItem('nest_capacity', nestCapacity.toString());
    localStorage.setItem('owned_egg_ids', JSON.stringify(ownedEggIds));
    if (selectedEggId) localStorage.setItem('selected_egg_id', selectedEggId);
  }, [collection, nestCapacity, ownedEggIds, selectedEggId]);

  // Ad Tracking
  const [adHistory, setAdHistory] = useState<number[]>(() => {
    const saved = localStorage.getItem('ad_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ad_history', JSON.stringify(adHistory));
    // Calculate luck multiplier based on recent ads + session loyalty boost
    const recentAds = getRecentAdsCount();
    const sessionBoost = sessionAdCount >= 5 ? 1.0 : 0; // Permanent +1.0x boost after 5 ads in session
    setLuckMultiplier(1 + (recentAds * 0.5) + sessionBoost);
  }, [adHistory, sessionAdCount]);

  const recordAdWatch = () => {
    setAdHistory(prev => [...prev, Date.now()]);
    setSessionAdCount(prev => prev + 1);
  };

  const getRecentAdsCount = () => {
    const now = Date.now();
    return adHistory.filter(timestamp => now - timestamp < AD_WINDOW_MS).length;
  };

  // Check for mandatory ad every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const recentAds = getRecentAdsCount();
      if (recentAds < REQUIRED_ADS && screen === 'game') {
        setScreen('mandatory_ad');
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [adHistory, screen]);

  const addDinoToCollection = (type: DinoType) => {
    const totalDinos = (Object.values(collection) as number[]).reduce((a, b) => a + b, 0);
    
    if (totalDinos >= nestCapacity) {
      setScreen('nest_full');
      return;
    }

    soundService.playCollect();
    setCollection(prev => {
      const newCount = (prev[type] || 0) + 1;
      const next = { ...prev, [type]: newCount };
      
      // Evolution logic: 10 of any basic dino -> Golden T-Rex
      if (type !== 'golden-trex' && newCount >= 10) {
        next[type] = newCount - 10;
        next['golden-trex'] = (next['golden-trex'] || 0) + 1;
        soundService.playEvolve();
      }
      return next;
    });
  };

  const handleMysteryEggPop = () => {
    const types: DinoType[] = ['stego', 'raptor', 'trex', 'golden-trex'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    setPendingMysteryDino(randomType);
    setScreen('mystery_egg');
  };

  const startBoost = () => {
    recordAdWatch();
    setBoostActive(true);
    setBoostTime(60);
    setScreen('game');
  };

  useEffect(() => {
    if (boostTime > 0) {
      const timer = setInterval(() => setBoostTime(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else {
      setBoostActive(false);
    }
  }, [boostTime]);

  return (
    <div className="fixed inset-0 bg-[#E0F2FE] font-sans overflow-hidden select-none touch-none">
      <AnimatePresence mode="wait">
        {screen === 'start' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.h1 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-6xl font-black text-[#0369A1] mb-8 drop-shadow-lg"
            >
              DINO EGG<br />POP!
            </motion.h1>
            
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button
                onClick={handlePlayClick}
                className="bg-[#4ADE80] hover:bg-[#22C55E] text-white text-3xl font-bold py-6 rounded-3xl shadow-[0_8px_0_#166534] active:translate-y-1 active:shadow-[0_4px_0_#166534] transition-all flex items-center justify-center gap-3"
              >
                <Play fill="currentColor" size={32} />
                {deferredPrompt && !isInstalled ? 'INSTALL & PLAY' : 'PLAY'}
              </button>
              
              <button
                onClick={() => setScreen('nest')}
                className="bg-[#FB923C] hover:bg-[#F97316] text-white text-2xl font-bold py-4 rounded-3xl shadow-[0_6px_0_#9A3412] active:translate-y-1 active:shadow-[0_3px_0_#9A3412] transition-all flex items-center justify-center gap-3"
              >
                <Trophy size={28} />
                EGG SHOP
              </button>

              {!isInstalled && (
                <>
                  {deferredPrompt && !isInIframe ? (
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={handleInstallClick}
                      className="bg-[#0369A1] hover:bg-[#075985] text-white text-xl font-bold py-4 rounded-3xl shadow-[0_6px_0_#0C4A6E] active:translate-y-1 active:shadow-[0_3px_0_#0C4A6E] transition-all flex items-center justify-center gap-3 mt-4"
                    >
                      <Download size={24} />
                      INSTALL APP
                    </motion.button>
                  ) : (
                    <button
                      onClick={() => setShowInstallGuide(true)}
                      className="text-[#0369A1] font-bold text-sm underline mt-4 opacity-70"
                    >
                      How to download this app?
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Install Guide Modal */}
            <AnimatePresence>
              {showInstallGuide && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl text-left"
                  >
                    <h3 className="text-2xl font-black text-[#0369A1] mb-4">HOW TO INSTALL</h3>
                    
                    {isInIframe ? (
                      <div className="space-y-4 text-slate-600 font-medium">
                        <p className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100">
                          🚀 <strong>Step 1:</strong> Tap the <strong>"Open in New Tab"</strong> button at the top of the screen.
                        </p>
                        <p>
                          Once opened in a new tab, the <strong>"Install App"</strong> button will appear here!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 text-slate-600 font-medium">
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="font-black text-[#0369A1] mb-2">FOR IPHONE (SAFARI):</p>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Tap the <strong>Share</strong> button (square with arrow)</li>
                            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                            <li>Tap <strong>"Add"</strong> in the corner</li>
                          </ol>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="font-black text-[#0369A1] mb-2">FOR ANDROID (CHROME):</p>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Tap the <strong>3 dots</strong> in the corner</li>
                            <li>Tap <strong>"Install App"</strong> or "Add to Home Screen"</li>
                          </ol>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowInstallGuide(false)}
                      className="w-full mt-6 bg-[#0369A1] text-white font-black py-4 rounded-2xl"
                    >
                      GOT IT!
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {screen === 'game' && (
          <GameScreen 
            onBack={() => setScreen('start')} 
            onCollect={addDinoToCollection}
            onMysteryPop={handleMysteryEggPop}
            onGoldenEgg={() => setScreen('golden_egg')}
            goldenEggAvailable={goldenEggAvailable}
            setGoldenEggAvailable={setGoldenEggAvailable}
            boostActive={boostActive}
            score={score}
            setScore={setScore}
            popCount={popCount}
            setPopCount={setPopCount}
            luckMultiplier={luckMultiplier}
            sessionAdCount={sessionAdCount}
            selectedEggId={selectedEggId}
          />
        )}

        {screen === 'nest' && (
          <EggShopScreen 
            score={score}
            setScore={setScore}
            ownedEggIds={ownedEggIds}
            setOwnedEggIds={setOwnedEggIds}
            selectedEggId={selectedEggId}
            setSelectedEggId={setSelectedEggId}
            onBack={() => setScreen('start')} 
            recordAdWatch={recordAdWatch}
          />
        )}

        {screen === 'boost' && (
          <BoostScreen 
            onStartBoost={startBoost} 
            onBack={() => setScreen('start')} 
          />
        )}

        {screen === 'mandatory_ad' && (
          <MandatoryAdScreen 
            onComplete={() => {
              recordAdWatch();
              setScreen('game');
            }} 
          />
        )}

        {screen === 'mystery_egg' && (
          <MysteryEggScreen 
            dinoType={pendingMysteryDino || 'chicken'}
            onHatch={() => {
              recordAdWatch();
              if (pendingMysteryDino) addDinoToCollection(pendingMysteryDino);
              setPendingMysteryDino(null);
              setScreen('game');
            }}
            onCancel={() => {
              setPendingMysteryDino(null);
              setScreen('game');
            }}
          />
        )}

        {screen === 'nest_full' && (
          <NestFullScreen 
            onExpand={() => {
              recordAdWatch();
              setNestCapacity(c => c + 20);
              setScreen('game');
            }}
            onBack={() => setScreen('start')}
          />
        )}

        {screen === 'golden_egg' && (
          <GoldenEggScreen 
            onComplete={() => {
              recordAdWatch();
              // Reward: 5 Golden T-Rexes
              for(let i=0; i<5; i++) addDinoToCollection('golden-trex');
              setScreen('game');
            }}
            onCancel={() => setScreen('game')}
          />
        )}

        {screen === 'collection' && (
          <CollectionScreen 
            collection={collection}
            nestCapacity={nestCapacity}
            onBack={() => setScreen('start')}
          />
        )}
      </AnimatePresence>

      {/* Navigation Bar (Bottom) */}
      {screen !== 'start' && (
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-t-4 border-[#BAE6FD] flex items-center justify-around px-4 pb-2">
          <NavButton icon={<Home />} label="Home" active={screen === 'start'} onClick={() => setScreen('start')} />
          <NavButton icon={<Play />} label="Play" active={screen === 'game'} onClick={() => setScreen('game')} />
          <NavButton icon={<Sparkles />} label="Dinos" active={screen === 'collection'} onClick={() => setScreen('collection')} />
          <NavButton icon={<Trophy />} label="Shop" active={screen === 'nest'} onClick={() => setScreen('nest')} />
          <NavButton icon={<Zap className={boostActive ? "text-yellow-500 fill-yellow-500 animate-pulse" : ""} />} label="Boost" active={screen === 'boost'} onClick={() => setScreen('boost')} />
        </div>
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-[#0369A1] scale-110' : 'text-slate-400'}`}
    >
      <div className={`${active ? 'bg-[#BAE6FD] p-2 rounded-xl' : ''}`}>
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function GameScreen({ onBack, onCollect, onMysteryPop, onGoldenEgg, goldenEggAvailable, setGoldenEggAvailable, boostActive, score, setScore, popCount, setPopCount, luckMultiplier, sessionAdCount, selectedEggId }: { 
  onBack: () => void, 
  onCollect: (type: DinoType) => void,
  onMysteryPop: () => void,
  onGoldenEgg: () => void,
  goldenEggAvailable: boolean,
  setGoldenEggAvailable: React.Dispatch<React.SetStateAction<boolean>>,
  boostActive: boolean,
  score: number,
  setScore: React.Dispatch<React.SetStateAction<number>>,
  popCount: number,
  setPopCount: React.Dispatch<React.SetStateAction<number>>,
  luckMultiplier: number,
  sessionAdCount: number,
  selectedEggId: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eggsRef = useRef<(Egg & { isMystery?: boolean })[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const lastGoldenRef = useRef<number>(0);
  const goldenEggExpiresRef = useRef<number>(0);

  const spawnEgg = useCallback((width: number) => {
    const isMystery = Math.random() < 0.05; // 5% chance for mystery egg
    const type = EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)];
    
    let customEmoji: string | undefined;
    let customColor: string | undefined;
    
    if (selectedEggId && !isMystery) {
      const shopEgg = SHOP_EGGS.find(e => e.id === selectedEggId);
      if (shopEgg) {
        customEmoji = shopEgg.emoji;
        customColor = shopEgg.color;
      }
    }

    // Speed increases by 10% for every 20 points
    const difficultyMultiplier = 1 + (Math.floor(score / 20) * 0.1);

    const egg: Egg & { isMystery?: boolean } = {
      id: Math.random(),
      x: Math.random() * (width - 60) + 30,
      y: -50,
      type,
      speed: (Math.random() * 2 + 2) * (boostActive ? 1.5 : 1) * difficultyMultiplier,
      radius: 30,
      isMystery,
      customEmoji,
      customColor
    };
    eggsRef.current.push(egg);
  }, [boostActive, selectedEggId, score]);

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1,
        color
      });
    }
  };

  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive sizing
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Trigger Golden Egg event every 45-60 seconds
    if (time - lastGoldenRef.current > 45000) {
      setGoldenEggAvailable(true);
      lastGoldenRef.current = time;
      goldenEggExpiresRef.current = time + 15000; // Expires in 15 seconds
    }

    // Auto-hide Golden Egg if expired
    if (goldenEggAvailable && time > goldenEggExpiresRef.current) {
      setGoldenEggAvailable(false);
    }

    // Spawn eggs
    const spawnRate = boostActive ? 600 : 1200;
    if (time - lastSpawnRef.current > spawnRate) {
      spawnEgg(canvas.width);
      lastSpawnRef.current = time;
    }

    // Update & Draw Eggs
    eggsRef.current = eggsRef.current.filter(egg => {
      egg.y += egg.speed;
      
      // Draw Egg
      ctx.save();
      ctx.translate(egg.x, egg.y);
      ctx.beginPath();
      ctx.ellipse(0, 0, egg.radius * 0.8, egg.radius, 0, 0, Math.PI * 2);
      
      if (egg.isMystery) {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, egg.radius);
        grad.addColorStop(0, '#FF00FF');
        grad.addColorStop(0.5, '#00FFFF');
        grad.addColorStop(1, '#FFFF00');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = egg.customColor || DINO_TYPES[egg.type].color;
      }
      
      ctx.fill();
      ctx.strokeStyle = egg.isMystery ? '#FFF' : 'white';
      ctx.lineWidth = egg.isMystery ? 5 : 3;
      ctx.stroke();

      // Draw Emoji
      if (egg.customEmoji && !egg.isMystery) {
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(egg.customEmoji, 0, 0);
      }
      
      // Shine
      ctx.beginPath();
      ctx.ellipse(-8, -10, 5, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
      ctx.restore();

      return egg.y < canvas.height + 50;
    });

    // Update & Draw Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.life -= 0.02;

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      return p.life > 0;
    });

    requestRef.current = requestAnimationFrame(animate);
  }, [boostActive, spawnEgg, onGoldenEgg]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const handleTouch = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Check collision
    const hitIndex = eggsRef.current.findIndex(egg => {
      const dist = Math.sqrt((egg.x - x) ** 2 + (egg.y - y) ** 2);
      return dist < egg.radius + 20; // Generous hit zone for kids
    });

    if (hitIndex !== -1) {
      const egg = eggsRef.current[hitIndex];
      
      if (egg.isMystery) {
        eggsRef.current.splice(hitIndex, 1);
        onMysteryPop();
        return;
      }

      const type = egg.type;
      const dino = DINO_TYPES[type];
      const color = egg.customColor || dino.color;
      const emoji = egg.customEmoji || dino.emoji;
      
      // Pop effect
      createExplosion(egg.x, egg.y, color);
      soundService.playPop();
      
      // Remove egg
      eggsRef.current.splice(hitIndex, 1);
      
      // Update score and collection
      const points = Math.round(dino.points * luckMultiplier);
      setScore(s => s + points);
      setPopCount(p => p + 1);
      onCollect(type);

      // Visual feedback
      const feedback = document.createElement('div');
      feedback.className = 'absolute pointer-events-none text-2xl font-black animate-bounce';
      feedback.style.left = `${egg.x}px`;
      feedback.style.top = `${egg.y}px`;
      feedback.style.color = color;
      feedback.innerText = `${emoji} +${points}`;
      canvas.parentElement?.appendChild(feedback);
      setTimeout(() => feedback.remove(), 1000);

      // Play sound (simulated)
      if ('vibrate' in navigator) navigator.vibrate(50);
    }
  };

  return (
    <motion.div
      key="game"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 p-2 rounded-full shadow-sm">
            <Star className="text-white fill-white" size={24} />
          </div>
          <span className="text-3xl font-black text-[#0369A1]">{score}</span>
        </div>
        {boostActive && (
          <div className="bg-yellow-400 px-4 py-1 rounded-full text-white font-bold animate-pulse flex items-center gap-2">
            <Zap size={16} fill="white" /> 2X SPEED!
          </div>
        )}
        {luckMultiplier > 1 && (
          <div className="bg-emerald-400 px-4 py-1 rounded-full text-white font-bold flex items-center gap-2 shadow-sm">
            <Sparkles size={16} fill="white" /> {luckMultiplier.toFixed(1)}x LUCK!
            {sessionAdCount >= 5 && <span className="text-[10px] bg-white/20 px-1 rounded">LOYALTY+</span>}
          </div>
        )}
      </div>

      {/* Game Area */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          onMouseDown={handleTouch}
          onTouchStart={handleTouch}
        />

        {/* Golden Egg Indicator */}
        <AnimatePresence>
          {goldenEggAvailable && (
            <motion.button
              initial={{ scale: 0, x: 100 }}
              animate={{ scale: 1, x: 0 }}
              exit={{ scale: 0, x: 100 }}
              onClick={() => {
                setGoldenEggAvailable(false);
                onGoldenEgg();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-yellow-400 p-4 rounded-full shadow-2xl border-4 border-white z-10 flex flex-col items-center gap-1 group"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-4xl"
              >
                👑
              </motion.div>
              <span className="text-[10px] font-black text-yellow-800 uppercase tracking-tighter">Golden!</span>
              
              {/* Pulsing Ring */}
              <motion.div 
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 rounded-full border-4 border-yellow-400"
              />
            </motion.button>
          )}
        </AnimatePresence>
        
        {/* Collection Prompt */}
        <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-white/80 px-6 py-2 rounded-full border-2 border-[#BAE6FD] text-[#0369A1] font-bold text-sm uppercase tracking-widest shadow-lg">
            Tap the Eggs!
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EggShopScreen({ score, setScore, ownedEggIds, setOwnedEggIds, selectedEggId, setSelectedEggId, onBack, recordAdWatch }: { 
  score: number, 
  setScore: React.Dispatch<React.SetStateAction<number>>,
  ownedEggIds: string[],
  setOwnedEggIds: React.Dispatch<React.SetStateAction<string[]>>,
  selectedEggId: string | null,
  setSelectedEggId: React.Dispatch<React.SetStateAction<string | null>>,
  onBack: () => void,
  recordAdWatch: () => void
}) {
  const [loadingAd, setLoadingAd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const buyEgg = (egg: ShopEgg) => {
    if (score >= egg.price && !ownedEggIds.includes(egg.id)) {
      setScore(s => s - egg.price);
      setOwnedEggIds(prev => [...prev, egg.id]);
      soundService.playCollect();
    }
  };

  const useEgg = (eggId: string) => {
    setSelectedEggId(eggId === selectedEggId ? null : eggId);
    soundService.playCollect();
  };

  const watchAdForEgg = () => {
    setLoadingAd(true);
    setTimeout(() => {
      setLoadingAd(false);
      recordAdWatch();
      
      // Get unowned eggs
      const unowned = SHOP_EGGS.filter(e => !ownedEggIds.includes(e.id));
      if (unowned.length > 0) {
        // Give a random unowned egg (prefer cheaper ones for ads usually, but let's do random)
        const randomEgg = unowned[Math.floor(Math.random() * Math.min(unowned.length, 10))];
        setOwnedEggIds(prev => [...prev, randomEgg.id]);
        soundService.playCollect();
      }
    }, 3000);
  };

  return (
    <motion.div
      key="shop"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="h-full bg-[#F0F9FF] flex flex-col p-6 overflow-hidden pb-24"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-4xl font-black text-[#0369A1]">EGG SHOP</h2>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border-2 border-[#BAE6FD] flex items-center gap-2">
          <Star className="text-yellow-500 fill-yellow-500" size={20} />
          <span className="font-bold text-[#0369A1]">{score}</span>
        </div>
      </div>

      {/* Ad Banner for Random Egg */}
      <div className="mb-6">
        <button
          onClick={watchAdForEgg}
          disabled={loadingAd}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 p-4 rounded-3xl text-white shadow-lg flex items-center justify-between relative overflow-hidden group"
        >
          <div className="flex items-center gap-3 z-10">
            <div className="bg-white/20 p-2 rounded-xl">
              <Gift size={24} />
            </div>
            <div className="text-left">
              <div className="font-black text-sm uppercase">Free Random Egg</div>
              <div className="text-[10px] opacity-80 font-bold">Watch ad to unlock!</div>
            </div>
          </div>
          <div className="text-2xl z-10">🎁</div>
          
          {loadingAd && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
            </div>
          )}
          
          <motion.div 
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
          />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
        {SHOP_EGGS.map((egg, index) => {
          const isOwned = ownedEggIds.includes(egg.id);
          const isSelected = selectedEggId === egg.id;
          const canAfford = score >= egg.price;
          
          return (
            <div 
              key={egg.id}
              className={`bg-white p-4 rounded-[32px] border-4 transition-all flex items-center gap-4 ${isSelected ? 'border-yellow-400' : isOwned ? 'border-[#4ADE80]' : 'border-white shadow-sm'}`}
            >
              <div 
                className="w-16 h-20 rounded-[2rem] flex items-center justify-center text-3xl shadow-inner relative overflow-hidden"
                style={{ backgroundColor: egg.color + '20', border: `3px solid ${egg.color}` }}
              >
                <motion.div
                  initial={false}
                  whileInView={{ y: [-10, 10, -10] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="z-10"
                >
                  {egg.emoji}
                </motion.div>
                {/* Subtle Parallax Background Element */}
                <motion.div 
                  initial={false}
                  whileInView={{ y: [20, -20, 20], rotate: [0, 45, 0] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                  className="absolute inset-0 opacity-10 flex items-center justify-center text-5xl pointer-events-none"
                >
                  {egg.emoji}
                </motion.div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[#0369A1] uppercase text-sm">{egg.name}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                    egg.rarity === 'Common' ? 'bg-slate-100 text-slate-500' :
                    egg.rarity === 'Rare' ? 'bg-blue-100 text-blue-500' :
                    egg.rarity === 'Epic' ? 'bg-purple-100 text-purple-500' :
                    egg.rarity === 'Legendary' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {egg.rarity}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                  <span className={`font-bold text-sm ${canAfford || isOwned ? 'text-slate-600' : 'text-red-400'}`}>
                    {egg.price.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {isOwned ? (
                  <button
                    onClick={() => useEgg(egg.id)}
                    className={`px-4 py-2 rounded-2xl font-black text-[10px] uppercase transition-all ${
                      isSelected 
                        ? 'bg-yellow-400 text-white shadow-[0_4px_0_#A16207]' 
                        : 'bg-white text-[#0369A1] border-2 border-[#0369A1] hover:bg-[#F0F9FF]'
                    }`}
                  >
                    {isSelected ? 'Using' : 'Use'}
                  </button>
                ) : (
                  <button
                    onClick={() => buyEgg(egg)}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded-2xl font-black text-[10px] uppercase transition-all ${
                      canAfford 
                        ? 'bg-[#0369A1] text-white shadow-[0_4px_0_#075985] active:translate-y-1 active:shadow-none' 
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    Buy
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function CollectionScreen({ collection, nestCapacity, onBack }: { 
  collection: Collection, 
  nestCapacity: number,
  onBack: () => void 
}) {
  const totalUnique = Object.keys(collection).filter(type => collection[type] > 0).length;
  const totalPossible = Object.keys(DINO_TYPES).length;
  const completionPercent = Math.round((totalUnique / totalPossible) * 100);
  const totalDinos = Object.values(collection).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      key="collection"
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      className="h-full bg-[#F0F9FF] flex flex-col p-6 overflow-hidden pb-24"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-4xl font-black text-[#0369A1]">MY DINOS</h2>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border-2 border-[#BAE6FD] flex items-center gap-2">
          <Sparkles className="text-purple-500 fill-purple-500" size={20} />
          <span className="font-bold text-[#0369A1]">{totalDinos}/{nestCapacity}</span>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white p-6 rounded-[40px] shadow-sm border-4 border-[#BAE6FD] mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl font-black text-[#0369A1]">{totalUnique}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unique Dinos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-purple-600">{completionPercent}%</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion</div>
          </div>
        </div>
        
        <div className="mt-6 w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 gap-4">
        {Object.entries(DINO_TYPES).map(([type, dino]) => {
          const count = collection[type] || 0;
          return (
            <div 
              key={type}
              className={`bg-white p-4 rounded-[32px] border-4 transition-all flex flex-col items-center text-center ${count > 0 ? 'border-[#4ADE80]' : 'border-slate-100 grayscale opacity-50'}`}
            >
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-3 shadow-inner"
                style={{ backgroundColor: dino.color + '20', border: `3px solid ${dino.color}` }}
              >
                {dino.emoji}
              </div>
              <div className="font-black text-[#0369A1] text-xs uppercase mb-1">{dino.name}</div>
              <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">
                x{count}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function BoostScreen({ onStartBoost, onBack }: { onStartBoost: () => void, onBack: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleWatchAd = () => {
    setLoading(true);
    // Simulate ad watching for 3 seconds
    setTimeout(() => {
      setLoading(false);
      onStartBoost();
    }, 3000);
  };

  return (
    <motion.div
      key="boost"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="h-full flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="bg-white p-8 rounded-[40px] shadow-2xl border-8 border-[#BAE6FD] w-full max-w-sm">
        <div className="bg-yellow-400 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Zap size={48} className="text-white fill-white" />
        </div>
        
        <h2 className="text-3xl font-black text-[#0369A1] mb-2">SUPER BOOST!</h2>
        <p className="text-slate-500 font-bold mb-8">Watch a quick video to get 2X faster eggs for 60 seconds!</p>

        <button
          onClick={handleWatchAd}
          disabled={loading}
          className={`w-full bg-[#4ADE80] hover:bg-[#22C55E] disabled:bg-slate-300 text-white text-2xl font-bold py-6 rounded-3xl shadow-[0_8px_0_#166534] active:translate-y-1 active:shadow-[0_4px_0_#166534] transition-all flex items-center justify-center gap-3 relative overflow-hidden ${!loading ? 'animate-pulse shadow-[0_0_20px_rgba(74,222,128,0.5)]' : ''}`}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
          ) : (
            <>
              <Gift size={32} />
              WATCH AD
              {/* Glow effect */}
              <motion.div 
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
              />
            </>
          )}
        </button>
        
        <button
          onClick={onBack}
          className="mt-6 text-slate-400 font-bold hover:text-slate-600 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </motion.div>
  );
}

function MandatoryAdScreen({ onComplete }: { onComplete: () => void }) {
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else {
      onComplete();
    }
  }, [timeLeft, onComplete]);

  return (
    <motion.div
      key="mandatory_ad"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm">
        <div className="bg-red-400 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-white" />
        </div>
        
        <h2 className="text-2xl font-black text-[#0369A1] mb-2">QUICK AD BREAK!</h2>
        <p className="text-slate-500 font-bold mb-8">Game will resume in {timeLeft} seconds...</p>

        <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5, ease: 'linear' }}
            className="h-full bg-[#4ADE80]"
          />
        </div>
        
        <p className="mt-4 text-xs text-slate-400 uppercase tracking-widest font-bold">Ad playing...</p>
      </div>
    </motion.div>
  );
}

function MysteryEggScreen({ dinoType, onHatch, onCancel }: { dinoType: DinoType, onHatch: () => void, onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const dino = DINO_TYPES[dinoType];

  const handleHatch = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onHatch();
    }, 3000);
  };

  return (
    <motion.div
      key="mystery_egg"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
    >
      <div className="bg-white p-8 rounded-[40px] shadow-2xl text-center w-full max-w-sm border-8 border-purple-400">
        <div className="text-7xl mb-6 animate-bounce">🎁</div>
        <h2 className="text-3xl font-black text-purple-600 mb-2">MYSTERY EGG!</h2>
        <p className="text-slate-500 font-bold mb-8">There is a <span className="text-purple-500">{dino.name}</span> inside! Watch an ad to hatch it now!</p>
        
        <button
          onClick={handleHatch}
          disabled={loading}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white text-2xl font-bold py-6 rounded-3xl shadow-[0_8px_0_#6B21A8] active:translate-y-1 active:shadow-[0_4px_0_#6B21A8] transition-all flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
          ) : (
            <>
              <Gift size={32} />
              HATCH NOW!
            </>
          )}
        </button>
        
        <button onClick={onCancel} className="mt-4 text-slate-400 font-bold">No thanks</button>
      </div>
    </motion.div>
  );
}

function NestFullScreen({ onExpand, onBack }: { onExpand: () => void, onBack: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleExpand = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onExpand();
    }, 3000);
  };

  return (
    <motion.div
      key="nest_full"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
    >
      <div className="bg-white p-8 rounded-[40px] shadow-2xl text-center w-full max-w-sm border-8 border-red-400">
        <div className="text-7xl mb-6">🚫</div>
        <h2 className="text-3xl font-black text-red-600 mb-2">NEST FULL!</h2>
        <p className="text-slate-500 font-bold mb-8">You can't catch more dinos! Watch an ad to expand your nest +20 slots!</p>
        
        <button
          onClick={handleExpand}
          disabled={loading}
          className="w-full bg-red-500 hover:bg-red-600 text-white text-2xl font-bold py-6 rounded-3xl shadow-[0_8px_0_#991B1B] active:translate-y-1 active:shadow-[0_4px_0_#991B1B] transition-all flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
          ) : (
            <>
              <Home size={32} />
              EXPAND NEST!
            </>
          )}
        </button>
        
        <button onClick={onBack} className="mt-4 text-slate-400 font-bold">Back to Menu</button>
      </div>
    </motion.div>
  );
}

function GoldenEggScreen({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else {
      onCancel();
    }
  }, [timeLeft, onCancel]);

  const handleClaim = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onComplete();
    }, 3000);
  };

  return (
    <motion.div
      key="golden_egg"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
    >
      <div className="bg-white p-8 rounded-[40px] shadow-2xl text-center w-full max-w-sm border-8 border-yellow-400 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-slate-100">
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 10, ease: 'linear' }}
            className="h-full bg-yellow-400"
          />
        </div>

        <div className="text-7xl mb-6 animate-bounce mt-4">👑</div>
        <h2 className="text-3xl font-black text-yellow-600 mb-2">GOLDEN OPPORTUNITY!</h2>
        <p className="text-slate-500 font-bold mb-8">A Golden Egg has appeared! Watch an ad to hatch <span className="text-yellow-500">5 GOLDEN T-REXS</span> instantly!</p>
        
        <button
          onClick={handleClaim}
          disabled={loading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-white text-2xl font-bold py-6 rounded-3xl shadow-[0_8px_0_#A16207] active:translate-y-1 active:shadow-[0_4px_0_#A16207] transition-all flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
          ) : (
            <>
              <Star size={32} fill="white" />
              CLAIM NOW!
            </>
          )}
        </button>
        
        <p className="mt-4 text-slate-400 font-bold">Hurry! Offer ends in {timeLeft}s</p>
      </div>
    </motion.div>
  );
}
