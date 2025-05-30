import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
import { AnalysisResult } from '@/types/analysis';

interface DiseaseResult {
    predicted_class: string;
    confidence: number;
  top_3_predictions?: Record<string, number>;
  warning?: string;
}

// Add this helper function at the top of the file, after the imports
const formatDiseaseName = (disease: string): string => {
  return disease
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\(/g, ' (')
    .replace(/\)/g, ') ')
    .trim();
};

// Add these helper functions after the imports
const getHealthStatus = (score: number): { color: string; label: string } => {
  if (score >= 80) return { color: 'text-green-600', label: 'Excellent' };
  if (score >= 60) return { color: 'text-yellow-600', label: 'Good' };
  if (score >= 40) return { color: 'text-orange-600', label: 'Fair' };
  return { color: 'text-red-600', label: 'Poor' };
};

const getStressLevel = (level: number): { color: string; label: string } => {
  if (level <= 20) return { color: 'text-green-600', label: 'Low' };
  if (level <= 40) return { color: 'text-yellow-600', label: 'Moderate' };
  if (level <= 60) return { color: 'text-orange-600', label: 'High' };
  return { color: 'text-red-600', label: 'Severe' };
};

const generatePrintContent = (analysisResult: AnalysisResult) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Leaf Analysis Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
          .card-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .metric { margin-bottom: 10px; }
          .metric-label { font-size: 14px; color: #666; }
          .metric-value { font-size: 24px; font-weight: bold; }
          .metric-description { font-size: 12px; color: #888; }
          .warning { color: #f59e0b; }
          .danger { color: #ef4444; }
          .success { color: #22c55e; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Leaf Analysis Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="grid">
          <div class="card">
            <div class="card-title">Calibration Details</div>
            <div class="metric">
              <div class="metric-label">Reference Area</div>
              <div class="metric-value">${analysisResult.calibration.referenceArea} cm²</div>
              <div class="metric-description">Calibration reference object area</div>
            </div>
            <div class="metric">
              <div class="metric-label">Pixel Ratio</div>
              <div class="metric-value">${analysisResult.calibration.pixelRatio.toFixed(6)} cm²/pixel</div>
              <div class="metric-description">Conversion factor for measurements</div>
            </div>
            <div class="metric">
              <div class="metric-label">Formula Used</div>
              <div class="metric-value" style="font-size: 14px;">${analysisResult.calibration.formula}</div>
              <div class="metric-description">Area calculation method</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Leaf Measurements</div>
            <div class="metric">
              <div class="metric-label">Area</div>
              <div class="metric-value">${analysisResult.leafArea.toFixed(2)} cm²</div>
              <div class="metric-description">Total leaf surface area</div>
            </div>
            <div class="metric">
              <div class="metric-label">Perimeter</div>
              <div class="metric-value">${analysisResult.measurements.perimeter.toFixed(1)} cm</div>
              <div class="metric-description">Total edge length</div>
            </div>
            <div class="metric">
              <div class="metric-label">Width × Height</div>
              <div class="metric-value">${analysisResult.measurements.width.toFixed(1)} × ${analysisResult.measurements.height.toFixed(1)} cm</div>
              <div class="metric-description">Maximum dimensions</div>
            </div>
            <div class="metric">
              <div class="metric-label">Aspect Ratio</div>
              <div class="metric-value">${analysisResult.measurements.aspectRatio.toFixed(2)}</div>
              <div class="metric-description">Width to height ratio</div>
            </div>
            <div class="metric">
              <div class="metric-label">Circularity</div>
              <div class="metric-value ${analysisResult.measurements.circularity && analysisResult.measurements.circularity < 0.5 ? 'warning' : 'success'}">
                ${analysisResult.measurements.circularity?.toFixed(2) || 'N/A'}
              </div>
              <div class="metric-description">Shape regularity (0-1)</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Health Indicators</div>
            <div class="metric">
              <div class="metric-label">Overall Health Score</div>
              <div class="metric-value ${getHealthStatus(analysisResult.healthIndicators.overallHealthScore).color}">
                ${analysisResult.healthIndicators.overallHealthScore.toFixed(1)}%
              </div>
              <div class="metric-description">${getHealthStatus(analysisResult.healthIndicators.overallHealthScore).label}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Stress Level</div>
              <div class="metric-value ${getStressLevel(analysisResult.healthIndicators.stressLevel).color}">
                ${analysisResult.healthIndicators.stressLevel.toFixed(1)}%
              </div>
              <div class="metric-description">${getStressLevel(analysisResult.healthIndicators.stressLevel).label}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Color Uniformity</div>
              <div class="metric-value ${analysisResult.healthIndicators.colorUniformity * 100 > 90 ? 'success' : 'warning'}">
                ${(analysisResult.healthIndicators.colorUniformity * 100).toFixed(1)}%
              </div>
              <div class="metric-description">Consistency of leaf color</div>
            </div>
            <div class="metric">
              <div class="metric-label">Edge Regularity</div>
              <div class="metric-value ${analysisResult.healthIndicators.edgeRegularity * 100 < 10 ? 'danger' : 'warning'}">
                ${(analysisResult.healthIndicators.edgeRegularity * 100).toFixed(1)}%
              </div>
              <div class="metric-description">Smoothness of leaf edges</div>
            </div>
            <div class="metric">
              <div class="metric-label">Texture Complexity</div>
              <div class="metric-value ${analysisResult.healthIndicators.textureComplexity * 100 < 10 ? 'warning' : 'success'}">
                ${(analysisResult.healthIndicators.textureComplexity * 100).toFixed(1)}%
              </div>
              <div class="metric-description">Surface pattern variation</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Nutrient Status</div>
            <div class="metric">
              <div class="metric-label">Nitrogen Content</div>
              <div class="metric-value">${analysisResult.nutrientIndicators?.nitrogenContent.toFixed(1) || 'N/A'}%</div>
              <div class="metric-description">Estimated nitrogen level</div>
            </div>
            <div class="metric">
              <div class="metric-label">Chlorophyll Content</div>
              <div class="metric-value">${analysisResult.nutrientIndicators?.chlorophyllContent.toFixed(1) || 'N/A'}%</div>
              <div class="metric-description">Estimated chlorophyll level</div>
            </div>
            <div class="metric">
              <div class="metric-label">Water Content</div>
              <div class="metric-value">${analysisResult.nutrientIndicators?.waterContent.toFixed(1) || 'N/A'}%</div>
              <div class="metric-description">Estimated water level</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Growth Stage</div>
            <div class="metric">
              <div class="metric-label">Stage</div>
              <div class="metric-value">${analysisResult.growthStage?.stage || 'N/A'}</div>
              <div class="metric-description">Current growth phase</div>
            </div>
            <div class="metric">
              <div class="metric-label">Confidence</div>
              <div class="metric-value">${analysisResult.growthStage?.confidence.toFixed(1) || 'N/A'}%</div>
              <div class="metric-description">Stage prediction reliability</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Disease Prediction</div>
            <div class="metric">
              <div class="metric-label">Predicted Disease</div>
              <div class="metric-value danger">${formatDiseaseName(analysisResult.disease.predicted_class)}</div>
              <div class="metric-description">Primary disease detected</div>
            </div>
            <div class="metric">
              <div class="metric-label">Confidence</div>
              <div class="metric-value">${(analysisResult.disease.confidence * 100).toFixed(1)}%</div>
              <div class="metric-description">Prediction reliability</div>
            </div>
            ${analysisResult.disease.warning ? `
              <div class="metric">
                <div class="metric-value warning">${analysisResult.disease.warning}</div>
              </div>
            ` : ''}
            <div class="metric">
              <div class="metric-label">Top Predictions:</div>
              ${analysisResult.disease.top_3_predictions ? Object.entries(analysisResult.disease.top_3_predictions).map(([disease, confidence]) => `
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                  <span>${formatDiseaseName(disease)}</span>
                  <span>${(confidence * 100).toFixed(1)}%</span>
                </div>
              `).join('') : ''}
            </div>
          </div>
        </div>

        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()">Print Report</button>
        </div>
      </body>
    </html>
  `;
};

const Dashboard: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [referenceArea, setReferenceArea] = useState<string>('1');
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('analysis');
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

      // Simulate progress
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Step 1: Measure leaf area
      console.log('Starting leaf area measurement...');
      const result = await imageProcessingService.measureLeafArea(selectedImage);
      console.log('Leaf area measurement result:', result);

      // Step 2: Disease Prediction
      console.log('Starting disease prediction...');
      let diseaseResult = {
        predicted_class: 'N/A',
        confidence: 0,
        top_3_predictions: {},
        warning: undefined
      };

      try {
        // Convert image to blob
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        const file = new File([blob], 'leaf.jpg', { type: 'image/jpeg' });

        // Check image size
        if (file.size > API_CONFIG.MAX_FILE_SIZE) {
          diseaseResult.warning = `Image size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of ${API_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB for disease prediction. Please use a smaller image.`;
          toast.warning(diseaseResult.warning);
        } else {
          // Check API health
          console.log('Checking API health...');
          try {
            const healthCheck = await apiService.checkHealth();
            console.log('API health check result:', healthCheck);

            if (healthCheck.status !== 'healthy') {
              throw new Error('API is not healthy');
            }

            // Make prediction
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
          } catch (apiError) {
            console.error('API error:', apiError);
            const errorMessage = apiError instanceof Error ? apiError.message : 'Failed to connect to prediction service';
            toast.error(errorMessage);
            diseaseResult.warning = errorMessage;
          }
        }
      } catch (error) {
        console.error('Disease prediction error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to predict disease';
        toast.error(errorMessage);
        diseaseResult.warning = errorMessage;
      }

      // Update analysis result
      const calculateAdditionalMetrics = (result: any) => {
        // Calculate circularity
        const circularity = (4 * Math.PI * result.leafArea) / (result.leafPerimeter * result.leafPerimeter);
        
        // Calculate color ratios
        const redGreenRatio = result.leafColorMetrics.averageRed / result.leafColorMetrics.averageGreen;
        const blueGreenRatio = result.leafColorMetrics.averageBlue / result.leafColorMetrics.averageGreen;
        
        // Calculate chlorophyll index
        const chlorophyllIndex = (result.leafColorMetrics.averageGreen - result.leafColorMetrics.averageRed) / 
                                (result.leafColorMetrics.averageGreen + result.leafColorMetrics.averageRed);
        
        // Calculate overall health score (weighted average)
        const healthScore = (
          result.leafHealthIndicators.colorUniformity * 0.4 +
          result.leafHealthIndicators.edgeRegularity * 0.3 +
          result.leafHealthIndicators.textureComplexity * 0.3
        );
        
        // Calculate stress level (0-100)
        const stressLevel = Math.min(100, Math.max(0, 
          (redGreenRatio * 40) + // Higher red/green ratio indicates stress
          ((1 - result.leafHealthIndicators.colorUniformity) * 30) + // Lower color uniformity indicates stress
          ((1 - result.leafHealthIndicators.edgeRegularity) * 30) // Lower edge regularity indicates stress
        ));
        
        // Estimate nutrient content
        const nitrogenContent = (result.leafColorMetrics.averageGreen / 255) * 100;
        const chlorophyllContent = chlorophyllIndex * 100;
        const waterContent = (result.leafColorMetrics.averageBlue / 255) * 100;
        
        // Estimate growth stage based on area and aspect ratio
        let growthStage = 'Unknown';
        let growthConfidence = 0;
        
        if (result.leafArea < 50) {
          growthStage = 'Early Growth';
          growthConfidence = 85;
        } else if (result.leafArea < 100) {
          growthStage = 'Mid Growth';
          growthConfidence = 75;
        } else {
          growthStage = 'Mature';
          growthConfidence = 80;
        }
        
        return {
          circularity,
          redGreenRatio,
          blueGreenRatio,
          chlorophyllIndex,
          healthScore,
          stressLevel,
          nutrientIndicators: {
            nitrogenContent,
            chlorophyllContent,
            waterContent
          },
          growthStage: {
            stage: growthStage,
            confidence: growthConfidence
          }
        };
      };

      const additionalMetrics = calculateAdditionalMetrics(result);
      setAnalysisResult({
        leafArea: result.leafArea,
        disease: diseaseResult,
        measurements: {
          perimeter: result.leafPerimeter,
          width: result.leafWidth,
          height: result.leafHeight,
          aspectRatio: result.leafAspectRatio,
          circularity: additionalMetrics.circularity
        },
        colorMetrics: {
          averageGreen: result.leafColorMetrics.averageGreen,
          averageRed: result.leafColorMetrics.averageRed,
          averageBlue: result.leafColorMetrics.averageBlue,
          colorVariance: result.leafColorMetrics.colorVariance,
          redGreenRatio: additionalMetrics.redGreenRatio,
          blueGreenRatio: additionalMetrics.blueGreenRatio,
          chlorophyllIndex: additionalMetrics.chlorophyllIndex
        },
        healthIndicators: {
          colorUniformity: result.leafHealthIndicators.colorUniformity,
          edgeRegularity: result.leafHealthIndicators.edgeRegularity,
          textureComplexity: result.leafHealthIndicators.textureComplexity,
          overallHealthScore: additionalMetrics.healthScore,
          stressLevel: additionalMetrics.stressLevel
        },
        nutrientIndicators: additionalMetrics.nutrientIndicators,
        growthStage: additionalMetrics.growthStage,
        calibration: {
          referenceArea: parseFloat(referenceArea),
          pixelRatio: result.pixelToCmRatio,
          formula: 'Leaf Area = (Pixel Count × Reference Area) / Reference Pixel Count'
        }
      });

      // Complete progress
      setAnalysisProgress(100);
      toast.success('Analysis completed successfully!');

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const handlePrint = useCallback(() => {
    if (!analysisResult) {
      toast.error('No analysis results to print');
      return;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Failed to open print window. Please check your popup settings.');
      return;
    }

    printWindow.document.write(generatePrintContent(analysisResult));
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = () => {
      printWindow.print();
      // Close the window after printing
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };
  }, [analysisResult]);

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide gap-2 sm:gap-4 bg-slate-100 dark:bg-slate-800 px-1 sm:px-0">
            <TabsTrigger value="analysis" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">Analysis</TabsTrigger>
            <TabsTrigger value="model" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">Model Info</TabsTrigger>
            <TabsTrigger value="batch" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">Batch</TabsTrigger>
            <TabsTrigger value="about" className="flex-shrink-0 text-xs xs:text-sm sm:text-base data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 sm:py-3 sm:px-4 min-w-[90px]">About</TabsTrigger>
          </TabsList>

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
                          Calibration completed successfully
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
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                            <Printer className="w-4 h-4 mr-2" />
                            Print Report
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                          <Card className="bg-white dark:bg-slate-800 h-full">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">Calibration Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-6">
                                <div>
                                  <p className="text-sm font-medium">Reference Area</p>
                                  <p className="text-2xl font-bold">{analysisResult.calibration.referenceArea} cm²</p>
                                  <p className="text-xs text-slate-500">Calibration reference object area</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Pixel Ratio</p>
                                  <p className="text-2xl font-bold">{analysisResult.calibration.pixelRatio.toFixed(6)} cm²/pixel</p>
                                  <p className="text-xs text-slate-500">Conversion factor for measurements</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Formula Used</p>
                                  <p className="text-2xl font-bold text-sm">{analysisResult.calibration.formula}</p>
                                  <p className="text-xs text-slate-500">Area calculation method</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-white dark:bg-slate-800 h-full">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">Leaf Measurements</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-6">
                                <div>
                                  <p className="text-sm font-medium">Area</p>
                                  <p className="text-2xl font-bold">{analysisResult.leafArea.toFixed(2)} cm²</p>
                                  <p className="text-xs text-slate-500">Total leaf surface area</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Perimeter</p>
                                  <p className="text-2xl font-bold">{analysisResult.measurements.perimeter.toFixed(1)} cm</p>
                                  <p className="text-xs text-slate-500">Total edge length</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Width × Height</p>
                                  <p className="text-2xl font-bold">{analysisResult.measurements.width.toFixed(1)} × {analysisResult.measurements.height.toFixed(1)} cm</p>
                                  <p className="text-xs text-slate-500">Maximum dimensions</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Aspect Ratio</p>
                                  <p className="text-2xl font-bold">{analysisResult.measurements.aspectRatio.toFixed(2)}</p>
                                  <p className="text-xs text-slate-500">Width to height ratio</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Circularity</p>
                                  <p className={`text-2xl font-bold ${analysisResult.measurements.circularity && analysisResult.measurements.circularity < 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {analysisResult.measurements.circularity?.toFixed(2) || 'N/A'}
                                  </p>
                                  <p className="text-xs text-slate-500">Shape regularity (0-1)</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-white dark:bg-slate-800 h-full">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">Health Indicators</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-6">
                                <div>
                                  <p className="text-sm font-medium">Overall Health Score</p>
                                  {analysisResult.healthIndicators.overallHealthScore && (
                                    <>
                                      <p className={`text-2xl font-bold ${getHealthStatus(analysisResult.healthIndicators.overallHealthScore).color}`}>
                                        {analysisResult.healthIndicators.overallHealthScore.toFixed(1)}%
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {getHealthStatus(analysisResult.healthIndicators.overallHealthScore).label}
                                      </p>
                                    </>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Stress Level</p>
                                  {analysisResult.healthIndicators.stressLevel && (
                                    <>
                                      <p className={`text-2xl font-bold ${getStressLevel(analysisResult.healthIndicators.stressLevel).color}`}>
                                        {analysisResult.healthIndicators.stressLevel.toFixed(1)}%
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {getStressLevel(analysisResult.healthIndicators.stressLevel).label}
                                      </p>
                                    </>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Color Uniformity</p>
                                  <p className={`text-2xl font-bold ${analysisResult.healthIndicators.colorUniformity * 100 > 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                                    {(analysisResult.healthIndicators.colorUniformity * 100).toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-slate-500">Consistency of leaf color</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Edge Regularity</p>
                                  <p className={`text-2xl font-bold ${analysisResult.healthIndicators.edgeRegularity * 100 < 10 ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {(analysisResult.healthIndicators.edgeRegularity * 100).toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-slate-500">Smoothness of leaf edges</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Texture Complexity</p>
                                  <p className={`text-2xl font-bold ${analysisResult.healthIndicators.textureComplexity * 100 < 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {(analysisResult.healthIndicators.textureComplexity * 100).toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-slate-500">Surface pattern variation</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-white dark:bg-slate-800 h-full">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">Nutrient Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium">Nitrogen Content</p>
                                  <p className="text-2xl font-bold">{analysisResult.nutrientIndicators?.nitrogenContent.toFixed(1) || 'N/A'}%</p>
                                  <p className="text-xs text-slate-500">Estimated nitrogen level</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Chlorophyll Content</p>
                                  <p className="text-2xl font-bold">{analysisResult.nutrientIndicators?.chlorophyllContent.toFixed(1) || 'N/A'}%</p>
                                  <p className="text-xs text-slate-500">Estimated chlorophyll level</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Water Content</p>
                                  <p className="text-2xl font-bold">{analysisResult.nutrientIndicators?.waterContent.toFixed(1) || 'N/A'}%</p>
                                  <p className="text-xs text-slate-500">Estimated water level</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-white dark:bg-slate-800 h-full">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">Growth Stage</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium">Stage</p>
                                  <p className="text-2xl font-bold">{analysisResult.growthStage?.stage || 'N/A'}</p>
                                  <p className="text-xs text-slate-500">Current growth phase</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Confidence</p>
                                  <p className="text-2xl font-bold">{analysisResult.growthStage?.confidence.toFixed(1) || 'N/A'}%</p>
                                  <p className="text-xs text-slate-500">Stage prediction reliability</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-white dark:bg-slate-800 h-full">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">Disease Prediction</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium">Predicted Disease</p>
                                  <p className="text-2xl font-bold text-red-600">{formatDiseaseName(analysisResult.disease.predicted_class)}</p>
                                  <p className="text-xs text-slate-500">Primary disease detected</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Confidence</p>
                                  <p className="text-2xl font-bold">{(analysisResult.disease.confidence * 100).toFixed(1)}%</p>
                                  <p className="text-xs text-slate-500">Prediction reliability</p>
                                </div>
                                {analysisResult.disease.warning && (
                                  <div className="mt-2">
                                    <p className="text-sm text-yellow-600">{analysisResult.disease.warning}</p>
                                  </div>
                                )}
                                <div className="mt-4">
                                  <p className="text-sm font-medium">Top Predictions:</p>
                                  <div className="mt-2 space-y-2">
                                    {analysisResult.disease.top_3_predictions && Object.entries(analysisResult.disease.top_3_predictions).map(([disease, confidence]) => (
                                      <div key={disease} className="flex justify-between">
                                        <span className="text-sm">{formatDiseaseName(disease)}</span>
                                        <span className="text-sm font-medium">{(confidence * 100).toFixed(1)}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle>Color Metrics</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium">Average Green</p>
                                  <p className="text-2xl font-bold">{analysisResult.colorMetrics.averageGreen.toFixed(1)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Average Red</p>
                                  <p className="text-2xl font-bold">{analysisResult.colorMetrics.averageRed.toFixed(1)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Average Blue</p>
                                  <p className="text-2xl font-bold">{analysisResult.colorMetrics.averageBlue.toFixed(1)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Color Variance</p>
                                  <p className="text-2xl font-bold">{analysisResult.colorMetrics.colorVariance.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Red/Green Ratio</p>
                                  <p className="text-2xl font-bold">{analysisResult.colorMetrics.redGreenRatio?.toFixed(2) || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Blue/Green Ratio</p>
                                  <p className="text-2xl font-bold">{analysisResult.colorMetrics.blueGreenRatio?.toFixed(2) || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Chlorophyll Index</p>
                                  <p className="text-2xl font-bold">{analysisResult.colorMetrics.chlorophyllIndex?.toFixed(2) || 'N/A'}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
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
                      {/* Alok */}
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
                          </div>
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 justify-center px-2">
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Python</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">TensorFlow</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">FastAPI</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">AWS</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">SQL</span>
                          </div>
                          <div className="mt-3 sm:mt-4 flex gap-3 sm:gap-4">
                            <a href="https://github.com/aloksingh1818" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="GitHub Profile">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                            </a>
                            <a href="https://www.linkedin.com/in/alok-kumar-singh-119481218/" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="LinkedIn Profile">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </a>
                            <a href="mailto:alok85820018@gmail.com" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="Email Address">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
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
                            className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full object-cover mb-3 sm:mb-4 border-4 border-slate-200 dark:border-slate-700"
                          />
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base md:text-lg">Sharique Azam</h4>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2">Backend Developer</p>
                          <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 dark:text-slate-400 text-center space-y-1 sm:space-y-2 mb-3 px-2 sm:px-4">
                            <p>
                              <span className="font-semibold">B.Tech CSE(DS) Student</span> at Haldia Institute of Technology, specializing in data science and backend development.
                            </p>
                            <p>
                              Experienced in building robust backend systems and implementing machine learning solutions for real-world applications.
                            </p>
                          </div>
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 justify-center px-2">
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Python</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Machine Learning</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Data Science</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Backend</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">API Development</span>
                          </div>
                          <div className="mt-3 sm:mt-4 flex gap-3 sm:gap-4">
                            <a href="https://github.com/HiIamShariqueAzam" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="GitHub Profile">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                            </a>
                            <a href="https://www.linkedin.com/in/sharique-azam-5b664a2b3" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="LinkedIn Profile">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </a>
                            <a href="mailto:shariqueazam410@gmail.com" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="Email Address">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
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
                            className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full object-cover mb-3 sm:mb-4 border-4 border-slate-200 dark:border-slate-700"
                          />
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base md:text-lg">Md Arif Azim</h4>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2">MERN Stack Developer</p>
                          <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 dark:text-slate-400 text-center space-y-1 sm:space-y-2 mb-3 px-2 sm:px-4">
                            <p>
                              <span className="font-semibold">Final-year B.Tech CSE(DS) Student</span> at Haldia Institute of Technology, specializing in MERN stack development and building modern web applications.
                            </p>
                            <p>
                              Passionate about creating scalable and user-friendly web applications using both frontend and backend technologies.
                            </p>
                          </div>
                          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 justify-center px-2">
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">React</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Node.js</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">MongoDB</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Express</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">MySQL</span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[9px] sm:text-[10px] md:text-xs rounded-full">Firebase</span>
                          </div>
                          <div className="mt-3 sm:mt-4 flex gap-3 sm:gap-4">
                            <a href="https://github.com/arif75157" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="GitHub Profile">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                            </a>
                            <a href="https://www.linkedin.com/in/md-arif-azim-6930b0172" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="LinkedIn Profile">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </a>
                            <a href="mailto:arif75157@gmail.com" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" aria-label="Email Address">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            </a>
                          </div>
                        </div>
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