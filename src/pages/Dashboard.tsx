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

interface AnalysisResult {
  leafArea: number;
  disease: {
    predicted_class: string;
    confidence: number;
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
    if (!selectedImage) return;
    
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
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage || !isCalibrated) {
      toast.error('Please capture an image and calibrate first.');
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

      // --- Disease Prediction API Call ---
      let diseaseResult = { predicted_class: 'N/A', confidence: 0 };
      try {
        // Convert image to blob
        let blob;
        if (selectedImage.startsWith('data:')) {
          // base64 data URL
          const res = await fetch(selectedImage);
          blob = await res.blob();
        } else {
          // file path or URL
          const res = await fetch(selectedImage);
          blob = await res.blob();
        }
        const formData = new FormData();
        formData.append('file', blob, 'leaf.jpg');
        // Call backend /predict endpoint
        const predictRes = await fetch('https://plant-disease-backend-f3gr.onrender.com/predict', {
          method: 'POST',
          body: formData
        });
        if (predictRes.ok) {
          const data = await predictRes.json();
          console.log('Disease prediction response:', data); // Debug log
          if (data && (data.predicted_class || data.class)) {
            diseaseResult = {
              predicted_class: data.predicted_class || data.class,
              confidence: data.confidence !== undefined ? data.confidence : 0
            };
          } else {
            toast.error('Prediction response missing class/confidence.');
          }
        } else {
          // If backend returns error, try to parse error message
          const errorText = await predictRes.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { detail: errorText };
          }
          toast.error(errorData?.detail || 'Disease prediction failed.');
          console.error('Disease prediction error:', errorData);
        }
      } catch (err) {
        toast.error('Disease prediction failed. Please try again.');
      }

