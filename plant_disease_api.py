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
from typing import Dict, Any, Optional
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Constants
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'plant_disease_model.h5')  # Try .h5 format first
MODEL_PATH_KERAS = os.path.join(os.path.dirname(__file__), 'plant_disease_model.keras')  # Fallback to .keras format
IMG_SIZE = (128, 128)  # Updated to match model's expected input size
CONFIDENCE_THRESHOLD = 0.7
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
RATE_LIMIT = 100  # requests per minute
REQUEST_TIMEOUT = 30  # seconds

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

def create_custom_input_layer(config):
    """Create a custom input layer with proper configuration."""
    try:
        # Handle different input shape configurations
        if isinstance(config, dict):
            # Extract input shape from config
            if 'input_shape' in config:
                input_shape = config['input_shape']
            elif 'batch_shape' in config:
                input_shape = config['batch_shape'][1:]  # Remove batch dimension
            else:
                input_shape = (128, 128, 3)  # Default shape
        else:
            input_shape = (128, 128, 3)  # Default shape if config is not a dict

        # Create input layer with proper configuration
        return tf.keras.layers.InputLayer(
            input_shape=input_shape,
            dtype=config.get('dtype', 'float32') if isinstance(config, dict) else 'float32',
            name=config.get('name', 'input_layer') if isinstance(config, dict) else 'input_layer'
        )
    except Exception as e:
        logger.error(f"Error creating input layer: {str(e)}")
        # Fallback to default configuration
        return tf.keras.layers.InputLayer(
            input_shape=(128, 128, 3),
            dtype='float32',
            name='input_layer'
        )

