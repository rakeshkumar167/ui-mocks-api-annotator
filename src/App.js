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

  // New states for dragging and resizing existing annotations
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [isResizingAnnotation, setIsResizingAnnotation] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Offset from mouse to annotation top-left for dragging
  const [resizeHandle, setResizeHandle] = useState(null); // Which handle is being dragged (e.g., 'se', 'n', 'w')
  const [initialAnnotationRect, setInitialAnnotationRect] = useState(null); // Original rect when resize/drag starts
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 }); // Initial mouse position for resizing

  // State to track if the image has fully loaded
  const [imageLoaded, setImageLoaded] = useState(false);

  // Ref for the image container (the div that wraps the image and annotations)
  const imageWrapperRef = useRef(null);
  // Ref for the actual <img> element to get its displayed dimensions
  const imgRef = useRef(null);

  // Helper to get annotation pixel dimensions from ratios
  const getAnnotationPixels = useCallback((annotation) => {
    const displayedWidth = imgRef.current ? imgRef.current.offsetWidth : 0;
    const displayedHeight = imgRef.current ? imgRef.current.offsetHeight : 0;
    return {
      x: annotation.ratioX * displayedWidth,
      y: annotation.ratioY * displayedHeight,
      width: annotation.ratioWidth * displayedWidth,
      height: annotation.ratioHeight * displayedHeight,
    };
  }, []);

  // Handle mouse down event on the image wrapper to start drawing, dragging, or resizing
  const handleMouseDown = useCallback((event) => {
    if (!imageUrl || !imageWrapperRef.current || !imgRef.current || !imageLoaded) return; // Ensure image is loaded

    const rect = imageWrapperRef.current.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    // Check if a resize handle was clicked
    const target = event.target;
    if (target.dataset.resizeHandle) {
      setIsResizingAnnotation(true);
      setResizeHandle(target.dataset.resizeHandle);
      setInitialAnnotationRect(getAnnotationPixels(annotations[selectedAnnotationIndex]));
      setInitialMousePos({ x: clientX, y: clientY }); // Capture initial mouse position for resizing
      event.stopPropagation(); // Prevent dragging if resizing
      return;
    }

    // Check if an existing annotation was clicked for dragging
    const clickedAnnotationIndex = annotations.findIndex(annotation => {
      const annPixels = getAnnotationPixels(annotation);
      return clientX >= annPixels.x && clientX <= annPixels.x + annPixels.width &&
             clientY >= annPixels.y && clientY <= annPixels.y + annPixels.height;
    });

    if (clickedAnnotationIndex !== -1 && activeTool === 'select') {
      setSelectedAnnotationIndex(clickedAnnotationIndex);
      setIsDraggingAnnotation(true);
      const annPixels = getAnnotationPixels(annotations[clickedAnnotationIndex]);
      // Calculate offset from mouse to annotation's top-left corner
      setDragOffset({ x: clientX - annPixels.x, y: clientY - annPixels.y });
      setIsDrawing(false); // Ensure drawing is off
    } else if (activeTool === 'draw') {
      // If no annotation was clicked and 'draw' tool is active, start drawing
      setIsDrawing(true);
      setStartPoint({ x: clientX, y: clientY });
      setCurrentRect({ x: clientX, y: clientY, width: 0, height: 0 });
      setSelectedAnnotationIndex(null); // Deselect any active annotation when starting to draw a new one
      setIsDraggingAnnotation(false);
      setIsResizingAnnotation(false);
    } else if (activeTool === 'select' && clickedAnnotationIndex === -1) {
      // If 'select' tool is active and empty space is clicked, deselect
      setSelectedAnnotationIndex(null);
      setIsDrawing(false);
      setIsDraggingAnnotation(false);
      setIsResizingAnnotation(false);
    }
  }, [activeTool, annotations, getAnnotationPixels, imageUrl, imageLoaded, selectedAnnotationIndex, setSelectedAnnotationIndex]);


  // Handle mouse move event while drawing, dragging, or resizing
  const handleMouseMove = useCallback((event) => {
    if (!imageUrl || !imageWrapperRef.current || !imgRef.current || !imageLoaded) return;

    const rect = imageWrapperRef.current.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    const displayedWidth = imgRef.current.offsetWidth;
    const displayedHeight = imgRef.current.offsetHeight;

    if (isDrawing) {
      // Calculate current rectangle dimensions for drawing new annotation
      const newX = Math.min(startPoint.x, clientX);
      const newY = Math.min(startPoint.y, clientY);
      const newWidth = Math.abs(clientX - startPoint.x);
      const newHeight = Math.abs(clientY - startPoint.y);
      setCurrentRect({ x: newX, y: newY, width: newWidth, height: newHeight });
    } else if (isDraggingAnnotation && selectedAnnotationIndex !== null) {
      // Calculate new position for dragging existing annotation
      const newX = clientX - dragOffset.x;
      const newY = clientY - dragOffset.y;

      // Boundary checks for dragging
      const currentAnnPixels = getAnnotationPixels(annotations[selectedAnnotationIndex]); // Get current pixel dimensions
      const imgWidth = imgRef.current.offsetWidth;
      const imgHeight = imgRef.current.offsetHeight;

      const boundedX = Math.max(0, Math.min(newX, imgWidth - currentAnnPixels.width));
      const boundedY = Math.max(0, Math.min(newY, imgHeight - currentAnnPixels.height));


      const updatedAnnotations = annotations.map((ann, idx) => {
        if (idx === selectedAnnotationIndex) {
          return {
            ...ann,
            ratioX: boundedX / imgWidth,
            ratioY: boundedY / imgHeight,
          };
        }
        return ann;
      });
      onUpdateImage({ ...image, annotations: updatedAnnotations });
    } else if (isResizingAnnotation && selectedAnnotationIndex !== null && initialAnnotationRect) {
      // Calculate new dimensions for resizing existing annotation
      let { x, y, width, height } = initialAnnotationRect;
      const dx = clientX - initialMousePos.x; // Correct delta X from initial mouse down
      const dy = clientY - initialMousePos.y; // Correct delta Y from initial mouse down

      switch (resizeHandle) {
        case 'n':
          height = initialAnnotationRect.height - dy;
          y = initialAnnotationRect.y + dy;
          break;
        case 'ne':
          width = initialAnnotationRect.width + dx;
          height = initialAnnotationRect.height - dy;
          y = initialAnnotationRect.y + dy;
          break;
        case 'e':
          width = initialAnnotationRect.width + dx;
          break;
        case 'se':
          width = initialAnnotationRect.width + dx;
          height = initialAnnotationRect.height + dy;
          break;
        case 's':
          height = initialAnnotationRect.height + dy;
          break;
        case 'sw':
          width = initialAnnotationRect.width - dx;
          x = initialAnnotationRect.x + dx;
          height = initialAnnotationRect.height + dy;
          break;
        case 'w':
          width = initialAnnotationRect.width - dx;
          x = initialAnnotationRect.x + dx;
          break;
        case 'nw':
          width = initialAnnotationRect.width - dx;
          x = initialAnnotationRect.x + dx;
          height = initialAnnotationRect.height - dy;
          y = initialAnnotationRect.y + dy;
          break;
        default:
          break;
      }

      // Ensure minimum size and prevent negative dimensions
      width = Math.max(width, 10);
      height = Math.max(height, 10);
      // Also ensure x and y don't go out of bounds (optional, but good practice)
      x = Math.max(0, Math.min(x, displayedWidth - width));
      y = Math.max(0, Math.min(y, displayedHeight - height));

      const updatedAnnotations = annotations.map((ann, idx) => {
        if (idx === selectedAnnotationIndex) {
          return {
            ...ann,
            ratioX: x / displayedWidth,
            ratioY: y / displayedHeight,
            ratioWidth: width / displayedWidth,
            ratioHeight: height / displayedHeight,
          };
        }
        return ann;
      });
      onUpdateImage({ ...image, annotations: updatedAnnotations });
    }
  }, [isDrawing, startPoint, isDraggingAnnotation, selectedAnnotationIndex, dragOffset, annotations, image, onUpdateImage, isResizingAnnotation, resizeHandle, initialAnnotationRect, initialMousePos, imageUrl, imageLoaded, getAnnotationPixels]);


  // Handle mouse up event to finish drawing, dragging, or resizing
  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      if (currentRect.width > 5 && currentRect.height > 5) {
        const displayedWidth = imgRef.current.offsetWidth;
        const displayedHeight = imgRef.current.offsetHeight;
        const newAnnotation = {
          id: generateId(),
          ratioX: currentRect.x / displayedWidth,
          ratioY: currentRect.y / displayedHeight,
          ratioWidth: currentRect.width / displayedWidth,
          ratioHeight: currentRect.height / displayedHeight,
          apiDetails: {
            name: '', endpoint: '', method: 'GET', requestBody: '', responseBody: '', parameters: [], description: ''
          }
        };
        const updatedAnnotations = [...annotations, newAnnotation];
        onUpdateImage({ ...image, annotations: updatedAnnotations });
        setSelectedAnnotationIndex(updatedAnnotations.length - 1);
      }
      setCurrentRect({ x: 0, y: 0, width: 0, height: 0 });
    }
    setIsDraggingAnnotation(false);
    setIsResizingAnnotation(false);
    setDragOffset({ x: 0, y: 0 });
    setResizeHandle(null);
    setInitialAnnotationRect(null);
    setInitialMousePos({ x: 0, y: 0 });
  }, [isDrawing, currentRect, annotations, image, onUpdateImage, setSelectedAnnotationIndex]);

  // Effect to add/remove global mouse event listeners for drawing, dragging, and resizing
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

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
              onLoad={() => setImageLoaded(true)} // Set imageLoaded to true when image loads
            />

            {/* Display existing annotations only if image is loaded */}
            {imageLoaded && annotations.map((annotation, index) => {
              const annPixels = getAnnotationPixels(annotation);
              const isSelected = selectedAnnotationIndex === index;
              return (
                <div
                  key={annotation.id}
                  className={`absolute border-2 ${
                    isSelected ? 'border-blue-500 bg-blue-500 bg-opacity-20' : 'border-red-500 bg-red-500 bg-opacity-10'
                  } hover:border-blue-500 hover:bg-blue-500 hover:bg-opacity-20 transition-all duration-150 ease-in-out flex justify-center items-center rounded-md`}
                  style={{
                    left: `${annPixels.x}px`,
                    top: `${annPixels.y}px`,
                    width: `${annPixels.width}px`,
                    height: `${annPixels.height}px`,
                    cursor: activeTool === 'select' && isSelected ? 'grab' : (activeTool === 'select' ? 'pointer' : 'default'), // Change cursor for dragging
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'select') {
                      setSelectedAnnotationIndex(index);
                    }
                  }}
                  title={annotation.apiDetails.name || `Annotation ${index + 1}`}
                >
                  <span className="absolute -top-6 left-0 text-xs font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded-md">
                    {annotation.apiDetails.name || `Section ${index + 1}`}
                  </span>
                  {isSelected && activeTool === 'select' && (
                    <>
                      {/* Resize Handles - Half size (w-1.5 h-1.5) and adjusted positioning */}
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full -top-0.5 -left-0.5 cursor-nwse-resize" data-resize-handle="nw"></div>
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full -top-0.5 left-1/2 -translate-x-1/2 cursor-ns-resize" data-resize-handle="n"></div>
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full -top-0.5 -right-0.5 cursor-nesw-resize" data-resize-handle="ne"></div>
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full top-1/2 -right-0.5 -translate-y-1/2 cursor-ew-resize" data-resize-handle="e"></div>
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full -bottom-0.5 -right-0.5 cursor-nwse-resize" data-resize-handle="se"></div>
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full -bottom-0.5 left-1/2 -translate-x-1/2 cursor-ns-resize" data-resize-handle="s"></div>
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full -bottom-0.5 -left-0.5 cursor-nesw-resize" data-resize-handle="sw"></div>
                      <div className="absolute w-1.5 h-1.5 bg-blue-700 border border-white rounded-full top-1/2 -left-0.5 -translate-y-1/2 cursor-ew-resize" data-resize-handle="w"></div>
                    </>
                  )}
                </div>
              );
            })}

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