import os
# Set environment variables to suppress warnings and disable CUDA
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress all TensorFlow logging
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # Disable oneDNN custom operations
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'  # Disable GPU
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
os.environ['TF_DISABLE_GPU'] = '1'
os.environ['TF_USE_CUDNN'] = '0'
os.environ['TF_USE_CUBLAS'] = '0'
os.environ['TF_USE_CUFFT'] = '0'

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from tensorflow.keras.models import load_model
from tensorflow.keras.layers import InputLayer
from tensorflow.keras.preprocessing import image
import numpy as np
import uvicorn
import io
from PIL import Image
import logging
import cv2
import tensorflow as tf
import time
from datetime import datetime
import json
from typing import Dict, Any, Optional, List, Tuple
import psutil
import gc

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Plant Disease Detection API",
    description="API for detecting plant diseases from leaf images",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins during development
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Constants
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'plant_disease_model.h5')
MODEL_PATH_KERAS = os.path.join(os.path.dirname(__file__), 'plant_disease_model.keras')
IMG_SIZE = (128, 128)  # Model's expected input size
CONFIDENCE_THRESHOLD = 0.2  # 20% minimum confidence threshold
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
RATE_LIMIT = 100  # requests per minute
REQUEST_TIMEOUT = 30  # seconds
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']

# Disease class mapping
DISEASE_CLASSES = {
    "0": "Apple___Apple_scab",
    "1": "Apple___Black_rot",
    "2": "Apple___Cedar_apple_rust",
    "3": "Apple___healthy",
    "4": "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "5": "Corn_(maize)___Common_rust_",
    "6": "Corn_(maize)___Northern_Leaf_Blight",
    "7": "Corn_(maize)___healthy",
    "8": "Grape___Black_rot",
    "9": "Grape___Esca_(Black_Measles)",
    "10": "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "11": "Grape___healthy",
    "12": "Potato___Early_blight",
    "13": "Potato___Late_blight",
    "14": "Potato___healthy",
    "15": "Tomato___Bacterial_spot",
    "16": "Tomato___Early_blight",
    "17": "Tomato___Late_blight",
    "18": "Tomato___Leaf_Mold",
    "19": "Tomato___Septoria_leaf_spot",
    "20": "Tomato___Spider_mites Two-spotted_spider_mite",
    "21": "Tomato___Target_Spot",
    "22": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "23": "Tomato___Tomato_mosaic_virus",
    "24": "Tomato___healthy"
}

# Rate limiting
request_times: Dict[str, list] = {}

def check_rate_limit(client_ip: str) -> bool:
    """Check if the client has exceeded the rate limit."""
    current_time = time.time()
    if client_ip not in request_times:
        request_times[client_ip] = []
    
    # Remove old requests
    request_times[client_ip] = [t for t in request_times[client_ip] if current_time - t < 60]
    
    if len(request_times[client_ip]) >= RATE_LIMIT:
        return False
    
    request_times[client_ip].append(current_time)
    return True

def load_model_safely():
    """Safely load the model with proper error handling."""
    model_paths = [MODEL_PATH, MODEL_PATH_KERAS]
    last_error = None
    
    for model_path in model_paths:
        if not os.path.exists(model_path):
            logger.warning(f"Model file not found: {model_path}")
            continue
            
        try:
            logger.info(f"Loading model from {model_path}")
            model = tf.keras.models.load_model(model_path, compile=False)
            
            # Verify model structure
            if not isinstance(model, tf.keras.Model):
                raise ValueError("Loaded object is not a valid Keras model")
            
            # Compile the model
            model.compile(
                optimizer='adam',
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
            
            logger.info("Model loaded and compiled successfully")
            return model
            
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {str(e)}")
            last_error = str(e)
            continue
    
    raise RuntimeError(f"Failed to load model from any path. Last error: {last_error}")

def validate_image(file: UploadFile) -> None:
    """Validate the uploaded image file."""
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE / (1024 * 1024)}MB"
        )
    
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )

def preprocess_image(pil_image: Image.Image) -> np.ndarray:
    """Preprocess the image for model input."""
    try:
        # Resize image
        pil_image = pil_image.resize(IMG_SIZE, Image.Resampling.LANCZOS)
        
        # Convert to numpy array and normalize
        img_array = np.array(pil_image) / 255.0
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Failed to process image"
        )

def get_top_predictions(predictions: np.ndarray, top_k: int = 3) -> List[Tuple[str, float]]:
    """Get top k predictions with their confidence scores."""
    # Get indices of top k predictions
    top_indices = np.argsort(predictions[0])[-top_k:][::-1]
    
    # Get corresponding class names and confidence scores
    top_predictions = [
        (DISEASE_CLASSES[str(idx)], float(predictions[0][idx]))
        for idx in top_indices
    ]
    
    return top_predictions

# Load model at startup
model = None
try:
    model = load_model_safely()
except Exception as e:
    logger.error(f"Failed to load model at startup: {str(e)}")
    raise RuntimeError("Failed to initialize model")

@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        # Check if model is loaded
        if model is None:
            raise RuntimeError("Model not loaded")
        
        # Get system metrics
        metrics = get_system_metrics()
        
        return {
            "status": "healthy",
            "model_loaded": True,
            "system_metrics": metrics
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )

@app.post("/predict")
async def predict(request: Request, file: UploadFile = File(...)):
    """Predict plant disease from uploaded image."""
    try:
        # Check rate limit
        client_ip = request.client.host
        if not check_rate_limit(client_ip):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later."
            )
        
        # Validate image
        validate_image(file)
        
        # Read and validate image
        contents = await file.read()
        try:
            pil_image = Image.open(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail="Invalid image file"
            )
        
        # Preprocess image
        img_array = preprocess_image(pil_image)
        
        # Make prediction
        start_time = time.time()
        predictions = model.predict(img_array, verbose=0)
        processing_time = time.time() - start_time
        
        # Get top predictions
        top_predictions = get_top_predictions(predictions)
        
        # Get predicted class and confidence
        predicted_class, confidence = top_predictions[0]
        
        # Check confidence threshold
        if confidence < CONFIDENCE_THRESHOLD:
            return {
                "predicted_class": predicted_class,
                "confidence": confidence,
                "top_3_predictions": dict(top_predictions),
                "all_predictions": {DISEASE_CLASSES[str(i)]: float(p) for i, p in enumerate(predictions[0])},
                "processing_time": processing_time,
                "warning": "Low confidence prediction. Please try with a clearer image."
            }
        
        return {
            "predicted_class": predicted_class,
            "confidence": confidence,
            "top_3_predictions": dict(top_predictions),
            "all_predictions": {DISEASE_CLASSES[str(i)]: float(p) for i, p in enumerate(predictions[0])},
            "processing_time": processing_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

def get_system_metrics() -> Dict[str, Any]:
    """Get system metrics."""
    return {
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