      setAnalysisResult({
        leafArea: result.leafArea,
        disease: diseaseResult,
        measurements: {
          perimeter: result.leafPerimeter,
          width: result.leafWidth,
          height: result.leafHeight,
          aspectRatio: result.leafAspectRatio
        },
        colorMetrics: {
          averageGreen: result.leafColorMetrics.averageGreen,
          averageRed: result.leafColorMetrics.averageRed,
          averageBlue: result.leafColorMetrics.averageBlue,
          colorVariance: result.leafColorMetrics.colorVariance
        },
        healthIndicators: {
          colorUniformity: result.leafHealthIndicators.colorUniformity,
          edgeRegularity: result.leafHealthIndicators.edgeRegularity,
          textureComplexity: result.leafHealthIndicators.textureComplexity
        },
        calibration: {
          referenceArea: parseFloat(referenceArea),
          pixelRatio: result.pixelToCmRatio,
          formula: 'Leaf Area = (Pixel Count × Reference Area) / Reference Pixel Count'
        }
      });
      toast.success('Analysis completed successfully!');
    } catch (error) {
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrint = () => {
    if (!analysisResult) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Leaf Analysis Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              position: relative;
            }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; margin-bottom: 10px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .item { margin-bottom: 10px; }
            .label { color: #666; }
            .value { font-weight: bold; }
            .image { max-width: 100%; margin: 20px 0; }
            .footer { 
              margin-top: 30px; 
              text-align: center; 
              font-size: 12px; 
              color: #666;
              border-top: 1px solid #eee;
              padding-top: 20px;
            }
            .copyright {
              margin-top: 10px;
              font-size: 11px;
              color: #888;
            }
            .developers {
              margin-top: 5px;
              font-style: italic;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Leaf Analysis Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>

          <div class="section">
            <h2 class="section-title">Leaf Image</h2>
            <img src="${selectedImage}" alt="Analyzed Leaf" class="image" />
          </div>

          <div class="section">
            <h2 class="section-title">Calibration Details</h2>
            <div class="grid">
              <div class="item">
                <span class="label">Reference Area:</span>
                <span class="value">${analysisResult.calibration.referenceArea} cm²</span>
              </div>
              <div class="item">
                <span class="label">Pixel Ratio:</span>
                <span class="value">${analysisResult.calibration.pixelRatio.toFixed(6)} cm²/pixel</span>
              </div>
              <div class="item">
                <span class="label">Formula Used:</span>
                <span class="value">${analysisResult.calibration.formula}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Analysis Results</h2>
            <div class="grid">
              <div class="item">
                <span class="label">Leaf Area:</span>
                <span class="value">${analysisResult.leafArea.toFixed(2)} cm²</span>
              </div>
              <div class="item">
                <span class="label">Disease Prediction:</span>
                <span class="value">${analysisResult.disease.predicted_class}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Measurements</h2>
            <div class="grid">
              <div class="item">
                <span class="label">Perimeter:</span>
                <span class="value">${analysisResult.measurements.perimeter.toFixed(1)} cm</span>
              </div>
              <div class="item">
                <span class="label">Width:</span>
                <span class="value">${analysisResult.measurements.width.toFixed(1)} cm</span>
              </div>
              <div class="item">
                <span class="label">Height:</span>
                <span class="value">${analysisResult.measurements.height.toFixed(1)} cm</span>
              </div>
              <div class="item">
                <span class="label">Aspect Ratio:</span>
                <span class="value">${analysisResult.measurements.aspectRatio.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Health Indicators</h2>
            <div class="grid">
              <div class="item">
                <span class="label">Color Uniformity:</span>
                <span class="value">${(analysisResult.healthIndicators.colorUniformity * 100).toFixed(0)}%</span>
              </div>
              <div class="item">
                <span class="label">Edge Regularity:</span>
                <span class="value">${(analysisResult.healthIndicators.edgeRegularity * 100).toFixed(0)}%</span>
              </div>
              <div class="item">
                <span class="label">Texture Complexity:</span>
                <span class="value">${(analysisResult.healthIndicators.textureComplexity * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Generated by LeafAI Analysis System</p>
            <p class="copyright">&copy; ${new Date().getFullYear()} LeafAI. All rights reserved.</p>
            <p class="developers">Developed by Alok, Sharique, Arif</p>
          </div>

          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()">Print Report</button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 sm:mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Leaf Analysis Dashboard</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2">Capture and analyze plant leaves for area measurement and disease detection</p>
          </div>
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <Sun className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            )}
          </Button>
        </header>

        <Tabs defaultValue="analysis" className="space-y-4 sm:space-y-6">
          {/* --- Responsive Tabs List --- */}
          <TabsList
            className="flex w-full overflow-x-auto scrollbar-hide gap-2 sm:gap-4 bg-slate-100 dark:bg-slate-800 px-1 sm:px-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <TabsTrigger value="analysis" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">Analysis</TabsTrigger>
            <TabsTrigger value="model" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">Model Info</TabsTrigger>
            <TabsTrigger value="batch" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">Batch</TabsTrigger>
            <TabsTrigger value="about" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">About</TabsTrigger>
          </TabsList>

          {/* --- Responsive Grid for Main Content --- */}
          <TabsContent value="analysis">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
              {/* Left Column - Image Capture and Calibration */}
              <div className="space-y-4 sm:space-y-6">
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base xs:text-lg sm:text-xl text-slate-900 dark:text-slate-100">Image Capture</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      <Button
                        onClick={handleCaptureImage}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={isAnalyzing}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        <span className="text-sm sm:text-base">Capture Image</span>
                      </Button>
                      <Button
                        onClick={handleSelectImage}
                        variant="outline"
                        className="flex-1 border-slate-300 dark:border-slate-600"
                        disabled={isAnalyzing}
                      >
                        <Image className="mr-2 h-4 w-4" />
                        <span className="text-sm sm:text-base">Select Image</span>
                      </Button>
                    </div>
                    
                    {selectedImage && (
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          src={selectedImage}
                          alt="Selected leaf"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base xs:text-lg sm:text-xl text-slate-900 dark:text-slate-100">Calibration</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="referenceArea" className="text-sm sm:text-base text-slate-700 dark:text-slate-300">Reference Object Area (cm²)</Label>
                      <Input
                        id="referenceArea"
                        type="number"
                        value={referenceArea}
                        onChange={(e) => setReferenceArea(e.target.value)}
                        placeholder="Enter area of reference object"
                        disabled={isAnalyzing}
                        min="0.1"
                        step="0.1"
                        className="text-sm sm:text-base border-slate-300 dark:border-slate-600"
                      />
                    </div>
                    <Button
                      onClick={handleCalibrate}
                      disabled={isAnalyzing || !selectedImage || !referenceArea}
                      className="w-full text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Calibrating...
                        </>
                      ) : (
                        'Calibrate'
                      )}
                    </Button>
                    {isCalibrated && (
                      <Alert className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-sm sm:text-base">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Calibration completed successfully
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Analysis Results */}
              <div className="space-y-4 sm:space-y-6">
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base xs:text-lg sm:text-xl text-slate-900 dark:text-slate-100">Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !isCalibrated}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm sm:text-base"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        'Analyze Leaf'
                      )}
                    </Button>

                    {isAnalyzing && (
                      <div className="space-y-2">
                        <Progress value={analysisProgress} className="h-2 bg-slate-100 dark:bg-slate-700" />
                        <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 text-center">
                          {analysisProgress}% complete
                        </p>
                      </div>
                    )}

                    {analysisResult && (
                      <div className="space-y-4 sm:space-y-6">
                        {/* Leaf Area */}
                        <div className="p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                          <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2 text-sm sm:text-base">Leaf Area</h3>
                          <p className="text-xl sm:text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                            {analysisResult.leafArea.toFixed(2)} cm²
                          </p>
                          <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                            Calibration: {analysisResult.calibration.referenceArea} cm² reference area
                          </p>
                        </div>

                        {/* Disease Prediction */}
                        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 text-sm sm:text-base">Disease Prediction</h3>
                          <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100">
                            {analysisResult.disease.predicted_class}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Confidence: {(analysisResult.disease.confidence * 100).toFixed(2)}%
                          </p>
                        </div>

                        {/* Measurements */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                          <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Perimeter</p>
                            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">{analysisResult.measurements.perimeter.toFixed(1)} cm</p>
                          </div>
                          <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Width</p>
                            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">{analysisResult.measurements.width.toFixed(1)} cm</p>
                          </div>
                          <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Height</p>
                            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">{analysisResult.measurements.height.toFixed(1)} cm</p>
                          </div>
                          <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Aspect Ratio</p>
                            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">{analysisResult.measurements.aspectRatio.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Health Indicators */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm sm:text-base">Health Indicators</h3>
                          <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Color Uniformity</p>
                              <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">{(analysisResult.healthIndicators.colorUniformity * 100).toFixed(0)}%</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Edge Regularity</p>
                              <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">{(analysisResult.healthIndicators.edgeRegularity * 100).toFixed(0)}%</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Texture</p>
                              <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">{(analysisResult.healthIndicators.textureComplexity * 100).toFixed(0)}%</p>
                            </div>
                          </div>
                        </div>

                        {/* Print Button */}
                        <Button
                          onClick={handlePrint}
                          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-sm sm:text-base"
                        >
                          <Printer className="mr-2 h-4 w-4" />
                          Print Analysis Report
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="model">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="p-3 xs:p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base xs:text-lg sm:text-xl text-slate-900 dark:text-slate-100">
                  <Info className="h-5 w-5" />
                  Model Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 xs:p-4 sm:p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Architecture</h3>
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg space-y-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Model Type</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Custom CNN (Keras)</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Input Size</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">128x128 RGB</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Framework</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">FastAPI + React</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Optimizer</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Adam</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Loss Function</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Categorical Cross-Entropy</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Training Details</h3>
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg space-y-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Dataset</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">PlantVillage Dataset</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Classes</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">15 Classes</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Data Augmentation</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Rotation, Flip, Zoom</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Validation Split</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">20%</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Batch Size</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">32</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Supported Classes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-2">Pepper Bell</h4>
                        <ul className="space-y-1 text-sm">
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Bacterial spot
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Healthy
                          </li>
                        </ul>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-2">Potato</h4>
                        <ul className="space-y-1 text-sm">
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Early blight
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Late blight
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Healthy
                          </li>
                        </ul>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-2">Tomato</h4>
                        <ul className="space-y-1 text-sm">
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Bacterial spot
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Early blight
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Late blight
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Leaf mold
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Septoria leaf spot
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Spider mites
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Target spot
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Yellow leaf curl virus
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            Mosaic virus
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Healthy
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Model Performance</h3>
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">15+</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Disease Classes</p>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">3</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Plant Types</p>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">100ms</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Response Time</p>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">99%</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Uptime</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batch">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="p-3 xs:p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base xs:text-lg sm:text-xl text-slate-900 dark:text-slate-100">
                  <Database className="h-5 w-5" />
                  Batch Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 xs:p-4 sm:p-6">
                <div className="text-center py-6 sm:py-8">
                  <h3 className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">Coming Soon!</h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    Upload multiple images to analyze them in batch. This feature is currently under development.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="p-3 xs:p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base xs:text-lg sm:text-xl text-slate-900 dark:text-slate-100">
                  <Users className="h-5 w-5" />
                  About & Development Team
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 xs:p-4 sm:p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 text-sm sm:text-base">Project Overview</h3>
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                      <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-3">
                        LeafAI is an advanced plant disease detection and leaf analysis system that combines computer vision and deep learning to help farmers and researchers identify plant diseases and analyze leaf characteristics.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">15+</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Disease Classes</p>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">3</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Plant Types</p>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">100ms</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Response Time</p>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">99%</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Uptime</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 text-sm sm:text-base">Development Team</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                      {/* Team Lead */}
                      <div className="bg-white dark:bg-slate-700/50 p-3 sm:p-4 rounded-lg">
                        <div className="flex flex-col items-center">
                          <img
                            src="/developers/alok.jpg"
                            alt="Alok"
                            className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full object-cover mb-3 sm:mb-4 border-4 border-slate-200 dark:border-slate-700"
                          />
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base md:text-lg">Alok</h4>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2">Team Lead</p>
                          <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 dark:text-slate-400 text-center space-y-1 sm:space-y-2 mb-3 px-2 sm:px-4">
                            <p>
                              <span className="font-semibold">Data Science student</span> at Haldia Institute of Technology with diverse real-world experience across data engineering, machine learning, and cloud computing.
                            </p>
                            <p>
                              At <span className="font-semibold">Cognizant</span>, he works as a <span className="font-semibold">Database Intern</span> optimizing SQL/MySQL/Snowflake queries and building cloud-native solutions using AWS.
                            </p>
                            <p>
                              Previously at <span className="font-semibold">Databits Technologia</span>, he deployed ML models on AWS infrastructure using PySpark and EMR.
                            </p>
                            <p>
                              As a <span className="font-semibold">top-rated Chegg Subject Matter Expert</span>, he's delivered <span className="font-semibold">5000+ high-quality solutions</span> in Data Structures, Algorithms, and Analytics.
                            </p>
                          </div>
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 justify-center px-2">
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Python</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">TensorFlow</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">FastAPI</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">AWS</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">SQL</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">C++</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Power BI</span>
                          </div>
                          <div className="mt-3 sm:mt-4 flex gap-3 sm:gap-4">
                            <a 
                              href="https://github.com/aloksingh1818" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="GitHub Profile"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                              </svg>
                            </a>
                            <a 
                              href="https://www.linkedin.com/in/alok-kumar-singh-119481218/" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="LinkedIn Profile"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </a>
                            <a 
                              href="mailto:alok85820018@gmail.com"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="Email Address"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Sharique */}
                      <div className="bg-white dark:bg-slate-700/50 p-3 sm:p-4 rounded-lg">
                        <div className="flex flex-col items-center">
                          <img
                            src="/developers/sharique.jpg"
                            alt="Sharique"
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover mb-3 sm:mb-4 border-4 border-slate-200 dark:border-slate-700"
                          />
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base sm:text-lg">Sharique Azam</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Backend Developer</p>
                          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-center space-y-2 mb-3 px-2 sm:px-4">
                            <p>
                              <span className="font-semibold">B.Tech CSE(DS) Student</span> at Haldia Institute of Technology, specializing in data science and backend development.
                            </p>
                            <p>
                              Experienced in building robust backend systems and implementing machine learning solutions for real-world applications.
                            </p>
                          </div>
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2 justify-center px-2">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">Python</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">Machine Learning</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">Data Science</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">Backend</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">API Development</span>
                          </div>
                          <div className="mt-3 sm:mt-4 flex gap-3 sm:gap-4">
                            <a 
                              href="https://github.com/HiIamShariqueAzam" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="GitHub Profile"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                              </svg>
                            </a>
                            <a 
                              href="https://www.linkedin.com/in/sharique-azam-5b664a2b3" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="LinkedIn Profile"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </a>
                            <a 
                              href="mailto:shariqueazam410@gmail.com"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="Email Address"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Arif */}
                      <div className="bg-white dark:bg-slate-700/50 p-3 sm:p-4 rounded-lg">
                        <div className="flex flex-col items-center">
                          <img
                            src="/developers/arif.jpg"
                            alt="Md Arif Azim"
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover mb-3 sm:mb-4 border-4 border-slate-200 dark:border-slate-700"
                          />
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base sm:text-lg">Md Arif Azim</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">MERN Stack Developer</p>
                          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-center space-y-2 mb-3 px-2 sm:px-4">
                            <p>
                              <span className="font-semibold">Final-year B.Tech CSE(DS) Student</span> at Haldia Institute of Technology, specializing in MERN stack development and building modern web applications.
                            </p>
                            <p>
                              Passionate about creating scalable and user-friendly web applications using both frontend and backend technologies.
                            </p>
                          </div>
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2 justify-center px-2">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">React</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">Node.js</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">MongoDB</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">Express</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">MySQL</span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs rounded-full">Firebase</span>
                          </div>
                          <div className="mt-3 sm:mt-4 flex gap-3 sm:gap-4">
                            <a 
                              href="https://github.com/arif75157" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="GitHub Profile"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                              </svg>
                            </a>
                            <a 
                              href="https://www.linkedin.com/in/md-arif-azim-6930b0172" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              aria-label="LinkedIn Profile"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </a>
                            <a 
                              href="mailto:arif75157@gmail.com"
                              className="text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              aria-label="Email Address"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-emerald-800">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        &copy; {new Date().getFullYear()} LeafAI. All rights reserved.
                      </p>
                      <div className="flex gap-3 sm:gap-4">
                        <a href="#" className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">Documentation</a>
                        <a href="#" className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">GitHub</a>
                        <a href="#" className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">Contact</a>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
