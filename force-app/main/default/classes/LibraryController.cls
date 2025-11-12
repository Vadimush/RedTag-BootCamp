/**
 * @description Controller for the libraryManager LWC.
 * Handles DML operations and logic for Library-related objects.
 * 'with sharing' ensures default sharing rules are enforced.
 */
public with sharing class LibraryController {

    /**
     * @description Creates one or more Author__c records.
     * @param authorsToInsert List of authors to insert, received from LWC.
     * @throws AuraHandledException if duplicates are found or a DML error occurs.
     */
    @AuraEnabled
    public static void createAuthors(List<Author__c> authorsToInsert) {
        
        if (authorsToInsert.isEmpty()) {
            throw new AuraHandledException('Author list is empty. Nothing to save.');
        }

        // --- Validation: Check for duplicates ---
        Set<String> authorNames = new Set<String>();
        for (Author__c author : authorsToInsert) {
            authorNames.add(author.Name);
        }

        // Finding existing names (duplicates)
        List<Author__c> existingAuthors = [
            SELECT Name 
            FROM Author__c 
            WHERE Name IN :authorNames
        ];

        // If the list is NOT empty, duplicates were found
        if (!existingAuthors.isEmpty()) {
            Set<String> existingNames = new Set<String>();
            for (Author__c existing : existingAuthors) {
                existingNames.add(existing.Name);
            }
            
            String errorMsg = 'Cannot create authors. The following authors already exist: ' + String.join(existingNames, ', ');
            throw new AuraHandledException(errorMsg);
        }

        try {
            insert authorsToInsert;

        } catch (DmlException e) {
            // If another validation rule, system field, etc., was triggered
            throw new AuraHandledException(e.getDmlMessage(0));
        } catch (Exception e) {
            // Any other unexpected error
            throw new AuraHandledException(e.getMessage());
        }
    }


    /**
     * @description Creates one or more Book__c records.
     * @param booksToInsert List of books to insert.
     * @throws AuraHandledException if required fields are missing.
     */
    @AuraEnabled
    public static void createBooks(List<Book__c> booksToInsert) {
        
        if (booksToInsert.isEmpty()) {
            throw new AuraHandledException('Book list is empty. Nothing to save.');
        }

        for (Book__c book : booksToInsert) {
            if (String.isBlank(book.Name) || String.isBlank(book.Author__c)) {
                throw new AuraHandledException('Name and Author are required for all rows.');
            }
        }

        try {
            insert booksToInsert;
        } catch (DmlException e) {
            throw new AuraHandledException(e.getDmlMessage(0));
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Gets a list of books filtered by title and author name.
     * @param titleFilter  String to search by Book__c.Name
     * @param authorFilter String to search by Author__c.Name
     * @return List<Book__c>
     */
    @AuraEnabled(cacheable=true)
    public static List<Book__c> getBooks(String titleFilter, String authorFilter) {
        
        // --- Prepare search keys ---
        String titleKey = '%' + (String.isBlank(titleFilter) ? '' : titleFilter) + '%';
        String authorKey = '%' + (String.isBlank(authorFilter) ? '' : authorFilter) + '%';

        return [
            SELECT Id, Name, Book_Genre__c, Author__r.Name 
            FROM Book__c
            WHERE (Name LIKE :titleKey) AND (Author__r.Name LIKE :authorKey)
            ORDER BY Name ASC
            LIMIT 100
        ];
    }

/**
 * @description Deletes a LIST of Book__c records by their IDs.
 * @param bookIds List of book IDs to delete.
 * @throws AuraHandledException if the list is empty or a DML error occurs.
 */
@AuraEnabled
public static void deleteBooks(List<String> bookIds) {
    
    if (bookIds.isEmpty()) {
        throw new AuraHandledException('Book ID list is empty. Nothing to delete.');
    }

    try {
        // Query the records to ensure they exist
        List<Book__c> booksToDelete = [
            SELECT Id 
            FROM Book__c 
            WHERE Id IN :bookIds
        ];

        if (!booksToDelete.isEmpty()) {
            delete booksToDelete;
        }

    } catch (DmlException e) {
        throw new AuraHandledException(e.getDmlMessage(0));
    } catch (Exception e) {
        throw new AuraHandledException(e.getMessage());
    }
}

    /**
    * @description Cascade delete: deletes all books by an author,
    * and then deletes the author.
    * @param authorId The ID of the author to delete.
    * @throws AuraHandledException if the ID is blank or a DML error occurs.
    */
   @AuraEnabled
   public static void deleteAuthorAndBooks(String authorId) {
       
       if (String.isBlank(authorId)) {
           throw new AuraHandledException('Author ID not provided. Nothing to delete.');
       }

       try {
           // --- First, delete the Children (Books) ---
           List<Book__c> booksToDelete = [
               SELECT Id 
               FROM Book__c 
               WHERE Author__c = :authorId
           ];

           if (!booksToDelete.isEmpty()) {
               delete booksToDelete;
           }

           // --- 2. Then, delete the Parent (Author) ---
           Author__c authorToDelete = new Author__c(Id = authorId);
           delete authorToDelete;

       } catch (DmlException e) {
           throw new AuraHandledException(e.getDmlMessage(0));
       } catch (Exception e) {
           throw new AuraHandledException(e.getMessage());
       }
   }
}