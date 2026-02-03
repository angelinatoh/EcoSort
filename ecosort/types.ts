
export type Page = 'home' | 'scan' | 'guide' | 'about' | 'history' | 'game';

export interface Location {
  country: string;
}

export interface BinRecommendation {
  stream: 'Recyclables' | 'Residual' | 'Organic' | 'E-waste' | 'Hazardous';
  bin_color: 'Blue' | 'White' | 'Green' | 'Black' | 'Brown' | 'Yellow' | 'Red' | 'None';
  instructions: string[];
}

export interface WasteClassification {
  item_detected: string;
  material: 'paper' | 'plastic' | 'glass' | 'metal' | 'organic' | 'ewaste' | 'hazardous' | 'mixed' | 'other';
  confidence: number;
  needs_followup: boolean;
  followup_question: string | null;
  location: Location;
  bin_recommendation: BinRecommendation;
  why: string[];
  sources?: { web: { uri: string; title: string } }[];
}

export interface ScanHistory {
  id: string;
  imageUrl?: string;
  timestamp: number;
  result: WasteClassification;
  isManualSearch?: boolean;
}