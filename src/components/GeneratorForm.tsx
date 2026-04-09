import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GeneratorFormProps {
  onGenerate: (data: any) => void;
  isGenerating: boolean;
}

export default function GeneratorForm({ onGenerate, isGenerating }: GeneratorFormProps) {
  const [theme, setTheme] = useState('Blue-and-white chinoiserie ginger jar with flowers');
  const [style, setStyle] = useState('traditional');
  const [meshCount, setMeshCount] = useState('13');
  const [shape, setShape] = useState('square');
  const [finishedWidth, setFinishedWidth] = useState('4');
  const [finishedHeight, setFinishedHeight] = useState('4');
  const [complexity, setComplexity] = useState('intermediate');
  const [maxColors, setMaxColors] = useState('12');
  const [monogram, setMonogram] = useState('');
  const [borderInches, setBorderInches] = useState('2');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    const width = parseFloat(finishedWidth);
    const height = parseFloat(finishedHeight);
    const mesh = parseInt(meshCount);
    const colors = parseInt(maxColors);
    
    if (width * mesh > 300 || height * mesh > 300) {
      setFormError(`Design is too large (${width * mesh}x${height * mesh} stitches). For V1, please keep stitch count under 300x300.`);
      return;
    }
    
    // Proceed with generation
    onGenerate({
      theme,
      style,
      meshCount,
      shape,
      finishedWidth,
      finishedHeight,
      complexity,
      maxColors,
      monogram,
      borderInches
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-6">Design Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
            {formError}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Theme or Idea</label>
          <textarea 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            required
            placeholder="e.g. Golden retriever in a blue armchair"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Style</label>
            <select 
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="traditional">Traditional</option>
              <option value="whimsical">Whimsical</option>
              <option value="preppy">Preppy</option>
              <option value="modern">Modern</option>
              <option value="vintage">Vintage</option>
              <option value="coastal">Coastal</option>
              <option value="holiday">Holiday</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mesh Count</label>
            <select
              value={meshCount}
              onChange={(e) => setMeshCount(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="13">13 Mesh</option>
              <option value="18">18 Mesh</option>
            </select>
            <p className="text-xs text-neutral-400 mt-1">
              {meshCount === '13' ? 'Prints at 312 DPI' : 'Prints at 306 DPI'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Shape</label>
            <select 
              value={shape}
              onChange={(e) => setShape(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="square">Square</option>
              <option value="rectangle">Rectangle</option>
              <option value="round">Round Ornament</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Complexity</label>
            <select 
              value={complexity}
              onChange={(e) => setComplexity(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Width (in)</label>
            <input 
              type="number" 
              step="0.5"
              min="1"
              max="20"
              value={finishedWidth}
              onChange={(e) => setFinishedWidth(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Height (in)</label>
            <input 
              type="number" 
              step="0.5"
              min="1"
              max="20"
              value={finishedHeight}
              onChange={(e) => setFinishedHeight(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Max Colors: {maxColors}
          </label>
          <input 
            type="range" 
            min="3" 
            max="30" 
            value={maxColors}
            onChange={(e) => setMaxColors(e.target.value)}
            className="w-full accent-indigo-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Optional Monogram/Text</label>
          <input
            type="text"
            value={monogram}
            onChange={(e) => setMonogram(e.target.value)}
            placeholder="e.g. ABC"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Border (inches each side)</label>
          <select
            value={borderInches}
            onChange={(e) => setBorderInches(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="1.5">1.5"</option>
            <option value="2">2" (standard)</option>
            <option value="2.5">2.5"</option>
            <option value="3">3"</option>
          </select>
          <p className="text-xs text-neutral-400 mt-1">Unstitched margin for stretching/framing</p>
        </div>

        <button 
          type="submit" 
          disabled={isGenerating}
          className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Generating Concepts...
            </>
          ) : (
            'Generate Concepts'
          )}
        </button>
      </form>
    </div>
  );
}
