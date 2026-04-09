import React, { useState } from 'react';
import GeneratorForm from './components/GeneratorForm';
import Gallery from './components/Gallery';
import DesignDetailModal from './components/DesignDetailModal';
import { X } from 'lucide-react';

export type DesignConcept = {
  id: string;
  title: string;
  originalPrompt: string;
  style: string;
  meshCount: number;
  finishedWidth: number;
  finishedHeight: number;
  maxColors: number;
  imageUrl: string;
  needlepointabilityScore: number;
  warnings: string[];
  productionWarnings?: string[];
  collapseWarnings?: string[];
  badges: string[];
  // Processed fields
  designStitchesWide?: number;
  designStitchesHigh?: number;
  borderInchesEachSide?: number;
  totalCanvasWidthInches?: number;
  totalCanvasHeightInches?: number;
  actualColorCount?: number;
  palette?: { hex: string; name: string; dmcNumber?: string }[];
  fullPalette?: { hex: string; name: string; dmcNumber?: string; stitchCount: number; percentageOfDesign: number }[];
  designPalette?: { hex: string; name: string; dmcNumber?: string; stitchCount: number; percentageOfDesign: number }[];
  backgroundColor?: { hex: string; name: string; dmcNumber?: string; stitchCount: number; percentageOfDesign: number } | null;
  effectiveDpi?: number;
  pixelsPerStitch?: number;
  simplificationNotes?: string;
  stitchGridPreviewUrl?: string;
  paintedCanvasPreviewUrl?: string;
  rawStitchData?: string;
  productionConfidenceScore?: number;
  detailPreservationScore?: number;
  recommendedMinimumMesh?: number;
  recommendedMinimumSizeInches?: number;
};

export default function App() {
  const [concepts, setConcepts] = useState<DesignConcept[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<DesignConcept | null>(null);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true);
    setGlobalError(null);
    try {
      const response = await fetch('/api/generate-concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Invalid response from server. The server might have crashed.");
      }
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate concepts");
      }
      
      setConcepts(data.candidates || []);
      setSelectedForExport(new Set()); // Reset selection
    } catch (error: any) {
      console.error("Failed to generate concepts", error);
      setGlobalError(error.message || "Failed to generate concepts. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProcessDesign = async (concept: DesignConcept) => {
    if (concept.stitchGridPreviewUrl) {
      setSelectedConcept(concept);
      return;
    }

    setGlobalError(null);
    setProcessingId(concept.id);
    try {
      const response = await fetch('/api/process-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept }),
      });
      
      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Invalid response from server.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to process design");
      }
      
      // Update the concept in the list with processed data
      setConcepts(prev => prev.map(c => c.id === concept.id ? data.processedDesign : c));
      setSelectedConcept(data.processedDesign);
    } catch (error: any) {
      console.error("Failed to process design", error);
      setGlobalError(error.message || "Failed to process design. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExportSelection = (id: string) => {
    const newSelection = new Set(selectedForExport);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedForExport(newSelection);
  };

  const handleExport = async (format: 'png' | 'pdf' | 'zip' | 'json') => {
    let designsToExport = concepts.filter(c => selectedForExport.has(c.id));
    setGlobalError(null);
    
    // Ensure all selected designs are processed before export
    const unprocessed = designsToExport.filter(c => !c.rawStitchData);
    if (unprocessed.length > 0) {
      setExportProgress(`Processing ${unprocessed.length} design(s) before export...`);
      
      const processedDesigns = [...designsToExport];
      for (let i = 0; i < unprocessed.length; i++) {
        const concept = unprocessed[i];
        setExportProgress(`Processing design ${i + 1} of ${unprocessed.length}...`);
        try {
          const response = await fetch('/api/process-design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concept }),
          });
          
          let data;
          try {
            data = await response.json();
          } catch (err) {
            throw new Error("Invalid response from server.");
          }

          if (!response.ok) {
            throw new Error(data.error || "Failed to process design");
          }
          
          // Update in our local array
          const index = processedDesigns.findIndex(c => c.id === concept.id);
          if (index !== -1) {
            processedDesigns[index] = data.processedDesign;
          }
          
          // Update in global state
          setConcepts(prev => prev.map(c => c.id === concept.id ? data.processedDesign : c));
        } catch (error: any) {
          console.error("Failed to process design during export", error);
          setGlobalError(`Failed to process "${concept.title}". Export aborted.`);
          setExportProgress(null);
          return;
        }
      }
      
      designsToExport = processedDesigns;
    }

    setExportProgress(`Generating ${format.toUpperCase()} export...`);

    if (format === 'json') {
      const dataStr = JSON.stringify(designsToExport, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `needlepoint-metadata.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setExportProgress(null);
      return;
    }

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designs: designsToExport, format }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `needlepoint-export.${format === 'zip' ? 'zip' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Export failed", error);
      setGlobalError(error.message || "Export failed. Please try again.");
    } finally {
      setExportProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-indigo-900">Needlepoint Canvas Generator</h1>
          {selectedForExport.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-neutral-600">{selectedForExport.size} selected</span>
              <button onClick={() => handleExport('zip')} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors">
                Export ZIP
              </button>
            </div>
          )}
        </div>
      </header>

      {exportProgress && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-lg flex items-center shadow-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-3"></div>
            <p className="font-medium">{exportProgress}</p>
          </div>
        </div>
      )}

      {globalError && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center shadow-sm">
            <p className="font-medium">{globalError}</p>
            <button onClick={() => setGlobalError(null)} className="text-red-500 hover:text-red-700 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 xl:col-span-3">
          <GeneratorForm onGenerate={handleGenerate} isGenerating={isGenerating} />
        </div>
        
        <div className="lg:col-span-8 xl:col-span-9">
          {concepts.length > 0 ? (
            <Gallery 
              concepts={concepts} 
              selectedForExport={selectedForExport}
              onToggleSelection={toggleExportSelection}
              onViewDetail={handleProcessDesign}
              processingId={processingId}
            />
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl bg-white text-neutral-400">
              <svg className="w-16 h-16 mb-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium text-neutral-600">No designs generated yet</p>
              <p className="text-sm">Enter a theme and adjust settings to get started.</p>
            </div>
          )}
        </div>
      </main>

      {selectedConcept && (
        <DesignDetailModal 
          concept={selectedConcept} 
          onClose={() => setSelectedConcept(null)} 
          onExport={(format) => {
            // Quick export for single item
            const tempSet = new Set([selectedConcept.id]);
            const originalSet = selectedForExport;
            setSelectedForExport(tempSet);
            handleExport(format).finally(() => setSelectedForExport(originalSet));
          }}
        />
      )}
    </div>
  );
}
