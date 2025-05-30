import React, { useState } from 'react';
import { imageProcessingService } from '@/services/imageProcessingServiceInstance';

const LeafAreaDetails: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calibrationArea, setCalibrationArea] = useState<string>('');
  const [isCalibrated, setIsCalibrated] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setResult(null);
    setError(null);
    setIsCalibrated(false);
    if (file) {
      setImageUrl(URL.createObjectURL(file));
    } else {
      setImageUrl(null);
    }
  };

  const handleCalibrate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !imageUrl || !calibrationArea) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      await imageProcessingService.setCalibration(Number(calibrationArea), imageUrl);
      setIsCalibrated(true);
    } catch (err: any) {
      setError('Calibration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !imageUrl || !isCalibrated) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const analysis = await imageProcessingService.measureLeafArea(imageUrl);
      setResult(analysis);
    } catch (err: any) {
      setError('Leaf area analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded shadow mt-8">
      <h2 className="text-2xl font-bold mb-4 text-green-700">Leaf Area & Details</h2>
      <form onSubmit={handleCalibrate} className="flex flex-col gap-4 mb-4">
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Enter calibration object area (cm²)"
          value={calibrationArea}
          onChange={e => setCalibrationArea(e.target.value)}
          className="border rounded px-2 py-1"
          disabled={loading || !selectedFile}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={!selectedFile || !calibrationArea || loading}
        >
          {loading ? 'Calibrating...' : 'Calibrate'}
        </button>
      </form>
      <form onSubmit={handleAnalyze} className="flex flex-col gap-4">
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          disabled={!selectedFile || !isCalibrated || loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Leaf Area'}
        </button>
      </form>
      {imageUrl && (
        <img src={imageUrl} alt="Preview" className="mt-4 rounded border w-full" />
      )}
      {result && (
        <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
          <div className="font-semibold mb-1">Leaf Details:</div>
          <div>Leaf Area: <span className="text-green-800 font-mono">{result.leafArea?.toFixed(2) || 'N/A'} cm²</span></div>
          <div>Calibration Area: <span className="text-green-800 font-mono">{result.calibrationArea?.toFixed(2) || 'N/A'} cm²</span></div>
          <div>Pixel to cm² Ratio: <span className="text-green-800 font-mono">{result.pixelToCmRatio?.toFixed(4) || 'N/A'}</span></div>
          <div>Leaf Width: <span className="text-green-800 font-mono">{result.leafWidth?.toFixed(2) || 'N/A'} cm</span></div>
          <div>Leaf Height: <span className="text-green-800 font-mono">{result.leafHeight?.toFixed(2) || 'N/A'} cm</span></div>
          <div>Aspect Ratio: <span className="text-green-800 font-mono">{result.leafAspectRatio?.toFixed(2) || 'N/A'}</span></div>
          <div>Compactness: <span className="text-green-800 font-mono">{result.leafCompactness?.toFixed(2) || 'N/A'}</span></div>
          <div className="mt-2 font-semibold">Color Metrics:</div>
          <div>Avg Green: <span className="text-green-800">{result.leafColorMetrics?.averageGreen?.toFixed(2) || 'N/A'}</span></div>
          <div>Avg Red: <span className="text-green-800">{result.leafColorMetrics?.averageRed?.toFixed(2) || 'N/A'}</span></div>
          <div>Avg Blue: <span className="text-green-800">{result.leafColorMetrics?.averageBlue?.toFixed(2) || 'N/A'}</span></div>
          <div>Color Variance: <span className="text-green-800">{result.leafColorMetrics?.colorVariance?.toFixed(2) || 'N/A'}</span></div>
          <div className="mt-2 font-semibold">Health Indicators:</div>
          <div>Color Uniformity: <span className="text-green-800">{result.leafHealthIndicators?.colorUniformity?.toFixed(2) || 'N/A'}</span></div>
          <div>Edge Regularity: <span className="text-green-800">{result.leafHealthIndicators?.edgeRegularity?.toFixed(2) || 'N/A'}</span></div>
          <div>Texture Complexity: <span className="text-green-800">{result.leafHealthIndicators?.textureComplexity?.toFixed(2) || 'N/A'}</span></div>
        </div>
      )}
      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded border border-red-200 text-red-700">{error}</div>
      )}
    </div>
  );
};

export default LeafAreaDetails;
