
import React from 'react';
import { WasteClassification } from '../types';

interface ResultCardProps {
  result: WasteClassification;
  imageUrl?: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, imageUrl }) => {
  const getBinBgColor = (color: string) => {
    switch (color) {
      case 'Blue': return 'bg-blue-600 text-white shadow-blue-200';
      case 'White': return 'bg-white text-slate-900 border border-slate-200 shadow-slate-100';
      case 'Green': return 'bg-emerald-600 text-white shadow-emerald-200';
      case 'Black': return 'bg-slate-900 text-white shadow-slate-400';
      case 'Brown': return 'bg-amber-800 text-white shadow-amber-200';
      case 'Yellow': return 'bg-yellow-400 text-slate-900 shadow-yellow-100';
      case 'Red': return 'bg-red-600 text-white shadow-red-200';
      default: return 'bg-slate-200 text-slate-700 shadow-slate-100';
    }
  };

  const getBinIcon = (stream: string) => {
    switch (stream) {
      case 'Recyclables': return '♻️';
      case 'Residual': return '🗑️';
      case 'Organic': return '🌿';
      case 'E-waste': return '🔋';
      case 'Hazardous': return '⚠️';
      default: return '❓';
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 transition-all animate-in slide-in-from-bottom-8 duration-700">
      {imageUrl && (
        <div className="relative h-72 w-full">
          <img src={imageUrl} alt={result.item_detected} className="w-full h-full object-cover" />
          <div className="absolute top-6 right-6 px-4 py-2 bg-black/50 backdrop-blur-xl rounded-2xl text-[10px] font-black text-white uppercase tracking-widest border border-white/20">
            {result.confidence}% Match
          </div>
        </div>
      )}

      <div className="p-10 space-y-8">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Detected Item</h3>
            <p className="text-4xl font-black text-slate-900 capitalize tracking-tighter leading-none">{result.item_detected}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500">{result.material}</span>
              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500">
                {result.location.country}
              </span>
            </div>
          </div>
          
          <div className={`p-6 rounded-[32px] flex flex-col items-center gap-2 text-center min-w-[140px] shadow-xl ${getBinBgColor(result.bin_recommendation.bin_color)}`}>
            <span className="text-5xl">{getBinIcon(result.bin_recommendation.stream)}</span>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{result.bin_recommendation.stream}</p>
              <p className="font-black text-sm whitespace-nowrap">{result.bin_recommendation.bin_color} Bin</p>
            </div>
          </div>
        </div>

        {result.needs_followup && result.followup_question && (
          <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-3xl space-y-2">
            <p className="text-amber-800 font-black text-xs uppercase tracking-widest">Question for Accuracy</p>
            <p className="text-amber-900 font-bold italic">“{result.followup_question}”</p>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Why this bin?</p>
          <ul className="space-y-3">
            {result.why.map((reason, idx) => (
              <li key={idx} className="flex gap-3 text-slate-700 font-medium text-sm leading-relaxed">
                <span className="text-emerald-500 font-black">✔</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Instructions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.bin_recommendation.instructions.map((inst, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-700 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500">{idx + 1}</span>
                {inst}
              </div>
            ))}
          </div>
        </div>

        {result.sources && result.sources.length > 0 && (
          <div className="pt-8 border-t border-slate-100 space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sources & Local Info</h4>
            <div className="flex flex-col gap-2">
              {result.sources.map((s, idx) => (
                <a key={idx} href={s.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-bold flex items-center gap-2 hover:underline group">
                  <div className="w-2 h-2 rounded-full bg-blue-100 group-hover:bg-blue-600 transition-colors" />
                  <span className="truncate">{s.web.title || s.web.uri}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
