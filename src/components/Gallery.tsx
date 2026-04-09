import React from 'react';
import { DesignConcept } from '../App';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface GalleryProps {
  concepts: DesignConcept[];
  selectedForExport: Set<string>;
  onToggleSelection: (id: string) => void;
  onViewDetail: (concept: DesignConcept) => void;
  processingId?: string | null;
}

export default function Gallery({ concepts, selectedForExport, onToggleSelection, onViewDetail, processingId }: GalleryProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Generated Concepts</h2>
        <div className="flex gap-2">
          {/* Filters could go here */}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {concepts.map((concept) => {
          const isSelected = selectedForExport.has(concept.id);
          
          return (
            <div 
              key={concept.id}
              className={cn(
                "group relative bg-white rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-md",
                isSelected ? "border-indigo-500 ring-1 ring-indigo-500" : "border-neutral-200"
              )}
            >
              {/* Selection Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelection(concept.id);
                }}
                className="absolute top-3 left-3 z-10 p-1 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-colors"
              >
                {isSelected ? (
                  <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                ) : (
                  <Circle className="w-6 h-6 text-neutral-400 group-hover:text-neutral-600" />
                )}
              </button>

              {/* Image */}
              <div 
                className="w-full bg-neutral-100 cursor-pointer overflow-hidden relative"
                style={{ aspectRatio: `${concept.finishedWidth} / ${concept.finishedHeight}` }}
                onClick={() => onViewDetail(concept)}
              >
                <img 
                  src={concept.imageUrl} 
                  alt={concept.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                {/* Overlay on hover or processing */}
                <div className={cn(
                  "absolute inset-0 transition-colors flex items-center justify-center",
                  processingId === concept.id ? "bg-black/20" : "bg-black/0 group-hover:bg-black/10"
                )}>
                  {processingId === concept.id ? (
                    <span className="bg-white/90 text-neutral-900 text-sm font-medium px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-neutral-900 text-sm font-medium px-3 py-1.5 rounded-full shadow-sm transition-opacity transform translate-y-2 group-hover:translate-y-0">
                      View Details
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-4 cursor-pointer" onClick={() => onViewDetail(concept)}>
                <h3 className="font-medium text-neutral-900 truncate" title={concept.title}>
                  {concept.title}
                </h3>
                
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800">
                    {concept.meshCount} Mesh
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800">
                    {concept.finishedWidth}" × {concept.finishedHeight}"
                  </span>
                  {concept.needlepointabilityScore >= 85 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                      High Score
                    </span>
                  )}
                  {concept.badges && concept.badges.map(badge => (
                    <span key={badge} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {badge}
                    </span>
                  ))}
                </div>

                {concept.warnings && concept.warnings.length > 0 && (
                  <p className="mt-3 text-xs text-amber-600 flex items-start">
                    <span className="mr-1">⚠️</span>
                    <span className="truncate">{concept.warnings[0]}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
