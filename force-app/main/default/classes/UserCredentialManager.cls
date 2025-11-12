public with sharing class UserCredentialManager {

    // ===== Helpers =====
    private static String sha256(String input) {
        return EncodingUtil.convertToHex(
            Crypto.generateDigest('SHA-256', Blob.valueOf(input))
        );
    }

    // Random numbers
    private static String generateSalt() {
        String seed = String.valueOf(Crypto.getRandomLong())
                    + ':' + String.valueOf(Crypto.getRandomInteger());
        return EncodingUtil.convertToHex(
            Crypto.generateDigest('SHA-256', Blob.valueOf(seed))
        );
    }

    // ===== Registration =====
    /**
     * Creates a new credentials record with salted+hashed password.
     * @param username Unique username (User_Credentials__c.Username__c)
     * @param password Plain password (will NOT be stored)
     * @param displayName Optional display name for UI
     */
    @AuraEnabled
    public static String register(String username, String password, String displayName) {
        if (String.isBlank(username) || String.isBlank(password)) {
            throw new AuraHandledException('Username and password are required');
        }

        Boolean exists = ![
            SELECT Id
            FROM User_Credentials__c
            WHERE Username__c = :username
            LIMIT 1
        ].isEmpty();

        if (exists) {
            throw new AuraHandledException('Username already exists');
        }

        String salt = generateSalt();
        String hash = sha256(salt + password);

        User_Credentials__c rec = new User_Credentials__c(
            Username__c      = username,
            Password_Salt__c = salt,
            Password_Hash__c = hash,
            Display_Name__c  = String.isBlank(displayName) ? username : displayName
        );
        insert rec;

        return 'OK';
    }

    // ===== Login =====
    /**
     * Validates credentials by recalculating salted hash.
     * @return LoginResultDTO (ok/message/displayName)
     */
    @AuraEnabled
    public static LoginResultDTO login(String username, String password) {
        List<User_Credentials__c> listRec = [
            SELECT Display_Name__c, Password_Salt__c, Password_Hash__c
            FROM User_Credentials__c
            WHERE Username__c = :username
            LIMIT 1
        ];

        if (listRec.isEmpty()) {
            return LoginResultDTO.fail('Invalid username or password');
        }

        User_Credentials__c u = listRec[0];
        String calc = sha256(u.Password_Salt__c + password);

        if (calc != u.Password_Hash__c) {
            return LoginResultDTO.fail('Invalid username or password');
        }

        return LoginResultDTO.success(u.Display_Name__c);
    }
}
