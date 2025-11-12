import { LightningElement, wire, track, api } from 'lwc'; // <-- 1. ДОБАВЬ 'api'
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

// --- Apex Imports ---
import getBooks from '@salesforce/apex/LibraryController.getBooks';
import deleteBooks from '@salesforce/apex/LibraryController.deleteBooks';


// --- Consts for Datatable ---
const ACTIONS = [
    { label: 'Edit', name: 'edit' },
    { label: 'Delete', name: 'delete' },
];

const COLS = [
    { label: 'Book Title', fieldName: 'Name', type: 'text' },
    { label: 'Genre', fieldName: 'Book_Genre__c', type: 'text' },
    { 
        label: 'Author', 
        fieldName: 'AuthorName', 
        type: 'text' 
    },
    { type: 'action', typeAttributes: { rowActions: ACTIONS } }
];

export default class BookList extends LightningElement {
    columns = COLS;
    
    @track titleFilter = '';
    @track authorFilter = '';
    @track books = [];
    wiredBooksResult; 
    
    isEditModalOpen = false;
    currentBookId = '';

    @track selectedBookIds = [];

    @api
    refresh() {
        return refreshApex(this.wiredBooksResult);
    }

    // =================================================================
    // GETTERS
    // =================================================================

    /**
     * @description Getters for blocking "Delete Selected" button
     * The 'Delete Selected' button will remain inactive until at least one element is selected
     */
    get isDeleteButtonDisabled() {
        return this.selectedBookIds.length === 0;
    }

    // --- Get books ---
    @wire(getBooks, { titleFilter: '$titleFilter', authorFilter: '$authorFilter' })
    wiredBooks(result) {
        this.wiredBooksResult = result; 
        if (result.data) {
            this.books = result.data.map(book => {
                let authorName = book.Author__r ? book.Author__r.Name : 'N/A';
                return { ...book, AuthorName: authorName };
            });
        } else if (result.error) {
            this.showToast('Error', 'Failed to load the list of books.', 'error');
            this.books = [];
        }
    }

    // === Method is needed for export ===
    /**
     * @description Return books that already stored in child component
     * @returns {Array} Array of books.
     */
    @api
    getBookData() {
        return this.books;
    }

    // --- Fires on row selection (Checkbox) ---
    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows;
        
        // Transform this array to an array of IDs
        this.selectedBookIds = selectedRows.map(row => row.Id);

    }

    // --- Logic for "Delete Selected" Button ---
    async handleDeleteSelectedBooks() {

        if (this.selectedBookIds.length === 0) {
            this.showToast('Info', 'Please select books to delete first.', 'info');
            return;
        }

        // User Confirmation
        const bookCount = this.selectedBookIds.length;
        if (!confirm(`Are you sure you want to delete ${bookCount} ${bookCount === 1 ? 'book' : 'books'}?`)) {
            return;
        }

        // Apex
        try {

            await deleteBooks({ bookIds: this.selectedBookIds });

            this.showToast('Success', `${bookCount} ${bookCount === 1 ? 'book deleted' : 'books deleted'}.`, 'success');

            // Clearing and unckeck checkboxes 
            this.selectedBookIds = [];
            this.template.querySelector('lightning-datatable').selectedRows = [];
            
            // Update data
            return refreshApex(this.wiredBooksResult); 

        } catch (error) {
            this.showToast('Error while deleting.', error.body.message, 'error');
        }
    }

    // --- Title and Author Filters logic ---
    handleFilterChange(event) {
        const filterName = event.target.name;
        const value = event.target.value;

        if (filterName === 'titleFilter') {
            this.titleFilter = value;
        } 
        else if (filterName === 'authorFilter') {
            this.authorFilter = value;
        }
    }

    // --- Logic for (Edit / Delete) Action in table ---
    async handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        
        if (actionName === 'edit') {
            this.currentBookId = row.Id; 
            this.isEditModalOpen = true;
        } 
        else if (actionName === 'delete') {
            if (!confirm(`Are you sure you want to delete the book "${row.Name}"?`)) {
                return;
            }
            
            try {
                await deleteBook({ bookId: row.Id });
                this.showToast('Success', `Book "${row.Name}" deleted.`, 'success');
                return refreshApex(this.wiredBooksResult); 

            } catch (error) {
                this.showToast('Error while deleting.', error.body.message, 'error');
            }
        }
    }

    // --- Logic for "Edit" modal ---
    closeEditModal() {
        this.isEditModalOpen = false;
    }

    handleEditSuccess() {
        this.showToast('Success', 'Book updated', 'success');
        this.closeEditModal();
        return refreshApex(this.wiredBooksResult); 
    }

    // --- UTILS ---
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant 
        });
        this.dispatchEvent(event);
    }
}