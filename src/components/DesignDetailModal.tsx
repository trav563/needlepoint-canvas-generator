import React, { useState, useRef, useCallback } from 'react';
import { DesignConcept } from '../App';
import { X, Download, AlertTriangle, Palette, Ruler, Grid3x3, FileImage, FileText, FileArchive, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { cn } from '../lib/utils';

interface DesignDetailModalProps {
  concept: DesignConcept;
  onClose: () => void;
  onExport: (format: 'png' | 'pdf' | 'zip' | 'json') => void;
}

export default function DesignDetailModal({ concept, onClose, onExport }: DesignDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'art' | 'grid' | 'painted'>('art');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const isProcessed = !!concept.rawStitchData;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    const container = containerRef.current;
    if (!container) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    e.preventDefault();
  }, [zoomLevel]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = containerRef.current;
    if (!container) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    container.scrollLeft = dragStart.current.scrollLeft - dx;
    container.scrollTop = dragStart.current.scrollTop - dy;
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900 truncate pr-4">{concept.title}</h2>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
          
          {/* Left: Previews */}
          <div className="flex-1 bg-neutral-50 p-6 flex flex-col">
            {/* Tabs & Zoom */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex space-x-2">
                <button
                  onClick={() => { setActiveTab('art'); setZoomLevel(1); }}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    activeTab === 'art' ? "bg-white text-indigo-600 shadow-sm border border-neutral-200" : "text-neutral-600 hover:bg-neutral-200/50"
                  )}
                >
                  Art Preview
                </button>
                <button
                  onClick={() => { setActiveTab('grid'); setZoomLevel(1); }}
                  disabled={!isProcessed}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    activeTab === 'grid' ? "bg-white text-indigo-600 shadow-sm border border-neutral-200" : "text-neutral-600 hover:bg-neutral-200/50"
                  )}
                >
                  Inspection Grid
                </button>
                <button
                  onClick={() => { setActiveTab('painted'); setZoomLevel(1); }}
                  disabled={!isProcessed}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    activeTab === 'painted' ? "bg-white text-indigo-600 shadow-sm border border-neutral-200" : "text-neutral-600 hover:bg-neutral-200/50"
                  )}
                >
                  Canvas Texture
                </button>
              </div>
              
              {activeTab !== 'art' && isProcessed && (
                <div className="flex items-center space-x-2 bg-white border border-neutral-200 rounded-lg p-1 shadow-sm">
                  <button 
                    onClick={() => setZoomLevel(Math.max(1, zoomLevel - 1))}
                    disabled={zoomLevel <= 1}
                    className="p-1 text-neutral-500 hover:text-neutral-700 disabled:opacity-30"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium text-neutral-600 w-12 text-center">
                    {zoomLevel * 100}%
                  </span>
                  <button 
                    onClick={() => setZoomLevel(Math.min(4, zoomLevel + 1))}
                    disabled={zoomLevel >= 4}
                    className="p-1 text-neutral-500 hover:text-neutral-700 disabled:opacity-30"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Image Container */}
            <div
              ref={containerRef}
              className={cn(
                "flex-1 bg-neutral-200/50 rounded-xl border border-neutral-200 overflow-auto relative min-h-[400px]",
                zoomLevel <= 1 && "flex items-center justify-center",
                zoomLevel > 1 && isDragging && "cursor-grabbing",
                zoomLevel > 1 && !isDragging && "cursor-grab"
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {!isProcessed && activeTab !== 'art' ? (
                <div className="flex flex-col items-center text-neutral-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                  <p>Processing design...</p>
                </div>
              ) : (
                <div className={cn(
                  "p-4",
                  zoomLevel <= 1 && "flex items-center justify-center w-full h-full"
                )}>
                  <img
                    src={
                      activeTab === 'art' ? concept.imageUrl :
                      activeTab === 'grid' ? concept.stitchGridPreviewUrl :
                      concept.paintedCanvasPreviewUrl
                    }
                    alt={`${activeTab} preview`}
                    className={cn(
                      "object-contain select-none",
                      zoomLevel <= 1 && "max-w-full max-h-full",
                      activeTab !== 'art' && "pixelated"
                    )}
                    style={{
                      imageRendering: activeTab !== 'art' ? 'pixelated' : 'auto',
                      width: activeTab !== 'art' && zoomLevel > 1 ? `${zoomLevel * 100}%` : undefined,
                      height: activeTab !== 'art' && zoomLevel > 1 ? 'auto' : undefined,
                    }}
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              {zoomLevel > 1 && (
                <div className="sticky bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full pointer-events-none w-fit mx-auto">
                  <Move className="w-3 h-3" />
                  Click & drag to pan
                </div>
              )}
            </div>
          </div>

          {/* Right: Metadata & Export */}
          <div className="w-full lg:w-96 border-l border-neutral-200 bg-white flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto space-y-8">
              
              {/* Specs */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4 flex items-center">
                  <Ruler className="w-4 h-4 mr-2" />
                  Dimensions
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div>
                    <dt className="text-neutral-500">Finished Size</dt>
                    <dd className="font-medium text-neutral-900">{concept.finishedWidth}" × {concept.finishedHeight}"</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Mesh Count</dt>
                    <dd className="font-medium text-neutral-900">{concept.meshCount}</dd>
                  </div>
                  {isProcessed && (
                    <>
                      <div>
                        <dt className="text-neutral-500">Stitch Count</dt>
                        <dd className="font-medium text-neutral-900">{concept.designStitchesWide}w × {concept.designStitchesHigh}h</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Total Canvas Cut</dt>
                        <dd className="font-medium text-neutral-900">{concept.totalCanvasWidthInches}" × {concept.totalCanvasHeightInches}"</dd>
                      </div>
                      {concept.effectiveDpi && (
                        <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-md p-2">
                          <dt className="text-blue-600 text-xs font-semibold">Print Setting</dt>
                          <dd className="font-medium text-blue-900">Set printer to {concept.effectiveDpi} DPI ({concept.pixelsPerStitch}px per stitch)</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
              </section>

              {/* Palette */}
              {isProcessed && (concept.designPalette || concept.palette) && (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4 flex items-center">
                    <Palette className="w-4 h-4 mr-2" />
                    Palette ({concept.actualColorCount} colors)
                  </h3>
                  
                  {concept.backgroundColor && (
                    <div className="mb-4">
                      <p className="text-xs text-neutral-500 mb-2 uppercase tracking-wider font-semibold">Background</p>
                      <div className="flex items-center gap-3 p-2 rounded-lg border border-neutral-200 bg-neutral-50">
                        <div 
                          className="w-8 h-8 rounded-full shadow-sm border border-neutral-200 shrink-0"
                          style={{ backgroundColor: typeof concept.backgroundColor === 'string' ? concept.backgroundColor : concept.backgroundColor.hex }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">
                            {typeof concept.backgroundColor !== 'string' && concept.backgroundColor.dmcNumber
                              ? `DMC ${concept.backgroundColor.dmcNumber}`
                              : (typeof concept.backgroundColor === 'string' ? concept.backgroundColor : concept.backgroundColor.name)}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {typeof concept.backgroundColor !== 'string' && concept.backgroundColor.dmcNumber ? concept.backgroundColor.name + ' ' : ''}
                            {(typeof concept.backgroundColor === 'string' ? concept.backgroundColor : concept.backgroundColor.hex)?.toUpperCase()}
                          </p>
                        </div>
                        {typeof concept.backgroundColor !== 'string' && (
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-neutral-900">{concept.backgroundColor.percentageOfDesign !== undefined ? Math.round(concept.backgroundColor.percentageOfDesign) + '%' : ''}</p>
                            <p className="text-xs text-neutral-500">{concept.backgroundColor.stitchCount?.toLocaleString()} sts</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    {concept.designPalette && <p className="text-xs text-neutral-500 mb-2 uppercase tracking-wider font-semibold">Design Colors</p>}
                    <div className="space-y-2">
                      {(concept.designPalette || concept.palette)?.map((color: any, i: number) => {
                        const hex = typeof color === 'string' ? color : color.hex;
                        const name = typeof color === 'string' ? color : color.name;
                        return (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-neutral-100 hover:bg-neutral-50 transition-colors">
                            <div 
                              className="w-8 h-8 rounded-full shadow-sm border border-neutral-200 shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900 truncate">
                                {color.dmcNumber ? `DMC ${color.dmcNumber}` : name}
                              </p>
                              <p className="text-xs text-neutral-500">{color.dmcNumber ? name : ''} {hex?.toUpperCase()}</p>
                            </div>
                            {typeof color !== 'string' && color.percentageOfDesign !== undefined && (
                              <div className="text-right shrink-0">
                                <p className="text-sm font-medium text-neutral-900">{color.percentageOfDesign < 1 ? '<1' : Math.round(color.percentageOfDesign)}%</p>
                                <p className="text-xs text-neutral-500">{color.stitchCount?.toLocaleString()} sts</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* Recommendations */}
              {isProcessed && (concept.recommendedMinimumMesh || concept.recommendedMinimumSizeInches) && (
                <section className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-indigo-600" />
                    Production Recommendations
                  </h3>
                  <ul className="space-y-2 text-sm text-indigo-800">
                    {concept.recommendedMinimumMesh && (
                      <li className="flex justify-between">
                        <span className="text-indigo-600/80">Minimum Mesh:</span>
                        <span className="font-medium">{concept.recommendedMinimumMesh} count</span>
                      </li>
                    )}
                    {concept.recommendedMinimumSizeInches && (
                      <li className="flex justify-between">
                        <span className="text-indigo-600/80">Minimum Size:</span>
                        <span className="font-medium">{concept.recommendedMinimumSizeInches}"</span>
                      </li>
                    )}
                    <li className="flex justify-between pt-2 border-t border-indigo-200/50 mt-2">
                      <span className="text-indigo-600/80">Best Suited For:</span>
                      <span className="font-medium">
                        {concept.meshCount <= 13 && concept.detailPreservationScore && concept.detailPreservationScore < 80 
                          ? '18 Mesh (Safer)' 
                          : `${concept.meshCount} Mesh`}
                      </span>
                    </li>
                  </ul>
                </section>
              )}

              {/* Warnings */}
              {((concept.warnings && concept.warnings.length > 0) || (concept.productionWarnings && concept.productionWarnings.length > 0) || (concept.collapseWarnings && concept.collapseWarnings.length > 0)) && (
                <section className="space-y-4">
                  {concept.warnings && concept.warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-800 flex items-center mb-2">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Model Warnings
                      </h3>
                      <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                        {concept.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {concept.productionWarnings && concept.productionWarnings.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-orange-800 flex items-center mb-2">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Production Warnings
                      </h3>
                      <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                        {concept.productionWarnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {concept.collapseWarnings && concept.collapseWarnings.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-red-800 flex items-center mb-2">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Detail Collapse Warnings
                      </h3>
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {concept.collapseWarnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                      {concept.recommendedMinimumMesh && (
                        <p className="mt-2 text-xs font-medium text-red-800">
                          See recommendations below for safer sizing.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Score */}
              <section className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">Needlepointability Score</span>
                    <span className={cn(
                      "text-sm font-bold",
                      concept.needlepointabilityScore >= 80 ? "text-green-600" :
                      concept.needlepointabilityScore >= 60 ? "text-amber-600" : "text-red-600"
                    )}>
                      {concept.needlepointabilityScore}/100
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                    <div 
                      className={cn(
                        "h-1.5 rounded-full",
                        concept.needlepointabilityScore >= 80 ? "bg-green-500" :
                        concept.needlepointabilityScore >= 60 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${concept.needlepointabilityScore}%` }}
                    ></div>
                  </div>
                </div>

                {isProcessed && concept.productionConfidenceScore !== undefined && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-700">Production Confidence</span>
                      <span className={cn(
                        "text-sm font-bold",
                        concept.productionConfidenceScore >= 80 ? "text-green-600" :
                        concept.productionConfidenceScore >= 60 ? "text-amber-600" : "text-red-600"
                      )}>
                        {concept.productionConfidenceScore}/100
                      </span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                      <div 
                        className={cn(
                          "h-1.5 rounded-full",
                          concept.productionConfidenceScore >= 80 ? "bg-green-500" :
                          concept.productionConfidenceScore >= 60 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${concept.productionConfidenceScore}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {isProcessed && concept.detailPreservationScore !== undefined && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-700">Detail Preservation</span>
                      <span className={cn(
                        "text-sm font-bold",
                        concept.detailPreservationScore >= 80 ? "text-green-600" :
                        concept.detailPreservationScore >= 60 ? "text-amber-600" : "text-red-600"
                      )}>
                        {concept.detailPreservationScore}/100
                      </span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                      <div 
                        className={cn(
                          "h-1.5 rounded-full",
                          concept.detailPreservationScore >= 80 ? "bg-green-500" :
                          concept.detailPreservationScore >= 60 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${concept.detailPreservationScore}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </section>

            </div>

            {/* Export Actions */}
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">Export Options</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => onExport('png')}
                  disabled={!isProcessed}
                  className="w-full flex items-center justify-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                >
                  <FileImage className="w-4 h-4 mr-2" />
                  Export as PNG
                </button>
                <button 
                  onClick={() => onExport('pdf')}
                  disabled={!isProcessed}
                  className="w-full flex items-center justify-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </button>
                <button 
                  onClick={() => onExport('zip')}
                  disabled={!isProcessed}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <FileArchive className="w-4 h-4 mr-2" />
                  Download ZIP Bundle
                </button>
                <button 
                  onClick={() => onExport('json')}
                  disabled={!isProcessed}
                  className="w-full flex items-center justify-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export Metadata (JSON)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
