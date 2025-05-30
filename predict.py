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
    def __init__(self, model_path='models/best_model.h5'):
        self.img_size = (160, 160)  # Same as training
        self.model = load_model(model_path)
        # Dynamically load class names from plantvillage_data directory, sorted
        data_dir = os.path.join(os.path.dirname(__file__), 'plantvillage_data')
        self.class_names = sorted([
            d for d in os.listdir(data_dir)
            if os.path.isdir(os.path.join(data_dir, d))
        ])
    
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
    test_image_path = 'path/to/your/test/image.jpg'  # Replace with your image path
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