// sessionEditor.js

// Keep track of the current data
let folders = [];
window.modifiedSessions = {};

// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded - initializing session editor');
    
    // Request initial data from the extension
    vscode.postMessage({ command: 'getData' });
    
    // Set up event listeners
    setupEventListeners();
});

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'updateData':
            console.log('Received data:', message.data);
            folders = message.data || [];
            renderFolders();
            break;
            
        case 'error':
            showToast(message.message, 'error');
            break;
            
        case 'saveConfirm':
            showToast('Changes saved successfully', 'success');
            break;
    }
});

// Render the folder list
function renderFolders() {
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '';
    
    if (folders.length === 0) {
        folderList.innerHTML = '<div class="no-content">No folders found. Click "Add Folder" to create one.</div>';
        return;
    }
    
    // Render each folder
    folders.forEach((folder, folderIndex) => {
        // Create folder element using the template
        const template = document.getElementById('folderTemplate');
        const folderElement = document.importNode(template.content, true);
        
        // Set folder data
        const folderItem = folderElement.querySelector('.folder-item');
        folderItem.dataset.folderId = folderIndex;
        
        // Set folder name
        const folderName = folderElement.querySelector('.folder-name');
        folderName.textContent = folder.folder_name;
        
        // Render sessions for this folder
        const sessionList = folderElement.querySelector('.session-list');
        
        if (folder.sessions && folder.sessions.length > 0) {
            folder.sessions.forEach((session, sessionIndex) => {
                // Create session element
                const sessionTemplate = document.getElementById('sessionTemplate');
                const sessionElement = document.importNode(sessionTemplate.content, true);
                
                // Set session data
                const sessionItem = sessionElement.querySelector('.session-item');
                sessionItem.dataset.sessionId = sessionIndex;
                
                // Set session name
                const sessionName = sessionElement.querySelector('.session-name');
                sessionName.textContent = session.display_name || session.host;
                
                // Add to session list
                sessionList.appendChild(sessionElement);
            });
        } else {
            sessionList.innerHTML = '<div class="no-content">No sessions in this folder.</div>';
        }
        
        // Add to folder list
        folderList.appendChild(folderElement);
    });
}

// Hide the session form
function hideSessionForm() {
    const sessionEditor = document.getElementById('sessionEditor');
    sessionEditor.innerHTML = '<p class="placeholder">Select a session to edit or click "Add Session" to create a new one</p>';
}

