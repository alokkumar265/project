import os
import io
import numpy as np
from flask import Flask, request, jsonify
from PIL import Image
import cv2
import tensorflow as tf
from tensorflow.keras.models import load_model
import logging
import math
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load your trained model (update path if needed)
MODEL_PATH = 'plant_disease_model.keras'
model = load_model(MODEL_PATH)

# Load class names dynamically (assumes subfolders in train dir)
TRAIN_DIR = 'plantvillage_data/train'
class_names = sorted([d for d in os.listdir(TRAIN_DIR) if os.path.isdir(os.path.join(TRAIN_DIR, d))])

app = Flask(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LeafAnalyzer:
    def __init__(self):
        self.calibration_area = 10.00  # Increased calibration area
        self.min_quality_score = 0.7   # Minimum quality threshold
        
    def check_image_quality(self, image):
        """Check image quality and return quality score."""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Check focus
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            focus_score = min(1.0, laplacian_var / 1000.0)
            
            # Check lighting
            brightness = np.mean(gray)
            lighting_score = 1.0 - abs(brightness - 128) / 128
            
            # Check contrast
            contrast = np.std(gray)
            contrast_score = min(1.0, contrast / 100.0)
            
            # Overall quality score
            quality_score = (focus_score + lighting_score + contrast_score) / 3
            
            return {
                'quality_score': quality_score,
                'focus_score': focus_score,
                'lighting_score': lighting_score,
                'contrast_score': contrast_score
            }
        except Exception as e:
            logger.error(f"Error in quality check: {str(e)}")
            return None

    def preprocess_image(self, image):
        """Preprocess image for better analysis."""
        try:
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(image, (5, 5), 0)
            
            # Convert to grayscale
            gray = cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY_INV, 11, 2
            )
            
            # Apply morphological operations
            kernel = np.ones((3,3), np.uint8)
            cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            return cleaned
        except Exception as e:
            logger.error(f"Error in preprocessing: {str(e)}")
            return None

    def calculate_leaf_area(self, image, contour):
        """Calculate leaf area with improved precision."""
        try:
            # Calculate pixel area
            pixel_area = cv2.contourArea(contour)
            
            # Calculate calibration factor
            image_area = image.shape[0] * image.shape[1]
            calibration_factor = self.calibration_area / image_area
            
            # Calculate actual area
            actual_area = pixel_area * calibration_factor
            
            # Calculate error margin (1% of the area)
            error_margin = actual_area * 0.01
            
            return {
                'area': actual_area,
                'error_margin': error_margin,
                'pixel_area': pixel_area
            }
        except Exception as e:
            logger.error(f"Error in area calculation: {str(e)}")
            return None

    def analyze_colors(self, image, mask):
        """Enhanced color analysis with normalization."""
        try:
            # Convert to float and normalize
            normalized = image.astype(float) / 255.0
            
            # Calculate mean RGB values
            mean_rgb = np.mean(normalized, axis=(0, 1))
            
            # Calculate standard deviation
            std_rgb = np.std(normalized, axis=(0, 1))
            
            # Convert to HSV
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            
            # Calculate color variance
            color_variance = np.var(hsv, axis=(0, 1))
            
            # Calculate color uniformity
            color_uniformity = 1 - np.mean(std_rgb)
            
            return {
                'mean_rgb': mean_rgb.tolist(),
                'std_rgb': std_rgb.tolist(),
                'color_variance': float(np.mean(color_variance)),
                'color_uniformity': float(color_uniformity)
            }
        except Exception as e:
            logger.error(f"Error in color analysis: {str(e)}")
            return None

    def calculate_health_indicators(self, image, contour):
        """Calculate health indicators with improved accuracy."""
        try:
            # Edge detection
            edges = cv2.Canny(image, 100, 200)
            
            # Calculate edge regularity
            edge_pixels = np.sum(edges > 0)
            total_pixels = edges.size
            edge_regularity = edge_pixels / total_pixels
            
            # Calculate texture complexity
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gradient_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            gradient_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            gradient_magnitude = np.sqrt(gradient_x**2 + gradient_y**2)
            texture_complexity = np.mean(gradient_magnitude) / np.mean(gray)
            
            # Calculate compactness
            perimeter = cv2.arcLength(contour, True)
            area = cv2.contourArea(contour)
            compactness = (4 * math.pi * area) / (perimeter * perimeter)
            
            return {
                'edge_regularity': float(edge_regularity),
                'texture_complexity': float(texture_complexity),
                'compactness': float(compactness)
            }
        except Exception as e:
            logger.error(f"Error in health indicators: {str(e)}")
            return None

    def analyze_leaf(self, image):
        """Main analysis function with improved error handling."""
        try:
            # Check image quality
            quality = self.check_image_quality(image)
            if not quality or quality['quality_score'] < self.min_quality_score:
                raise HTTPException(status_code=400, detail="Image quality too low")
            
            # Preprocess image
            processed = self.preprocess_image(image)
            if processed is None:
                raise HTTPException(status_code=400, detail="Image preprocessing failed")
            
            # Find contours
            contours, _ = cv2.findContours(processed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                raise HTTPException(status_code=400, detail="No leaf detected")
            
            # Get the largest contour
            leaf_contour = max(contours, key=cv2.contourArea)
            
            # Calculate area
            area_info = self.calculate_leaf_area(image, leaf_contour)
            if not area_info:
                raise HTTPException(status_code=400, detail="Area calculation failed")
            
            # Analyze colors
            color_info = self.analyze_colors(image, processed)
            if not color_info:
                raise HTTPException(status_code=400, detail="Color analysis failed")
            
            # Calculate health indicators
            health_info = self.calculate_health_indicators(image, leaf_contour)
            if not health_info:
                raise HTTPException(status_code=400, detail="Health indicators calculation failed")
            
            # Combine all results
            result = {
                'leaf_area': area_info['area'],
                'error_margin': area_info['error_margin'],
                'color_metrics': color_info,
                'health_indicators': health_info,
                'quality_metrics': quality
            }
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in leaf analysis: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.route('/analyze_leaf', methods=['POST'])
def analyze_leaf():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    file = request.files['image']
    image = Image.open(file.stream).convert('RGB')
    # Area measurement
    area_mm2, mask = measure_leaf_area(image)
    if area_mm2 is None:
        return jsonify({'error': 'Could not find calibration object or leaf'}), 400
    # Disease prediction
    disease, confidence, all_probs = predict_disease(image)
    return jsonify({
        'area_mm2': area_mm2,
        'area_cm2': area_mm2 / 100.0,
        'disease': disease,
        'confidence': confidence,
        'all_probs': all_probs
    })

@app.post("/analyze")
async def analyze_leaf(file: UploadFile = File(...)):
    try:
        # Read file contents
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file received")
        
        # Convert to image
        image = Image.open(io.BytesIO(contents))
        image = np.array(image)
        
        # Initialize analyzer
        analyzer = LeafAnalyzer()
        
        # Analyze leaf
        result = analyzer.analyze_leaf(image)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
