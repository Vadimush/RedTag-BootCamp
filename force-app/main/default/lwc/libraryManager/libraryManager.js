import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';

// --- Schema Imports ---
import BOOK_OBJECT from '@salesforce/schema/Book__c';
import GENRE_FIELD from '@salesforce/schema/Book__c.Book_Genre__c';

// --- Apex Imports ---
import createAuthors from '@salesforce/apex/LibraryController.createAuthors';
import createBooks from '@salesforce/apex/LibraryController.createBooks';
import deleteAuthorAndBooks from '@salesforce/apex/LibraryController.deleteAuthorAndBooks';

export default class LibraryManager extends LightningElement {
    
    // === "Add Author" ===
    isAddAuthorModalOpen = false;
    @track authorsToCreate = []; 
    
    // === "Add Book" ===
    isAddBookModalOpen = false;
    @track booksToCreate = [];
    genreOptions = [];  
    defaultBookRecordTypeId; 
    
    // === "Delete Author" ===
    isDeleteAuthorModalOpen = false;
    authorToDeleteId = null;

    // ---lightning-record-picker ---
    authorMatchInfo = {
        primaryField: { fieldApiName: 'Name' }
    };
    authorDisplayInfo = {
        primaryField: 'Name'
    };

    // =================================================================
    // GETTERS
    // =================================================================
    
    // Also block "Delete", while Author not choosen 
    get isDeleteButtonDisabled() {
        return !this.authorToDeleteId;
    }

    // =================================================================
    // WIREs
    // =================================================================
    