// Custom dialog for adding a folder
function createFolderDialog() {
    console.log('Creating custom folder dialog');
    
    // Create the dialog overlay
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'custom-dialog-overlay';
    dialogOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    // Create the dialog container
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.style.cssText = `
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        padding: 20px;
        width: 350px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    // Create dialog header
    const header = document.createElement('div');
    header.style.cssText = `
        margin-bottom: 15px;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Add New Folder';
    title.style.cssText = `
        margin: 0;
        padding: 0;
        font-size: 16px;
        font-weight: 600;
    `;
    
    header.appendChild(title);
    
    // Create dialog content
    const content = document.createElement('div');
    
    const label = document.createElement('label');
    label.textContent = 'Folder Name:';
    label.htmlFor = 'folderNameInput';
    label.style.cssText = `
        display: block;
        margin-bottom: 5px;
    `;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'folderNameInput';
    input.style.cssText = `
        width: 100%;
        padding: 6px 8px;
        margin-bottom: 15px;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 2px;
    `;
    
    content.appendChild(label);
    content.appendChild(input);
    
    // Create dialog footer with buttons
    const footer = document.createElement('div');
    footer.style.cssText = `
        display: flex;
        justify-content: flex-end;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'button';
    cancelButton.style.cssText = `
        margin-right: 8px;
        padding: 6px 12px;
    `;
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Create Folder';
    confirmButton.className = 'button primary';
    confirmButton.style.cssText = `
        padding: 6px 12px;
    `;
    
    footer.appendChild(cancelButton);
    footer.appendChild(confirmButton);
    
    // Assemble the dialog
    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    
    dialogOverlay.appendChild(dialog);
    
    // Add to document
    document.body.appendChild(dialogOverlay);
    
    // Focus the input field
    setTimeout(() => {
        input.focus();
    }, 100);
    
    // Return a promise that resolves with the folder name or null if canceled
    return new Promise((resolve) => {
        // Handle cancel button click
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
            resolve(null);
        });
        
        // Handle confirm button click
        confirmButton.addEventListener('click', () => {
            const folderName = input.value.trim();
            document.body.removeChild(dialogOverlay);
            resolve(folderName);
        });
        
        // Handle Enter key press
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const folderName = input.value.trim();
                document.body.removeChild(dialogOverlay);
                resolve(folderName);
            }
        });
        
        // Handle Escape key press
        document.addEventListener('keyup', function escHandler(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(dialogOverlay);
                document.removeEventListener('keyup', escHandler);
                resolve(null);
            }
        });
    });
}

// Updated implementation of promptAddFolder using a custom dialog
async function promptAddFolder() {
    console.log('promptAddFolder function started');
    
    try {
        // Show custom dialog and wait for result
        const folderName = await createFolderDialog();
        console.log('Folder name entered:', folderName);
        
        if (folderName) {
            console.log('Creating new folder object');
            
            // Create a new folder object
            const newFolder = {
                folder_name: folderName,
                sessions: []
            };
            
            console.log('New folder object created:', newFolder);
            console.log('Current folders array:', folders);
            
            // Add it to folders array
            folders.push(newFolder);
            console.log('After adding, folders array:', folders);
            
            // Re-render the folders
            console.log('Calling renderFolders()');
            renderFolders();
            console.log('renderFolders() completed');
            
            // Show message
            console.log('Showing success toast');
            showToast(`Folder "${folderName}" added. Click "Save Changes" to save to file.`, 'success');
            
            // Send to extension
            console.log('Sending message to extension');
            vscode.postMessage({
                command: 'addFolder',
                name: folderName
            });
            console.log('Message sent to extension');
        } else {
            console.log('No folder name entered or dialog canceled');
        }
    } catch (error) {
        console.error('Error in promptAddFolder:', error);
        showToast('Failed to create folder: ' + error.message, 'error');
    }
    
    console.log('promptAddFolder function completed');
}

// Show the session form
function showSessionForm(folderId, sessionId) {
    const sessionEditor = document.getElementById('sessionEditor');
    const template = document.getElementById('sessionFormTemplate');
    const formElement = document.importNode(template.content, true);
    
    // Set form title
    const title = formElement.querySelector('.form-header h2');
    const isNewSession = sessionId === 'new';
    let sessionData = {};
    
    if (isNewSession) {
        title.textContent = 'Add New Session';
    } else {
        title.textContent = 'Edit Session';
        
        // Get existing session data
        const folderIndex = parseInt(folderId, 10);
        const sessionIndex = parseInt(sessionId, 10);
        
        if (folders[folderIndex] && folders[folderIndex].sessions && folders[folderIndex].sessions[sessionIndex]) {
            sessionData = folders[folderIndex].sessions[sessionIndex];
            
            // Store a copy of the original data
            window.originalSessionData = JSON.parse(JSON.stringify(sessionData));
        }
    }
    
    // Set form values
    const form = formElement.querySelector('#sessionForm');
    
    // Hidden fields
    form.querySelector('#folderId').value = folderId;
    form.querySelector('#sessionId').value = sessionId;
    
    // Text fields
    form.querySelector('#displayName').value = sessionData.display_name || '';
    form.querySelector('#host').value = sessionData.host || '';
    form.querySelector('#port').value = sessionData.port || '22';
    form.querySelector('#credsid').value = sessionData.credsid || '1';
    
    // Device type dropdown
    const deviceTypeSelect = form.querySelector('#deviceType');
    deviceTypeSelect.value = sessionData.DeviceType || '';
    
    // Optional fields
    form.querySelector('#vendor').value = sessionData.Vendor || '';
    form.querySelector('#model').value = sessionData.Model || '';
    form.querySelector('#softwareVersion').value = sessionData.SoftwareVersion || '';
    form.querySelector('#serialNumber').value = sessionData.SerialNumber || '';
    
    // Add change event listeners to all form fields
    const formKey = `${folderId}-${sessionId}`;
    window.modifiedSessions[formKey] = { isDirty: false, changes: {} };
    
    form.querySelectorAll('input, select').forEach(input => {
        // Don't track hidden fields
        if (input.type === 'hidden') return;
        
        // Initial value
        const initialValue = input.value;
        const fieldName = input.id;
        
        // Add change event listener
        input.addEventListener('input', (e) => {
            const newValue = e.target.value;
            
            // Check if value actually changed
            if (initialValue !== newValue) {
                // Get the property name mapping
                const fieldMapping = {
                    'displayName': 'display_name',
                    'host': 'host',
                    'port': 'port',
                    'deviceType': 'DeviceType',
                    'vendor': 'Vendor',
                    'model': 'Model',
                    'softwareVersion': 'SoftwareVersion',
                    'serialNumber': 'SerialNumber',
                    'credsid': 'credsid'
                };
                
                // Map the field name to property name
                const propertyName = fieldMapping[fieldName];
                
                if (propertyName) {
                    // Mark the session as dirty
                    window.modifiedSessions[formKey].isDirty = true;
                    
                    // Store the change
                    window.modifiedSessions[formKey].changes[propertyName] = newValue;
                    
                    console.log(`Field changed: ${propertyName} = ${newValue}`);
                    console.log('Current dirty state:', window.modifiedSessions[formKey]);
                    
                    // Add visual indication for the changed field
                    input.classList.add('modified-field');
                    
                    // Show "Apply Changes" button if it doesn't already exist
                    if (!document.getElementById('applyChangesBtn')) {
                        // Create apply changes button
                        const applyBtn = document.createElement('button');
                        applyBtn.id = 'applyChangesBtn';
                        applyBtn.className = 'button warning';
                        applyBtn.innerHTML = '<i class="codicon codicon-check"></i> Apply Changes';
                        applyBtn.addEventListener('click', () => applySessionChanges(formKey));
                        
                        // Add it before the cancel button
                        const cancelBtn = document.getElementById('cancelBtn');
                        if (cancelBtn) {
                            cancelBtn.parentNode.insertBefore(applyBtn, cancelBtn);
                        }
                    }
                }
            }
        });
    });
    
    // Add "Save Session" button handler
    const submitBtn = formElement.querySelector('#submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitSessionForm();
        });
    }
    
    // Clear existing content and add form
    sessionEditor.innerHTML = '';
    sessionEditor.appendChild(formElement);
    
    // Add CSS for modified fields
    if (!document.getElementById('modifiedFieldsStyle')) {
        const style = document.createElement('style');
        style.id = 'modifiedFieldsStyle';
        style.textContent = `
            .modified-field {
                border-left: 3px solid var(--warning-color) !important;
                background-color: rgba(204, 167, 0, 0.1) !important;
            }
            
            #applyChangesBtn {
                margin-right: 10px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Custom dialog for selecting a folder
function createFolderSelectionDialog(folders) {
    console.log('Creating folder selection dialog');
    
    // Create the dialog overlay
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'custom-dialog-overlay';
    dialogOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    // Create the dialog container
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.style.cssText = `
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        padding: 20px;
        width: 350px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    // Create dialog header
    const header = document.createElement('div');
    header.style.cssText = `
        margin-bottom: 15px;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Select Folder';
    title.style.cssText = `
        margin: 0;
        padding: 0;
        font-size: 16px;
        font-weight: 600;
    `;
    
    header.appendChild(title);
    
    // Create dialog content
    const content = document.createElement('div');
    content.style.cssText = `
        margin-bottom: 15px;
        max-height: 200px;
        overflow-y: auto;
    `;
    
    // Create list of folders
    const folderList = document.createElement('div');
    folderList.className = 'folder-selection-list';
    folderList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    folders.forEach((folder, index) => {
        const folderOption = document.createElement('div');
        folderOption.className = 'folder-option';
        folderOption.dataset.folderId = index;
        folderOption.style.cssText = `
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            cursor: pointer;
        `;
        folderOption.textContent = folder.folder_name;
        
        // Highlight on hover
        folderOption.addEventListener('mouseover', () => {
            folderOption.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
        });
        
        folderOption.addEventListener('mouseout', () => {
            folderOption.style.backgroundColor = '';
        });
        
        folderList.appendChild(folderOption);
    });
    
    content.appendChild(folderList);
    
    // Create dialog footer with buttons
    const footer = document.createElement('div');
    footer.style.cssText = `
        display: flex;
        justify-content: flex-end;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'button';
    cancelButton.style.cssText = `
        margin-right: 8px;
        padding: 6px 12px;
    `;
    
    footer.appendChild(cancelButton);
    
    // Assemble the dialog
    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    
    dialogOverlay.appendChild(dialog);
    
    // Add to document
    document.body.appendChild(dialogOverlay);
    
    // Return a promise that resolves with the selected folder index or null if canceled
    return new Promise((resolve) => {
        // Handle folder option click
        const folderOptions = folderList.querySelectorAll('.folder-option');
        folderOptions.forEach(option => {
            option.addEventListener('click', () => {
                const folderId = option.dataset.folderId;
                document.body.removeChild(dialogOverlay);
                resolve(folderId);
            });
        });
        
        // Handle cancel button click
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
            resolve(null);
        });
        
        // Handle Escape key press
        document.addEventListener('keyup', function escHandler(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(dialogOverlay);
                document.removeEventListener('keyup', escHandler);
                resolve(null);
            }
        });
    });
}

// Custom dialog for confirming folder creation
function createConfirmDialog(message) {
    // Create the dialog overlay
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'custom-dialog-overlay';
    dialogOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    // Create the dialog container
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.style.cssText = `
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        padding: 20px;
        width: 350px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    // Create dialog content
    const content = document.createElement('div');
    content.style.cssText = `
        margin-bottom: 15px;
    `;
    
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        margin: 0 0 15px 0;
    `;
    
    content.appendChild(messageElement);
    
    // Create dialog footer with buttons
    const footer = document.createElement('div');
    footer.style.cssText = `
        display: flex;
        justify-content: flex-end;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'No';
    cancelButton.className = 'button';
    cancelButton.style.cssText = `
        margin-right: 8px;
        padding: 6px 12px;
    `;
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Yes';
    confirmButton.className = 'button primary';
    confirmButton.style.cssText = `
        padding: 6px 12px;
    `;
    
    footer.appendChild(cancelButton);
    footer.appendChild(confirmButton);
    
    // Assemble the dialog
    dialog.appendChild(content);
    dialog.appendChild(footer);
    
    dialogOverlay.appendChild(dialog);
    
    // Add to document
    document.body.appendChild(dialogOverlay);
    
    // Return a promise that resolves with true/false
    return new Promise((resolve) => {
        // Handle confirm button click
        confirmButton.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
            resolve(true);
        });
        
        // Handle cancel button click
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
            resolve(false);
        });
        
        // Handle Escape key press
        document.addEventListener('keyup', function escHandler(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(dialogOverlay);
                document.removeEventListener('keyup', escHandler);
                resolve(false);
            }
        });
    });
}

