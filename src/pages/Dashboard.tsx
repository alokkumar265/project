import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Image, Loader, AlertCircle, Info, Database, Users, Printer, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cameraService } from '@/services/CameraService';
import { imageProcessingService } from '@/services/ImageProcessingService';
import { apiService } from '@/services/ApiService';
import { API_CONFIG } from '@/config/api';

interface AnalysisResult {
  leafArea: number;
  disease: {
    predicted_class: string;
    confidence: number;
    top_3_predictions?: Record<string, number>;
    warning?: string;
  };
  measurements: {
    perimeter: number;
    width: number;
    height: number;
    aspectRatio: number;
  };
  colorMetrics: {
    averageGreen: number;
    averageRed: number;
    averageBlue: number;
    colorVariance: number;
  };
  healthIndicators: {
    colorUniformity: number;
    edgeRegularity: number;
    textureComplexity: number;
  };
  calibration: {
    referenceArea: number;
    pixelRatio: number;
    formula: string;
  };
  greenPixelCount: number;
  redPixelCount: number;
  calibrationArea: number;
  pixelToCmRatio: number;
  leafHealthIndicators: {
    colorUniformity: number;
    edgeRegularity: number;
    textureComplexity: number;
  };
}

const Dashboard: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [referenceArea, setReferenceArea] = useState<string>('1');
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleCaptureImage = async () => {
    try {
      const imageData = await cameraService.captureImage();
      if (imageData && imageData.webPath) {
        setSelectedImage(imageData.webPath);
        toast.success('Image captured successfully!');
      } else {
        toast.error('No image captured.');
      }
    } catch (error) {
      toast.error('Failed to capture image. Please try again.');
      console.error('Camera error:', error);
    }
  };

  const handleSelectImage = async () => {
    try {
      const imageData = await cameraService.selectImage();
      if (imageData && imageData.webPath) {
        setSelectedImage(imageData.webPath);
        toast.success('Image selected successfully!');
      } else {
        toast.error('No image selected.');
      }
    } catch (error) {
      toast.error('Failed to select image. Please try again.');
      console.error('Gallery error:', error);
    }
  };

  const handleCalibrate = async () => {
    if (!selectedImage) {
      toast.error('Please capture or select an image first.');
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      // Simulate calibration progress
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

      // Use real calibration logic
      await imageProcessingService.setCalibration(parseFloat(referenceArea), selectedImage);
      
      setIsCalibrated(true);
      toast.success('Calibration completed successfully!');
    } catch (error) {
      toast.error('Calibration failed. Please try again.');
      console.error('Calibration error:', error);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast.error('Please capture or select an image first.');
      return;
    }

    if (!isCalibrated) {
      toast.error('Please calibrate the image first.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      // Simulate analysis progress
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(interval);
            return 100;
          }
          return newProgress;
        });
      }, 200);

      // Use real image analysis logic
      const result = await imageProcessingService.measureLeafArea(selectedImage);

      // Disease Prediction
      let diseaseResult = { 
        predicted_class: 'N/A', 
        confidence: 0,
        top_3_predictions: {},
        warning: undefined
      };

      try {
        console.log('Starting disease prediction process...');
        
        // Convert image to blob
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        const file = new File([blob], 'leaf.jpg', { type: 'image/jpeg' });
        
        console.log('Image converted to file:', {
          name: file.name,
          type: file.type,
          size: file.size
        });

        // Check image size for disease prediction
        if (file.size > API_CONFIG.MAX_FILE_SIZE) {
          diseaseResult.warning = `Image size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of ${API_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB for disease prediction. Please use a smaller image.`;
          toast.warning(diseaseResult.warning);
        } else {
          // Check API health first
          console.log('Checking API health...');
          const healthCheck = await apiService.checkHealth();
          console.log('API health check result:', healthCheck);
          
          if (healthCheck.status !== 'healthy') {
            throw new Error('API is not healthy');
          }
          
          console.log('Sending image for prediction...');
          const prediction = await apiService.predictDisease(file);
          console.log('Prediction result:', prediction);
          
          diseaseResult = {
            predicted_class: prediction.predicted_class || 'N/A',
            confidence: prediction.confidence || 0,
            top_3_predictions: prediction.top_3_predictions || {},
            warning: prediction.warning
          };
          
          if (prediction.warning) {
            console.warn('Prediction warning:', prediction.warning);
            toast.warning(prediction.warning);
          }

          // Show success message if prediction is good
          if (diseaseResult.confidence >= API_CONFIG.MIN_CONFIDENCE) {
            const confidencePercent = (diseaseResult.confidence * 100).toFixed(2);
            const message = `Disease detected: ${diseaseResult.predicted_class} (${confidencePercent}% confidence)`;
            console.log('Prediction success:', message);
            toast.success(message);
          } else {
            console.warn('Low confidence prediction:', diseaseResult);
            toast.warning('Low confidence prediction. Please try with a clearer image.');
          }
        }
      } catch (error) {
        console.error('Disease prediction error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to predict disease';
        toast.error(errorMessage);
        diseaseResult.warning = errorMessage;
      }

      // Update analysis result with all original properties
      setAnalysisResult({
        leafArea: result.leafArea,
        disease: diseaseResult,
        measurements: result.measurements,
        colorMetrics: result.colorMetrics,
        healthIndicators: result.healthIndicators,
        calibration: result.calibration,
        greenPixelCount: result.greenPixelCount,
        redPixelCount: result.redPixelCount,
        calibrationArea: result.calibrationArea,
        pixelToCmRatio: result.pixelToCmRatio,
        leafHealthIndicators: result.leafHealthIndicators
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const handlePrint = () => {
    if (!analysisResult) {
      toast.error('No analysis result to print.');
      return;
    }

    try {
      window.print();
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print. Please try again.');
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Leaf Disease Detection</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full"
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Image Capture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-4">
              <Button onClick={handleCaptureImage} disabled={isAnalyzing}>
                <Camera className="mr-2 h-4 w-4" />
                Capture
              </Button>
              <Button onClick={handleSelectImage} disabled={isAnalyzing}>
                <Image className="mr-2 h-4 w-4" />
                Select
              </Button>
            </div>

            {selectedImage && (
              <div className="relative aspect-video">
                <img
                  src={selectedImage}
                  alt="Selected leaf"
                  className="rounded-lg object-contain w-full h-full"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="referenceArea">Reference Area (cm²)</Label>
              <Input
                id="referenceArea"
                type="number"
                value={referenceArea}
                onChange={(e) => setReferenceArea(e.target.value)}
                disabled={isAnalyzing}
                min="0.1"
                step="0.1"
              />
            </div>

            <div className="flex space-x-4">
              <Button
                onClick={handleCalibrate}
                disabled={!selectedImage || isAnalyzing}
              >
                Calibrate
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={!selectedImage || !isCalibrated || isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze'
                )}
              </Button>
            </div>

            {isAnalyzing && (
              <Progress value={analysisProgress} className="w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            {analysisResult ? (
              <div className="space-y-4">
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold">Leaf Area</h3>
                        <p>{analysisResult.leafArea.toFixed(2)} cm²</p>
                      </div>
                      <div>
                        <h3 className="font-semibold">Disease</h3>
                        <p>
                          {analysisResult.disease.predicted_class}
                          {analysisResult.disease.confidence > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {' '}
                              ({(analysisResult.disease.confidence * 100).toFixed(1)}%)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {analysisResult.disease.warning && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {analysisResult.disease.warning}
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Measurements</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <p>Perimeter: {analysisResult.measurements.perimeter.toFixed(2)} cm</p>
                        <p>Width: {analysisResult.measurements.width.toFixed(2)} cm</p>
                        <p>Height: {analysisResult.measurements.height.toFixed(2)} cm</p>
                        <p>Aspect Ratio: {analysisResult.measurements.aspectRatio.toFixed(2)}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Color Metrics</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <p>Average Green: {analysisResult.colorMetrics.averageGreen.toFixed(2)}</p>
                        <p>Average Red: {analysisResult.colorMetrics.averageRed.toFixed(2)}</p>
                        <p>Average Blue: {analysisResult.colorMetrics.averageBlue.toFixed(2)}</p>
                        <p>Color Variance: {analysisResult.colorMetrics.colorVariance.toFixed(2)}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Health Indicators</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <p>Color Uniformity: {analysisResult.healthIndicators.colorUniformity.toFixed(2)}</p>
                        <p>Edge Regularity: {analysisResult.healthIndicators.edgeRegularity.toFixed(2)}</p>
                        <p>Texture Complexity: {analysisResult.healthIndicators.textureComplexity.toFixed(2)}</p>
                      </div>
                    </div>

                    {analysisResult.disease.top_3_predictions && Object.keys(analysisResult.disease.top_3_predictions).length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Top Predictions</h3>
                        <div className="space-y-1">
                          {Object.entries(analysisResult.disease.top_3_predictions).map(([disease, confidence]) => (
                            <p key={disease}>
                              {disease}: {(confidence * 100).toFixed(1)}%
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <Button onClick={handlePrint} className="w-full">
                  <Printer className="mr-2 h-4 w-4" />
                  Print Results
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2" />
                <p>No analysis results yet.</p>
                <p className="text-sm">Capture an image and run the analysis to see results.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
