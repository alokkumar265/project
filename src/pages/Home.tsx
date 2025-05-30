import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Camera, Image, Info, X, Check, Loader, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { cameraService } from '@/services/CameraService';
import { imageProcessingService } from '@/services/ImageProcessingService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import PlantDiseasePredictor from './PlantDiseasePredictor';
import { Label } from '@/components/ui/label';

interface AnalysisResult {
  leafArea: number;
  greenPixelCount: number;
  redPixelCount: number;
  calibrationArea: number;
  pixelToCmRatio: number;
}

const Home = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [referenceArea, setReferenceArea] = useState<string>('1');
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  const [diseaseResult, setDiseaseResult] = useState<{predicted_class: string, confidence: number} | null>(null);
  const [diseaseLoading, setDiseaseLoading] = useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = useState<any | null>(null);
  const navigate = useNavigate();

  const handleCaptureImage = async () => {
    try {
      setIsLoading(true);
      const imageData = await cameraService.captureImage();
      setIsLoading(false);
      
      if (imageData) {
        setSelectedImage(imageData.webPath);
        toast.success("Image captured successfully!");
        setIsImageDialogOpen(true);
      }
    } catch (error) {
      setIsLoading(false);
      toast.error("Failed to capture image. Please try again.");
      console.error("Camera error:", error);
    }
  };

  const handleSelectImage = async () => {
    try {
      setIsLoading(true);
      const imageData = await cameraService.selectImage();
      setIsLoading(false);
      
      if (imageData) {
        setSelectedImage(imageData.webPath);
        toast.success("Image selected successfully!");
        setIsImageDialogOpen(true);
      }
    } catch (error) {
      setIsLoading(false);
      toast.error("Failed to select image. Please try again.");
      console.error("Gallery error:", error);
    }
  };

  const handleCalibrate = async () => {
    if (!selectedImage) return;
    
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      // Simulate progress
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          const newProgress = prev + 20;
          if (newProgress >= 100) {
            clearInterval(interval);
            return 100;
          }
          return newProgress;
        });
      }, 200);

      // Set calibration
      await imageProcessingService.setCalibration(
        parseFloat(referenceArea),
        selectedImage
      );
      
      setIsCalibrated(true);
      toast.success("Calibration completed successfully!");
      setIsAnalyzing(false);
    } catch (error) {
      console.error("Calibration error:", error);
      toast.error("Calibration failed. Please try again.");
      setIsAnalyzing(false);
    }
  };

  // Helper to convert dataURL to File (robust)
  const dataURLtoFile = async (imageUrl: string, filename: string) => {
    try {
      // Check if imageUrl is valid
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Invalid image data');
      }

      // Handle blob URLs
      if (imageUrl.startsWith('blob:')) {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.statusText}`);
          }
          const blob = await response.blob();
          return new File([blob], filename, { type: blob.type || 'image/jpeg' });
        } catch (error) {
          console.error('Error fetching blob:', error);
          throw new Error('Failed to process blob image data');
        }
      }

      // Handle Capacitor camera image URLs
      if (imageUrl.startsWith('file://') || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          const blob = await response.blob();
          return new File([blob], filename, { type: blob.type || 'image/jpeg' });
        } catch (error) {
          console.error('Error fetching image:', error);
          throw new Error('Failed to fetch image data');
        }
      }

      // Handle base64 data URLs
      if (imageUrl.startsWith('data:')) {
        const parts = imageUrl.split(',');
        if (parts.length !== 2) {
          throw new Error('Invalid data URL format');
        }

        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Data = parts[1];

        try {
          const binaryStr = window.atob(base64Data);
          const len = binaryStr.length;
          const arr = new Uint8Array(len);
          
          for (let i = 0; i < len; i++) {
            arr[i] = binaryStr.charCodeAt(i);
          }

          return new File([arr], filename, { type: mime });
        } catch (error) {
          console.error('Error processing base64 data:', error);
          throw new Error('Failed to process base64 image data');
        }
      }

      throw new Error('Unsupported image format');
    } catch (error) {
      console.error('Error converting to File:', error);
      throw error;
    }
  };

  // Call FastAPI for disease prediction
  const handleDiseasePrediction = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }

    setDiseaseLoading(true);
    setDiseaseResult(null);
    try {
      console.log('Processing image URL:', selectedImage);
      const file = await dataURLtoFile(selectedImage, 'leaf.jpg');
      console.log('File created:', file);

      // Create a canvas to resize the image
      const img = new window.Image();
      img.crossOrigin = 'anonymous';  // Add this to handle CORS
      img.src = selectedImage;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 128;  // Match the model's expected input size
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw and resize the image
      ctx.drawImage(img, 0, 0, 128, 128);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not convert canvas to blob'));
        }, 'image/jpeg', 0.95);
      });

      // Create a new file from the blob
      const resizedFile = new File([blob], 'leaf.jpg', { type: 'image/jpeg' });
      console.log('Resized file created:', resizedFile);

      const formData = new FormData();
      formData.append('file', resizedFile);

      console.log('Sending request to API...');
      const response = await fetch(import.meta.env.VITE_API_URL + '/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      console.log('API response:', data);
      setDiseaseResult(data);
      toast.success('Disease prediction completed successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to predict disease';
      console.error('Disease prediction error:', err);
      toast.error(errorMessage);
    } finally {
      setDiseaseLoading(false);
    }
  };

  const handleAnalyzeLeaf = async () => {
    if (!selectedImage || !isCalibrated) {
      toast.error("Please calibrate first with a reference object.");
      return;
    }
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      // Simulate progress
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          const newProgress = prev + 20;
          if (newProgress >= 100) {
            clearInterval(interval);
            return 100;
          }
          return newProgress;
        });
      }, 200);
      // Measure leaf area
      const result = await imageProcessingService.measureLeafArea(selectedImage);
      setAnalysisResult(result);
      // After leaf area, predict disease
      await handleDiseasePrediction();
      toast.success("Leaf analysis completed successfully!");
      setIsAnalyzing(false);
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Analysis failed. Please try again.");
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setSelectedImage(null);
    setAnalysisResult(null);
    setIsImageDialogOpen(false);
    setIsCalibrated(false);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }

    if (!isCalibrated) {
      toast.error('Please set calibration first');
      return;
    }

    setIsAnalyzing(true);
    try {
      const results = await imageProcessingService.measureLeafArea(selectedImage);
      setAnalysisResults(results);
      toast.success('Analysis completed successfully');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h1 className="text-3xl font-bold mb-4 text-green-700">PlantVillage Leaf Area & Disease Detection</h1>
      <p className="mb-6 text-gray-700">
        Upload a plant leaf image to measure its area and detect possible diseases using AI.
      </p>
      <Button
        className="bg-green-600 text-white px-6 py-3 rounded text-lg hover:bg-green-700 mb-8"
        onClick={() => navigate('/predictor')}
      >
        Go to Leaf Area & Disease Analysis
      </Button>

      <div className="flex flex-col items-center space-y-4">
        <h1 className="text-3xl font-bold text-center">Leaf Area Measurement</h1>
        <p className="text-gray-600 text-center max-w-2xl">
          Capture or select an image of a leaf with a red reference object for accurate area measurement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Image Capture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Button
                  onClick={handleCaptureImage}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Capturing...' : 'Capture Image'}
                </Button>
                <Button
                  onClick={handleSelectImage}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isLoading ? 'Selecting...' : 'Select from Gallery'}
                </Button>
              </div>
              {selectedImage && (
                <div className="relative aspect-video">
                  <img
                    src={selectedImage}
                    alt="Selected"
                    className="rounded-lg object-contain w-full h-full"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calibration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="calibrationArea">Reference Object Area (cm²)</Label>
                <Input
                  id="calibrationArea"
                  type="number"
                  value={referenceArea}
                  onChange={(e) => setReferenceArea(e.target.value)}
                  placeholder="Enter area of red reference object"
                  disabled={isAnalyzing}
                  min="0.1"
                  step="0.1"
                />
                <Button
                  onClick={handleCalibrate}
                  disabled={isAnalyzing || !selectedImage || !referenceArea}
                  className="w-full"
                >
                  {isAnalyzing ? 'Calibrating...' : 'Calibrate'}
                </Button>
              </div>
              {isCalibrated && (
                <div className="text-sm text-green-600">
                  Calibration completed successfully
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !isCalibrated}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Leaf Area'}
                </Button>
                <Button
                  onClick={handleDiseasePrediction}
                  disabled={diseaseLoading || !selectedImage}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {diseaseLoading ? 'Analyzing...' : 'Analyze Disease'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {analysisResults && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalysisResults results={analysisResults} />
              </CardContent>
            </Card>
          )}

          {diseaseResult && (
            <Card>
              <CardHeader>
                <CardTitle>Disease Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Predicted Class:</span>
                    <span className="font-medium">{diseaseResult.predicted_class}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="font-medium">{(diseaseResult.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="bg-white border-2 border-green-200 shadow-lg">
        <CardHeader className="bg-green-100">
          <CardTitle className="text-green-700 text-xl font-bold">How it Works</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <ol className="list-decimal pl-5 space-y-3 text-gray-600">
            <li>Capture or select an image containing a leaf and a red calibration object</li>
            <li>Enter the known area of your red calibration object</li>
            <li>Click "Calibrate" to set up the measurement system</li>
            <li>Click "Analyze Leaf" to measure the leaf area</li>
            <li>The leaf area will be calculated and displayed in cm²</li>
          </ol>
        </CardContent>
      </Card>

      <Alert className="mt-8 bg-green-50 border border-green-200">
        <AlertDescription className="text-center text-sm text-green-800">
          Developed by Alok, Sharique, and Arif &copy; 2025
        </AlertDescription>
      </Alert>

      {/* Image Analysis Results Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{analysisResult ? "Leaf Analysis Results" : "Image Confirmation"}</DialogTitle>
            <DialogDescription>
              {analysisResult ? "Detailed analysis of the leaf area and disease prediction" : "Confirm your image selection"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedImage && (
            <div className="aspect-w-16 aspect-h-9 relative w-full h-48 mb-4">
              <img 
                src={selectedImage} 
                alt="Selected Leaf" 
                className="rounded-md object-cover w-full h-full"
              />
            </div>
          )}
          
          {isAnalyzing && (
            <div className="mb-4">
              <p className="text-gray-700 mb-2 font-medium">Analyzing leaf area...</p>
              <Progress value={analysisProgress} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">{analysisProgress}% complete</p>
            </div>
          )}
          
          {analysisResult && (
            <div className="p-4 bg-green-50 rounded-md mb-4" id="printable-content">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-green-800">Analysis Results:</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-700 border-green-300"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Leaf Analysis Results</title>
                            <style>
                              body { font-family: Arial, sans-serif; padding: 20px; }
                              .header { text-align: center; margin-bottom: 20px; }
                              .results { margin-bottom: 20px; }
                              .result-row { display: flex; justify-content: space-between; margin: 5px 0; }
                              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                              @media print {
                                .no-print { display: none; }
                              }
                            </style>
                          </head>
                          <body>
                            <div class="header">
                              <h1>Leaf Analysis Results</h1>
                              <p>Foliage Pixel Probe</p>
                            </div>
                            <div class="results">
                              <div class="result-row">
                                <span>Leaf Area:</span>
                                <strong>${analysisResult.leafArea} cm²</strong>
                              </div>
                              <div class="result-row">
                                <span>Green Pixels:</span>
                                <strong>${analysisResult.greenPixelCount.toLocaleString()}</strong>
                              </div>
                              <div class="result-row">
                                <span>Red Reference Pixels:</span>
                                <strong>${analysisResult.redPixelCount.toLocaleString()}</strong>
                              </div>
                              <div class="result-row">
                                <span>Calibration Area:</span>
                                <strong>${analysisResult.calibrationArea} cm²</strong>
                              </div>
                              <div class="result-row">
                                <span>Pixel to cm² Ratio:</span>
                                <strong>${(analysisResult.pixelToCmRatio * 10000).toFixed(6)} cm²/pixel</strong>
                              </div>
                            </div>
                            <div class="footer">
                              <p>Formula: Leaf Area = Green Pixels × (Calibration Area ÷ Red Pixels)</p>
                              <p>Developed by Alok, Sharique, and Arif &copy; 2025</p>
                            </div>
                            <div class="no-print">
                              <button onclick="window.print()">Print Results</button>
                            </div>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Results
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Leaf Area:</span>
                  <span className="font-semibold">{analysisResult.leafArea} cm²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Green Pixels:</span>
                  <span className="font-semibold">{analysisResult.greenPixelCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Red Reference Pixels:</span>
                  <span className="font-semibold">{analysisResult.redPixelCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Calibration Area:</span>
                  <span className="font-semibold">{analysisResult.calibrationArea} cm²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pixel to cm² Ratio:</span>
                  <span className="font-semibold">{(analysisResult.pixelToCmRatio * 10000).toFixed(6)} cm²/pixel</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-green-200">
                <p className="text-xs text-gray-500">
                  Formula: Leaf Area = Green Pixels × (Calibration Area ÷ Red Pixels)
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Developed by Alok, Sharique, and Arif &copy; 2025
                </p>
              </div>
            </div>
          )}
          {diseaseResult && (
            <div className="p-4 bg-yellow-50 rounded-md mb-4">
              <h3 className="font-bold text-yellow-800 mb-2">Disease Prediction:</h3>
              {diseaseLoading ? (
                <div className="text-green-700">Predicting disease...</div>
              ) : diseaseResult && (
                diseaseResult.predicted_class === 'Error' ? (
                  <div className="text-red-700">Disease prediction failed. Please try again.</div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Predicted Disease:</span>
                      <span className="font-semibold">{diseaseResult.predicted_class}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Confidence:</span>
                      <span className="font-semibold">{diseaseResult.confidence ? (diseaseResult.confidence * 100).toFixed(2) : '--'}%</span>
                    </div>
                  </>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AnalysisResults: React.FC<{ results: any }> = ({ results }) => {
  if (!results) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Basic Measurements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Leaf Area:</span>
                <span className="font-medium">{results.leafArea.toFixed(2)} cm²</span>
              </div>
              <div className="flex justify-between">
                <span>Perimeter:</span>
                <span className="font-medium">{results.leafPerimeter.toFixed(2)} cm</span>
              </div>
              <div className="flex justify-between">
                <span>Width:</span>
                <span className="font-medium">{results.leafWidth.toFixed(2)} cm</span>
              </div>
              <div className="flex justify-between">
                <span>Height:</span>
                <span className="font-medium">{results.leafHeight.toFixed(2)} cm</span>
              </div>
              <div className="flex justify-between">
                <span>Aspect Ratio:</span>
                <span className="font-medium">{results.leafAspectRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Compactness:</span>
                <span className="font-medium">{results.leafCompactness.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Average Green:</span>
                <span className="font-medium">{results.leafColorMetrics.averageGreen.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Average Red:</span>
                <span className="font-medium">{results.leafColorMetrics.averageRed.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Average Blue:</span>
                <span className="font-medium">{results.leafColorMetrics.averageBlue.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Color Variance:</span>
                <span className="font-medium">{results.leafColorMetrics.colorVariance.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Color Uniformity:</span>
                <span className="font-medium">{(results.leafHealthIndicators.colorUniformity * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Edge Regularity:</span>
                <span className="font-medium">{(results.leafHealthIndicators.edgeRegularity * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Texture Complexity:</span>
                <span className="font-medium">{(results.leafHealthIndicators.textureComplexity * 100).toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pixel Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Green Pixels:</span>
                <span className="font-medium">{results.greenPixelCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Red Reference Pixels:</span>
                <span className="font-medium">{results.redPixelCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Calibration Area:</span>
                <span className="font-medium">{results.calibrationArea} cm²</span>
              </div>
              <div className="flex justify-between">
                <span>Pixel to cm² Ratio:</span>
                <span className="font-medium">{results.pixelToCmRatio.toFixed(6)} cm²/pixel</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