// Updated implementation for adding a new session with custom dialogs
async function handleAddSession() {
    console.log('Add Session clicked');
    
    try {
        // Check if folders exist
        if (!folders || folders.length === 0) {
            // No folders, ask to create one using custom confirm dialog
            const createFolder = await createConfirmDialog('No folders exist. Create a folder first?');
            
            if (createFolder) {
                await promptAddFolder();
                // If we still don't have folders after trying to create one, return
                if (!folders || folders.length === 0) {
                    return;
                }
            } else {
                return;
            }
        }
        
        // If only one folder, use it automatically
        if (folders.length === 1) {
            showSessionForm(0, 'new');
            return;
        }
        
        // Show custom folder selection dialog
        const selectedIndex = await createFolderSelectionDialog(folders);
        
        if (selectedIndex !== null) {
            showSessionForm(parseInt(selectedIndex), 'new');
        }
    } catch (error) {
        console.error('Error in handleAddSession:', error);
        showToast('Failed to add session: ' + error.message, 'error');
    }
}

// Apply changes to a session
function applySessionChanges(formKey) {
    if (!window.modifiedSessions[formKey] || !window.modifiedSessions[formKey].isDirty) {
        showToast('No changes to apply', 'info');
        return;
    }
    
    const [folderId, sessionId] = formKey.split('-');
    const folderIndex = parseInt(folderId, 10);
    const sessionIndex = parseInt(sessionId, 10);
    
    // Get current folders data
    if (!folders[folderIndex] || !folders[folderIndex].sessions || !folders[folderIndex].sessions[sessionIndex]) {
        showToast('Session not found', 'error');
        return;
    }
    
    // Get the changes
    const changes = window.modifiedSessions[formKey].changes;
    
    // Create debug modal content
    const contentSections = [
        {
            title: 'Changes to Apply',
            content: changes
        },
        {
            title: 'Current Session Data',
            content: folders[folderIndex].sessions[sessionIndex]
        },
        {
            title: 'Original Session Data',
            content: window.originalSessionData || 'Not available'
        }
    ];
    
    // Log changes
    console.log('Applying changes to session:', sessionIndex, 'in folder:', folderIndex);
    console.log('Changes:', changes);
    console.log('Before:', folders[folderIndex].sessions[sessionIndex]);
    
    // Apply changes directly to the session data
    Object.keys(changes).forEach(key => {
        folders[folderIndex].sessions[sessionIndex][key] = changes[key];
    });
    
    console.log('After:', folders[folderIndex].sessions[sessionIndex]);
    
    // Show confirmation
    showToast('Changes applied to session. Click "Save Changes" to save to file.', 'success');
    
    // Reset dirty state
    window.modifiedSessions[formKey].isDirty = false;
    window.modifiedSessions[formKey].changes = {};
    
    // Remove applied changes button
    const applyBtn = document.getElementById('applyChangesBtn');
    if (applyBtn) {
        applyBtn.remove();
    }
    
    // Remove visual indicators
    document.querySelectorAll('.modified-field').forEach(element => {
        element.classList.remove('modified-field');
    });
    
    // Store pending data for save
    window.pendingSaveData = JSON.parse(JSON.stringify(folders));
    
    // Create debug modal
    createDebugModal('Changes Applied', contentSections);
}

