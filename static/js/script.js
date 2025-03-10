document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('equation-form');
    const equationInput = document.getElementById('equation');
    const contextInput = document.getElementById('context');
    const submitBtn = document.getElementById('submit-btn');
    const clearBtn = document.getElementById('clear-btn');
    const loadingContainer = document.getElementById('loading-container');
    const resultContainer = document.getElementById('result-container');
    const equationDisplay = document.getElementById('equation-display');
    const explanationDisplay = document.getElementById('explanation-display');
    const breakdownDisplay = document.getElementById('breakdown-display');
    const equationPreview = document.getElementById('equation-preview');
    const imageUploadBtn = document.getElementById('image-upload-btn');
    const imageFileInput = document.getElementById('image-file-input');
    const imageUploadLoading = document.getElementById('image-upload-loading');

    // Load saved data from cookies
    loadSavedData();

    // Set up live preview for equation input
    equationInput.addEventListener('input', function () {
        updateEquationPreview();
    });

    // Initialize preview if there's content on page load
    updateEquationPreview();

    // Clear button handler
    clearBtn.addEventListener('click', function () {
        clearSavedData();
        equationInput.value = '';
        contextInput.value = '';
        resultContainer.style.display = 'none';
        updateEquationPreview();
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const equation = equationInput.value.trim();
        const context = contextInput.value.trim();

        if (!equation) {
            alert('Please enter an equation');
            return;
        }

        // Show loading, hide results
        submitBtn.disabled = true;
        loadingContainer.style.display = '';
        resultContainer.style.display = 'none';

        try {
            const response = await fetch('/api/explain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    equation: equation,
                    context: context
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get explanation');
            }

            const data = await response.json();

            // Render the results without using marked
            equationDisplay.innerHTML = data.equation;

            // Use simple HTML rendering instead of marked
            explanationDisplay.innerHTML = data.explanation
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');

            breakdownDisplay.innerHTML = '<ul>' +
                data.breakdown
                    .split('\n')
                    .map(line => {
                        // Check if line starts with * for bullet points
                        if (line.trim().startsWith('*')) {
                            // Remove the * and create a list item
                            return '<li>' + line.trim().substring(1).trim()
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>') + '</li>';
                        } else {
                            // Regular line with normal formatting
                            return line
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>') + '<br>';
                        }
                    })
                    .join('') +
                '</ul>';

            // Render LaTeX in all displays
            renderMathInElement(equationDisplay, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false }
                ]
            });
            renderMathInElement(explanationDisplay, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false }
                ]
            });
            renderMathInElement(breakdownDisplay, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false }
                ]
            });

            // Save data to cookies
            saveDataToCookies(equation, context, data);

            // Show results
            resultContainer.style.display = '';

            // Add copy buttons to the result sections
            addCopyButtons();
        } catch (error) {
            alert('Error: ' + error.message);
            console.error('Error:', error);
        } finally {
            // Hide loading, enable button
            loadingContainer.style.display = 'none';
            submitBtn.disabled = false;
        }
    });

    // Image upload button handler
    imageUploadBtn.addEventListener('click', function () {
        imageFileInput.click();
    });

    // Handle image file selection
    imageFileInput.addEventListener('change', async function (e) {
        if (this.files && this.files[0]) {
            // Show loading indicator
            imageUploadLoading.style.display = '';
            imageUploadBtn.disabled = true;

            // Clear previous results
            resultContainer.style.display = 'none';

            const formData = new FormData();
            formData.append('image', this.files[0]);

            try {
                const response = await fetch('/api/picture-to-equation', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to process image');
                }

                const data = await response.json();

                // Set the equation input value
                equationInput.value = data.equation.trim();

                // Update the equation preview
                updateEquationPreview();

                // Clear the file input so the same file can be selected again
                this.value = '';
            } catch (error) {
                alert('Error processing image: ' + error.message);
                console.error('Error:', error);
            } finally {
                // Hide loading indicator
                imageUploadLoading.style.display = 'none';
                imageUploadBtn.disabled = false;
            }
        }
    });

    // Add paste event listeners to handle image pasting
    document.addEventListener('paste', handlePaste);
    equationInput.addEventListener('paste', handlePaste);
    contextInput.addEventListener('paste', handlePaste);

    // Function to handle paste events with images
    async function handlePaste(e) {
        // Check if the paste event contains image data
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;

            for (let i = 0; i < items.length; i++) {
                // Check if the item is an image
                if (items[i].type.indexOf('image') !== -1) {
                    // Prevent the default paste behavior
                    e.preventDefault();

                    // Get the image file from clipboard
                    const file = items[i].getAsFile();

                    // Show loading indicator
                    imageUploadLoading.style.display = '';
                    imageUploadBtn.disabled = true;

                    // Clear previous results
                    resultContainer.style.display = 'none';

                    const formData = new FormData();
                    formData.append('image', file);

                    try {
                        const response = await fetch('/api/picture-to-equation', {
                            method: 'POST',
                            body: formData
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to process image');
                        }

                        const data = await response.json();

                        // Set the equation input value
                        equationInput.value = data.equation.trim();

                        // Update the equation preview
                        updateEquationPreview();
                    } catch (error) {
                        alert('Error processing pasted image: ' + error.message);
                        console.error('Error:', error);
                    } finally {
                        // Hide loading indicator
                        imageUploadLoading.style.display = 'none';
                        imageUploadBtn.disabled = false;
                    }

                    // We found an image, no need to check other items
                    break;
                }
            }
        }
    }

    // Function to update equation preview
    function updateEquationPreview() {
        const equation = equationInput.value.trim();
        if (equation) {
            equationPreview.style.display = 'block';
            try {
                katex.render(equation, equationPreview, {
                    throwOnError: false,
                    displayMode: true
                });
            } catch (e) {
                equationPreview.innerHTML = '<span class="text-muted">Preview will appear when equation syntax is valid</span>';
            }
        } else {
            equationPreview.style.display = 'none';
        }
    }

    // Add copy functionality for result sections
    function addCopyButtons() {
        // Add copy button to equation display
        addCopyButtonToElement(equationDisplay, 'equation', () => equationInput.value.trim());

        // Add copy button to explanation display
        addCopyButtonToElement(explanationDisplay, 'explanation', () => {
            const resultData = getSavedResultData();
            return resultData?.explanation || '';
        });

        // Add copy button to breakdown display
        addCopyButtonToElement(breakdownDisplay, 'breakdown', () => {
            const resultData = getSavedResultData();
            return resultData?.breakdown || '';
        });
    }

    // Helper function to add copy button to an element
    function addCopyButtonToElement(element, type, getContentFn) {
        // Create button container with absolute positioning
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'copy-button-container';

        // Create the button
        const copyButton = document.createElement('button');
        copyButton.className = 'btn btn-sm copy-button';
        copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
        copyButton.title = `Copy ${type} to clipboard`;

        // Add click event
        copyButton.addEventListener('click', async () => {
            try {
                const content = getContentFn();
                await navigator.clipboard.writeText(content);

                // Show feedback
                copyButton.innerHTML = '<i class="bi bi-clipboard-check"></i>';
                setTimeout(() => {
                    copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy: ', err);
                copyButton.innerHTML = '<i class="bi bi-clipboard-x"></i>';
                setTimeout(() => {
                    copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
                }, 2000);
            }
        });

        // Add button to container and container to element
        buttonContainer.appendChild(copyButton);

        // Check if element already has a copy button
        const existingButton = element.querySelector('.copy-button-container');
        if (existingButton) {
            existingButton.remove();
        }

        element.style.position = 'relative';
        element.appendChild(buttonContainer);
    }

    // Helper function to get saved result data
    function getSavedResultData() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'equationData') {
                try {
                    const data = JSON.parse(decodeURIComponent(value));
                    return data.results;
                } catch (e) {
                    console.error('Error parsing saved data:', e);
                    return null;
                }
            }
        }
        return null;
    }

    // Function to save data to cookies
    function saveDataToCookies(equation, context, results) {
        const data = {
            equation: equation,
            context: context,
            results: results
        };
        document.cookie = `equationData=${encodeURIComponent(JSON.stringify(data))}; max-age=86400; path=/; SameSite=Strict`;
    }

    // Function to load saved data from cookies
    function loadSavedData() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'equationData') {
                try {
                    const data = JSON.parse(decodeURIComponent(value));

                    // Restore form inputs
                    equationInput.value = data.equation || '';
                    contextInput.value = data.context || '';

                    // Restore results if available
                    if (data.results) {
                        equationDisplay.innerHTML = data.results.equation;
                        explanationDisplay.innerHTML = data.results.explanation
                            .replace(/\n/g, '<br>')
                            .replace(/\*\*([^\n]*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*([^\n]*?)\*/g, '<em>$1</em>');
                        breakdownDisplay.innerHTML = '<ul>' +
                            data.results.breakdown
                                .split('\n')
                                .map(line => {
                                    // Check if line starts with * for bullet points
                                    if (line.trim().startsWith('*')) {
                                        // Remove the * and create a list item
                                        return '<li>' + line.trim().substring(1).trim()
                                            .replace(/\*\*([^\n]*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\*([^\n]*?)\*/g, '<em>$1</em>') + '</li>';
                                    } else {
                                        // Regular line with normal formatting
                                        return line
                                            .replace(/\*\*([^\n]*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\*([^\n]*?)\*/g, '<em>$1</em>') + '<br>';
                                    }
                                })
                                .join('') +
                            '</ul>';

                        // Render LaTeX in all displays
                        renderMathInElement(equationDisplay, {
                            delimiters: [
                                { left: "$$", right: "$$", display: true },
                                { left: "$", right: "$", display: false }
                            ]
                        });
                        renderMathInElement(explanationDisplay, {
                            delimiters: [
                                { left: "$$", right: "$$", display: true },
                                { left: "$", right: "$", display: false }
                            ]
                        });
                        renderMathInElement(breakdownDisplay, {
                            delimiters: [
                                { left: "$$", right: "$$", display: true },
                                { left: "$", right: "$", display: false }
                            ]
                        });

                        // Show results container
                        resultContainer.style.display = '';

                        // After restoring results, add copy buttons
                        addCopyButtons();
                    }
                } catch (e) {
                    console.error('Error loading saved data:', e);
                }
                break;
            }
        }
    }

    // Function to clear saved data
    function clearSavedData() {
        document.cookie = 'equationData=; max-age=0; path=/; SameSite=Strict';
    }
}); 