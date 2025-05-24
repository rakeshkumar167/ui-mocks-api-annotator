import React, { useState, useRef, useEffect, useCallback } from 'react';

// A unique ID generator for images and annotations
const generateId = () => Math.random().toString(36).substring(2, 11);

// ImageAnnotatorTab Component: Handles a single image and its annotations
function ImageAnnotatorTab({ image, onUpdateImage, onDeleteImage }) {
  // Destructure image properties for easier access
  const { id, name, url: imageUrl, annotations } = image;

  // State to track if the user is currently drawing a new annotation
  const [isDrawing, setIsDrawing] = useState(false);
  // State to store the starting coordinates of a new annotation
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  // State to store the current dimensions of the annotation being drawn
  const [currentRect, setCurrentRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  // State to store the index of the currently selected annotation for editing
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(null);
  // State for the API details form inputs
  const [apiDetails, setApiDetails] = useState({
    name: '',
    endpoint: '',
    method: 'GET',
    requestBody: '',
    responseBody: '',
    description: ''
  });

  // Ref for the image container (the div that wraps the image and annotations)
  const imageWrapperRef = useRef(null);
  // Ref for the actual <img> element to get its displayed dimensions
  const imgRef = useRef(null);

  // Effect to update apiDetails form when a new annotation is selected or image changes
  useEffect(() => {
    if (selectedAnnotationIndex !== null && annotations[selectedAnnotationIndex]) {
      setApiDetails(annotations[selectedAnnotationIndex].apiDetails);
    } else {
      // Reset form if no annotation is selected or image changes
      setApiDetails({
        name: '',
        endpoint: '',
        method: 'GET',
        requestBody: '',
        responseBody: '',
        description: ''
      });
    }
  }, [selectedAnnotationIndex, annotations, imageUrl]); // Depend on annotations and imageUrl to reset on image change

  // Handle mouse down event on the image wrapper to start drawing
  const handleMouseDown = (event) => {
    if (!imageUrl || !imageWrapperRef.current) return; // Only draw if an image is loaded and wrapper exists

    setIsDrawing(true);
    // Get bounds of the imageWrapperRef (the div that holds the image and annotations)
    const rect = imageWrapperRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setStartPoint({ x, y });
    setCurrentRect({ x, y, width: 0, height: 0 });
    setSelectedAnnotationIndex(null); // Deselect any active annotation when starting to draw
  };

  // Handle mouse move event while drawing
  const handleMouseMove = (event) => {
    if (!isDrawing || !imageUrl || !imageWrapperRef.current) return;

    const rect = imageWrapperRef.current.getBoundingClientRect(); // Get bounds of the imageWrapperRef
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate current rectangle dimensions
    const newX = Math.min(startPoint.x, x);
    const newY = Math.min(startPoint.y, y);
    const newWidth = Math.abs(x - startPoint.x);
    const newHeight = Math.abs(y - startPoint.y);

    setCurrentRect({ x: newX, y: newY, width: newWidth, height: newHeight });
  };

  // Handle mouse up event to finish drawing or select an annotation
  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      // If the drawn rectangle has a valid size, add it as a new annotation
      if (currentRect.width > 5 && currentRect.height > 5) { // Minimum size to avoid tiny clicks
        const imgElement = imgRef.current;
        if (!imgElement) return; // Should not happen if drawing is active

        // Get current displayed dimensions of the image
        const displayedWidth = imgElement.offsetWidth;
        const displayedHeight = imgElement.offsetHeight;

        // Store ratios instead of absolute pixels
        const newAnnotation = {
          id: generateId(), // Assign a unique ID to the annotation
          ratioX: currentRect.x / displayedWidth,
          ratioY: currentRect.y / displayedHeight,
          ratioWidth: currentRect.width / displayedWidth,
          ratioHeight: currentRect.height / displayedHeight,
          apiDetails: {
            name: '',
            endpoint: '',
            method: 'GET',
            requestBody: '',
            responseBody: '',
            description: ''
          }
        };
        const updatedAnnotations = [...annotations, newAnnotation];
        onUpdateImage({ ...image, annotations: updatedAnnotations });
        setSelectedAnnotationIndex(updatedAnnotations.length - 1); // Select the newly created annotation
      }
      setCurrentRect({ x: 0, y: 0, width: 0, height: 0 }); // Reset current drawing rect
    }
  }, [isDrawing, currentRect, annotations, image, onUpdateImage]); // Dependencies for useCallback

  // Handle click on an existing annotation to select it for editing
  const handleAnnotationClick = (index, event) => {
    event.stopPropagation(); // Prevent the click from bubbling up to the image container
    setSelectedAnnotationIndex(index);
  };

  // Handle changes in the API details form
  const handleApiDetailsChange = (event) => {
    const { name, value } = event.target;
    setApiDetails((prev) => ({ ...prev, [name]: value }));
  };

  // Save API details to the selected annotation
  const saveApiDetails = () => {
    if (selectedAnnotationIndex !== null) {
      const updatedAnnotations = annotations.map((annotation, index) =>
        index === selectedAnnotationIndex
          ? { ...annotation, apiDetails: apiDetails }
          : annotation
      );
      onUpdateImage({ ...image, annotations: updatedAnnotations });
    }
  };

  // Delete the selected annotation
  const deleteAnnotation = () => {
    if (selectedAnnotationIndex !== null) {
      const updatedAnnotations = annotations.filter((_, index) => index !== selectedAnnotationIndex);
      onUpdateImage({ ...image, annotations: updatedAnnotations });
      setSelectedAnnotationIndex(null); // Deselect after deletion
    }
  };

  // Effect to add/remove global mouse event listeners for drawing
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]); // Only re-run if handleMouseUp changes

  // Get current displayed image dimensions for rendering annotations
  const currentDisplayedWidth = imgRef.current ? imgRef.current.offsetWidth : 0;
  const currentDisplayedHeight = imgRef.current ? imgRef.current.offsetHeight : 0;


  return (
    <div className="flex flex-col lg:flex-row w-full gap-6">
      {/* Image Display Area */}
      {/* The image container itself needs to be relative */}
      <div className="relative flex-1 bg-white p-4 rounded-lg shadow-lg flex justify-center items-center">
        {!imageUrl && (
          <p className="text-gray-500 text-lg">Upload an image to start annotating.</p>
        )}
        {imageUrl && (
          // THIS IS THE KEY DIV: It's relative, contains the image, and will contain annotations.
          // Mouse events for drawing are now on this div.
          <div
            ref={imageWrapperRef} // Assign ref to this div for correct coordinate calculation
            className="relative w-full h-auto cursor-crosshair" // Added cursor-crosshair here
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            <img
              ref={imgRef} // Assign ref to the img element
              src={imageUrl}
              alt={`Mockup: ${name}`}
              className="w-full h-auto object-contain"
              draggable="false"
            />

            {/* Display existing annotations */}
            {annotations.map((annotation, index) => (
              <div
                key={annotation.id} // Use unique annotation ID for key
                className={`absolute border-2 ${
                  selectedAnnotationIndex === index ? 'border-blue-500 bg-blue-500 bg-opacity-20' : 'border-red-500 bg-red-500 bg-opacity-10'
                } hover:border-blue-500 hover:bg-blue-500 hover:bg-opacity-20 transition-all duration-150 ease-in-out cursor-pointer flex justify-center items-center`}
                style={{
                  // Use ratios multiplied by current displayed dimensions
                  left: `${annotation.ratioX * currentDisplayedWidth}px`,
                  top: `${annotation.ratioY * currentDisplayedHeight}px`,
                  width: `${annotation.ratioWidth * currentDisplayedWidth}px`,
                  height: `${annotation.ratioHeight * currentDisplayedHeight}px`,
                }}
                onClick={(e) => handleAnnotationClick(index, e)}
                title={annotation.apiDetails.name || `Annotation ${index + 1}`}
              >
                <span className="absolute -top-6 left-0 text-xs font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded-md">
                  {annotation.apiDetails.name || `Section ${index + 1}`}
                </span>
                {selectedAnnotationIndex === index && (
                  <span className="text-white text-2xl font-bold">+</span>
                )}
              </div>
            ))}

            {/* Display the rectangle being drawn - MOVED HERE */}
            {isDrawing && currentRect.width > 0 && currentRect.height > 0 && (
              <div
                className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20"
                style={{
                  left: `${currentRect.x}px`,
                  top: `${currentRect.y}px`,
                  width: `${currentRect.width}px`,
                  height: `${currentRect.height}px`,
                }}
              ></div>
            )}
          </div>
        )}
      </div>

      {/* API Details Form */}
      <div className="w-full lg:w-96 bg-white p-6 rounded-lg shadow-lg overflow-y-auto flex-grow flex-shrink-0 max-h-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          {selectedAnnotationIndex !== null ? `API Details for Section ${selectedAnnotationIndex + 1}` : 'API Details'}
        </h2>
        {selectedAnnotationIndex !== null ? (
          <form onSubmit={(e) => { e.preventDefault(); saveApiDetails(); }}>
            <div className="mb-4">
              <label htmlFor={`api-name-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Section Name
              </label>
              <input
                type="text"
                id={`api-name-${id}`}
                name="name"
                value={apiDetails.name}
                onChange={handleApiDetailsChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., User Profile Fetch"
              />
            </div>

            <div className="mb-4">
              <label htmlFor={`endpoint-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                API Endpoint
              </label>
              <input
                type="text"
                id={`endpoint-${id}`}
                name="endpoint"
                value={apiDetails.endpoint}
                onChange={handleApiDetailsChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., /api/users/{id}"
              />
            </div>

            <div className="mb-4">
              <label htmlFor={`method-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Method
              </label>
              <select
                id={`method-${id}`}
                name="method"
                value={apiDetails.method}
                onChange={handleApiDetailsChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor={`requestBody-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Request Body (JSON)
              </label>
              <textarea
                id={`requestBody-${id}`}
                name="requestBody"
                value={apiDetails.requestBody}
                onChange={handleApiDetailsChange}
                rows="4"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder='{"key": "value"}'
              ></textarea>
            </div>

            <div className="mb-4">
              <label htmlFor={`responseBody-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Expected Response Body (JSON)
              </label>
              <textarea
                id={`responseBody-${id}`}
                name="responseBody"
                value={apiDetails.responseBody}
                onChange={handleApiDetailsChange}
                rows="4"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder='{"data": "response"}'
              ></textarea>
            </div>

            <div className="mb-6">
              <label htmlFor={`description-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id={`description-${id}`}
                name="description"
                value={apiDetails.description}
                onChange={handleApiDetailsChange}
                rows="3"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of this API call's purpose."
              ></textarea>
            </div>

            <div className="flex justify-between">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Save Details
              </button>
              <button
                type="button"
                onClick={deleteAnnotation}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                Delete Section
              </button>
            </div>
          </form>
        ) : (
          <p className="text-gray-500">Select or draw a section on the image to add API details.</p>
        )}
      </div>
    </div>
  );
}

// Main App component
function App() {
  // State to hold all images and their respective annotations
  const [images, setImages] = useState([]);
  // State to track the ID of the currently selected image/tab
  const [selectedImageId, setSelectedImageId] = useState(null);
  // State to manage the input for new tab names
  const [newTabName, setNewTabName] = useState('');
  // State to manage the input for renaming current tab
  const [editingTabName, setEditingTabName] = useState(false);
  const [currentTabNameInput, setCurrentTabNameInput] = useState('');

  // Ref for the hidden file input for loading data
  const fileInputRef = useRef(null);

  // Effect to set the first image as selected when images are loaded
  useEffect(() => {
    if (images.length > 0 && selectedImageId === null) {
      setSelectedImageId(images[0].id);
    }
  }, [images, selectedImageId]);

  // Handle adding a new image (and thus a new tab)
  const handleAddImage = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage = {
          id: generateId(),
          name: newTabName || `Mockup ${images.length + 1}`, // Default name
          url: reader.result,
          annotations: [],
        };
        setImages((prev) => [...prev, newImage]);
        setSelectedImageId(newImage.id); // Select the new tab
        setNewTabName(''); // Clear the input
        event.target.value = null; // Clear the file input
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle deleting an image/tab
  const handleDeleteImage = (imageIdToDelete) => {
    setImages((prev) => prev.filter(img => img.id !== imageIdToDelete));
    if (selectedImageId === imageIdToDelete) {
      // If the deleted tab was selected, select the first remaining tab or null
      setSelectedImageId(images.length > 1 ? images[0].id : null);
    }
  };

  // Callback to update an image's data (e.g., annotations) from the ImageAnnotatorTab component
  const handleUpdateImage = (updatedImage) => {
    setImages((prev) =>
      prev.map((img) => (img.id === updatedImage.id ? updatedImage : img))
    );
  };

  // Find the currently selected image object
  const currentImage = images.find((img) => img.id === selectedImageId);

  // Handle renaming the current tab
  const handleRenameTab = () => {
    if (currentImage) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === currentImage.id ? { ...img, name: currentTabNameInput } : img
        )
      );
      setEditingTabName(false);
    }
  };

  // Start editing tab name
  const startEditingTabName = (imageName) => {
    setEditingTabName(true);
    setCurrentTabNameInput(imageName);
  };

  // Function to save all images and annotations to a JSON file
  const handleSaveData = () => {
    try {
      const dataToSave = JSON.stringify(images, null, 2); // Pretty print JSON
      const blob = new Blob([dataToSave], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ui-mocks-annotations.json';
      document.body.appendChild(a); // Append to body to make it clickable
      a.click(); // Programmatically click the link to trigger download
      document.body.removeChild(a); // Clean up the element
      URL.revokeObjectURL(url); // Release the object URL
    } catch (error) {
      console.error("Failed to save data:", error);
      // In a real app, you might show a user-friendly error message here
    }
  };

  // Function to load data from a JSON file
  const handleLoadData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedData = JSON.parse(e.target.result);
          // Basic validation: ensure it's an array and has expected properties
          if (Array.isArray(loadedData) && loadedData.every(item => item.id && item.name && item.url && Array.isArray(item.annotations))) {
            setImages(loadedData);
            // Select the first image if data is loaded
            if (loadedData.length > 0) {
              setSelectedImageId(loadedData[0].id);
            } else {
              setSelectedImageId(null);
            }
          } else {
            console.error("Loaded data is not in the expected format.");
            // Show error to user
          }
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          // Show error to user
        }
      };
      reader.readAsText(file);
      event.target.value = null; // Clear the file input
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Navigation Bar / Header */}
      <nav className="bg-blue-800 text-white p-4 shadow-lg flex flex-col sm:flex-row justify-between items-center w-full">
        <h1 className="text-3xl font-bold mb-2 sm:mb-0">
          UI Mocks API Annotator
        </h1>

        {/* Tab Management Section (moved inside nav for better integration) */}
        <div className="flex flex-wrap items-center gap-2">
          {images.map((img) => (
            <div key={img.id} className="flex items-center">
              <button
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors duration-200
                  ${selectedImageId === img.id ? 'bg-blue-600 text-white' : 'bg-blue-700 text-blue-100 hover:bg-blue-600'}`}
                onClick={() => setSelectedImageId(img.id)}
              >
                {img.name}
              </button>
              <button
                className="ml-1 px-2 py-1 text-xs text-red-300 hover:text-red-100 rounded-full"
                onClick={() => handleDeleteImage(img.id)}
                title="Delete Tab"
              >
                &times;
              </button>
            </div>
          ))}
          {/* Add New Tab Input */}
          <div className="flex items-center ml-4">
            <input
              type="text"
              placeholder="New Tab Name"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-l-md text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800"
            />
            <label htmlFor="add-image-file" className="px-4 py-2 bg-green-600 text-white rounded-r-md cursor-pointer hover:bg-green-700 text-sm font-medium transition-colors duration-200">
              Add Image
            </label>
            <input
              type="file"
              id="add-image-file"
              accept="image/*"
              onChange={handleAddImage}
              className="hidden"
            />
          </div>
        </div>

        {/* Save/Load Data Buttons */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-4">
          <button
            onClick={handleSaveData}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors duration-200"
          >
            Save Data
          </button>
          <label htmlFor="load-data-file" className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium cursor-pointer hover:bg-yellow-700 transition-colors duration-200">
            Load Data
          </label>
          <input
            type="file"
            id="load-data-file"
            accept=".json"
            onChange={handleLoadData}
            className="hidden"
            ref={fileInputRef} // Assign ref to clear input
          />
        </div>
      </nav>

      {/* Current Tab Name Editing (moved outside nav but still prominent) */}
      {currentImage && (
        <div className="w-full bg-white p-4 shadow-sm flex items-center justify-center border-b border-gray-200">
          <span className="text-lg font-semibold text-gray-800 mr-2">Current Tab:</span>
          {editingTabName ? (
            <>
              <input
                type="text"
                value={currentTabNameInput}
                onChange={(e) => setCurrentTabNameInput(e.target.value)}
                onBlur={handleRenameTab}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameTab();
                  }
                }}
                className="px-2 py-1 border border-gray-300 rounded-md text-lg font-semibold focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <button
                onClick={handleRenameTab}
                className="ml-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
              >
                Save
              </button>
            </>
          ) : (
            <span
              className="text-lg font-semibold text-blue-700 cursor-pointer hover:underline"
              onClick={() => startEditingTabName(currentImage.name)}
            >
              {currentImage.name} (Click to rename)
            </span>
          )}
        </div>
      )}

      {/* Main Content Area and Annotations List Container */}
      <div className="flex-grow overflow-y-auto p-4">
        {currentImage ? (
          <>
            <ImageAnnotatorTab
              key={currentImage.id}
              image={currentImage}
              onUpdateImage={handleUpdateImage}
              onDeleteImage={handleDeleteImage}
            />

            {/* Annotations List */}
            {currentImage.annotations.length > 0 && (
              <div className="w-full max-w-6xl bg-white p-6 rounded-lg shadow-lg mt-6 mx-auto">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  Annotations for "{currentImage.name}"
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentImage.annotations.map((annotation, index) => (
                    <div
                      key={annotation.id}
                      className={`p-4 border rounded-md ${
                        // Simplified selection check for this display list
                        selectedImageId === currentImage.id &&
                        currentImage.annotations[index] &&
                        currentImage.annotations[index].id === annotation.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      } cursor-pointer hover:shadow-md transition-shadow duration-200`}
                    >
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {annotation.apiDetails.name || `Section ${index + 1}`}
                      </h3>
                      <p className="text-sm text-gray-600">Endpoint: {annotation.apiDetails.endpoint || 'N/A'}</p>
                      <p className="text-sm text-gray-600">Method: {annotation.apiDetails.method}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full max-w-6xl bg-white p-6 rounded-lg shadow-lg text-center text-gray-500 text-xl flex items-center justify-center h-full mx-auto">
            Please add an image to start annotating.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