// Create the modal dialog for debug information
function createDebugModal(title, contentSections) {
    // Create the modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'debug-modal-overlay';
    
    // Create the modal container
    const modal = document.createElement('div');
    modal.className = 'debug-modal';
    
    // Create modal header
    const header = document.createElement('div');
    header.className = 'debug-modal-header';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'debug-modal-title';
    titleEl.textContent = title;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'debug-modal-close';
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    header.appendChild(titleEl);
    header.appendChild(closeButton);
    
    // Create modal content
    const content = document.createElement('div');
    content.className = 'debug-modal-content';
    
    // Add content sections
    contentSections.forEach(section => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'debug-modal-section';
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = section.title;
        sectionEl.appendChild(sectionTitle);
        
        const pre = document.createElement('pre');
        pre.textContent = typeof section.content === 'object' 
            ? JSON.stringify(section.content, null, 2) 
            : section.content;
        sectionEl.appendChild(pre);
        
        content.appendChild(sectionEl);
    });
    
    // Create modal footer
    const footer = document.createElement('div');
    footer.className = 'debug-modal-footer';
    
    const proceedButton = document.createElement('button');
    proceedButton.className = 'button success';
    proceedButton.textContent = 'Proceed with Save';
    proceedButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
        // Continue with the save operation
        saveDataAfterConfirmation();
    });
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    footer.appendChild(cancelButton);
    footer.appendChild(proceedButton);
    
    // Assemble the modal
    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    
    modalOverlay.appendChild(modal);
    
    // Add to document
    document.body.appendChild(modalOverlay);
}