    @wire(getObjectInfo, { objectApiName: BOOK_OBJECT })
    wiredBookObjectInfo({ error, data }){
        if (data){
            this.defaultBookRecordTypeId = data.defaultRecordTypeId;
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$defaultBookRecordTypeId', fieldApiName: GENRE_FIELD })
    wiredGenrePicklist({ error, data }){
        if (data){
            this.genreOptions = data.values.map(plValue => ({ label: plValue.label, value: plValue.value }));
        }
    }

    // ===========================================================================
    // General Modal Close method. Can be use to close any modal from this package
    // ===========================================================================

    handleModalClose(){
        // Add Author
        this.isAddAuthorModalOpen = false;
        this.authorsToCreate = []; 
        // Add Book
        this.isAddBookModalOpen = false;
        this.booksToCreate = [];
        // Delete Author
        this.isDeleteAuthorModalOpen = false;
        this.authorToDeleteId = null;
    }

    // =================================================================
    // "EXPORT" LOGIC
    // =================================================================

    /**
     * Handles the "Export Books" button click.
     * 1. Requests data from the child component c-book-list.
     * 2. Converts the data to CSV format.
     * 3. Triggers the download.
     */
    handleExportClick() {
        // 1. Request data from the child component
        const bookData = this.template.querySelector('c-book-list').getBookData();

        if (bookData.length === 0) {
            this.showToast('No Data', 'No data to export.', 'info');
            return;
        }

        // 2. Prepare CSV
        
        // Headers
        const headers = ['Book Name', 'Author', 'Genre'];
        
        let csvLines = [];
        csvLines.push(headers.join(',')); // Add the header row

        // Iterate over each book and format the row
        bookData.forEach(book => {
            let row = [];
            // Data structure: { Id, Name, Book_Genre__c, Author__r.Name }

            // Use formatCsvCell for safety (e.g., if a name contains a comma)
            row.push(this.formatCsvCell(book.Name));
            row.push(this.formatCsvCell(book.Author__r ? book.Author__r.Name : '')); // Check in case the author data wasn't retrieved
            row.push(this.formatCsvCell(book.Book_Genre__c));
            
            csvLines.push(row.join(','));
        });

        const csvString = csvLines.join('\n');

        // 3. Trigger the download
        this.downloadCsv(csvString, 'book-list.csv');
    }

    /**
     * Utility: Safely formats a cell for CSV.
     * Wraps in quotes if it contains commas, quotes, or newlines.
     */
    formatCsvCell(value) {
        if (value == null) {
            return '""'; // Handle null or undefined value
        }
        
        let cell = value.toString();
        
        // 1. Double up any existing quotes
        cell = cell.replace(/"/g, '""');
        
        // 2. Wrap in quotes if it contains a comma, quote, newline, or space
        if (cell.search(/("|,|\n|\s)/g) >= 0) {
            cell = `"${cell}"`;
        }
        
        return cell;
    }

    /**
     * Utility: Creates a "virtual" file and triggers its download.
     */
    downloadCsv(csvData, fileName) {
        // Create an invisible 'a' (link) element
        const hiddenElement = document.createElement('a');
        
        // Important: \ufeff (BOM - Byte Order Mark) is needed
        // for Excel to correctly recognize UTF-8 encoding (e.g., for Cyrillic characters).
        const bom = '\ufeff';
        hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(bom + csvData);
        hiddenElement.target = '_blank';
        hiddenElement.download = fileName;
        
        // Add the link to the DOM, "click" it, and then immediately remove it
        document.body.appendChild(hiddenElement);
        hiddenElement.click();
        document.body.removeChild(hiddenElement);
    }

    // =================================================================
    // Logic for button "ADD AUTHOR"
    // =================================================================
    handleAddAuthor() {
        this.isAddAuthorModalOpen = true;
        if (this.authorsToCreate.length === 0){
            this.handleAddAuthorRow();
        } 
    }
    handleAddAuthorRow() {
        const newId = new Date().getTime(); 
        this.authorsToCreate.push({ tempId: newId, Name: '', Pseudonyms__c: '', Date_of_Birth__c: null });
    }
    handleRemoveAuthorRow(event) {
        const rowIdToRemove = event.target.dataset.id;
        this.authorsToCreate = this.authorsToCreate.filter(author => author.tempId != rowIdToRemove);
        if (this.authorsToCreate.length === 0){
            this.handleAddAuthorRow();
        } 
    }
    handleAuthorChange(event) {
        const rowId = event.target.dataset.id;
        const fieldApiName = event.target.name; 
        const value = event.target.value;
        let authorRow = this.authorsToCreate.find(author => author.tempId == rowId);
        if (authorRow){
            authorRow[fieldApiName] = value;
        } 
    }
    async handleSaveAuthors() {
        let hasInvalidRow = false;
        this.authorsToCreate.forEach(author => {
            if (!author.Name || author.Name.trim() === ''){
                hasInvalidRow = true;
            }
        });
        if (hasInvalidRow){
            this.showToast('Validation Error', 'Author Name is required.', 'error');
            return;
        }

        const authorsForApex = this.authorsToCreate.map(author => {
            const { tempId, ...cleanAuthor } = author; 
            return cleanAuthor;
        });
        try {
            await createAuthors({ authorsToInsert: authorsForApex });
            this.showToast('Success', 'New authors created successfully.', 'success');
            this.handleModalClose();
            this.template.querySelector('c-book-list').refresh();
        } catch (error) {
            this.showToast('Error creating authors', error.body.message, 'error');
        } 
    }
    
    // =================================================================
    // Logic for button "ADD BOOK"
    // =================================================================
    handleAddBook() { 
        this.isAddBookModalOpen = true;
        if (this.booksToCreate.length === 0){
            this.handleAddBookRow();
        }
    }
    handleAddBookRow() {
        const newId = new Date().getTime(); 
        this.booksToCreate.push({ tempId: newId, Name: '', Book_Genre__c: '', Author__c: null });
    }
    handleRemoveBookRow(event) {
        const rowIdToRemove = event.target.dataset.id;
        this.booksToCreate = this.booksToCreate.filter(book => book.tempId != rowIdToRemove);
        if (this.booksToCreate.length === 0){
            this.handleAddBookRow();
        } 
    }
    handleBookChange(event) {
        const rowId = event.target.dataset.id;
        const fieldApiName = event.target.name; 
        const value = (fieldApiName === 'Author__c') 
                      ? event.detail.recordId
                      : event.target.value;
        let bookRow = this.booksToCreate.find(book => book.tempId == rowId);
        if (bookRow){
            bookRow[fieldApiName] = value;
        }
    }
    async handleSaveBooks() {
        let hasInvalidRow = false;
        this.booksToCreate.forEach(book => {
            if (!book.Name || book.Name.trim() === '' || !book.Author__c){
                hasInvalidRow = true;
            }
        });
        if (hasInvalidRow){
            this.showToast('Validation Error', 'Book Name and Author are required.', 'error');
            return;
        }
        
        const booksForApex = this.booksToCreate.map(book => {
            const { tempId, ...cleanBook } = book; 
            return cleanBook;
        });
        try {
            await createBooks({ booksToInsert: booksForApex });
            this.showToast('Success', 'New books created successfully.', 'success');
            this.handleModalClose();
            this.template.querySelector('c-book-list').refresh();
        } catch (error) {
            this.showToast('Error creating books', error.body.message, 'error');
        }
    }


    handleDeleteAuthor() { 
        this.isDeleteAuthorModalOpen = true;
    }

    handleAuthorToDeleteChange(event) {
        this.authorToDeleteId = event.detail.recordId;
    }


    async handleConfirmDeleteAuthor(){
        if (!this.authorToDeleteId){
            this.showToast('Error', 'Please select an author to delete.', 'error');
            return;
        }

        try {
            await deleteAuthorAndBooks({ authorId: this.authorToDeleteId });
            
            this.showToast('Success', 'Author and all their books have been deleted.', 'success');
            this.handleModalClose();
            this.template.querySelector('c-book-list').refresh();

        } catch (error) {
            this.showToast('Error deleting author', error.body.message, 'error');
        }
    }

    // =================================================================
    // UTILS
    // =================================================================
    showToast(title, message, variant) {
        const event = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(event);
    }
}