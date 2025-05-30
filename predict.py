import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PlantDiseasePredictor:
    def __init__(self, model_path=None):
        self.img_size = (128, 128)  # Match model input shape
        # Try loading model from project root
        root_dir = os.path.dirname(os.path.abspath(__file__))
        if model_path is None:
            h5_path = os.path.join(root_dir, 'plant_disease_model.h5')
            keras_path = os.path.join(root_dir, 'plant_disease_model.keras')
            if os.path.exists(h5_path):
                model_path = h5_path
            elif os.path.exists(keras_path):
                model_path = keras_path
            else:
                raise FileNotFoundError('No model file found in project root.')
        self.model = load_model(model_path)
        # Hardcoded class names (order must match model training)
        self.class_names = [
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
    
    def preprocess_image(self, image_path):
        """Preprocess a single image for prediction."""
        try:
            # Load and resize image
            img = load_img(image_path, target_size=self.img_size)
            # Convert to array and normalize
            img_array = img_to_array(img) / 255.0
            # Add batch dimension
            img_array = np.expand_dims(img_array, axis=0)
            return img_array
        except Exception as e:
            logger.error(f"Error preprocessing image {image_path}: {str(e)}")
            return None
    
    def predict(self, image_path):
        """Make prediction on a single image."""
        try:
            # Preprocess image
            img_array = self.preprocess_image(image_path)
            if img_array is None:
                return None
            
            # Make prediction
            predictions = self.model.predict(img_array)
            predicted_class = np.argmax(predictions[0])
            confidence = predictions[0][predicted_class]
            
            return {
                'class': self.class_names[predicted_class],
                'confidence': float(confidence),
                'all_predictions': {
                    class_name: float(conf) 
                    for class_name, conf in zip(self.class_names, predictions[0])
                }
            }
        except Exception as e:
            logger.error(f"Error making prediction: {str(e)}")
            return None
    
    def predict_batch(self, image_dir):
        """Make predictions on all images in a directory."""
        results = {}
        for filename in os.listdir(image_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_path = os.path.join(image_dir, filename)
                prediction = self.predict(image_path)
                if prediction:
                    results[filename] = prediction
        return results

def main():
    # Initialize predictor
    predictor = PlantDiseasePredictor()
    
    # Example: Predict a single image
    test_image_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_leaf.jpg')
    if os.path.exists(test_image_path):
        result = predictor.predict(test_image_path)
        if result:
            print(f"\nPrediction for {test_image_path}:")
            print(f"Class: {result['class']}")
            print(f"Confidence: {result['confidence']:.2%}")
            print("\nAll predictions:")
            for class_name, conf in result['all_predictions'].items():
                print(f"{class_name}: {conf:.2%}")
    
    # Example: Predict all images in a directory
    test_dir = 'path/to/your/test/directory'  # Replace with your directory path
    if os.path.exists(test_dir):
        results = predictor.predict_batch(test_dir)
        print(f"\nPredictions for {len(results)} images:")
        for filename, result in results.items():
            print(f"\n{filename}:")
            print(f"Class: {result['class']}")
            print(f"Confidence: {result['confidence']:.2%}")

if __name__ == "__main__":
    main()