// Enhanced session form submission
function submitSessionForm() {
    const form = document.getElementById('sessionForm');
    
    if (!form) {
        showToast('Form not found', 'error');
        return;
    }
    
    // Get form data
    const folderId = form.querySelector('#folderId').value;
    const sessionId = form.querySelector('#sessionId').value;
    
    // Check if there are unapplied changes
    const formKey = `${folderId}-${sessionId}`;
    if (window.modifiedSessions[formKey] && window.modifiedSessions[formKey].isDirty) {
        // Apply changes first
        applySessionChanges(formKey);
    }
    
    // Collect all form data
    const formData = {
        display_name: form.querySelector('#displayName').value,
        host: form.querySelector('#host').value,
        port: form.querySelector('#port').value,
        DeviceType: form.querySelector('#deviceType').value,
        Vendor: form.querySelector('#vendor').value,
        Model: form.querySelector('#model').value,
        SoftwareVersion: form.querySelector('#softwareVersion').value,
        SerialNumber: form.querySelector('#serialNumber').value,
        credsid: form.querySelector('#credsid').value
    };
    
    // Find the folder and session
    const folderIndex = parseInt(folderId, 10);
    const folder = folders[folderIndex];
    
    if (!folder) {
        showToast('Folder not found', 'error');
        return;
    }
    
    if (!folder.sessions) {
        folder.sessions = [];
    }
    
    // Apply data
    if (sessionId === 'new') {
        // Add new session
        folder.sessions.push(formData);
        showToast('New session added. Click "Save Changes" to save to file.', 'success');
    } else {
        // Update existing session
        const sessionIndex = parseInt(sessionId, 10);
        
        if (!isNaN(sessionIndex) && sessionIndex >= 0 && sessionIndex < folder.sessions.length) {
            folder.sessions[sessionIndex] = formData;
            showToast('Session updated. Click "Save Changes" to save to file.', 'success');
        } else {
            folder.sessions.push(formData);
            showToast('Invalid session index. Added as new session.', 'warning');
        }
    }
    
    // Send to extension
    vscode.postMessage({
        command: 'addSession',
        folderId: folderId,
        session: formData
    });
    
    // Return to main view
    renderFolders();
}

