
import React, { useState, useEffect, useMemo } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultCard } from './components/ResultCard';
import { Logo } from './components/Logo';
import { classifyWaste, searchWasteLookup } from './services/geminiService';
import { WasteClassification, ScanHistory, Page, Location } from './types';

const HERO_IMAGE_URL = 'https://usedoilrecyclingab.com/wp-content/uploads/2022/01/Untitled-design.webp';
const ABOUT_HERO_URL = 'https://payspacemagazine.com/wp-content/uploads/2024/07/reduce-reuse-recycle-ai-edition.jpg';

const GAME_ITEMS = [
  { name: 'Plastic Water Bottle', stream: 'Recyclables', img: 'https://images.unsplash.com/photo-1591193113735-6660c230e46a?auto=format&fit=crop&q=80&w=400', reason: 'Plastic #1 (PET) is highly recyclable when rinsed.' },
  { name: 'Dirty Pizza Box', stream: 'Residual', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400', reason: 'Oil and grease contaminate the paper recycling process.' },
  { name: 'Apple Core', stream: 'Organic', img: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&q=80&w=400', reason: 'Food waste should be composted to reduce methane in landfills.' },
  { name: 'Aluminum Can', stream: 'Recyclables', img: 'https://images.unsplash.com/photo-1534262326206-2868e945e1d2?auto=format&fit=crop&q=80&w=400', reason: 'Metal is infinitely recyclable and energy-efficient to re-process.' },
  { name: 'Banana Peel', stream: 'Organic', img: 'https://images.unsplash.com/photo-1528825831138-2ec2384158a3?auto=format&fit=crop&q=80&w=400', reason: 'Natural organic matter breaks down perfectly into soil.' },
  { name: 'Used Diaper', stream: 'Residual', img: 'https://images.unsplash.com/photo-1590483734724-383b9f39bb1d?auto=format&fit=crop&q=80&w=400', reason: 'Hygiene products are non-recyclable residual waste.' },
];

const GLOBAL_REGIONS = [
  "Global (General Rules)", "Australia", "Canada", "China", "European Union", "Germany", "India", "Japan", "Malaysia", "New Zealand", "Singapore", "South Korea", "United Kingdom", "United States"
];

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('home');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<WasteClassification | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location>({ country: 'Global (General Rules)' });
  const [isLocating, setIsLocating] = useState(false);

  // Game State
  const [ecoPoints, setEcoPoints] = useState(0);
  const [gameIdx, setGameIdx] = useState(0);
  const [gameFeedback, setGameFeedback] = useState<{ isCorrect: boolean; text: string } | null>(null);
  const [itemsSortedInGame, setItemsSortedInGame] = useState(0);

  useEffect(() => {
    const savedHistory = localStorage.getItem('ecosort_history_global_v3');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedLocation = localStorage.getItem('ecosort_location_global_v3');
    if (savedLocation) setLocation(JSON.parse(savedLocation));

    const savedPoints = localStorage.getItem('ecosort_eco_points');
    if (savedPoints) setEcoPoints(parseInt(savedPoints));

    const savedSortedCount = localStorage.getItem('ecosort_game_count');
    if (savedSortedCount) setItemsSortedInGame(parseInt(savedSortedCount));
  }, []);

  useEffect(() => {
    localStorage.setItem('ecosort_eco_points', ecoPoints.toString());
    localStorage.setItem('ecosort_game_count', itemsSortedInGame.toString());
  }, [ecoPoints, itemsSortedInGame]);

  const stats = useMemo(() => {
    const total = history.length;
    const recyclables = history.filter(h => h.result.bin_recommendation.stream === 'Recyclables').length;
    const rate = total > 0 ? Math.round((recyclables / total) * 100) : 0;
    return { total, recyclables, rate };
  }, [history]);

  const gameLevel = useMemo(() => {
    if (ecoPoints < 100) return { name: 'Green Beginner', emoji: '🌱', next: 100 };
    if (ecoPoints < 300) return { name: 'Waste Warrior', emoji: '⚔️', next: 300 };
    if (ecoPoints < 600) return { name: 'Eco Hero', emoji: '🦸', next: 600 };
    return { name: 'Sustainer Legend', emoji: '💎', next: 1000 };
  }, [ecoPoints]);

  const handleGameSort = (stream: string) => {
    const currentItem = GAME_ITEMS[gameIdx];
    const isCorrect = currentItem.stream === stream;
    
    if (isCorrect) {
      setEcoPoints(prev => prev + 15);
      setItemsSortedInGame(prev => prev + 1);
      setGameFeedback({ isCorrect: true, text: `Correct! ${currentItem.reason}` });
    } else {
      setGameFeedback({ isCorrect: false, text: `Not quite. ${currentItem.reason}` });
    }

    setTimeout(() => {
      setGameFeedback(null);
      setGameIdx((prev) => (prev + 1) % GAME_ITEMS.length);
    }, 2500);
  };

  const saveResult = (result: WasteClassification, url?: string, isManual = false) => {
    const newHistoryItem: ScanHistory = {
      id: crypto.randomUUID(),
      imageUrl: url,
      timestamp: Date.now(),
      result,
      isManualSearch: isManual
    };
    const updated = [newHistoryItem, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('ecosort_history_global_v3', JSON.stringify(updated));
    // Reward points for real scans too
    setEcoPoints(prev => prev + 25);
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your scan history?")) {
      setHistory([]);
      localStorage.removeItem('ecosort_history_global_v3');
    }
  };

  const handleImageCaptured = async (base64: string, url: string) => {
    setIsProcessing(true);
    setCurrentResult(null);
    setPreviewUrl(url);
    setError(null);
    setActivePage('scan');
    try {
      const result = await classifyWaste(base64, location);
      setCurrentResult(result);
      saveResult(result, url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsProcessing(true);
    setError(null);
    setPreviewUrl(null);
    setActivePage('scan');
    try {
      const result = await searchWasteLookup(searchQuery, location);
      setCurrentResult(result);
      saveResult(result, undefined, true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      setSearchQuery('');
    }
  };

  const updateLocation = (country: string) => {
    const newLoc = { country };
    setLocation(newLoc);
    localStorage.setItem('ecosort_location_global_v3', JSON.stringify(newLoc));
    setIsLocating(false);
  };

  const renderGame = () => (
    <div className="max-w-7xl mx-auto px-10 py-12 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* Progress Header */}
      <div className="bg-emerald-600 rounded-[56px] p-10 text-white flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -ml-32 -mt-32 blur-3xl" />
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black tracking-widest uppercase">
            {gameLevel.emoji} {gameLevel.name}
          </div>
          <h2 className="text-6xl font-black tracking-tighter leading-none">Your Eco Impact</h2>
          <p className="text-emerald-50 text-xl font-medium opacity-80">You've sorted {itemsSortedInGame} items in training and {history.length} in the real world!</p>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-40 flex items-center justify-center">
             <svg className="w-full h-full -rotate-90">
               <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.2)" strokeWidth="12" fill="transparent" />
               <circle cx="80" cy="80" r="70" stroke="white" strokeWidth="12" fill="transparent" 
                       strokeDasharray={440} 
                       strokeDashoffset={440 - (440 * Math.min(ecoPoints / gameLevel.next, 1))} 
                       strokeLinecap="round" 
                       className="transition-all duration-1000" />
             </svg>
             <div className="absolute flex flex-col items-center">
               <span className="text-3xl font-black">{ecoPoints}</span>
               <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Points</span>
             </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">{gameLevel.next - ecoPoints} PTS TO NEXT LEVEL</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sort It Right Mini Game */}
        <div className="lg:col-span-7 space-y-8">
          <div className="flex justify-between items-end">
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Sort It Right</h3>
            <p className="text-emerald-600 font-black text-[10px] tracking-widest uppercase">Earn +15 PTS per correct item</p>
          </div>

          <div className="relative aspect-[4/3] bg-slate-50 rounded-[48px] border border-slate-100 shadow-xl overflow-hidden group">
            <img src={GAME_ITEMS[gameIdx].img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Sort Item" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-10 flex flex-col items-center text-center">
               <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">WHICH BIN DOES THIS GO IN?</p>
               <h4 className="text-4xl font-black text-white tracking-tighter mb-8">{GAME_ITEMS[gameIdx].name}</h4>
               
               <div className="flex gap-4 w-full max-w-md">
                 {[
                   { name: 'Recyclables', color: 'bg-blue-600', emoji: '♻️' },
                   { name: 'Organic', color: 'bg-emerald-600', emoji: '🌿' },
                   { name: 'Residual', color: 'bg-slate-800', emoji: '🗑️' }
                 ].map(bin => (
                   <button 
                    key={bin.name}
                    disabled={!!gameFeedback}
                    onClick={() => handleGameSort(bin.name)}
                    className={`flex-1 ${bin.color} py-5 rounded-3xl text-white shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-1 group/btn`}
                   >
                     <span className="text-2xl group-hover/btn:rotate-12 transition-transform">{bin.emoji}</span>
                     <span className="text-[9px] font-black uppercase tracking-widest">{bin.name}</span>
                   </button>
                 ))}
               </div>
            </div>

            {gameFeedback && (
              <div className={`absolute inset-0 z-20 flex items-center justify-center p-10 backdrop-blur-md animate-in zoom-in-95 duration-300 ${gameFeedback.isCorrect ? 'bg-emerald-600/90' : 'bg-red-600/90'}`}>
                <div className="text-white text-center space-y-6">
                  <div className="text-7xl">{gameFeedback.isCorrect ? '✨' : '⚠️'}</div>
                  <h5 className="text-4xl font-black tracking-tighter">{gameFeedback.isCorrect ? 'Brilliant!' : 'Oops!'}</h5>
                  <p className="text-lg font-bold leading-relaxed max-w-sm">{gameFeedback.text}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Challenges & Badges */}
        <div className="lg:col-span-5 space-y-12">
          <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-xl space-y-8">
            <h4 className="text-2xl font-black text-slate-900 tracking-tighter">Daily Challenges</h4>
            <div className="space-y-4">
              {[
                { title: 'Training Day', desc: 'Sort 5 items in the game correctly', progress: (itemsSortedInGame / 5) * 100, current: itemsSortedInGame, target: 5 },
                { title: 'Waste Explorer', desc: 'Scan a plastic item today', progress: history.some(h => h.result.material === 'plastic') ? 100 : 0, current: history.some(h => h.result.material === 'plastic') ? 1 : 0, target: 1 }
              ].map((c, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-slate-900">{c.title}</p>
                      <p className="text-xs text-slate-500 font-medium">{c.desc}</p>
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">+{20 * (i+1)} PTS</span>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(c.progress, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                      <span>Progress</span>
                      <span>{c.current} / {c.target}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-2xl font-black text-slate-900 tracking-tighter">Eco Badges</h4>
            <div className="grid grid-cols-4 gap-4">
              {[
                { name: 'Plastic Pioneer', icon: '🥤', unlocked: ecoPoints > 50 },
                { name: 'Paper Pro', icon: '📄', unlocked: ecoPoints > 150 },
                { name: 'Compost King', icon: '🍎', unlocked: ecoPoints > 300 },
                { name: 'Zero Waste', icon: '💎', unlocked: ecoPoints > 1000 },
              ].map((badge, i) => (
                <div key={i} className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all ${badge.unlocked ? 'bg-white border-emerald-100 shadow-lg' : 'bg-slate-50 border-slate-100 opacity-40 grayscale'}`}>
                  <span className="text-3xl">{badge.icon}</span>
                  <p className="text-[8px] font-black uppercase tracking-tighter text-center px-1">{badge.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rewards Simulator */}
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
             <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Redeem Rewards</h3>
             <p className="text-slate-500 text-sm font-medium">Use your Eco Points for real-world sustainability perks.</p>
          </div>
          <p className="text-[10px] font-black text-slate-400 italic">Rewards are simulated for demo purposes</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'RM5 Eco Voucher', cost: 250, brand: 'Sustainable Store', icon: '🎟️' },
            { title: 'Free Reusable Bag', cost: 500, brand: 'EcoSort Promo', icon: '🛍️' },
            { title: 'Tree Planting', cost: 1000, brand: 'Green Earth Foundation', icon: '🌳' }
          ].map((reward, i) => (
            <div key={i} className="group bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl hover:shadow-2xl hover:border-emerald-200 transition-all space-y-6">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">
                {reward.icon}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{reward.brand}</p>
                <h5 className="text-2xl font-black text-slate-900 tracking-tight">{reward.title}</h5>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="font-black text-emerald-600">{reward.cost} PTS</span>
                <button 
                  disabled={ecoPoints < reward.cost}
                  className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${ecoPoints >= reward.cost ? 'bg-slate-900 text-white hover:bg-black active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  {ecoPoints >= reward.cost ? 'Redeem Now' : 'Not Enough Pts'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="animate-in fade-in duration-1000">
      <section className="relative w-full h-screen min-h-[850px] overflow-hidden">
        <img src={HERO_IMAGE_URL} alt="Eco Recycling" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-white/10 flex items-start">
          <div className="max-w-7xl mx-auto px-10 w-full pt-52 md:pt-64">
            <div className="max-w-2xl space-y-10">
              <div className="space-y-4">
                <h2 className="text-7xl sm:text-8xl font-black text-slate-900 leading-[0.9] tracking-tighter drop-shadow-sm">
                  Smart Sorting <br />
                  <span className="text-emerald-600">Zero Waste.</span>
                </h2>
                <p className="text-xl sm:text-2xl text-slate-800 font-bold leading-relaxed max-w-lg bg-white/30 backdrop-blur-sm rounded-2xl p-2 -ml-2">
                  Instantly classify waste and discover local disposal rules anywhere in the world.
                </p>
              </div>

              <div className="flex flex-wrap gap-5 pt-4">
                <button onClick={() => setActivePage('scan')} className="px-12 py-6 bg-emerald-600 text-white rounded-[28px] font-black tracking-widest shadow-2xl hover:bg-emerald-700 transition-all active:scale-95">
                  LAUNCH SCANNER
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setIsLocating(!isLocating)} 
                    className="px-8 py-6 bg-white/90 backdrop-blur-md text-slate-900 border border-slate-200 rounded-[28px] font-black tracking-widest hover:bg-white transition-all flex items-center gap-3 shadow-lg"
                  >
                    📍 {location.country}
                  </button>
                  {isLocating && (
                    <div className="absolute top-full mt-4 left-0 w-80 bg-white shadow-2xl rounded-[32px] p-4 z-[200] border border-slate-100 animate-in slide-in-from-top-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-3 ml-4 tracking-widest">Select Your Region</p>
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1">
                        {GLOBAL_REGIONS.map(region => (
                          <button
                            key={region}
                            onClick={() => updateLocation(region)}
                            className={`w-full text-left p-4 rounded-2xl font-bold text-sm transition-all ${location.country === region ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            {region}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-8 max-w-md">
                <form onSubmit={handleManualSearch} className="relative group">
                  <input 
                    type="text" 
                    placeholder="Ask about any item..." 
                    className="w-full bg-white/80 backdrop-blur-xl border border-white rounded-3xl py-6 pl-14 pr-6 text-slate-800 font-bold focus:bg-white shadow-lg outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-10 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 rounded-[48px] p-12 flex flex-col justify-between border border-slate-100 shadow-sm">
                <div>
                  <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4">DIVERSION PERFORMANCE</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-8xl font-black text-slate-900 leading-none">{stats.rate}%</span>
                    <span className="text-emerald-500 font-black text-xl">Diverted</span>
                  </div>
                  <p className="text-slate-500 text-sm mt-6 font-medium leading-relaxed">Your efforts in accurate waste diversion help reduce global landfill waste.</p>
                </div>
                <div className="mt-10 h-4 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${stats.rate}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-sky-50 border border-sky-100 rounded-[32px] p-8 text-center flex flex-col justify-center">
                  <p className="text-sky-700 font-black text-4xl leading-none">{stats.total}</p>
                  <p className="text-sky-600/70 text-[10px] font-black uppercase tracking-widest mt-2">Analysis Count</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-[32px] p-8 text-center flex flex-col justify-center">
                  <p className="text-emerald-700 font-black text-4xl leading-none">{stats.recyclables}</p>
                  <p className="text-emerald-600/70 text-[10px] font-black uppercase tracking-widest mt-2">Recyclables</p>
                </div>
                <div className="bg-slate-900 rounded-[32px] p-10 col-span-2 flex items-center justify-between text-white">
                  <div>
                    <p className="font-black text-xs uppercase tracking-widest text-white/40 mb-1">Eco Points</p>
                    <p className="font-black text-2xl tracking-tight">{ecoPoints} PTS</p>
                  </div>
                  <div className="text-5xl opacity-40">✨</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
             <div className="flex justify-between items-center">
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Recent Scans</h3>
               <button onClick={() => setActivePage('history')} className="text-[10px] font-black text-emerald-600 hover:underline tracking-widest uppercase">View All</button>
             </div>
             {history.length === 0 ? (
               <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-[48px] flex flex-col items-center gap-4 opacity-40">
                  <Logo size="lg" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No history found</p>
               </div>
             ) : (
               <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {history.slice(0, 5).map((item) => (
                    <div key={item.id} className="group p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-5 hover:border-emerald-200 hover:shadow-xl transition-all cursor-pointer">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300">🔍</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm capitalize truncate mb-1">{item.result.item_detected}</p>
                        <div className="flex gap-2">
                           <span className={`text-[10px] font-black uppercase ${item.result.bin_recommendation.stream === 'Recyclables' ? 'text-sky-500' : 'text-slate-400'}`}>{item.result.bin_recommendation.stream}</span>
                           <span className="text-[10px] font-black text-slate-200">/</span>
                           <span className="text-[10px] font-black uppercase text-slate-400 truncate">{item.result.location.country}</span>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="animate-in fade-in duration-1000 bg-white">
      {/* High-Impact Hero - Refined White Typography */}
      <section className="relative w-full h-[600px] overflow-hidden">
        <img src={ABOUT_HERO_URL} alt="Inside the Pipeline" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-white flex flex-col items-center justify-center text-center px-10">
          <div className="max-w-5xl space-y-6 pt-20">
            <div className="inline-flex items-center gap-3 px-6 py-2 bg-emerald-500/90 backdrop-blur text-white rounded-full text-[10px] font-black tracking-widest uppercase shadow-xl mb-4">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Intelligence Core v3.0
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight drop-shadow-2xl text-white">
              Inside the <br/>
              EcoSort Pipeline
            </h2>
            <div className="max-w-3xl mx-auto space-y-4">
              <p className="text-slate-900 text-lg md:text-xl font-bold leading-relaxed bg-white/60 backdrop-blur-xl rounded-[32px] p-6 shadow-2xl border border-white/50">
                EcoSort leverages a state-of-the-art visual pipeline combining Computer Vision with Grounded Rule-Based Reasoning.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                {["Powered by Gemini 3 Flash", "Rule-Based Engine", "Explainable AI"].map(tag => (
                  <span key={tag} className="px-4 py-2 bg-slate-900/80 backdrop-blur text-white text-[9px] font-black tracking-[0.2em] uppercase rounded-full shadow-lg">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Intelligence Pipeline */}
      <section className="max-w-7xl mx-auto px-10 pb-32 pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
          {/* Timeline Pipeline */}
          <div className="lg:col-span-7 relative">
            <div className="absolute left-8 md:left-12 top-0 bottom-0 w-2 bg-slate-100 rounded-full hidden md:block" />
            
            <div className="space-y-24">
              {[
                { step: "01", title: "Image Acquisition", desc: "User captures a real-time photo. Our system optimizes the frame for clarity, removing lighting artifacts while ensuring maximum privacy.", icon: "📸", color: "bg-sky-500" },
                { step: "02", title: "Visual Understanding", desc: "Gemini 3 Flash identifies object geometry, texture, and brand. We detect material composition down to the resin code (#1-#7) when visible.", icon: "🤖", color: "bg-emerald-500" },
                { step: "03", title: "Material Reasoning", desc: "AI evaluates contamination levels (e.g., leftover food in a pizza box) to determine if the item can safely enter the recycling stream.", icon: "🔍", color: "bg-purple-500" },
                { step: "04", title: "Location-Aware Rules", desc: "Our engine cross-references detected materials with the user's regional rules (e.g., Malaysia's 'Smart Sorting' guidelines) to provide precise advice.", icon: "📍", color: "bg-amber-500" },
                { step: "05", title: "Smart Recommendation", desc: "The system outputs actionable instructions: which bin to use, how to prep the item (rinse, dry, remove label), and why.", icon: "♻️", color: "bg-slate-900" },
                { step: "06", title: "Impact Analysis", desc: "Every scan contributes to a personal and global dashboard tracking CO₂ offset and estimated landfill diversion weight.", icon: "📊", color: "bg-pink-500" }
              ].map((item, i) => (
                <div key={i} className="group flex items-start gap-8 md:gap-16 relative">
                  <div className="relative z-10 flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full bg-white border-[6px] border-slate-50 shadow-2xl flex items-center justify-center transition-all group-hover:scale-110">
                    <div className={`absolute inset-0 ${item.color} opacity-10 rounded-full`} />
                    <span className="text-3xl md:text-4xl">{item.icon}</span>
                  </div>

                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-4">
                      <span className={`text-[12px] font-black px-3 py-1 rounded-full text-white ${item.color} tracking-widest`}>STEP {item.step}</span>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{item.title}</h3>
                    </div>
                    <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-xl">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar: Tech Showcase */}
          <div className="lg:col-span-5 space-y-12">
            <div className="sticky top-32 space-y-12">
              <div className="bg-slate-50 rounded-[48px] p-10 border border-slate-100 shadow-xl space-y-8">
                <p className="text-[10px] font-black text-emerald-600 tracking-[0.3em] uppercase">Example Engine Output</p>
                <div className="aspect-square bg-white rounded-[32px] overflow-hidden shadow-inner flex items-center justify-center p-4">
                   <img src="https://bernardlab.com/wp-content/uploads/2021/01/plastic-bottles.png" className="w-full h-full object-cover rounded-2xl" alt="Example Item" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Detection</p>
                      <p className="text-2xl font-black text-slate-900">Plastic Water Bottle</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-500 uppercase">Confidence</p>
                      <p className="text-xl font-black text-emerald-600">98.4%</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-white rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Bin Target</p>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-600 shadow-lg shadow-blue-100" />
                        <span className="font-black text-sm">Recyclables</span>
                      </div>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Action</p>
                      <p className="font-black text-sm">Rinse & Cap Off</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-[48px] p-12 space-y-6 shadow-2xl">
                <h4 className="text-3xl font-black tracking-tighter leading-tight">Beyond Simple <br/>Object Detection.</h4>
                <p className="text-slate-400 font-medium leading-relaxed">
                  Most waste apps simply guess the item. EcoSort understands the <strong>context</strong>. A paper bag is recyclable, but a food-stained greasy paper bag is residual waste. Our rule engine accounts for these nuances in every decision.
                </p>
                <div className="pt-4 flex items-center gap-4">
                   <div className="flex -space-x-4">
                      <div className="w-12 h-12 rounded-full border-4 border-slate-900 bg-emerald-500 flex items-center justify-center text-xl">🌱</div>
                      <div className="w-12 h-12 rounded-full border-4 border-slate-900 bg-blue-500 flex items-center justify-center text-xl">♻️</div>
                      <div className="w-12 h-12 rounded-full border-4 border-slate-900 bg-purple-500 flex items-center justify-center text-xl">🤖</div>
                   </div>
                   <p className="text-[10px] font-black tracking-widest uppercase text-white/40">Multi-Model Fusion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderHistory = () => (
    <div className="max-w-7xl mx-auto px-10 py-24 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
        <div className="space-y-4 text-center sm:text-left">
          <h2 className="text-7xl font-black text-slate-900 tracking-tighter">My <span className="text-emerald-500">Scans</span></h2>
          <p className="text-slate-500 text-xl font-medium">Track your environmental contribution and sorting journey.</p>
        </div>
        <div className="flex items-center gap-4 justify-center sm:justify-start">
           <button onClick={clearHistory} className="px-8 py-4 text-[10px] font-black tracking-widest uppercase text-red-500 border border-red-100 hover:bg-red-50 rounded-2xl transition-all">Clear All</button>
           <div className="px-8 py-4 bg-slate-900 text-white rounded-2xl">
             <span className="text-[10px] font-black tracking-widest uppercase opacity-40 block mb-1">Lifetime Diversion</span>
             <span className="text-2xl font-black">{stats.rate}%</span>
           </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-32 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-[64px] flex flex-col items-center gap-8">
          <div className="text-8xl grayscale opacity-20">📂</div>
          <div className="space-y-2">
            <p className="text-2xl font-black text-slate-900">No History Recorded Yet</p>
            <p className="text-slate-500 font-medium">Items you scan or search for will appear here for future reference.</p>
          </div>
          <button onClick={() => setActivePage('scan')} className="px-12 py-5 bg-emerald-600 text-white rounded-2xl font-black tracking-widest shadow-xl shadow-emerald-100">LAUNCH CAMERA</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {history.map((item) => (
            <div key={item.id} className="group bg-white rounded-[40px] border border-slate-100 p-8 space-y-6 hover:shadow-2xl hover:border-emerald-200 transition-all">
              <div className="flex justify-between items-start">
                <div className="w-20 h-20 rounded-[28px] bg-slate-50 overflow-hidden flex-shrink-0 shadow-inner">
                  {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🔍</div>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <h4 className="text-3xl font-black text-slate-900 capitalize truncate tracking-tighter">{item.result.item_detected}</h4>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase text-slate-500">{item.result.material}</span>
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase text-slate-500">{item.result.location.country}</span>
                </div>
              </div>

              <div className={`p-6 rounded-[32px] flex items-center justify-between shadow-sm border border-black/5 ${
                item.result.bin_recommendation.bin_color === 'Blue' ? 'bg-blue-600 text-white' :
                item.result.bin_recommendation.bin_color === 'Green' ? 'bg-emerald-600 text-white' :
                item.result.bin_recommendation.bin_color === 'Yellow' ? 'bg-yellow-400 text-slate-900' :
                item.result.bin_recommendation.bin_color === 'Red' ? 'bg-red-600 text-white' :
                item.result.bin_recommendation.bin_color === 'Black' ? 'bg-slate-900 text-white' :
                'bg-slate-100 text-slate-700'
              }`}>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Recommendation</p>
                  <p className="font-black text-sm">{item.result.bin_recommendation.stream}</p>
                </div>
                <span className="text-3xl">
                  {item.result.bin_recommendation.stream === 'Recyclables' ? '♻️' : 
                   item.result.bin_recommendation.stream === 'Organic' ? '🌿' : '🗑️'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderScan = () => (
    <div className="max-w-4xl mx-auto px-10 py-20 animate-in fade-in zoom-in-95 duration-700">
      <div className="text-center mb-16 space-y-4">
        <h2 className="text-6xl font-black text-slate-900 tracking-tighter">AI Analysis</h2>
        <div className="flex items-center justify-center gap-3">
          <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
            {location.country}
          </span>
          <button onClick={() => setIsLocating(true)} className="text-[10px] font-black text-slate-400 hover:text-slate-900 underline underline-offset-4 tracking-widest uppercase">Adjust Region</button>
        </div>
      </div>

      {(!currentResult && !isProcessing && !error) ? (
        <ImageUploader onImageCaptured={handleImageCaptured} isProcessing={isProcessing} />
      ) : (
        <div className="space-y-12 max-w-2xl mx-auto">
          {isProcessing && (
            <div className="w-full aspect-square bg-white rounded-[56px] border border-slate-100 shadow-2xl flex flex-col items-center justify-center space-y-10 animate-pulse">
               <div className="w-24 h-24 border-8 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
               <div className="text-center space-y-2">
                  <p className="font-black text-slate-900 text-2xl tracking-tighter">Consulting AI Knowledge</p>
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Matching Regional Disposal Logic</p>
               </div>
            </div>
          )}
          
          {error && (
            <div className="w-full p-20 bg-red-50 border border-red-100 rounded-[56px] text-center space-y-8">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto text-4xl">⚠️</div>
              <p className="text-red-600 font-black text-2xl">{error}</p>
              <button onClick={() => { setCurrentResult(null); setError(null); }} className="px-14 py-6 bg-red-600 text-white rounded-[32px] font-black tracking-widest shadow-xl transition-all">TRY AGAIN</button>
            </div>
          )}

          {currentResult && (
            <div className="animate-in slide-in-from-bottom-12 duration-700">
              <ResultCard result={currentResult} imageUrl={previewUrl || ''} />
              <div className="flex justify-center pt-12">
                <button 
                  onClick={() => { setCurrentResult(null); setPreviewUrl(null); }} 
                  className="px-16 py-7 bg-slate-900 text-white rounded-[40px] font-black tracking-[0.2em] shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center gap-4"
                >
                  NEW SCAN
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 left-0 right-0 z-[100] transition-all duration-700 px-6 sm:px-10 py-4 bg-white/70 backdrop-blur-xl border-b border-slate-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => setActivePage('home')} className="flex items-center gap-3 sm:gap-4 group">
            <Logo size="md" />
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter group-hover:text-emerald-600 transition-colors">EcoSort</h1>
          </button>
          
          <div className="hidden md:flex items-center gap-8 lg:gap-10">
            {[
              { id: 'home', label: 'HOME' },
              { id: 'about', label: 'ABOUT' },
              { id: 'guide', label: 'GUIDE' },
              { id: 'scan', label: 'SCANNER' },
              { id: 'game', label: 'REWARDS' },
              { id: 'history', label: 'HISTORY' }
            ].map((nav) => (
              <button 
                key={nav.id}
                onClick={() => setActivePage(nav.id as Page)} 
                className={`text-[10px] font-black tracking-[0.4em] transition-all relative py-2 ${activePage === nav.id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-900'}`}
              >
                {nav.label}
                {activePage === nav.id && <span className="absolute -bottom-1 left-0 right-0 h-1 bg-emerald-500 rounded-full" />}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
             <div className="px-5 py-2.5 bg-slate-900 text-white rounded-full text-[9px] font-black tracking-[0.2em] shadow-xl border border-white/10 flex items-center gap-2.5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               {ecoPoints} PTS
             </div>
          </div>
        </div>
      </nav>

      <main className="min-h-screen">
        {activePage === 'home' && renderHome()}
        <div className={activePage !== 'home' ? 'pt-0' : ''}>
          {activePage === 'scan' && <div className="pt-24">{renderScan()}</div>}
          {activePage === 'about' && renderAbout()}
          {activePage === 'game' && <div className="pt-24">{renderGame()}</div>}
          {activePage === 'history' && <div className="pt-24">{renderHistory()}</div>}
          {activePage === 'guide' && (
            <div className="max-w-7xl mx-auto px-10 py-24 space-y-24 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-32">
               <div className="text-center space-y-6 max-w-3xl mx-auto">
                  <h2 className="text-7xl font-black text-slate-900 tracking-tighter leading-tight">Universal <span className="text-emerald-500">Waste</span> Code</h2>
                  <p className="text-slate-500 text-xl font-medium">Standardized guidance for global sustainability.</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    { color: "Recycle", items: "Cardboard, Clean Paper, Plastic Bottles (#1, #2), Aluminum Cans.", label: "Mainstream", bg: "bg-blue-600", text: "text-white" },
                    { color: "Organic", items: "Food scraps, yard waste, compostable paper.", label: "Compost", bg: "bg-emerald-600", text: "text-white" },
                    { color: "Residual", items: "Nappies, tissues, food-soiled packaging, non-recyclable plastic.", label: "Landfill", bg: "bg-red-600", text: "text-white" },
                    { color: "Specialty", items: "Batteries, bulbs, electronics, hazardous chemicals.", label: "E-Waste", bg: "bg-slate-900", text: "text-white" }
                  ].map(bin => (
                    <div key={bin.color} className={`p-10 rounded-[56px] shadow-xl flex flex-col gap-6 ${bin.bg} ${bin.text} transition-transform hover:-translate-y-4`}>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{bin.label}</p>
                      <h4 className="text-3xl font-black tracking-tighter leading-none">{bin.color}</h4>
                      <p className="font-bold opacity-80 leading-relaxed text-sm">{bin.items}</p>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-10 py-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 font-black text-[10px] tracking-widest uppercase">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <span>© 2025 EcoSort Global</span>
        </div>
        <div className="flex gap-8">
          <button onClick={() => setActivePage('about')} className="hover:text-emerald-500 transition-colors">How it works</button>
          <button onClick={() => setActivePage('game')} className="hover:text-emerald-500 transition-colors">Rewards Program</button>
          <button onClick={() => setActivePage('history')} className="hover:text-emerald-500 transition-colors">My activity</button>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        ::selection { background: #10b981; color: white; }
      `}</style>
    </div>
  );
};

export default App;