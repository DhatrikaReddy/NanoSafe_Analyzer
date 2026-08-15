import os
import urllib.request
import zipfile

def create_dirs():
    dirs = [
        "image_analysis/dataset",
        "image_analysis/models",
        "image_analysis/preprocessing",
        "image_analysis/training",
        "image_analysis/evaluation/results",
        "static/uploads/images"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
        print(f"Created {d}")

def download_dataset():
    url = "https://ceb.nlm.nih.gov/proj/malaria/cell_images.zip"
    zip_path = "image_analysis/dataset/cell_images.zip"
    
    if not os.path.exists(zip_path):
        print("Downloading dataset (this may take a few minutes)...")
        # For speed and since we're just demonstrating a pipeline,
        # we'll still download the full zip, but when we extract, we will only extract a subset.
        urllib.request.urlretrieve(url, zip_path)
        print("Downloaded.")
    
    print("Extracting a subset of images for training efficiency...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # We only want to extract the first 250 from each class
        # to ensure training doesn't take hours on a CPU.
        # The structure inside is cell_images/Parasitized/... and cell_images/Uninfected/...
        parasitized_count = 0
        uninfected_count = 0
        MAX_PER_CLASS = 250
        
        for file_info in zip_ref.infolist():
            if file_info.filename.endswith(".png"):
                if "Parasitized" in file_info.filename and parasitized_count < MAX_PER_CLASS:
                    zip_ref.extract(file_info, "image_analysis/dataset/")
                    parasitized_count += 1
                elif "Uninfected" in file_info.filename and uninfected_count < MAX_PER_CLASS:
                    zip_ref.extract(file_info, "image_analysis/dataset/")
                    uninfected_count += 1
                
            if parasitized_count >= MAX_PER_CLASS and uninfected_count >= MAX_PER_CLASS:
                break
                
    print("Extraction complete. We have extracted 250 images per class for efficiency.")

if __name__ == "__main__":
    create_dirs()
    download_dataset()