// Handle the final save after confirmation
function saveDataAfterConfirmation() {
    if (!window.pendingSaveData) {
        showToast('No data to save', 'error');
        return;
    }
    
    // Clean the data for saving
    const cleanData = window.pendingSaveData.map(folder => {
        const cleanFolder = {
            folder_name: folder.folder_name
        };
        
        if (Array.isArray(folder.sessions)) {
            cleanFolder.sessions = folder.sessions.map(session => {
                const cleanSession = {};
                
                // Required fields
                cleanSession.display_name = session.display_name || 'Unnamed Session';
                cleanSession.host = session.host || 'localhost';
                cleanSession.port = session.port || '22';
                cleanSession.credsid = session.credsid || '1';
                
                // Optional fields
                if (session.DeviceType) cleanSession.DeviceType = session.DeviceType;
                if (session.Model) cleanSession.Model = session.Model;
                if (session.SoftwareVersion) cleanSession.SoftwareVersion = session.SoftwareVersion;
                if (session.SerialNumber) cleanSession.SerialNumber = session.SerialNumber;
                if (session.Vendor) cleanSession.Vendor = session.Vendor;
                
                // Remove UI properties
                delete cleanSession.id;
                delete cleanSession.sessionId;
                
                return cleanSession;
            });
        } else {
            cleanFolder.sessions = [];
        }
        
        // Remove UI properties
        delete cleanFolder.id;
        
        return cleanFolder;
    });
    
    console.log('Saving cleaned data:', cleanData);
    
    // Send to extension
    vscode.postMessage({
        command: 'saveData',
        data: cleanData
    });
    
    // Reset all dirty state
    window.modifiedSessions = {};
    
    // Show saving toast
    showToast('Saving changes...', 'info');
}

// Confirms deletion of a folder
function confirmDeleteFolder(folderId, folderName) {
    const confirmed = confirm(`Are you sure you want to delete the folder "${folderName}" and all its sessions?`);
    
    if (confirmed) {
        // Send to extension
        vscode.postMessage({
            command: 'deleteFolder',
            folderId: folderId
        });
    }
}

// Confirms deletion of a session
function confirmDeleteSession(folderId, sessionId, sessionName) {
    const confirmed = confirm(`Are you sure you want to delete the session "${sessionName}"?`);
    
    if (confirmed) {
        // Send to extension
        vscode.postMessage({
            command: 'deleteSession',
            folderId: folderId,
            sessionId: sessionId
        });
    }
}

// Save data with confirmation
function saveData() {
    // Check if there are dirty sessions
    let hasDirtySessions = false;
    
    Object.keys(window.modifiedSessions).forEach(key => {
        if (window.modifiedSessions[key].isDirty) {
            hasDirtySessions = true;
        }
    });
    
    if (hasDirtySessions) {
        // Ask user if they want to apply unsaved changes
        const confirmed = confirm('There are unsaved session changes. Apply them before saving?');
        
        if (confirmed) {
            // Apply all dirty changes
            Object.keys(window.modifiedSessions).forEach(key => {
                if (window.modifiedSessions[key].isDirty) {
                    applySessionChanges(key);
                }
            });
        }
    }
    
    // Create content for the debug modal
    const contentSections = [
        {
            title: 'Current Data Structure',
            content: `Total folders: ${folders.length}\nTotal sessions: ${folders.reduce((count, folder) => count + (folder.sessions ? folder.sessions.length : 0), 0)}`
        },
        {
            title: 'Data Preview',
            content: folders.length > 0 ? 
                `First folder: ${folders[0].folder_name}\nSessions: ${folders[0].sessions ? folders[0].sessions.length : 0}` : 
                'No folders found'
        }
    ];
    
    // Create debug modal
    createDebugModal('Save Confirmation', contentSections);
    
    // Store pending data
    window.pendingSaveData = JSON.parse(JSON.stringify(folders));
}

