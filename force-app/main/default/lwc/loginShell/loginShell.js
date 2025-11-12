import { LightningElement } from 'lwc';

// --- Apex Imports ---
import register from '@salesforce/apex/UserCredentialManager.register';
import login from '@salesforce/apex/UserCredentialManager.login';

const strongPassword = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[a-z]).{12,}$/;


export default class LoginShell extends LightningElement {

  isLoggedIn = false;
  isSignUp = false;
  error = '';
  displayName = '';
  username = '';
  password = '';
  displayNameInput = '';

  connectedCallback() {
    this.isLoggedIn = sessionStorage.getItem('demo_logged_in') === '1';
    this.displayName = sessionStorage.getItem('demo_display_name') || '';
  }

  get formTitle(){
    return this.isSignUp ? 'Sign up' : 'Log in';
  }
  get primaryCta(){
    return this.isSignUp ? 'Create account' : 'Log in';
  }
  get switchCta(){
    return this.isSignUp ? 'Have an account? Log in' : 'No account? Sign up';
  }

  toggleMode() {
    this.isSignUp = !this.isSignUp;
    this.error = '';
  }
 
  handleUsername(event){
    this.username = event.target.value;
  }
  handlePassword(event){
    this.password = event.target.value;
  }
  handleDisplayName(event){
    this.displayNameInput = event.target.value;
  }

  async handleSubmit() {
    this.error = '';

    try {
      if (!this.username || !this.password) {
        this.error = 'Username and password are required';
        return;
      }

      if (!strongPassword.test(this.password)) {
        this.error = 'Password must include at least one uppercase, digit and be at least 12 characters long';
        return;
      }

      if (this.isSignUp) {
        await register({
          username: this.username,
          password: this.password,
          displayName: this.displayNameInput
        });
      }

      const result = await login({ username: this.username, password: this.password });

      if (result.ok) {
        this.isLoggedIn = true;
        this.displayName = result.displayName || this.username;
        sessionStorage.setItem('demo_logged_in', '1');
        sessionStorage.setItem('demo_display_name', this.displayName);
      } else {
        this.error = result.message || 'Login failed';
      }

    } catch (e) {
      this.error = e?.body?.message || 'Unexpected error';
    }
  }

  handleLogout() {
    sessionStorage.removeItem('demo_logged_in');
    sessionStorage.removeItem('demo_display_name');

    this.isLoggedIn = false;
    this.displayName = '';
    this.username = '';
    this.password = '';
    this.displayNameInput = '';
    this.error = '';
  }
}