def load_model_safely():
    """Safely load the model with proper error handling and version compatibility."""
    model_paths = [MODEL_PATH, MODEL_PATH_KERAS]
    last_error = None
    
    for model_path in model_paths:
        if not os.path.exists(model_path):
            logger.warning(f"Model file not found: {model_path}")
            continue
            
        try:
            # First attempt: Try loading with custom objects and compile=False
            logger.info(f"Attempting to load model from {model_path}")
            model = tf.keras.models.load_model(
                model_path,
                compile=False,
                custom_objects={
                    'InputLayer': create_custom_input_layer
                }
            )
            logger.info(f"Model loaded successfully from {model_path}")
            
            # Verify model structure
            if not isinstance(model, tf.keras.Model):
                raise ValueError("Loaded object is not a valid Keras model")
                
            # Compile the model
            model.compile(
                optimizer='adam',
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
            return model
            
        except Exception as e1:
            logger.warning(f"First loading attempt failed for {model_path}: {str(e1)}")
            try:
                # Second attempt: Try loading with legacy format
                logger.info("Attempting to load model with legacy format")
                model = tf.keras.models.load_model(
                    model_path,
                    compile=False,
                    custom_objects=None
                )
                logger.info(f"Model loaded successfully with legacy format from {model_path}")
                
                # Verify model structure
                if not isinstance(model, tf.keras.Model):
                    raise ValueError("Loaded object is not a valid Keras model")
                    
                # Compile the model
                model.compile(
                    optimizer='adam',
                    loss='categorical_crossentropy',
                    metrics=['accuracy']
                )
                return model
                
            except Exception as e2:
                logger.error(f"Second loading attempt failed for {model_path}: {str(e2)}")
                try:
                    # Third attempt: Try loading with minimal configuration
                    logger.info("Attempting to load model with minimal configuration")
                    model = tf.keras.models.load_model(
                        model_path,
                        compile=False
                    )
                    logger.info(f"Model loaded successfully with minimal configuration from {model_path}")
                    
                    # Verify model structure
                    if not isinstance(model, tf.keras.Model):
                        raise ValueError("Loaded object is not a valid Keras model")
                        
                    # Compile the model
                    model.compile(
                        optimizer='adam',
                        loss='categorical_crossentropy',
                        metrics=['accuracy']
                    )
                    return model
                    
                except Exception as e3:
                    logger.error(f"Third loading attempt failed for {model_path}: {str(e3)}")
                    last_error = str(e3)
                    continue
    
    error_msg = f"Failed to load model from any available path. Last error: {last_error}"
    logger.error(error_msg)
    raise Exception(error_msg)

# Load the model at startup
try:
    logger.info("Starting model loading process...")
    model = load_model_safely()
    logger.info("Model loaded successfully")
    
    # Hardcoded class names (in the order used during model training)
    class_names = [
        'Pepper__bell___Bacterial_spot',
        'Pepper__bell___healthy',
        'Potato___Early_blight',
        'Potato___Late_blight',
        'Potato___healthy',
        'Tomato_Bacterial_spot',
        'Tomato_Early_blight',
        'Tomato_Late_blight',
        'Tomato_Leaf_Mold',
        'Tomato_Septoria_leaf_spot',
        'Tomato_Spider_mites_Two_spotted_spider_mite',
        'Tomato__Target_Spot',
        'Tomato__Tomato_YellowLeaf__Curl_Virus',
        'Tomato__Tomato_mosaic_virus',
        'Tomato_healthy'
    ]
    logger.info(f"Found {len(class_names)} classes: {class_names}")
except Exception as e:
    logger.error(f"Critical error loading model: {str(e)}")
    raise

def get_system_metrics() -> Dict[str, Any]:
    """Get system metrics for monitoring."""
    return {
        "memory_usage": psutil.Process().memory_info().rss / 1024 / 1024,  # MB
        "cpu_percent": psutil.Process().cpu_percent(),
        "timestamp": datetime.now().isoformat()
    }

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time header to response."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        metrics = get_system_metrics()
        return {
            "status": "healthy",
            "model_loaded": model is not None,
            "classes": len(class_names),
            "image_size": IMG_SIZE,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "system_metrics": metrics
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "unhealthy", "error": str(e)}
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

        # Check file size
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE/1024/1024}MB"
            )

        # Process image
        try:
            img = Image.open(io.BytesIO(contents))
            if not check_image_quality(img):
                raise HTTPException(
                    status_code=400,
                    detail="Image quality too low. Please ensure good lighting and focus."
                )
            
            img_array = preprocess_image(img)
            if img_array is None:
                raise HTTPException(status_code=400, detail="Error preprocessing image")
            
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

        # Make prediction
        try:
            preds = model.predict(img_array, verbose=0)
            pred_class_idx = np.argmax(preds[0])
            confidence = float(preds[0][pred_class_idx])
            
            if confidence < CONFIDENCE_THRESHOLD:
                logger.warning(f"Low confidence prediction: {confidence:.2f}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Low confidence prediction ({confidence:.2%}). Please retake the image."
                )
            
            pred_class = class_names[pred_class_idx]
            
            # Get top 3 predictions
            top_3_idx = np.argsort(preds[0])[-3:][::-1]
            top_3_predictions = {
                class_names[i]: float(preds[0][i])
                for i in top_3_idx
            }
            
            logger.info(f"Prediction successful: {pred_class} with confidence {confidence:.2f}")
            
            # Clean up memory
            del img_array
            gc.collect()
            
            return {
                "predicted_class": pred_class,
                "confidence": confidence,
                "top_3_predictions": top_3_predictions,
                "all_predictions": {
                    class_name: float(conf)
                    for class_name, conf in zip(class_names, preds[0])
                },
                "processing_time": time.time() - request.state.start_time
            }
            
        except Exception as e:
            logger.error(f"Error making prediction: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error making prediction: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Plant Disease Detection API is running.",
        "version": "1.0.0",
        "endpoints": {
            "/health": "Check API health",
            "/predict": "Upload image for disease prediction",
            "/docs": "API documentation",
            "/redoc": "Alternative API documentation"
        }
    }

if __name__ == "__main__":
    # Get port from environment variable or default to 8000
    port = int(os.getenv("PORT", 8000))
    
    # Configure uvicorn server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        workers=2,
        timeout_keep_alive=75,
        log_level="info",
        reload=False  # Disable reload in production
    )