// Show a toast notification
function showToast(message, type = 'info') {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove after a delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Setup all event listeners - consolidated function
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Find the Add Folder button 
    const addFolderBtn = document.getElementById('addFolderBtn');
    if (addFolderBtn) {
        console.log('Found Add Folder button, attaching listener');
        // Ensure any previous listeners are removed
        const newAddFolderBtn = addFolderBtn.cloneNode(true);
        addFolderBtn.parentNode.replaceChild(newAddFolderBtn, addFolderBtn);
        
        // Add clean event listener
        newAddFolderBtn.addEventListener('click', function(e) {
            console.log('Add Folder button clicked');
            e.preventDefault();
            promptAddFolder();
        });
    } else {
        console.error('Add Folder button not found in DOM');
    }
    
    // Find the Add Session button or create it if it doesn't exist
    let addSessionBtn = document.getElementById('addSessionBtn');
    if (!addSessionBtn) {
        console.log('Add Session button not found, creating it');
        const toolbar = document.querySelector('.toolbar .actions');
        if (toolbar) {
            addSessionBtn = document.createElement('button');
            addSessionBtn.id = 'addSessionBtn';
            addSessionBtn.className = 'button primary';
            addSessionBtn.innerHTML = '<i class="codicon codicon-add"></i> Add Session';
            
            // Add it before the save button if possible
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                toolbar.insertBefore(addSessionBtn, saveBtn);
            } else {
                toolbar.appendChild(addSessionBtn);
            }
        }
    }
    
    // Add the Add Session handler
    if (addSessionBtn) {
        console.log('Attaching handler to Add Session button');
        // Remove any existing listeners
        const newAddSessionBtn = addSessionBtn.cloneNode(true);
        addSessionBtn.parentNode.replaceChild(newAddSessionBtn, addSessionBtn);
        
        // Add clean event listener
        newAddSessionBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleAddSession();
        });
    }
    
    // Save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        console.log('Attaching handler to Save button');
        // Remove any existing listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        // Add clean event listener
        newSaveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            saveData();
        });
    }
    
    // Global click handler for dynamically added elements
    document.addEventListener('click', (e) => {
        // Add session button within a folder
        if (e.target.closest('.add-session-btn')) {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                const folderId = folderItem.dataset.folderId;
                showSessionForm(folderId, 'new');
            }
        }
        
        // Delete folder button
        else if (e.target.closest('.delete-folder-btn')) {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                const folderId = folderItem.dataset.folderId;
                const folderName = folderItem.querySelector('.folder-name').textContent;
                confirmDeleteFolder(folderId, folderName);
            }
        }
        
        // Edit session button
        else if (e.target.closest('.edit-session-btn')) {
            const sessionItem = e.target.closest('.session-item');
            if (sessionItem) {
                const folderId = sessionItem.closest('.folder-item').dataset.folderId;
                const sessionId = sessionItem.dataset.sessionId;
                showSessionForm(folderId, sessionId);
            }
        }
        
        // Delete session button
        else if (e.target.closest('.delete-session-btn')) {
            const sessionItem = e.target.closest('.session-item');
            if (sessionItem) {
                const folderId = sessionItem.closest('.folder-item').dataset.folderId;
                const sessionId = sessionItem.dataset.sessionId;
                const sessionName = sessionItem.querySelector('.session-name').textContent;
                confirmDeleteSession(folderId, sessionId, sessionName);
            }
        }
        
        // Click on session item (for selection)
        else if (e.target.closest('.session-item') && !e.target.closest('.session-actions')) {
            const sessionItem = e.target.closest('.session-item');
            if (sessionItem) {
                const folderId = sessionItem.closest('.folder-item').dataset.folderId;
                const sessionId = sessionItem.dataset.sessionId;
                
                // Deselect all other session items
                document.querySelectorAll('.session-item.selected').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // Select this session item
                sessionItem.classList.add('selected');
                
                // Show the session form
                showSessionForm(folderId, sessionId);
            }
        }
        
        // Cancel button in session form
        else if (e.target.id === 'cancelBtn') {
            hideSessionForm();
        }
    });
    
    console.log('Event listeners setup complete');
}