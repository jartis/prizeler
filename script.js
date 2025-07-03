// Global data stores
let prizePacks = [];
let donations = [];
let currentEditIndex = -1;
let currentEditType = null; // 'prizepack' or 'donation'
let filteredDonations = [];

// Drawing-specific variables
let drawingHistory = [];
let currentDrawingSession = null;
let currentDrawingResults = null;
let allDrawingResults = {}; // Store results for each pack
let drawingStates = {}; // Track drawing states for each pack

// Schema validation cache
let donationsSchema = null;
let prizePacksSchema = null;

// Load schemas for validation
async function loadSchemas() {
    try {
        if (!donationsSchema) {
            const donationsSchemaResponse = await fetch('./donations-schema.json');
            donationsSchema = await donationsSchemaResponse.json();
        }
        
        if (!prizePacksSchema) {
            const prizePacksSchemaResponse = await fetch('./prizepacks-schema.json');
            prizePacksSchema = await prizePacksSchemaResponse.json();
        }
    } catch (error) {
        console.error('Error loading schemas:', error);
        // Schemas are optional - validation will be skipped if they can't be loaded
    }
}

// JSON Schema validation function
function validateData(data, schema) {
    if (!schema) {
        console.warn('Schema not available - skipping validation');
        return { isValid: true, errors: [] };
    }
    
    const errors = [];
    
    // Basic type validation
    if (schema.type === 'array' && !Array.isArray(data)) {
        errors.push('Data must be an array');
        return { isValid: false, errors };
    }
    
    if (Array.isArray(data)) {
        // Validate array items
        if (schema.items) {
            data.forEach((item, index) => {
                const itemErrors = validateObject(item, schema.items, `Item ${index + 1}`);
                errors.push(...itemErrors);
            });
        }
        
        // Check array constraints
        if (schema.minItems !== undefined && data.length < schema.minItems) {
            errors.push(`Array must have at least ${schema.minItems} items`);
        }
        if (schema.maxItems !== undefined && data.length > schema.maxItems) {
            errors.push(`Array must have at most ${schema.maxItems} items`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateObject(obj, schema, prefix = '') {
    const errors = [];
    const prefixStr = prefix ? `${prefix}: ` : '';
    
    // Check required properties
    if (schema.required) {
        schema.required.forEach(prop => {
            if (!(prop in obj)) {
                errors.push(`${prefixStr}Missing required property '${prop}'`);
            }
        });
    }
    
    // Check additional properties
    if (schema.additionalProperties === false) {
        const allowedProps = Object.keys(schema.properties || {});
        Object.keys(obj).forEach(prop => {
            if (!allowedProps.includes(prop)) {
                errors.push(`${prefixStr}Unknown property '${prop}' is not allowed`);
            }
        });
    }
    
    // Validate each property
    if (schema.properties) {
        Object.entries(schema.properties).forEach(([prop, propSchema]) => {
            if (prop in obj) {
                const value = obj[prop];
                const propErrors = validateProperty(value, propSchema, `${prefixStr}${prop}`);
                errors.push(...propErrors);
            }
        });
    }
    
    return errors;
}

function validateProperty(value, schema, propertyName) {
    const errors = [];
    
    // Type validation
    if (schema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (schema.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
            errors.push(`${propertyName} must be an integer`);
        } else if (schema.type !== 'integer' && actualType !== schema.type) {
            errors.push(`${propertyName} must be of type ${schema.type}, got ${actualType}`);
        }
    }
    
    // String validations
    if (typeof value === 'string') {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(`${propertyName} must be at least ${schema.minLength} characters long`);
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push(`${propertyName} must be at most ${schema.maxLength} characters long`);
        }
        if (schema.format === 'email' && !isValidEmail(value)) {
            errors.push(`${propertyName} must be a valid email address`);
        }
        if (schema.format === 'date-time' && !isValidDateTime(value)) {
            errors.push(`${propertyName} must be a valid ISO 8601 date-time`);
        }
    }
    
    // Number validations
    if (typeof value === 'number') {
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push(`${propertyName} must be at least ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push(`${propertyName} must be at most ${schema.maximum}`);
        }
        if (schema.multipleOf !== undefined && (value % schema.multipleOf) !== 0) {
            errors.push(`${propertyName} must be a multiple of ${schema.multipleOf}`);
        }
    }
    
    return errors;
}

// Helper validation functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidDateTime(dateTime) {
    try {
        const date = new Date(dateTime);
        return date.toISOString() === dateTime;
    } catch {
        return false;
    }
}

// Enhanced validation with user-friendly error reporting
function validateAndShowErrors(data, schema, dataType) {
    const validation = validateData(data, schema);
    
    if (!validation.isValid) {
        const errorCount = validation.errors.length;
        const errorSummary = validation.errors.slice(0, 5).join('\n• ');
        const moreErrors = errorCount > 5 ? `\n... and ${errorCount - 5} more errors` : '';
        
        const errorMessage = `❌ ${dataType} validation failed (${errorCount} error${errorCount > 1 ? 's' : ''}):\n\n• ${errorSummary}${moreErrors}\n\nDo you want to load the data anyway? (Some features may not work correctly)`;
        
        return confirm(errorMessage);
    }
    
    return true;
}

// Load sample data function
async function loadSampleData() {
    try {
        // Ensure schemas are loaded first
        await loadSchemas();
        
        // Load sample prize packs
        const prizePackResponse = await fetch('./prizepacks_voyage.json');
        const samplePrizePacks = await prizePackResponse.json();
        
        // Load sample donations
        const donationResponse = await fetch('./donations_example.json');
        const sampleDonations = await donationResponse.json();
        
        // Validate prize packs
        if (!validateAndShowErrors(samplePrizePacks, prizePacksSchema, 'Prize Packs')) {
            return;
        }
        
        // Validate donations
        if (!validateAndShowErrors(sampleDonations, donationsSchema, 'Donations')) {
            return;
        }
        
        // Update global arrays
        prizePacks = samplePrizePacks;
        donations = sampleDonations;
        
        // Auto-save
        localStorage.setItem('prizePacks', JSON.stringify(prizePacks));
        localStorage.setItem('donations', JSON.stringify(donations));
        
        // Re-render all views
        renderPrizePacks();
        updatePrizePackStats();
        renderDonations();
        updateDonationStats();
        renderAvailableDrawings();
        updateDrawingStats();
        
        // Show success message
        alert('✅ Sample data loaded and validated successfully! Check the Prize Packs and Donations tabs.');
        
    } catch (error) {
        console.error('Error loading sample data:', error);
        alert('Error loading sample data. Please make sure the JSON files are present.');
    }
}

// Tab management
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + '-tab').classList.add('active');

    // Update drag drop message
    const dragDropText = document.getElementById('dragDropText');
    if (tabName === 'prizepacks') {
        dragDropText.textContent = 'Release to load your prize pack data';
    } else if (tabName === 'donations') {
        dragDropText.textContent = 'Release to load your donation data';
    } else if (tabName === 'drawings') {
        dragDropText.textContent = 'Release to load data for drawings';
        renderAvailableDrawings();
        updateDrawingStats();
        
        // Populate pack filter dropdown
        const filterSelect = document.getElementById('drawingPackFilter');
        filterSelect.innerHTML = '<option value="">All Prize Packs</option>' + 
            prizePacks.map(pack => `<option value="${pack.pack}">${pack.blockName} (${pack.pack})</option>`).join('');
    }
}

// Prize Pack Functions
function renderPrizePacks() {
    const grid = document.getElementById('prizePackGrid');
    const emptyState = document.getElementById('prizepackEmptyState');
    
    if (prizePacks.length === 0) {
        grid.innerHTML = '<div class="add-new-card" onclick="addNewPrizePack()"><div class="plus-icon">+</div><div class="add-text">Add Your First Prize Pack</div></div>';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    
    const html = prizePacks.map((pack, index) => `
        <div class="card" data-index="${index}">
            <div class="card-header">
                <div>
                    <div class="card-title prizepack-title">${pack.blockName}</div>
                    <div class="pack-id">${pack.pack}</div>
                </div>
                <button class="delete-btn" onclick="deletePrizePack(${index})" title="Delete Prize Pack">×</button>
            </div>
            
            <div class="form-group">
                <label>Block:</label>
                <span>${pack.block}</span>
            </div>
            
            <div class="form-group">
                <label>Start Date:</label>
                <span>${formatDisplayDate(pack.startDate)} UTC</span>
            </div>
            
            <div class="form-group">
                <label>End Date:</label>
                <span>${pack.endDate ? formatDisplayDate(pack.endDate) + ' UTC' : 'Not set'}</span>
            </div>
            
            <div class="form-group">
                <label>Item Description:</label>
                <span>${pack.itemDescription}</span>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Min Entry:</label>
                    <span>$${pack.minEntryDollars}</span>
                </div>
                <div class="form-group">
                    <label>Draws:</label>
                    <span>${pack.draws}</span>
                </div>
            </div>
            
            <div class="form-group">
                <label>Multi-entry:</label>
                <span>${pack.multientry ? '✅ Yes' : '❌ No'}</span>
            </div>
            
            <button class="btn" onclick="editPrizePack(${index})" style="width: 100%; margin-top: 15px;">
                ✏️ Edit Prize Pack
            </button>
        </div>
    `).join('');

    grid.innerHTML = html + '<div class="add-new-card" onclick="addNewPrizePack()"><div class="plus-icon">+</div><div class="add-text">Add New Prize Pack</div></div>';
}

function updatePrizePackStats() {
    document.getElementById('totalPacks').textContent = prizePacks.length;
    document.getElementById('totalDraws').textContent = prizePacks.reduce((sum, pack) => sum + pack.draws, 0);
    document.getElementById('multiEntryPacks').textContent = prizePacks.filter(pack => pack.multientry).length;
}

function addNewPrizePack() {
    const newPack = {
        pack: `B-${String(prizePacks.length + 1).padStart(2, '0')}`,
        block: "New Block",
        blockName: "New Prize Pack",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 24*60*60*1000).toISOString(),
        itemDescription: "New prize description",
        minEntryDollars: "5",
        multientry: false,
        draws: 1
    };
    
    prizePacks.push(newPack);
    renderPrizePacks();
    updatePrizePackStats();
    
    editPrizePack(prizePacks.length - 1);
}

function deletePrizePack(index) {
    if (confirm('Are you sure you want to delete this prize pack?')) {
        prizePacks.splice(index, 1);
        renderPrizePacks();
        updatePrizePackStats();
    }
}

function editPrizePack(index) {
    currentEditIndex = index;
    currentEditType = 'prizepack';
    const pack = prizePacks[index];
    
    document.getElementById('editPack').value = pack.pack;
    document.getElementById('editBlock').value = pack.block;
    document.getElementById('editBlockName').value = pack.blockName;
    document.getElementById('editItemDescription').value = pack.itemDescription;
    
    document.getElementById('editStartDate').value = formatDateTimeLocalFromUTC(pack.startDate);
    document.getElementById('editEndDate').value = pack.endDate ? formatDateTimeLocalFromUTC(pack.endDate) : '';
    
    document.getElementById('editMinEntryDollars').value = pack.minEntryDollars;
    document.getElementById('editDraws').value = pack.draws;
    document.getElementById('editMultientry').checked = pack.multientry;
    
    document.getElementById('prizepackEditModal').style.display = 'flex';
}

function closePrizePackModal() {
    document.getElementById('prizepackEditModal').style.display = 'none';
    currentEditIndex = -1;
    currentEditType = null;
}

function filterPrizePacks() {
    const searchTerm = document.getElementById('prizepackSearchInput').value.toLowerCase();
    const cards = document.querySelectorAll('#prizePackGrid .card');
    
    cards.forEach(card => {
        const index = card.getAttribute('data-index');
        if (index !== null) {
            const pack = prizePacks[index];
            const searchableText = `${pack.pack} ${pack.block} ${pack.blockName} ${pack.itemDescription}`.toLowerCase();
            
            if (searchableText.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

function loadPrizePackFile(event) {
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
        alert('Please select a JSON file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                // Ensure schemas are loaded
                await loadSchemas();
                
                // Validate against schema
                if (validateAndShowErrors(data, prizePacksSchema, 'Prize Packs')) {
                    prizePacks = data;
                    renderPrizePacks();
                    updatePrizePackStats();
                    alert(`✅ Prize packs loaded and validated successfully! Loaded ${data.length} prize pack(s).`);
                }
            } else {
                alert('Invalid file format. Please select a valid JSON file with an array of prize packs.');
            }
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    };
    reader.readAsText(file);
    
    if (event.target) {
        event.target.value = '';
    }
}

function exportPrizePackData() {
    const dataStr = JSON.stringify(prizePacks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `prizepacks-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function clearAllPrizePacks() {
    if (confirm('Are you sure you want to delete all prize packs? This action cannot be undone.')) {
        prizePacks = [];
        renderPrizePacks();
        updatePrizePackStats();
    }
}

// Donation Functions
function renderDonations() {
    const grid = document.getElementById('donationsGrid');
    const emptyState = document.getElementById('donationEmptyState');
    
    const donationsToShow = filteredDonations.length > 0 ? filteredDonations : donations;
    
    if (donationsToShow.length === 0) {
        grid.innerHTML = '<div class="add-new-card" onclick="addNewDonation()"><div class="plus-icon">+</div><div class="add-text">Add Your First Donation</div></div>';
        emptyState.style.display = donations.length === 0 ? 'block' : 'none';
        return;
    }

    emptyState.style.display = 'none';
    
    const html = donationsToShow.map((donation, index) => {
        const originalIndex = donations.indexOf(donation);
        return `
        <div class="card" data-index="${originalIndex}">
            <div class="card-header">
                <div>
                    <div class="card-title donation-title">${donation.screenName}</div>
                    <div style="color: #666; font-size: 0.9rem;">${donation.email}</div>
                </div>
                <div class="amount-badge">$${donation.amount.toFixed(2)}</div>
                <button class="delete-btn" onclick="deleteDonation(${originalIndex})" title="Delete Donation">×</button>
            </div>
            
            <div class="form-group">
                <label>User ID:</label>
                <span>${donation.userId}</span>
            </div>
            
            <div class="form-group">
                <label>Donation Time:</label>
                <span>${formatDisplayDate(donation.time)} UTC</span>
            </div>
            
            <button class="btn btn-orange" onclick="editDonation(${originalIndex})" style="width: 100%; margin-top: 15px;">
                ✏️ Edit Donation
            </button>
        </div>
    `;
    }).join('');

    grid.innerHTML = html + '<div class="add-new-card" onclick="addNewDonation()"><div class="plus-icon">+</div><div class="add-text">Add New Donation</div></div>';
}

function updateDonationStats() {
    const totalDonations = donations.length;
    const totalAmount = donations.reduce((sum, donation) => sum + donation.amount, 0);
    const uniqueDonors = new Set(donations.map(d => d.email)).size;
    const averageAmount = totalDonations > 0 ? totalAmount / totalDonations : 0;

    document.getElementById('totalDonations').textContent = totalDonations;
    document.getElementById('totalAmount').textContent = `$${totalAmount.toFixed(2)}`;
    document.getElementById('uniqueDonors').textContent = uniqueDonors;
    document.getElementById('averageAmount').textContent = `$${averageAmount.toFixed(2)}`;
}

function addNewDonation() {
    const newDonation = {
        time: new Date().toISOString(),
        screenName: "New Donor",
        email: "donor@example.com",
        userId: Math.floor(Math.random() * 100000),
        amount: 10.00
    };
    
    donations.push(newDonation);
    renderDonations();
    updateDonationStats();
    
    editDonation(donations.length - 1);
}

function deleteDonation(index) {
    if (confirm('Are you sure you want to delete this donation?')) {
        donations.splice(index, 1);
        filterDonations();
        updateDonationStats();
    }
}

function editDonation(index) {
    currentEditIndex = index;
    currentEditType = 'donation';
    const donation = donations[index];
    
    document.getElementById('editTime').value = formatDateTimeLocalFromUTC(donation.time);
    document.getElementById('editScreenName').value = donation.screenName;
    document.getElementById('editEmail').value = donation.email;
    document.getElementById('editUserId').value = donation.userId;
    document.getElementById('editAmount').value = donation.amount;
    
    document.getElementById('donationEditModal').style.display = 'flex';
}

function closeDonationModal() {
    document.getElementById('donationEditModal').style.display = 'none';
    currentEditIndex = -1;
    currentEditType = null;
}

function filterDonations() {
    const searchTerm = document.getElementById('donationSearchInput').value.toLowerCase();
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const minAmount = parseFloat(document.getElementById('amountFilter').value) || 0;

    filteredDonations = donations.filter(donation => {
        const searchableText = `${donation.screenName} ${donation.email} ${donation.userId}`.toLowerCase();
        const matchesSearch = searchableText.includes(searchTerm);

        const donationDate = new Date(donation.time).toISOString().split('T')[0];
        const matchesDateFrom = !dateFrom || donationDate >= dateFrom;
        const matchesDateTo = !dateTo || donationDate <= dateTo;

        const matchesAmount = donation.amount >= minAmount;

        return matchesSearch && matchesDateFrom && matchesDateTo && matchesAmount;
    });

    renderDonations();
}

function clearDateFilter() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('amountFilter').value = '';
    filterDonations();
}

function loadDonationFile(event) {
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.json')) {
        alert('Please select a JSON file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                // Ensure schemas are loaded
                await loadSchemas();
                
                // Validate against schema
                if (validateAndShowErrors(data, donationsSchema, 'Donations')) {
                    donations = data;
                    renderDonations();
                    updateDonationStats();
                    alert(`✅ Donations loaded and validated successfully! Loaded ${data.length} donation(s).`);
                }
            } else {
                alert('Invalid file format. Please select a valid JSON file with an array of donations.');
            }
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    };
    reader.readAsText(file);
    
    if (event.target) {
        event.target.value = '';
    }
}

function exportDonationData() {
    const dataStr = JSON.stringify(donations, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `donations-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function clearAllDonations() {
    if (confirm('Are you sure you want to delete all donations? This action cannot be undone.')) {
        donations = [];
        filterDonations();
        updateDonationStats();
    }
}

function showUserSummary() {
    const userStats = {};
    
    donations.forEach(donation => {
        if (!userStats[donation.email]) {
            userStats[donation.email] = {
                screenName: donation.screenName,
                email: donation.email,
                totalAmount: 0,
                donationCount: 0,
                donations: []
            };
        }
        
        userStats[donation.email].totalAmount += donation.amount;
        userStats[donation.email].donationCount++;
        userStats[donation.email].donations.push(donation);
    });

    const sortedUsers = Object.entries(userStats)
        .sort(([,a], [,b]) => b.totalAmount - a.totalAmount);

    let html = '<div style="max-height: 60vh; overflow-y: auto;">';
    
    if (sortedUsers.length === 0) {
        html += '<p style="text-align: center; color: #666;">No donations to summarize.</p>';
    } else {
        sortedUsers.forEach(([email, stats]) => {
            html += `
                <div class="user-summary">
                    <h4>${stats.screenName} (ID: ${userId})</h4>
                    <p style="color: #666; margin-bottom: 15px;">${stats.email}</p>
                    <div class="user-donations">
                        <div class="user-stat">
                            <div class="user-stat-number">$${stats.totalAmount.toFixed(2)}</div>
                            <div class="user-stat-label">Total Donated</div>
                        </div>
                        <div class="user-stat">
                            <div class="user-stat-number">${stats.donationCount}</div>
                            <div class="user-stat-label">Donations</div>
                        </div>
                        <div class="user-stat">
                            <div class="user-stat-number">$${(stats.totalAmount / stats.donationCount).toFixed(2)}</div>
                            <div class="user-stat-label">Average</div>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    
    document.getElementById('userSummaryContent').innerHTML = html;
    document.getElementById('userSummaryModal').style.display = 'flex';
}

function closeUserSummary() {
    document.getElementById('userSummaryModal').style.display = 'none';
}

// Drawing Core Functions (from drawing.js)
function doDrawing(drawingInfo, donors) {
    const winners = [];
    
    if (drawingInfo.multientry) {
        let eligibleDonors = getMultiEligible(donors, drawingInfo);
        console.log("Eligible Donors for Multi-Entry Drawing:", eligibleDonors.length);
        
        for (let i = 0; i < drawingInfo.draws; i++) {
            console.log("Drawing:", i + 1);
            if (eligibleDonors.length > 0) {
                let winnerIndex = Math.floor(Math.random() * eligibleDonors.length);
                let winner = eligibleDonors[winnerIndex];
                winners.push(winner);
                console.log("Winner of Multi-Entry Drawing:", JSON.stringify(winner));
                // Remove the winner from the list to prevent multiple wins in the same drawing
                eligibleDonors = eligibleDonors.filter(user => user.email !== winner.email);
            } else {
                console.log("No eligible donors for multi-entry drawing.");
                break;
            }
        }
    } else {
        // Get eligible cumulative donations
        let eligibleDonors = getEligibleCumulative(donors, drawingInfo);
        console.log("Eligible Donors for Cumulative Drawing:", eligibleDonors.length);

        for (let i = 0; i < drawingInfo.draws; i++) {
            if (eligibleDonors.length > 0) {
                let winnerIndex = Math.floor(Math.random() * eligibleDonors.length);
                let winner = eligibleDonors[winnerIndex];
                winners.push(winner);
                console.log("Winner of Cumulative Drawing:", JSON.stringify(winner));
                // Remove winner to prevent multiple wins
                eligibleDonors = eligibleDonors.filter(user => user.email !== winner.email);
            } else {
                console.log("No eligible donors for cumulative drawing.");
                break;
            }
        }
    }
    
    return {
        winners: winners,
        eligibleCount: drawingInfo.multientry ? 
            getMultiEligible(donors, drawingInfo).length : 
            getEligibleCumulative(donors, drawingInfo).length
    };
}

function getEligibleCumulative(donations, drawingInfo) {
    // Filter donations based on the drawing's start and end dates
    const startDate = new Date(drawingInfo.startDate);
    const endDate = new Date(drawingInfo.endDate);

    let validDonations = donations.filter(donation => {
        const donationDate = new Date(donation.time);
        return donationDate >= startDate && donationDate <= endDate;
    });

    // Aggregate the valid donations by userId to get a total for the block
    const aggregatedDonations = [];
    validDonations.forEach(donation => {
        const existingUser = aggregatedDonations.find(user => user.email === donation.email);
        if (existingUser) {
            existingUser.totalAmount += donation.amount;
        } else {
            aggregatedDonations.push({
                userId: donation.userId,
                screenName: donation.screenName,
                email: donation.email,
                totalAmount: donation.amount
            });
        }
    });

    // Filter users who have met the minimum entry requirement
    const minEntryDollars = parseFloat(drawingInfo.minEntryDollars);
    let eligibleDonors = aggregatedDonations.filter((userData) => {
        return userData.totalAmount >= minEntryDollars;
    });

    return eligibleDonors;
}

function getMultiEligible(donations, drawingInfo) {
    // Filter donations based on the drawing's start and end dates
    const startDate = new Date(drawingInfo.startDate);
    const endDate = new Date(drawingInfo.endDate);

    let validDonations = donations.filter(donation => {
        const donationDate = new Date(donation.time);
        return donationDate >= startDate && donationDate <= endDate;
    });

    if (validDonations.length === 0) {
        console.log("No valid donations found for the specified date range.");
        return [];
    }

    // Aggregate the valid donations by userId to get a total for the block
    const aggregatedDonations = [];
    validDonations.forEach(donation => {
        const existingUser = aggregatedDonations.find(user => user.email === donation.email);
        if (existingUser) {
            existingUser.amount += donation.amount;
        } else {
            aggregatedDonations.push({
                userId: donation.userId,
                screenName: donation.screenName,
                email: donation.email,
                amount: donation.amount
            });
        }
    });

    // Multientry drawings give one "entry" for every minimum entry amount
    const minEntryDollars = parseFloat(drawingInfo.minEntryDollars);
    let eligibleDonors = [];
    
    aggregatedDonations.forEach(userData => {
        const entries = Math.floor(userData.amount / minEntryDollars);
        if (entries > 0) {
            for (let i = 0; i < entries; i++) {
                eligibleDonors.push({
                    userId: userData.userId,
                    screenName: userData.screenName,
                    email: userData.email,
                    amount: minEntryDollars
                });
            }
        }
    });

    return eligibleDonors;
}

// Drawing History Functions
function showDrawingHistory() {
    if (drawingHistory.length === 0) {
        alert('No drawing history available.');
        return;
    }

    const historyHtml = drawingHistory.map((result, index) => `
        <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
            <h4>${result.pack.blockName} (${result.pack.pack})</h4>
            <p><strong>Date:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
            <p><strong>Prize:</strong> ${result.pack.itemDescription}</p>
            <p><strong>Winners:</strong> ${result.winners.length}</p>
            <p><strong>Eligible Entries:</strong> ${result.eligibleCount}</p>
            <div style="margin-top: 10px;">
                <strong>Winners:</strong><br>
                ${result.winners.map(w => `
                    <div style="background: #e8f5e8; padding: 8px; border-radius: 4px; margin: 2px 0;">
                        <strong>${w.screenName}</strong> (${w.email}) - $${w.totalAmount || w.amount}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Create a simple modal for history
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.5); z-index: 2000; display: flex; 
        justify-content: center; align-items: center;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 800px; width: 90%; max-height: 80%; overflow-y: auto;">
            <h2 style="margin-bottom: 20px;">Drawing History (${drawingHistory.length} total)</h2>
            ${historyHtml}
            <button onclick="this.closest('div').parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Validate individual prize pack or donation item
function validateSingleItem(item, type) {
    const schema = type === 'prizepack' ? prizePacksSchema : donationsSchema;
    if (!schema || !schema.items) return { isValid: true, errors: [] };
    
    const errors = validateObject(item, schema.items);
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Show validation errors for a single item
function showValidationErrors(errors, itemType, itemName) {
    if (errors.length === 0) return;
    
    const errorList = errors.map(error => `• ${error}`).join('\n');
    alert(`⚠️ Validation warnings for ${itemType} "${itemName}":\n\n${errorList}\n\nPlease review the data for potential issues.`);
}

// Utility Functions
function formatDateTimeLocalFromUTC(utcString) {
    if (!utcString) return '';
    const date = new Date(utcString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDisplayDate(utcString) {
    if (!utcString) return '';
    const date = new Date(utcString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    });
}

// Drag and Drop
function setupDragAndDrop() {
    const body = document.body;
    const overlay = document.getElementById('dragOverlay');
    let dragCounter = 0;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, preventDefaults, false);
        document.documentElement.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        body.addEventListener(eventName, handleDragEnter, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, handleDragLeave, false);
    });

    function handleDragEnter(e) {
        dragCounter++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            body.classList.add('drag-over');
            overlay.classList.add('active');
        }
    }

    function handleDragLeave(e) {
        dragCounter--;
        if (dragCounter === 0) {
            body.classList.remove('drag-over');
            overlay.classList.remove('active');
        }
    }

    body.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        dragCounter = 0;
        body.classList.remove('drag-over');
        overlay.classList.remove('active');

        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];
            
            if (file.name.toLowerCase().endsWith('.json')) {
                // Determine which tab is active and load accordingly
                const activeTab = document.querySelector('.tab-content.active').id;
                if (activeTab === 'prizepacks-tab') {
                    loadPrizePackFile(file);
                } else if (activeTab === 'donations-tab') {
                    loadDonationFile(file);
                }
            } else {
                alert('Please drop a JSON file.');
            }
        }
    }
}

// Auto-save functions
function autoSave() {
    localStorage.setItem('prizePacks', JSON.stringify(prizePacks));
    localStorage.setItem('donations', JSON.stringify(donations));
    localStorage.setItem('drawingHistory', JSON.stringify(drawingHistory));
    localStorage.setItem('drawingStates', JSON.stringify(drawingStates));
    localStorage.setItem('allDrawingResults', JSON.stringify(allDrawingResults));
}

// Drawing Functions (based on drawing.js logic)
function renderAvailableDrawings() {
    const grid = document.getElementById('availableDrawingsGrid');
    const emptyState = document.getElementById('drawingEmptyState');
    
    // Filter prize packs that are available for drawing
    const now = new Date();
    const availablePacks = prizePacks.filter(pack => {
        const startDate = new Date(pack.startDate);
        const endDate = pack.endDate ? new Date(pack.endDate) : new Date(Date.now() + 365*24*60*60*1000);
        
        // Show packs that are either currently active, or recently ended (within 30 days)
        // This allows for some flexibility while still respecting date boundaries
        const thirtyDaysAgo = new Date(now.getTime() - 30*24*60*60*1000);
        const thirtyDaysFromNow = new Date(now.getTime() + 30*24*60*60*1000);
        
        return (startDate <= thirtyDaysFromNow && endDate >= thirtyDaysAgo);
    });
    
    if (availablePacks.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    
    const html = availablePacks.map((pack, index) => {
        const eligibleCount = pack.multientry ? 
            getMultiEligible(donations, pack).length : 
            getEligibleCumulative(donations, pack).length;
        
        const packState = drawingStates[pack.pack] || 'ready'; // ready, drawn, saved
        const packResults = allDrawingResults[pack.pack];
        
        let statusBadge = '';
        let actionButton = '';
        let resultSection = '';
        
        if (packState === 'ready') {
            statusBadge = '<div style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 5px;">Ready</div>';
            actionButton = `
                <button class="btn" style="background: #4CAF50; width: 100%" 
                        onclick="conductSingleDrawing('${pack.pack}')"
                        ${eligibleCount === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    🎲 Run Drawing
                </button>
            `;
        } else if (packState === 'drawn') {
            statusBadge = '<div style="background: #fff3e0; color: #e65100; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 5px;">Drawn</div>';
            actionButton = `
                <button class="btn btn-secondary" style="width: 100%" onclick="resetSingleDrawing('${pack.pack}')">
                    🔄 Reset Drawing
                </button>
            `;
            if (packResults && packResults.winners) {
                resultSection = `
                    <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin: 10px 0;">
                        <strong>🏆 Winners:</strong><br>
                        ${packResults.winners.map(w => `<span style="color: #2e7d32;">${w.screenName}</span>`).join(', ')}
                    </div>
                `;
            }
        } else if (packState === 'saved') {
            statusBadge = '<div style="background: #e8f5e8; color: #2e7d32; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 5px;">Saved</div>';
            actionButton = `
                <button class="btn btn-secondary" style="width: 100%" onclick="resetSingleDrawing('${pack.pack}')">
                    🔄 Reset Drawing
                </button>
            `;
            if (packResults && packResults.winners) {
                resultSection = `
                    <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin: 10px 0;">
                        <strong>✅ Saved Winners:</strong><br>
                        ${packResults.winners.map(w => `<span style="color: #2e7d32;">${w.screenName}</span>`).join(', ')}
                    </div>
                `;
            }
        }
        
        return `
            <div class="card" style="border-left: 4px solid #4CAF50;" id="drawing-card-${pack.pack}">
                <div class="card-header">
                    <div>
                        <div class="card-title" style="color: #4CAF50;">${pack.blockName}</div>
                        <div style="color: #666; font-size: 0.9rem;">${pack.pack} - ${pack.block}</div>
                    </div>
                    <div style="text-align: right;">
                        ${statusBadge}
                        <div style="background: #e8f5e8; color: #2e7d32; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 5px;">
                            ${eligibleCount} eligible
                        </div>
                        <div style="background: #fff3e0; color: #e65100; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem;">
                            ${pack.draws} draw(s)
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <strong>Item:</strong> ${pack.itemDescription}
                </div>
                
                <div style="margin-bottom: 10px;">
                    <strong>Min Entry:</strong> $${pack.minEntryDollars} 
                    ${pack.multientry ? '(Multi-entry allowed)' : '(Cumulative)'}
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong>Period:</strong> ${formatDisplayDate(pack.startDate)} - ${pack.endDate ? formatDisplayDate(pack.endDate) : 'No end date'}
                </div>
                
                ${resultSection}
                
                ${actionButton}
            </div>
        `;
    }).join('');

    grid.innerHTML = html;
}

function updateDrawingStats() {
    const now = new Date();
    const availablePacks = prizePacks.filter(pack => {
        const startDate = new Date(pack.startDate);
        const endDate = pack.endDate ? new Date(pack.endDate) : new Date(Date.now() + 365*24*60*60*1000);
        
        // Show packs that are either currently active, or recently ended (within 30 days)
        const thirtyDaysAgo = new Date(now.getTime() - 30*24*60*60*1000);
        const thirtyDaysFromNow = new Date(now.getTime() + 30*24*60*60*1000);
        
        return (startDate <= thirtyDaysFromNow && endDate >= thirtyDaysAgo);
    });

    const totalEligible = availablePacks.reduce((sum, pack) => {
        return sum + (pack.multientry ? 
            getMultiEligible(donations, pack).length : 
            getEligibleCumulative(donations, pack).length);
    }, 0);

    document.getElementById('availableDrawings').textContent = availablePacks.length;
    document.getElementById('totalEligibleDonors').textContent = totalEligible;
    document.getElementById('completedDrawings').textContent = drawingHistory.length;
    
    // Calculate total prize value (simplified)
    const totalValue = availablePacks.reduce((sum, pack) => sum + (pack.draws * 50), 0); // Estimate $50 per draw
    document.getElementById('totalPrizeValue').textContent = `$${totalValue}`;
}

// New Drawing Functions for Multiple Pack Management
function runAllDrawings() {
    const now = new Date();
    const availablePacks = prizePacks.filter(pack => {
        const startDate = new Date(pack.startDate);
        const endDate = pack.endDate ? new Date(pack.endDate) : new Date(Date.now() + 365*24*60*60*1000);
        
        // Show packs that are either currently active, or recently ended (within 30 days)
        const thirtyDaysAgo = new Date(now.getTime() - 30*24*60*60*1000);
        const thirtyDaysFromNow = new Date(now.getTime() + 30*24*60*60*1000);
        
        return (startDate <= thirtyDaysFromNow && endDate >= thirtyDaysAgo);
    });

    if (availablePacks.length === 0) {
        alert('No prize packs available for drawing.');
        return;
    }

    let totalDrawings = 0;
    let totalWinners = 0;
    let packsWithNoEligible = 0;

    availablePacks.forEach(pack => {
        const eligibleCount = pack.multientry ? 
            getMultiEligible(donations, pack).length : 
            getEligibleCumulative(donations, pack).length;

        if (eligibleCount > 0) {
            const results = doDrawing(pack, donations);
            allDrawingResults[pack.pack] = {
                pack: pack,
                winners: results.winners,
                timestamp: new Date().toISOString(),
                eligibleCount: results.eligibleCount,
                status: 'drawn'
            };
            drawingStates[pack.pack] = 'drawn';
            totalDrawings++;
            totalWinners += results.winners.length;
        } else {
            // Track packs with no eligible entries
            allDrawingResults[pack.pack] = {
                pack: pack,
                winners: [],
                timestamp: new Date().toISOString(),
                eligibleCount: 0,
                status: 'no_eligible'
            };
            drawingStates[pack.pack] = 'drawn';
            packsWithNoEligible++;
        }
    });

    if (availablePacks.length > 0) {
        autoSave();
        
        // Show detailed results including winners per pack AND packs with no eligible entries
        const resultsHtml = Object.values(allDrawingResults)
            .filter(result => drawingStates[result.pack.pack] === 'drawn')
            .sort((a, b) => {
                // Sort by status: successful drawings first, then no eligible
                if (a.status === 'drawn' && b.status === 'no_eligible') return -1;
                if (a.status === 'no_eligible' && b.status === 'drawn') return 1;
                return a.pack.blockName.localeCompare(b.pack.blockName);
            })
            .map(result => {
                if (result.status === 'no_eligible') {
                    return `
                        <div style="background: rgba(255,193,7,0.1); padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #ff9800;">
                            <h4 style="margin: 0 0 10px 0; color: #333; font-weight: bold;">${result.pack.blockName} (${result.pack.pack})</h4>
                            <div style="background: rgba(255,152,0,0.1); padding: 10px; border-radius: 6px;">
                                <strong>⚠️ No Eligible Entries</strong><br>
                                <div style="color: #e65100; margin-top: 8px;">
                                    No donors met the minimum entry requirement of $${result.pack.minEntryDollars} for this prize pack.
                                </div>
                            </div>
                            <div style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">
                                <strong>Prize:</strong> ${result.pack.itemDescription}<br>
                                <strong>Min Entry:</strong> $${result.pack.minEntryDollars} | 
                                <strong>Type:</strong> ${result.pack.multientry ? 'Multi-entry' : 'Cumulative'}
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #4CAF50;">
                            <h4 style="margin: 0 0 10px 0; color: #333; font-weight: bold;">${result.pack.blockName} (${result.pack.pack})</h4>
                            <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 6px;">
                                <strong>🏆 Winners (${result.winners.length}):</strong><br>
                                ${result.winners.map(w => `
                                    <div style="background: rgba(76,175,80,0.2); padding: 8px; border-radius: 4px; margin: 4px 0; color: #2e7d32;">
                                        <strong>${w.screenName}</strong> - ${w.email}
                                    </div>
                                `).join('')}
                            </div>
                            <div style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">
                                <strong>Prize:</strong> ${result.pack.itemDescription}<br>
                                <strong>Eligible Entries:</strong> ${result.eligibleCount} | 
                                <strong>Type:</strong> ${result.pack.multientry ? 'Multi-entry' : 'Cumulative'}
                            </div>
                        </div>
                    `;
                }
            }).join('');
        
        // Show summary and detailed results in drawing-winners element
        document.getElementById('drawing-winners').innerHTML = `
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4>🎉 All Drawings Complete!</h4>
                <p><strong>Total Packs Processed:</strong> ${availablePacks.length}</p>
                <p><strong>Successful Drawings:</strong> ${totalDrawings}</p>
                <p><strong>Packs with No Eligible Entries:</strong> ${packsWithNoEligible}</p>
                <p><strong>Total Winners:</strong> ${totalWinners}</p>
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            </div>
            ${resultsHtml}
        `;
        
        // Show the results section and scroll to it
        document.getElementById('drawing-interface').style.display = 'none';
        document.getElementById('drawing-results').style.display = 'block';
        
        // Scroll to the results section
        document.getElementById('drawing-results').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        
        renderAvailableDrawings();
        updateDrawingStats();
    } else {
        alert('No eligible donors found for any prize packs.');
    }
}

function conductSingleDrawing(packId) {
    const pack = prizePacks.find(p => p.pack === packId);
    if (!pack) return;

    const eligibleCount = pack.multientry ? 
        getMultiEligible(donations, pack).length : 
        getEligibleCumulative(donations, pack).length;

    if (eligibleCount === 0) {
        alert('No eligible donors for this prize pack.');
        return;
    }

    const results = doDrawing(pack, donations);
    allDrawingResults[packId] = {
        pack: pack,
        winners: results.winners,
        timestamp: new Date().toISOString(),
        eligibleCount: results.eligibleCount
    };
    drawingStates[packId] = 'drawn';

    autoSave();
    renderAvailableDrawings();
    updateDrawingStats();
}

function resetSingleDrawing(packId) {
    delete allDrawingResults[packId];
    delete drawingStates[packId];
    renderAvailableDrawings();
    updateDrawingStats();
}

function resetAllDrawings() {
    allDrawingResults = {};
    drawingStates = {};
    document.getElementById('drawing-interface').style.display = 'none';
    document.getElementById('drawing-results').style.display = 'none';
    document.getElementById('availableDrawingsGrid').style.display = 'grid';
    renderAvailableDrawings();
    updateDrawingStats();
}

function saveAllDrawingResults() {
    const drawnResults = Object.values(allDrawingResults).filter(result => 
        drawingStates[result.pack.pack] === 'drawn'
    );

    if (drawnResults.length === 0) {
        alert('No drawings to save.');
        return;
    }

    // Separate results with winners from those with no eligible entries
    const resultsWithWinners = drawnResults.filter(result => result.winners.length > 0);
    const resultsWithNoEligible = drawnResults.filter(result => result.winners.length === 0);

    // Add all drawn results to history
    drawnResults.forEach(result => {
        drawingHistory.push(result);
        drawingStates[result.pack.pack] = 'saved';
    });

    autoSave();

    // Create CSV content only for results with winners
    let csvContent = 'Prize Pack ID,Prize Pack Name,Winner Username,Winner Email,Drawing Date\n';
    
    resultsWithWinners.forEach(result => {
        result.winners.forEach(winner => {
            const drawingDate = new Date(result.timestamp).toLocaleDateString();
            
            // Escape commas and quotes in CSV fields
            const escapeCSV = (field) => {
                if (field == null) return '';
                const str = String(field);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            };
            
            csvContent += `${escapeCSV(result.pack.pack)},${escapeCSV(result.pack.blockName)},${escapeCSV(winner.screenName)},${escapeCSV(winner.email)},${escapeCSV(drawingDate)}\n`;
        });
    });

    // Create and download the CSV file only if there are winners
    let csvExportMessage = '';
    if (resultsWithWinners.length > 0) {
        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        const exportFileDefaultName = `drawing-results-${new Date().toISOString().split('T')[0]}-${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}.csv`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        csvExportMessage = `<p><strong>Exported to CSV:</strong> ${exportFileDefaultName}</p>`;
    }

    // Show results summary
    const totalWinners = drawnResults.reduce((sum, result) => sum + result.winners.length, 0);
    
    document.getElementById('drawing-winners').innerHTML = `
        <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px;">
            <h4>✅ Results Saved & Exported Successfully!</h4>
            <p><strong>Total Processed:</strong> ${drawnResults.length} drawing(s)</p>
            <p><strong>With Winners:</strong> ${resultsWithWinners.length}</p>
            <p><strong>No Eligible Entries:</strong> ${resultsWithNoEligible.length}</p>
            <p><strong>Total Winners:</strong> ${totalWinners}</p>
            ${csvExportMessage}
            <p><strong>Saved to History:</strong> ${new Date().toLocaleString()}</p>
        </div>
        ${drawnResults.map(result => {
            if (result.status === 'no_eligible') {
                return `
                    <div style="background: rgba(255,193,7,0.1); padding: 10px; border-radius: 6px; margin: 10px 0; border-left: 3px solid #ff9800;">
                        <strong style="color: #333;">${result.pack.blockName}:</strong> 
                        <span style="color: #e65100;">No eligible entries</span>
                    </div>
                `;
            } else {
                return `
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 6px; margin: 10px 0;">
                        <strong style="color: #333;">${result.pack.blockName}:</strong> 
                        ${result.winners.map(w => w.screenName).join(', ')}
                    </div>
                `;
            }
        }).join('')}
    `;

    document.getElementById('drawing-interface').style.display = 'none';
    document.getElementById('drawing-results').style.display = 'block';
}

// Legacy function updates for compatibility
function selectPackForDrawing(packId) {
    conductSingleDrawing(packId);
}

function startNewDrawing() {
    resetAllDrawings();
}

function cancelDrawing() {
    resetAllDrawings();
}

function conductDrawing() {
    // Legacy function - now handled by individual drawings
    alert('Please use individual drawing buttons for each prize pack.');
}

function saveDrawingResults() {
    saveAllDrawingResults();
}

function showDrawingInterface() {
    // This function is no longer needed with the new multi-pack approach
}

function showDrawingResults() {
    // This function is no longer needed with the new multi-pack approach
}

// Override render functions to include auto-save
const originalRenderPrizePacks = renderPrizePacks;
renderPrizePacks = function() {
    originalRenderPrizePacks();
    autoSave();
};

const originalRenderDonations = renderDonations;
renderDonations = function() {
    originalRenderDonations();
    autoSave();
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Load schemas for validation
    await loadSchemas();
    
    // Load saved data
    const savedPrizePacks = localStorage.getItem('prizePacks');
    if (savedPrizePacks) {
        try {
            prizePacks = JSON.parse(savedPrizePacks);
        } catch (e) {
            console.error('Error loading saved prize packs:', e);
        }
    }

    const savedDonations = localStorage.getItem('donations');
    if (savedDonations) {
        try {
            donations = JSON.parse(savedDonations);
        } catch (e) {
            console.error('Error loading saved donations:', e);
        }
    }

    const savedDrawingHistory = localStorage.getItem('drawingHistory');
    if (savedDrawingHistory) {
        try {
            drawingHistory = JSON.parse(savedDrawingHistory);
        } catch (e) {
            console.error('Error loading saved drawing history:', e);
        }
    }

    const savedDrawingStates = localStorage.getItem('drawingStates');
    if (savedDrawingStates) {
        try {
            drawingStates = JSON.parse(savedDrawingStates);
        } catch (e) {
            console.error('Error loading saved drawing states:', e);
        }
    }

    const savedAllDrawingResults = localStorage.getItem('allDrawingResults');
    if (savedAllDrawingResults) {
        try {
            allDrawingResults = JSON.parse(savedAllDrawingResults);
        } catch (e) {
            console.error('Error loading saved drawing results:', e);
        }
    }
    
    // Render initial state
    renderPrizePacks();
    updatePrizePackStats();
    renderDonations();
    updateDonationStats();
    renderAvailableDrawings();
    updateDrawingStats();
    setupDragAndDrop();

    // Form Handlers
    document.getElementById('prizepackEditForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (currentEditIndex === -1 || currentEditType !== 'prizepack') return;
        
        const pack = prizePacks[currentEditIndex];
        pack.pack = document.getElementById('editPack').value;
        pack.block = document.getElementById('editBlock').value;
        pack.blockName = document.getElementById('editBlockName').value;
        pack.itemDescription = document.getElementById('editItemDescription').value;
        pack.startDate = new Date(document.getElementById('editStartDate').value).toISOString();
        
        const endDateValue = document.getElementById('editEndDate').value;
        pack.endDate = endDateValue ? new Date(endDateValue).toISOString() : null;
        
        pack.minEntryDollars = parseFloat(document.getElementById('editMinEntryDollars').value);
        pack.draws = parseInt(document.getElementById('editDraws').value);
        pack.multientry = document.getElementById('editMultientry').checked;
        
        // Validate the updated prize pack
        const validation = validateSingleItem(pack, 'prizepack');
        if (!validation.isValid) {
            showValidationErrors(validation.errors, 'Prize Pack', pack.blockName);
            // Continue anyway - this is just a warning
        }
        
        renderPrizePacks();
        updatePrizePackStats();
        closePrizePackModal();
    });

    document.getElementById('donationEditForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (currentEditIndex === -1 || currentEditType !== 'donation') return;
        
        const donation = donations[currentEditIndex];
        donation.time = new Date(document.getElementById('editTime').value).toISOString();
        donation.screenName = document.getElementById('editScreenName').value;
        donation.email = document.getElementById('editEmail').value;
        donation.userId = parseInt(document.getElementById('editUserId').value);
        donation.amount = parseFloat(document.getElementById('editAmount').value);
        
        // Validate the updated donation
        const validation = validateSingleItem(donation, 'donation');
        if (!validation.isValid) {
            showValidationErrors(validation.errors, 'Donation', donation.screenName);
            // Continue anyway - this is just a warning
        }
        
        filterDonations();
        updateDonationStats();
        closeDonationModal();
    });

    // Close modals when clicking outside
    document.getElementById('prizepackEditModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closePrizePackModal();
        }
    });

    document.getElementById('donationEditModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeDonationModal();
        }
    });

    document.getElementById('userSummaryModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeUserSummary();
        }
    });

    // Load schemas for validation
    loadSchemas();
});

// Make functions global for HTML event handlers
window.loadSampleData = loadSampleData;
window.switchTab = switchTab;
window.addNewPrizePack = addNewPrizePack;
window.exportPrizePackData = exportPrizePackData;
window.clearAllPrizePacks = clearAllPrizePacks;
window.deletePrizePack = deletePrizePack;
window.editPrizePack = editPrizePack;
window.addNewDonation = addNewDonation;
window.exportDonationData = exportDonationData;
window.showUserSummary = showUserSummary;
window.clearAllDonations = clearAllDonations;
window.clearDateFilter = clearDateFilter;
window.deleteDonation = deleteDonation;
window.editDonation = editDonation;
window.runAllDrawings = runAllDrawings;
window.resetAllDrawings = resetAllDrawings;
window.showDrawingHistory = showDrawingHistory;
window.conductDrawing = conductDrawing;
window.cancelDrawing = cancelDrawing;
window.saveDrawingResults = saveDrawingResults;
window.startNewDrawing = startNewDrawing;
window.conductSingleDrawing = conductSingleDrawing;
window.resetSingleDrawing = resetSingleDrawing;
