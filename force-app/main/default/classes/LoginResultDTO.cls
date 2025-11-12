public class LoginResultDTO {
    @AuraEnabled public Boolean ok;
    @AuraEnabled public String message;
    @AuraEnabled public String displayName;

    public LoginResultDTO() {}

    public static LoginResultDTO success(String name) {
        LoginResultDTO loginResult = new LoginResultDTO();
        loginResult.ok = true;
        loginResult.displayName = name;
        return loginResult;
    }

    public static LoginResultDTO fail(String message) {
        LoginResultDTO loginResult = new LoginResultDTO();
        loginResult.ok = false;
        loginResult.message = message;
        return loginResult;
    }
}
