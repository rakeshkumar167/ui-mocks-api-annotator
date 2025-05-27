import React, { useState, useRef, useEffect, useCallback } from 'react';

// A unique ID generator for images and annotations
const generateId = () => Math.random().toString(36).substring(2, 11);

// ImageAnnotatorTab Component: Handles a single image and its annotations
function ImageAnnotatorTab({ image, onUpdateImage, activeTool, setSelectedAnnotationIndex, selectedAnnotationIndex }) {
  // Destructure image properties for easier access
  const { id, name, url: imageUrl, annotations } = image;

  // State to track if the user is currently drawing a new annotation
  const [isDrawing, setIsDrawing] = useState(false);
  // State to store the starting coordinates of a new annotation
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  // State to store the current dimensions of the annotation being drawn
  const [currentRect, setCurrentRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  // State for the API details form inputs
  const [apiDetails, setApiDetails] = useState({
    name: '',
    endpoint: '',
    method: 'GET',
    requestBody: '', // Added
    responseBody: '', // Added
    description: '',
    parameters: [],
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
        description: '',
        parameters: [],
      });
    }
  }, [selectedAnnotationIndex, annotations, imageUrl]); // Depend on annotations and imageUrl to reset on image change

  // Handle mouse down event on the image wrapper to start drawing or select
  const handleMouseDown = (event) => {
    if (!imageUrl || !imageWrapperRef.current) return; // Only interact if an image is loaded and wrapper exists

    const rect = imageWrapperRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if an existing annotation was clicked
    const clickedAnnotationIndex = annotations.findIndex(annotation => {
      const annX = annotation.ratioX * imgRef.current.offsetWidth;
      const annY = annotation.ratioY * imgRef.current.offsetHeight;
      const annWidth = annotation.ratioWidth * imgRef.current.offsetWidth;
      const annHeight = annotation.ratioHeight * imgRef.current.offsetHeight;
      return x >= annX && x <= annX + annWidth && y >= annY && y <= annY + annHeight;
    });

    if (clickedAnnotationIndex !== -1) {
      // If an annotation was clicked, select it
      setSelectedAnnotationIndex(clickedAnnotationIndex);
      setIsDrawing(false); // Ensure drawing is off if an existing annotation is clicked
    } else if (activeTool === 'draw') {
      // If no annotation was clicked and 'draw' tool is active, start drawing
      setIsDrawing(true);
      setStartPoint({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
      setSelectedAnnotationIndex(null); // Deselect any active annotation when starting to draw a new one
    } else if (activeTool === 'select') {
      // If 'select' tool is active and empty space is clicked, deselect
      setSelectedAnnotationIndex(null);
      setIsDrawing(false); // Ensure drawing is off
    }
  };

  // Handle mouse move event while drawing
  const handleMouseMove = (event) => {
    if (!isDrawing || !imageUrl || !imageWrapperRef.current) return;

    const rect = imageWrapperRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate current rectangle dimensions
    const newX = Math.min(startPoint.x, x);
    const newY = Math.min(startPoint.y, y);
    const newWidth = Math.abs(x - startPoint.x);
    const newHeight = Math.abs(y - startPoint.y);

    setCurrentRect({ x: newX, y: newY, width: newWidth, height: newHeight });
  };

  // Handle mouse up event to finish drawing
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
            description: '',
            parameters: [],
          }
        };
        const updatedAnnotations = [...annotations, newAnnotation];
        onUpdateImage({ ...image, annotations: updatedAnnotations });
        setSelectedAnnotationIndex(updatedAnnotations.length - 1); // Select the newly created annotation
      }
      setCurrentRect({ x: 0, y: 0, width: 0, height: 0 }); // Reset current drawing rect
    }
  }, [isDrawing, currentRect, annotations, image, onUpdateImage, setSelectedAnnotationIndex]); // Dependencies for useCallback

  // Handle changes in the API details form
  const handleApiDetailsChange = (event) => {
    const { name, value } = event.target;
    setApiDetails((prev) => ({ ...prev, [name]: value }));
  };

  // Handle changes in API parameters
  const handleParameterChange = (index, field, value) => {
    const updatedParameters = apiDetails.parameters.map((param, i) =>
      i === index ? { ...param, [field]: value } : param
    );
    setApiDetails((prev) => ({ ...prev, parameters: updatedParameters }));
  };

  // Add a new parameter row
  const addParameter = () => {
    setApiDetails((prev) => ({
      ...prev,
      parameters: [...prev.parameters, { key: '', type: '' }], // Removed description as per image
    }));
  };

  // Remove a parameter row
  const removeParameter = (index) => {
    setApiDetails((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
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
    <div className="flex flex-col lg:flex-row w-full h-full gap-6">
      {/* Image Display Area */}
      <div className="relative flex-1 bg-white p-6 rounded-xl shadow-lg flex justify-center items-start overflow-hidden">
        {!imageUrl && (
          <div className="text-gray-500 text-lg flex flex-col items-center justify-center h-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Upload your design file to start annotating</p>
          </div>
        )}
        {imageUrl && (
          <div
            ref={imageWrapperRef}
            className={`relative w-full h-auto ${activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt={`Mockup: ${name}`}
              className="w-full h-auto object-contain"
              draggable="false"
            />

            {/* Display existing annotations */}
            {annotations.map((annotation, index) => (
              <div
                key={annotation.id}
                className={`absolute border-2 ${
                  selectedAnnotationIndex === index ? 'border-blue-500 bg-blue-500 bg-opacity-20' : 'border-red-500 bg-red-500 bg-opacity-10'
                } hover:border-blue-500 hover:bg-blue-500 hover:bg-opacity-20 transition-all duration-150 ease-in-out cursor-pointer flex justify-center items-center rounded-md`}
                style={{
                  left: `${annotation.ratioX * currentDisplayedWidth}px`,
                  top: `${annotation.ratioY * currentDisplayedHeight}px`,
                  width: `${annotation.ratioWidth * currentDisplayedWidth}px`,
                  height: `${annotation.ratioHeight * currentDisplayedHeight}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent handleMouseDown on wrapper
                  setSelectedAnnotationIndex(index);
                }}
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

            {/* Display the rectangle being drawn */}
            {isDrawing && currentRect.width > 0 && currentRect.height > 0 && (
              <div
                className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20 rounded-md"
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
  // State for the active annotation tool
  const [activeTool, setActiveTool] = useState('select'); // 'select' or 'draw'
  // State for the selected annotation index, lifted from ImageAnnotatorTab
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(null);

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
          name: newTabName || file.name.split('.')[0] || `Mockup ${images.length + 1}`, // Default name from file name
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
  const handleExportProject = () => {
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
            setSelectedAnnotationIndex(null); // Reset selected annotation on load
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
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="text-2xl font-bold text-gray-800">UI Mocks API Annotator</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportProject}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm"
          >
            Export Project
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col shadow-lg overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">PROJECT FILES</h2>
          <div className="flex flex-col gap-2 mb-6">
            {images.map((img) => (
              <div
                key={img.id}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors duration-150
                  ${selectedImageId === img.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-gray-100'}`}
                onClick={() => setSelectedImageId(img.id)}
              >
                <span className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${selectedImageId === img.id ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                  {img.name}
                </span>
                <button
                  className="ml-2 text-red-500 hover:text-red-700 text-sm"
                  onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }}
                  title="Delete file"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">ANNOTATION TOOLS</h2>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setActiveTool('select')}
              className={`flex items-center px-4 py-2 rounded-lg shadow-md transition-colors duration-200 ${activeTool === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
              Select
            </button>
            <button
              onClick={() => setActiveTool('draw')}
              className={`flex items-center px-4 py-2 rounded-lg shadow-md transition-colors duration-200 ${activeTool === 'draw' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              + Add API
            </button>
          </div>

          <div className="mt-auto pt-6 border-t border-gray-200"> {/* Pushes to bottom */}
            <h2 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Add New File</h2>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="New File Name"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-400 focus:border-blue-400 outline-none"
              />
              <label htmlFor="add-image-file" className="w-full text-center px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 text-sm font-medium transition-colors duration-200 shadow-md">
                Upload Design File
              </label>
              <input
                type="file"
                id="add-image-file"
                accept="image/*"
                onChange={handleAddImage}
                className="hidden"
              />
              {/* Load Data button moved here for consistency with file management */}
              <label htmlFor="load-data-file" className="w-full text-center px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-yellow-700 transition-colors duration-200 shadow-md">
                Load Project Data
              </label>
              <input
                type="file"
                id="load-data-file"
                accept=".json"
                onChange={handleLoadData}
                className="hidden"
                ref={fileInputRef}
              />
            </div>
          </div>
        </aside>

        {/* Central Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {currentImage ? (
            <>
              <ImageAnnotatorTab
                key={currentImage.id}
                image={currentImage}
                onUpdateImage={handleUpdateImage}
                activeTool={activeTool}
                setSelectedAnnotationIndex={setSelectedAnnotationIndex}
                selectedAnnotationIndex={selectedAnnotationIndex}
              />

              {/* Annotations List (moved to main content, can be collapsed later if needed) */}
              {currentImage.annotations.length > 0 && (
                <div className="w-full bg-white p-6 rounded-xl shadow-lg mt-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                    Annotations for "{currentImage.name}"
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentImage.annotations.map((annotation, index) => (
                      <div
                        key={annotation.id}
                        className={`p-4 border rounded-lg ${
                          selectedAnnotationIndex === index
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:shadow-sm'
                        } cursor-pointer transition-all duration-200`}
                        onClick={() => setSelectedAnnotationIndex(index)} // Allow selecting from this list
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
            <div className="w-full h-full bg-white p-6 rounded-xl shadow-lg text-center text-gray-500 text-xl flex flex-col items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-gray-300 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Upload your design file to start annotating</p>
            </div>
          )}
        </main>

        {/* Right Sidebar (API Details Form) */}
        <aside className="w-96 bg-white p-6 rounded-xl shadow-lg overflow-y-auto flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Annotation Properties</h2>
          {currentImage && selectedAnnotationIndex !== null && currentImage.annotations[selectedAnnotationIndex] ? (
            <form onSubmit={(e) => { e.preventDefault(); /* saveApiDetails is handled by state updates */ }}>
              {/* Section Name Input */}
              <div className="mb-4">
                <label htmlFor={`section-name-${currentImage.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Section Name
                </label>
                <input
                  type="text"
                  id={`section-name-${currentImage.id}`}
                  name="name"
                  value={currentImage.annotations[selectedAnnotationIndex].apiDetails.name}
                  onChange={(e) => {
                    const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, name: e.target.value };
                    const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                      idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                    );
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-400 focus:border-blue-400 outline-none transition-all duration-200"
                  placeholder="e.g., User Profile Section"
                />
              </div>

              <div className="mb-4">
                <label htmlFor={`api-endpoint-${currentImage.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  API Endpoint
                </label>
                <input
                  type="text"
                  id={`api-endpoint-${currentImage.id}`}
                  name="endpoint"
                  value={currentImage.annotations[selectedAnnotationIndex].apiDetails.endpoint}
                  onChange={(e) => {
                    const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, endpoint: e.target.value };
                    const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                      idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                    );
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-400 focus:border-blue-400 outline-none transition-all duration-200"
                  placeholder="/api/products"
                />
              </div>

              <div className="mb-4">
                <label htmlFor={`method-${currentImage.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  HTTP Method
                </label>
                <select
                  id={`method-${currentImage.id}`}
                  name="method"
                  value={currentImage.annotations[selectedAnnotationIndex].apiDetails.method}
                  onChange={(e) => {
                    const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, method: e.target.value };
                    const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                      idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                    );
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-400 focus:border-blue-400 outline-none transition-all duration-200"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor={`description-${currentImage.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id={`description-${currentImage.id}`}
                  name="description"
                  value={currentImage.annotations[selectedAnnotationIndex].apiDetails.description}
                  onChange={(e) => {
                    const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, description: e.target.value };
                    const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                      idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                    );
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                  }}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all duration-200"
                  placeholder="Brief description of this API call's purpose."
                ></textarea>
              </div>

              {/* Request Body (JSON) */}
              <div className="mb-4">
                <label htmlFor={`requestBody-${currentImage.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Request Body (JSON)
                </label>
                <textarea
                  id={`requestBody-${currentImage.id}`}
                  name="requestBody"
                  value={currentImage.annotations[selectedAnnotationIndex].apiDetails.requestBody}
                  onChange={(e) => {
                    const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, requestBody: e.target.value };
                    const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                      idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                    );
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                  }}
                  rows="4"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all duration-200"
                  placeholder='{"key": "value"}'
                ></textarea>
              </div>

              {/* Expected Response Body (JSON) */}
              <div className="mb-4">
                <label htmlFor={`responseBody-${currentImage.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Response Body (JSON)
                </label>
                <textarea
                  id={`responseBody-${currentImage.id}`}
                  name="responseBody"
                  value={currentImage.annotations[selectedAnnotationIndex].apiDetails.responseBody}
                  onChange={(e) => {
                    const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, responseBody: e.target.value };
                    const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                      idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                    );
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                  }}
                  rows="4"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all duration-200"
                  placeholder='{"data": "response"}'
                ></textarea>
              </div>

              {/* Parameters Section */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Parameters</label>
                {currentImage.annotations[selectedAnnotationIndex].apiDetails.parameters.map((param, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={param.key}
                      onChange={(e) => {
                        const updatedParams = currentImage.annotations[selectedAnnotationIndex].apiDetails.parameters.map((p, i) =>
                          i === index ? { ...p, key: e.target.value } : p
                        );
                        const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, parameters: updatedParams };
                        const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                          idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                        );
                        handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                      }}
                      className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-400 focus:border-blue-400 outline-none"
                      placeholder="key"
                    />
                    <input
                      type="text"
                      value={param.type}
                      onChange={(e) => {
                        const updatedParams = currentImage.annotations[selectedAnnotationIndex].apiDetails.parameters.map((p, i) =>
                          i === index ? { ...p, type: e.target.value } : p
                        );
                        const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, parameters: updatedParams };
                        const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                          idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                        );
                        handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                      }}
                      className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-400 focus:border-blue-400 outline-none"
                      placeholder="type"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updatedParams = currentImage.annotations[selectedAnnotationIndex].apiDetails.parameters.filter((_, i) => i !== index);
                        const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, parameters: updatedParams };
                        const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                          idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                        );
                        handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                      }}
                      className="p-2 text-red-600 hover:text-red-800 rounded-full transition-colors duration-200"
                      title="Remove parameter"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const updatedParams = [...currentImage.annotations[selectedAnnotationIndex].apiDetails.parameters, { key: '', type: '' }];
                    const updatedApiDetails = { ...currentImage.annotations[selectedAnnotationIndex].apiDetails, parameters: updatedParams };
                    const updatedAnnotations = currentImage.annotations.map((ann, idx) =>
                      idx === selectedAnnotationIndex ? { ...ann, apiDetails: updatedApiDetails } : ann
                    );
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                  }}
                  className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors duration-200 w-full"
                >
                  + Add Parameter
                </button>
              </div>

              <div className="flex justify-between mt-6 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    // This button now just ensures the state is saved, which happens on input change
                    // No explicit action needed here unless there's a final "Save" button for the form
                  }}
                  className="inline-flex items-center justify-center flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  Update Annotation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updatedAnnotations = currentImage.annotations.filter((_, idx) => idx !== selectedAnnotationIndex);
                    handleUpdateImage({ ...currentImage, annotations: updatedAnnotations });
                    setSelectedAnnotationIndex(null); // Deselect after deletion
                  }}
                  className="inline-flex items-center justify-center flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                >
                  Delete Annotation
                </button>
              </div>
            </form>
          ) : (
            <p className="text-gray-500 text-sm">Select or draw a section on the image to add API details.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
